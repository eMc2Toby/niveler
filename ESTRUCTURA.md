# Niveler — Sistema web de inventario multi-sucursal
### Estructura completa del proyecto

---

## 1. Stack definitivo

| Capa | Tecnología | Por qué esta y no otra |
|---|---|---|
| Interfaz | **React 18 + Vite + TypeScript** | Vite compila rápido y TypeScript evita el 80% de los errores tontos cuando el proyecto crece |
| Uso móvil | **Diseño web responsive** | Funciona desde el navegador del celular sin una aplicación adicional |
| Base de datos | **PostgreSQL (Supabase)** | Transacciones reales: o se registra la venta completa o no se registra nada |
| Backend | **PostgREST + funciones RPC de Supabase** | Stock y permisos viven junto a PostgreSQL |
| Archivos | **Supabase Storage** | Bucket de productos protegido por políticas ligadas a los roles existentes |
| Conectividad | **Solo en línea** | Cada lectura y escritura se confirma directamente con Supabase |
| Autenticación | **Supabase Auth** | Login por email, recuperación de contraseña y sesiones ya resueltos |
| Permisos | **Row Level Security (RLS)** | El permiso vive en la base, no en el frontend |
| Estilos | **Tailwind CSS** | Consistencia sin escribir CSS suelto |
| Datos en pantalla | **TanStack Query** | Caché, reintentos y refresco automático |
| Gráficos | **Recharts** | Ligero y suficiente para el dashboard |
| Formularios | **React Hook Form + Zod** | Validación idéntica en cliente y servidor |
| Código | **Git + GitHub** | Historial y respaldo |
| Despliegue web | **Cloudflare Workers Static Assets** | SPA con fallback de rutas en la red de Cloudflare |

Supabase concentra autenticación, datos, funciones transaccionales e imágenes.
No hay un servidor adicional que desplegar o mantener.

---

## 2. La decisión que sostiene todo el sistema

Lo más difícil de tu caso no son las siete ciudades: son los **deliveries**. Un repartidor que sale con 20 unidades tiene stock real en su poder, vende en la calle, devuelve lo que sobra y a veces le pasa mercadería a otro repartidor. Modelarlo mal genera descuadres imposibles de rastrear.

**La solución: todo lo que puede tener stock es una `ubicación`.**

```
ubicaciones
├── SUCURSAL   → las 7 bodegas
├── DELIVERY   → una por repartidor
├── TRANSITO   → mercadería enviada que aún no llega
├── MERMA      → roturas, pérdidas, faltantes
├── PROVEEDOR  → contraparte de las compras
└── CLIENTE    → contraparte de las ventas
```

Con esto, **todo movimiento es siempre origen → destino**, sin excepciones:

| Operación | Origen | Destino |
|---|---|---|
| Compra | PROVEEDOR | Sucursal |
| Transferencia entre ciudades | Sucursal A | TRANSITO → Sucursal B |
| Entrega a repartidor | Sucursal | Delivery |
| Venta del repartidor | Delivery | CLIENTE |
| Devolución de mercadería | Delivery | Sucursal |
| Repartidor pasa a otro | Delivery A | Delivery B |
| Rotura | Sucursal | MERMA |
| Ajuste por conteo | PROVEEDOR o MERMA | Sucursal |

Un solo motor (`sp_confirmar_movimiento`) atiende los ocho casos. No hay lógica especial por tipo, y **la suma de todas las ubicaciones siempre da cero**: si algo falta en un lado, está de sobra en otro. El descuadre se vuelve detectable en lugar de invisible.

**Segunda regla:** el saldo de `inventario` es una consecuencia, no un dato editable. Nadie —ni el admin— hace `UPDATE` sobre el stock. Solo se registran movimientos, y el saldo se recalcula desde ellos. Si alguna vez se sospecha un descuadre, `fn_recalcular_inventario()` reconstruye los 560 saldos desde cero. Esto es exactamente lo que faltaba en el Excel: ahí el saldo se arrastraba a mano y por eso aparecían negativos.

**Tercera regla: el sistema no maneja dinero.** No hay precios, ni totales, ni formas de pago. Una venta responde a tres preguntas —qué producto, cuántas unidades y de qué ubicación salió— y nada más. Esto no es una simplificación provisional: mezclar inventario con facturación obliga a decidir qué precio vale cuando cambió entre el pedido y la entrega, cómo se prorratean descuentos y qué pasa con las anulaciones parciales. Nada de eso hace falta para saber dónde está la mercadería. Si algún día se necesita facturar, se agrega una tabla de precios aparte que referencia a `productos`, sin tocar el motor de stock.

---

## 3. Estructura de carpetas

```
niveler/
├── db/                          ← ejecutar en Supabase, en este orden
│   ├── 01_schema.sql            tablas, tipos, índices
│   ├── 02_vistas.sql            dashboard y reportes
│   ├── 03_funciones.sql         motor de stock y RPCs
│   ├── 04_rls.sql               permisos por rol
│   └── 05_seed.sql              roles, sucursales, migración del Excel
│
├── public/
│   ├── icons/                   icon-192.png, icon-512.png, maskable
│   └── favicon.ico
│
├── src/
│   ├── main.tsx                 punto de entrada de React
│   ├── App.tsx                  rutas y layout
│   │
│   ├── lib/
│   │   ├── supabase.ts          cliente + capa de datos (ya escrito)
│   │   ├── formato.ts           Bs, fechas, cantidades
│   │   └── utils.ts             cn(), helpers
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx          sesión, perfil y rol del usuario
│   │   ├── usePermisos.ts       ¿puede este rol ver este botón?
│   │   ├── useInventario.ts     queries de stock
│   │   └── useRealtime.ts       refresco automático
│   │
│   ├── components/
│   │   ├── ui/                  Boton, Input, Modal, Tabla, Badge, Skeleton
│   │   ├── layout/              Sidebar (PC), BottomNav (móvil), Header
│   │   └── comunes/             SelectorProducto, SelectorUbicacion,
│   │                            EstadoVacio
│   │
│   ├── features/                ← una carpeta por módulo
│   │   ├── auth/                Login, RecuperarPassword, RutaProtegida
│   │   ├── dashboard/           Tarjetas, GraficoVentas, AlertasStock
│   │   ├── productos/           Lista, Formulario, Detalle, Kardex
│   │   ├── inventario/          StockPorSucursal, StockPorDelivery, Conteo
│   │   ├── movimientos/         Registrar, Historial, Detalle
│   │   ├── transferencias/      Crear, Enviar, Recibir, Seguimiento
│   │   ├── ventas/              NuevaVenta, Lista, Detalle
│   │   ├── deliveries/          MiStock, Rendicion, Historial
│   │   ├── clientes/            Lista, Formulario
│   │   ├── sucursales/          Lista, Formulario
│   │   ├── usuarios/            Lista, AsignarRol
│   │   └── reportes/            filtros + exportación a Excel
│   │
│   ├── types/
│   │   └── database.ts          ← generado por Supabase CLI, no editar
│   │
│   └── styles/globals.css
│
├── .env.example
├── vite.config.ts               configuración de compilación
├── tailwind.config.js
└── package.json
```

**Organización por feature, no por tipo de archivo.** Todo lo de ventas vive en `features/ventas/`. Cuando haya que corregir algo de ventas dentro de seis meses, está todo en una carpeta y no repartido entre `components/`, `pages/` y `services/`.

---

## 4. Mapa de módulos

| # | Módulo | Tablas | Vista / RPC que usa |
|---|---|---|---|
| 1 | Dashboard | — | `v_dashboard_totales`, `v_stock_por_sucursal`, `v_stock_por_delivery`, `v_productos_bajo_stock`, `v_ventas_diarias` |
| 2 | Productos | `productos`, `categorias`, `marcas` | `rpc_crear_producto_con_stock` + `v_stock` + `v_kardex` |
| 3 | Sucursales | `sucursales`, `ubicaciones` | CRUD directo |
| 4 | Inventario | `inventario` | `v_stock` (lectura) · `rpc_ajustar_stock` |
| 5 | Movimientos | `movimientos`, `movimientos_detalle` | `rpc_registrar_movimiento` · `v_kardex` |
| 6 | Deliveries | `deliveries` | `v_stock_por_delivery`, `v_delivery_rendicion` |
| 7 | Ventas | `ventas`, `ventas_detalle`, `clientes`, `cliente_pedidos` | `rpc_registrar_venta_con_pedido` |
| 8 | Transferencias | `transferencias`, `transferencias_detalle` | `rpc_crear_` / `rpc_enviar_` / `rpc_recibir_transferencia` |
| 9 | Encomiendas | `encomiendas` | `rpc_crear_` / `rpc_despachar_` / `rpc_entregar_` / `rpc_anular_encomienda` |
| 10 | Usuarios y roles | `usuarios`, `roles` | CRUD + RLS |
| 11 | Reportes | todas | `v_productos_mas_vendidos`, `v_productos_sin_movimiento`, `v_kardex`, `v_ventas_diarias` |
| — | Auditoría | `auditoria` | automática por trigger |

---

## 5. Roles y qué puede cada uno

Las cuentas no las crea un administrador: **cada persona se registra desde el login** y nace inactiva, sin rol útil. Crear usuarios desde la app exigiría la `service_role` key, que se salta todas las políticas RLS y por eso no puede vivir en el navegador. El administrador aprueba en **Usuarios**, y ahí asigna rol y sucursal.

| Puede | Admin | Gerente | Encargado | Bodega | Ventas | Delivery |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Ver stock y catálogo | sí | sí | sí | sí | sí | sí |
| Registrar ventas | sí | sí | sí | sí | sí | sí |
| Crear y editar clientes | sí | sí | sí | sí | sí | — |
| Movimientos y transferencias | sí | sí | sí | sí | — | — |
| Encomiendas propias o de su sucursal | sí | sí | sí | sí | sí | sí |
| Crear y editar productos | sí | sí | sí | — | — | — |
| Ajustar stock por conteo | sí | sí | sí | — | — | — |
| Anular movimientos y ventas | sí | sí | sí | — | — | — |
| Reportes | sí | sí | sí | — | — | — |
| Ver las 7 ciudades | sí | sí | — | — | — | — |
| Sucursales y usuarios | sí | — | — | — | — | — |
| **Alcance de los datos** | todo | 7 ciudades | su ciudad | su ciudad | su ciudad | su propio stock |

Los niveles numéricos son 100, 80, 60, 40, 30 y 10. Quien solo debe **mirar** es Delivery o Ventas: ninguno puede cargar mercadería ni corregir un saldo, y lo único que mueve stock en sus manos es una venta, que descuenta de su propia ubicación.

**Esto se verifica en tres capas, y las tres importan:**

1. **El menú** oculta lo que no corresponde. Es comodidad, no seguridad.
2. **Las políticas RLS** filtran las filas. Un repartidor que consulte la API directamente recibe solo sus datos.
3. **Las funciones RPC** verifican el nivel por dentro (`09_permisos_rpc.sql`). Esta capa hace falta porque las RPC son `security definer`: se ejecutan con permisos elevados y RLS no las alcanza. Sin ella, cualquier usuario logueado podía llamar a `rpc_ajustar_stock` o `sp_anular_movimiento` contra la API aunque la app no le mostrara el botón.

---

## 6. Pasos para armarlo desde cero

**Base de datos**

1. Crear el proyecto en [supabase.com](https://supabase.com) — región **South America (São Paulo)**, la más cercana a Bolivia.
2. Aplicar en orden las migraciones de `supabase/migrations/` hasta la versión 25.
3. Verificar el bucket de imágenes como indica `ALMACENAMIENTO.md`.
4. Authentication → Users → crear el usuario admin y activarlo con el `update` que está al final de `05_seed.sql`.

Los dos últimos archivos no son opcionales: sin los grants de `08`, un usuario logueado recibe `permission denied` aunque las políticas RLS lo autoricen, y sin `security_invoker` las vistas le muestran a cualquiera el stock de las siete ciudades.

**Frontend**

```bash
npm install
cp .env.example .env   # y completar con la URL y la anon key del proyecto
npm run dev
```

**Tipos automáticos** (evita errores de nombres de columna):

```bash
npx supabase login
npx supabase gen types typescript --project-id TU_ID > src/types/database.ts
```

**Publicar**

```bash
npm run build
```

Aplicar primero las migraciones, configurar `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY`, y recién entonces publicar los assets con Wrangler.
En computadora y celular se utiliza desde un navegador con conexión.

---

## 7. Orden de construcción sugerido

| Fase | Qué se construye | Resultado |
|---|---|---|
| 1 | Auth + layout + productos | Se puede entrar y ver el catálogo |
| 2 | Inventario + movimientos | Ya reemplaza al Excel |
| 3 | Transferencias | Las 7 ciudades conectadas |
| 4 | Ventas + clientes | Se registra lo que sale |
| 5 | Deliveries + rendición | El problema de los repartidores resuelto |
| 6 | Encomiendas | Se rastrean bultos para clientes y entre deliveries |
| 7 | Dashboard + reportes | El gerente ve todo desde el celular |
| 8 | Usuarios, auditoría, exportar Excel | Sistema cerrado |
| 9 | Validación | Pruebas E2E autenticadas y verificación operativa |

**Sugerencia fuerte:** al terminar la fase 2, poner una sola sucursal a trabajar en paralelo con el Excel durante dos semanas. Los errores de modelado aparecen ahí, cuando corregirlos cuesta horas y no meses.

---

## 8. Tres cosas que no hay que hacer

1. **No editar `inventario` desde el frontend.** Solo funciones RPC. Es la única garantía de que el stock nunca se descuadre.
2. **No borrar movimientos.** Se anulan con `sp_anular_movimiento`, que revierte los saldos y deja el rastro. Un inventario sin historial no sirve para auditar.
3. **No poner la `service_role` key en el frontend.** Esa clave se salta todas las políticas RLS. Solo la `anon key`, que es pública por diseño.

---

## 9. Sobre el Excel actual

No conviene importar los 1.589 movimientos históricos. Los saldos ya están validados y cuadrados: se cargan como una entrada inicial por ciudad con fecha de corte, y el archivo viejo queda archivado en Drive como respaldo. El histórico anterior se consulta ahí si alguna vez hace falta; el sistema nuevo arranca limpio y desde el primer día todo movimiento queda registrado con usuario, fecha y motivo.

Los dos productos pendientes de conteo físico (aspiradora en La Paz, foco ventilador en Oruro) se cargan con la cantidad real contada, no con la del Excel.


---

## 10. Almacenamiento e infraestructura

Ver **`ALMACENAMIENTO.md`**: compresión, políticas del bucket, variables y
verificación manual de imágenes.

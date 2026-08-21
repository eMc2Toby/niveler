# Niveler — Sistema de inventario multi-sucursal
### Estructura completa del proyecto (PWA)

---

## 1. Stack definitivo

| Capa | Tecnología | Por qué esta y no otra |
|---|---|---|
| Interfaz | **React 18 + Vite + TypeScript** | Vite compila rápido y TypeScript evita el 80% de los errores tontos cuando el proyecto crece |
| App móvil | **vite-plugin-pwa (Workbox)** | Se instala en el celular como app real, sin tiendas ni Play Store |
| Base de datos | **PostgreSQL (Supabase)** | Transacciones reales: o se registra la venta completa o no se registra nada |
| Backend | **PostgREST + funciones RPC de Supabase** | La API se genera sola desde el esquema. No hay servidor propio que mantener |
| Autenticación | **Supabase Auth** | Login por email, recuperación de contraseña y sesiones ya resueltos |
| Permisos | **Row Level Security (RLS)** | El permiso vive en la base, no en el frontend |
| Estilos | **Tailwind CSS** | Consistencia sin escribir CSS suelto |
| Datos en pantalla | **TanStack Query** | Caché, reintentos y refresco automático |
| Gráficos | **Recharts** | Ligero y suficiente para el dashboard |
| Formularios | **React Hook Form + Zod** | Validación idéntica en cliente y servidor |
| Código | **Git + GitHub** | Historial y respaldo |
| Despliegue | **Cloudflare Pages** | Cada push a `main` publica solo. Gratuito y permite uso comercial |

**Sin FastAPI.** Supabase ya entrega API REST, autenticación y permisos por fila. Agregar FastAPI encima significaría reescribir a mano lo que ya viene funcionando, más un servidor extra que mantener y pagar. Si algún día hace falta lógica que Postgres no cubra (facturación electrónica del SIN, integración con la web de ventas), se agrega un microservicio puntual sin tocar el resto.

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
│   ├── main.tsx                 punto de entrada + registro del service worker
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
│   │                            EstadoVacio, IndicadorOffline
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
├── vite.config.ts               configuración PWA
├── tailwind.config.js
└── package.json
```

**Organización por feature, no por tipo de archivo.** Todo lo de ventas vive en `features/ventas/`. Cuando haya que corregir algo de ventas dentro de seis meses, está todo en una carpeta y no repartido entre `components/`, `pages/` y `services/`.

---

## 4. Mapa de módulos

| # | Módulo | Tablas | Vista / RPC que usa |
|---|---|---|---|
| 1 | Dashboard | — | `v_dashboard_totales`, `v_stock_por_sucursal`, `v_stock_por_delivery`, `v_productos_bajo_stock`, `v_ventas_diarias` |
| 2 | Productos | `productos`, `categorias`, `marcas` | CRUD directo + `v_kardex` |
| 3 | Sucursales | `sucursales`, `ubicaciones` | CRUD directo |
| 4 | Inventario | `inventario` | `v_stock` (lectura) · `rpc_ajustar_stock` |
| 5 | Movimientos | `movimientos`, `movimientos_detalle` | `rpc_registrar_movimiento` · `v_kardex` |
| 6 | Deliveries | `deliveries` | `v_stock_por_delivery`, `v_delivery_rendicion` |
| 7 | Ventas | `ventas`, `ventas_detalle`, `clientes` | `rpc_registrar_venta` |
| 8 | Transferencias | `transferencias`, `transferencias_detalle` | `rpc_crear_` / `rpc_enviar_` / `rpc_recibir_transferencia` |
| 9 | Usuarios y roles | `usuarios`, `roles` | CRUD + RLS |
| 10 | Reportes | todas | `v_productos_mas_vendidos`, `v_productos_sin_movimiento`, `v_kardex`, `v_ventas_diarias` |
| — | Auditoría | `auditoria` | automática por trigger |

---

## 5. Roles y qué ve cada uno

| Rol | Nivel | Alcance |
|---|---|---|
| Administrador | 100 | Todo, incluidos usuarios y configuración |
| Gerente | 80 | Las 7 ciudades, costos, márgenes, anulaciones |
| Encargado de sucursal | 60 | Su ciudad: productos, ajustes, aprobaciones |
| Bodega | 40 | Movimientos y transferencias de su sucursal |
| Ventas | 30 | Registra ventas y clientes de su sucursal |
| Delivery | 10 | Solo su propio stock y sus propias ventas |

Esto no es solo un menú distinto por rol: es RLS en la base. Un repartidor que consulte la API directamente sigue recibiendo únicamente sus datos.

---

## 6. Pasos para armarlo desde cero

**Base de datos (30 minutos)**

1. Crear proyecto en [supabase.com](https://supabase.com) — región São Paulo, la más cercana a Bolivia.
2. SQL Editor → ejecutar `01_schema.sql`, luego `02`, `03`, `04` y `05` en ese orden.
3. Storage → crear bucket público `productos` y subir las imágenes.
4. Authentication → Users → crear el usuario admin y activarlo con el `update` que está al final de `05_seed.sql`.

**Frontend**

```bash
npm create vite@latest niveler -- --template react-ts
cd niveler
npm install
# copiar package.json, vite.config.ts y src/lib/supabase.ts de este paquete
npm install
cp .env.example .env   # y completar con las claves del proyecto
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
# subir a GitHub → conectar el repo en Vercel → agregar las dos variables VITE_
```

Ahí ya se instala en el celular: al abrirla en Chrome aparece "Agregar a la pantalla de inicio".

---

## 7. Orden de construcción sugerido

| Fase | Qué se construye | Resultado |
|---|---|---|
| 1 | Auth + layout + productos | Se puede entrar y ver el catálogo |
| 2 | Inventario + movimientos | Ya reemplaza al Excel |
| 3 | Transferencias | Las 7 ciudades conectadas |
| 4 | Ventas + clientes | Se registra lo que sale |
| 5 | Deliveries + rendición | El problema de los repartidores resuelto |
| 6 | Dashboard + reportes | El gerente ve todo desde el celular |
| 7 | Usuarios, auditoría, exportar Excel | Sistema cerrado |

**Sugerencia fuerte:** al terminar la fase 2, poner una sola sucursal a trabajar en paralelo con el Excel durante dos semanas. Los errores de modelado aparecen ahí, cuando corregirlos cuesta horas y no meses.

---

## 8. Costos

| Concepto | Costo |
|---|---|
| Supabase Free (500 MB base, 1 GB archivos) | **0 USD** |
| Supabase Pro (cuando sea el registro único) | 25 USD/mes |
| Cloudflare Pages | **0 USD** |
| Dominio propio (opcional) | ~12 USD/año |

Tu volumen —80 productos, 1.589 movimientos— usa el 0,14% de la base de datos. El Pro se justifica por los respaldos diarios, no por el tamaño.

**Importante:** el plan gratuito de Vercel prohíbe el uso comercial, así que no sirve para Niveler. Cloudflare Pages sí lo permite. El detalle completo está en `ALMACENAMIENTO.md`.

---

## 9. Tres cosas que no hay que hacer

1. **No editar `inventario` desde el frontend.** Solo funciones RPC. Es la única garantía de que el stock nunca se descuadre.
2. **No borrar movimientos.** Se anulan con `sp_anular_movimiento`, que revierte los saldos y deja el rastro. Un inventario sin historial no sirve para auditar.
3. **No poner la `service_role` key en el frontend.** Esa clave se salta todas las políticas RLS. Solo la `anon key`, que es pública por diseño.

---

## 10. Sobre el Excel actual

No conviene importar los 1.589 movimientos históricos. Los saldos ya están validados y cuadrados: se cargan como una entrada inicial por ciudad con fecha de corte, y el archivo viejo queda archivado en Drive como respaldo. El histórico anterior se consulta ahí si alguna vez hace falta; el sistema nuevo arranca limpio y desde el primer día todo movimiento queda registrado con usuario, fecha y motivo.

Los dos productos pendientes de conteo físico (aspiradora en La Paz, foco ventilador en Oruro) se cargan con la cantidad real contada, no con la del Excel.


---

## 11. Almacenamiento e infraestructura

Ver **`ALMACENAMIENTO.md`**: cuánto ocupan los datos frente a las imágenes, cómo comprimir a WebP, cuántos productos caben en el plan gratuito, qué servidor se usa y cómo configurar respaldos gratuitos.

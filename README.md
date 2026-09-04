# Niveler

Sistema de inventario multi-sucursal (7 ciudades + deliveries), como PWA instalable.
React 18 + Vite + TypeScript + Tailwind, Supabase (PostgreSQL, Auth y RLS),
Supabase Storage para imágenes e IndexedDB/Dexie para trabajo offline.

El diseño completo del modelo de datos y las decisiones detrás está en
[ESTRUCTURA.md](ESTRUCTURA.md); la parte de imágenes, respaldos e
infraestructura, en [ALMACENAMIENTO.md](ALMACENAMIENTO.md).

## Arrancar en local

```bash
npm install
cp .env.example .env   # completar con las claves del proyecto de Supabase
npm run dev
```

Sin `.env` real la app levanta y muestra el login, pero cualquier consulta
falla: no hay base contra la cual hablar.

## Preparar la base de datos

1. Crear el proyecto en [supabase.com](https://supabase.com), región São Paulo.
2. Aplicar en orden las migraciones de `supabase/migrations/` hasta la versión 24.
3. Verificar el bucket `productos` y sus políticas siguiendo
   [ALMACENAMIENTO.md](ALMACENAMIENTO.md).
4. Authentication → Users → crear el usuario admin y activarlo con el `update`
   del final de `db/05_seed.sql`.
5. Copiar *Project URL* y *anon key* (Settings → API) al `.env`.

En una base que ya tiene 01–16, aplicar en orden
`db/17_retirar_almacenamiento_externo.sql` y
`db/18_codigo_delivery_automatico.sql` y
`db/19_corregir_ubicacion_delivery.sql` y
`db/20_sku_producto_automatico.sql`,
`db/21_alertas_y_ubicacion_sucursal.sql` y
`db/22_importacion_productos_normalizada.sql`.

Las migraciones 23 y 24 son limpiezas de esta instalación y sólo deben registrarse
mediante sus archivos formales en `supabase/migrations/`; no forman parte de la
preparación manual de una instalación nueva.

Las mismas migraciones están versionadas formalmente en `supabase/migrations/`.
Para un proyecto nuevo se pueden aplicar con Supabase CLI; en una base existente
se conserva el orden anterior y se ejecuta solo la migración que falte.

Después conviene regenerar los tipos directamente desde el proyecto remoto. El
script obtiene el project ref de `VITE_SUPABASE_URL`; solo requiere haber iniciado
sesión con Supabase CLI o definir `SUPABASE_ACCESS_TOKEN`:

```bash
npm run types
```

`src/types/database.ts` contiene el contrato actual y debe regenerarse después
de cada migración remota.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Verifica tipos y compila a `dist/` |
| `npm run preview` | Sirve el build, útil para probar la PWA |
| `npm run lint` | Revisa el código TypeScript/React y los scripts |
| `npm test` | Ejecuta las pruebas unitarias y de contrato SQL |
| `npm run test:e2e` | Ejecuta las pruebas públicas y, con credenciales, las de administrador |
| `npm run types` | Regenera los tipos desde el proyecto real de Supabase |
| `npm run db:status` | Compara el historial local y remoto de migraciones |
| `node scripts/generar-iconos.mjs` | Regenera los íconos provisionales de `public/icons/` |
| `node scripts/comprimir-imagenes.mjs` | Convierte `imagenes_productos/` a WebP para subir |

## Estado

| Módulo | Qué hace |
|---|---|
| Auth y layout | Login, roles, sidebar en PC y barra inferior en móvil |
| Dashboard | Totales, stock por ciudad, alertas de reposición, tiempo real |
| Productos | Catálogo con SKU manual obligatorio y único, stock inicial por entrada auditada y saldos físico/reservado/disponible por ubicación |
| Importación Excel | Plantilla XLSX, validación, previsualización e importación atómica del catálogo |
| Kardex | Historial de cada producto, con saldo acumulado por bodega y exportación XLSX |
| Inventario | Un registro por producto, distribución por bodega/delivery, conteo físico con ajuste y acceso al kardex |
| Movimientos | Entradas, entregas a repartidor, devoluciones, mermas, historial y anulación |
| Transferencias | Entre bodegas o deliveries: crear, enviar, recibir con faltantes y seguimiento |
| Encomiendas | Bultos para clientes y entre deliveries: registro, despacho, entrega y anulación |
| Ventas | Salida pendiente o entregada, atribución a delivery, número de pedido y anulación con reverso |
| Clientes | Alta, departamento, edición e historial de números de pedido; sin solicitar NIT/CI |
| Deliveries | Repartidores, stock en su poder y rendición |
| Sucursales | Alta y edición de las ciudades |
| Usuarios | Aprobar cuentas, asignar rol y sucursal |
| Reportes | Más vendidos, sin movimiento, salidas por día, stock completo, todo exportable a XLSX |
| Auditoría | Consulta filtrable de cambios, detalle JSON y exportación XLSX para administradores |
| Offline | Consulta local por usuario y cola idempotente para operaciones compatibles |
| Imágenes | Compresión en el navegador y carga autenticada a Supabase Storage |

Las pruebas E2E de administrador se habilitan con `E2E_ADMIN_EMAIL` y
`E2E_ADMIN_PASSWORD`. Esas variables se usan solo durante la prueba y no deben
subirse al repositorio; `.env.e2e` está ignorado por Git.

```dotenv
E2E_ADMIN_EMAIL=administrador@ejemplo.com
E2E_ADMIN_PASSWORD=contraseña-de-pruebas
```

## Cuentas y roles

Cada persona se registra desde el login (`/crear-cuenta`) y su cuenta nace
inactiva. Un administrador le asigna rol y sucursal en **Usuarios**, y recién
ahí ve datos. No hay alta de usuarios desde la app a propósito: la API de admin
de Supabase exige la `service_role` key, que no puede estar en el navegador.

Quién puede qué está en la sección 5 de [ESTRUCTURA.md](ESTRUCTURA.md) y en la
propia app, en Usuarios → "Qué puede cada rol".

## Tres reglas que no se rompen

1. El stock **nunca** se edita con `update` desde el frontend. Solo por las
   funciones RPC (`rpc_registrar_movimiento`, `rpc_registrar_venta`,
   `rpc_ajustar_stock`, …). Es lo único que garantiza que el inventario cuadre.
2. En el `.env` va la `anon key`, jamás la `service_role`: esa clave se salta
   todas las políticas RLS.
3. Toda RPC que mueva stock verifica el nivel del rol por dentro
   (`db/09_permisos_rpc.sql`). Son `security definer`, así que RLS no las
   alcanza: esconder el botón en la app no alcanza para impedir la llamada.

## Estado de la base de datos

El proyecto vive en Supabase (`InvetarioNiveler`), región **São Paulo
(sa-east-1)**. El repositorio contiene 24 migraciones SQL con políticas RLS, RPC de
stock/ventas/transferencias/encomiendas, idempotencia offline,
los 6 roles, las 7 sucursales, ubicaciones virtuales y el catálogo inicial.

Las versiones 01–24 están aplicadas en Supabase. La versión 22 normaliza y valida las unidades de los
productos importados desde Excel, sin modificar stock ni imágenes.
Antes de publicar cualquier frontend nuevo se comprueba el resultado con
`supabase migration list --linked`.

La validación autenticada del 30/08/2026 comprobó el alta de productos con foto y
stock inicial, la importación XLSX, ventas, transferencias, encomiendas, anulaciones,
auditoría y reportes. La migración 23 retiró de producción los productos, inventario,
movimientos, ventas, transferencias, encomiendas, cliente, pedidos, delivery,
sucursal y auditoría creados para QA. También se eliminó mediante la API de Storage
la imagen WebP de prueba. Las secuencias de SKU y delivery quedaron ajustadas al
último registro real existente.

El 04/09/2026 se reinició la operación para comenzar desde cero: se eliminaron
inventario, movimientos, ventas, transferencias, encomiendas, clientes, pedidos,
deliveries, reintentos offline y auditoría. Se conservaron sin cambios todos los
productos registrados y sus imágenes, además de categorías, marcas, usuarios,
roles y sucursales necesarios para operar. Los correlativos operativos se
reiniciaron desde 1.

## Cloudflare

El frontend es una SPA estática publicada como el Worker `niveler`, con Static Assets, en
[niveler.aqjaq18.workers.dev](https://niveler.aqjaq18.workers.dev). El archivo
`wrangler.jsonc` declara `dist` como directorio de assets y el fallback de SPA,
por lo que funcionan también las rutas abiertas directamente, como `/ventas` y
`/nueva-password`.

Supabase es el único backend de la aplicación: Auth, PostgreSQL, RPC y Storage.

Último despliegue verificado del 04/09/2026:
`06000e54-c98d-4360-aaf0-499454622641` (Worker `niveler`). El shell HTML de
la SPA se entrega sin caché para que las rutas ya visitadas reciban cada nueva
versión de inmediato; los archivos con hash conservan su caché optimizada.

El orden de una publicación que cambie RPC es obligatorio: aplicar y verificar
primero la migración en Supabase, compilar/probar después y recién entonces
desplegar con `npx wrangler deploy`.

Para una instalación nueva, la cuenta administradora inicial se crea así:

1. **Authentication → Users → Add user** con tu correo y contraseña.
2. Activarlo como administrador, en el SQL Editor:

```sql
update usuarios
   set rol_id = (select id from roles where codigo = 'ADMIN'),
       activo = true,
       nombre_completo = 'Tu nombre'
 where email = 'tu@correo.com';
```

La instalación productiva de Niveler ya tiene su cuenta administradora. Sus
credenciales no se guardan en este repositorio.

El 28 de agosto de 2026 se validaron en producción, con esa cuenta, la importación
XLSX, la venta pendiente y entrega, las anulaciones, el envío y recepción de
transferencias, el retorno del stock a cero y la consulta detallada de auditoría.

Los productos históricos conservan sus SKU actuales. Para un producto nuevo, el
usuario escribe un SKU único de hasta 50 caracteres usando letras, números,
guiones o guion bajo; el sistema lo normaliza a mayúsculas y no permite cambiarlo
al editar.

Las imágenes históricas y nuevas viven en el bucket `productos` de Supabase
Storage. El script `scripts/subir-imagenes.mjs` se conserva para cargas masivas o
recuperación controlada.

## Las fotos se comprimen solas

Al agregar o cambiar una foto, el navegador la reduce a un máximo de 1200 px y
500 KiB para ahorrar datos. Después la sesión autenticada la sube al bucket; las
políticas de Storage permiten escribir únicamente a roles de nivel 60 o superior.

El script `scripts/comprimir-imagenes.mjs` solo hace falta para cargas
masivas desde la PC, como la migración inicial del catálogo.

## El sistema no maneja dinero

No hay precios, ni totales, ni formas de pago: una venta registra qué producto
salió, cuántas unidades y de dónde. El razonamiento completo está en la
"tercera regla" de [ESTRUCTURA.md](ESTRUCTURA.md). Si algún día hace falta
facturar, se agrega una tabla de precios aparte sin tocar el motor de stock.

# Niveler

Sistema de inventario multi-sucursal (7 ciudades + deliveries), como PWA instalable.
React 18 + Vite + TypeScript + Tailwind sobre Supabase (PostgreSQL, Auth y RLS).

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
2. SQL Editor → ejecutar en orden los archivos `db/01_...sql` a `db/12_...sql`.
3. Subir `imagenes_productos_webp/` al bucket público `productos` creado por
   `db/07_storage.sql`.
4. Authentication → Users → crear el usuario admin y activarlo con el `update`
   del final de `db/05_seed.sql`.
5. Copiar *Project URL* y *anon key* (Settings → API) al `.env`.

En una base que ya tenía ejecutados los archivos 01–11, aplicar solamente
`db/12_integridad_y_permisos.sql`. Esa migración cierra las escrituras directas
de ventas y transferencias, vuelve atómicas sus reservas/anulaciones, restringe
las RPC por sucursal y corrige los reportes de stock.

Las mismas migraciones están versionadas formalmente en `supabase/migrations/`.
Para un proyecto nuevo se pueden aplicar con Supabase CLI; en una base existente
se conserva el orden anterior y se ejecuta solo la migración que falte.

Después conviene regenerar los tipos directamente desde el proyecto remoto. El
script obtiene el project ref de `VITE_SUPABASE_URL`; solo requiere haber iniciado
sesión con Supabase CLI o definir `SUPABASE_ACCESS_TOKEN`:

```bash
npm run types
```

`src/types/database.ts` fue generado desde el proyecto remoto el 28 de agosto de
2026. Debe regenerarse después de cada cambio de esquema; no se mantiene a mano.

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
| Productos | Catálogo con búsqueda, alta y edición con foto, detalle con stock por ubicación |
| Importación Excel | Plantilla XLSX, validación, previsualización e importación atómica del catálogo |
| Kardex | Historial de cada producto, con saldo acumulado por bodega y exportación XLSX |
| Inventario | Stock por ubicación, conteo físico con ajuste y acceso al kardex |
| Movimientos | Entradas, entregas a repartidor, devoluciones, mermas, historial y anulación |
| Transferencias | Crear, enviar, recibir con faltantes, seguimiento |
| Ventas | Registro de salida, pendiente o entregada, anulación con reverso |
| Clientes | Alta y edición |
| Deliveries | Repartidores, stock en su poder y rendición |
| Sucursales | Alta y edición de las ciudades |
| Usuarios | Aprobar cuentas, asignar rol y sucursal |
| Reportes | Más vendidos, sin movimiento, salidas por día, stock completo, todo exportable a XLSX |
| Auditoría | Consulta filtrable de cambios, detalle JSON y exportación XLSX para administradores |

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
(sa-east-1)**, la más cercana a Bolivia. El repositorio contiene 12 scripts SQL:
17 tablas, 10 vistas, políticas RLS, RPC de stock/ventas/transferencias, los 6
roles, las 7 sucursales, ubicaciones virtuales y el catálogo inicial. El bucket
`productos` es público para lectura; las escrituras requieren nivel 60.

Las 12 versiones de `supabase/migrations/` están registradas como aplicadas en el
historial remoto y `supabase migration list --linked` las muestra alineadas.

## Cloudflare

El proyecto es una SPA estática: el backend sigue siendo Supabase. Está publicado
como el Worker `niveler`, con Static Assets, en
[niveler.aqjaq18.workers.dev](https://niveler.aqjaq18.workers.dev). El archivo
`wrangler.jsonc` declara `dist` como directorio de assets y el fallback de SPA,
por lo que funcionan también las rutas abiertas directamente, como `/ventas` y
`/nueva-password`.

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

Las 77 imágenes ya están en el bucket. Si hay que volver a subirlas (o cargar
las de un producto nuevo), hay dos caminos: con la `service_role` key en
`SUPABASE_SERVICE_ROLE_KEY`, o abriendo una política temporal de insert para
`anon` y pasando la anon key en `SUPABASE_KEY`. En los dos casos:

```bash
node scripts/subir-imagenes.mjs
```

## Las fotos se comprimen solas

Al agregar o cambiar la foto de un producto desde la app, el navegador la
reduce a 1000 px y la convierte a WebP **antes** de subirla: una foto de
celular de 5 MB se sube como unos 130 KB. No hay servidor de imágenes ni
paso manual; funciona igual desde una PC que desde un teléfono, y el mismo
botón deja elegir entre la cámara y la galería.

El script `scripts/comprimir-imagenes.mjs` solo hace falta para cargas
masivas desde la PC, como la migración inicial del catálogo.

## El sistema no maneja dinero

No hay precios, ni totales, ni formas de pago: una venta registra qué producto
salió, cuántas unidades y de dónde. El razonamiento completo está en la
"tercera regla" de [ESTRUCTURA.md](ESTRUCTURA.md). Si algún día hace falta
facturar, se agrega una tabla de precios aparte sin tocar el motor de stock.

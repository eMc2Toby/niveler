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
2. SQL Editor → ejecutar en orden `db/01_schema.sql`, `02`, `03`, `04`, `05`.
3. Storage → crear el bucket público `productos` y subir `imagenes_productos/`.
4. Authentication → Users → crear el usuario admin y activarlo con el `update`
   del final de `db/05_seed.sql`.
5. Copiar *Project URL* y *anon key* (Settings → API) al `.env`.

Después conviene reemplazar los tipos escritos a mano por los generados:

```bash
npx supabase gen types typescript --project-id TU_ID > src/types/database.ts
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Verifica tipos y compila a `dist/` |
| `npm run preview` | Sirve el build, útil para probar la PWA |
| `node scripts/generar-iconos.mjs` | Regenera los íconos provisionales de `public/icons/` |

## Estado

| Módulo | Qué hace |
|---|---|
| Auth y layout | Login, roles, sidebar en PC y barra inferior en móvil |
| Dashboard | Totales, stock por ciudad, alertas de reposición, tiempo real |
| Productos | Catálogo con búsqueda, alta y edición, detalle con stock por ubicación |
| Kardex | Historial de cada producto, con saldo acumulado por bodega y exportación |
| Inventario | Stock por ubicación, conteo físico con ajuste y acceso al kardex |
| Movimientos | Entradas, entregas a repartidor, devoluciones, mermas, historial y anulación |
| Transferencias | Crear, enviar, recibir con faltantes, seguimiento |
| Ventas | Registro de salida, pendiente o entregada, anulación con reverso |
| Clientes | Alta y edición |
| Deliveries | Repartidores, stock en su poder y rendición |
| Sucursales | Alta y edición de las ciudades |
| Usuarios | Aprobar cuentas, asignar rol y sucursal |
| Reportes | Más vendidos, sin movimiento, salidas por día, stock completo, todo exportable |

Falta la exportación a Excel nativa (hoy se baja CSV, que Excel abre directo)
y el módulo de auditoría, que hoy solo se consulta desde la base.

## Dos reglas que no se rompen

1. El stock **nunca** se edita con `update` desde el frontend. Solo por las
   funciones RPC (`rpc_registrar_movimiento`, `rpc_registrar_venta`,
   `rpc_ajustar_stock`, …). Es lo único que garantiza que el inventario cuadre.
2. En el `.env` va la `anon key`, jamás la `service_role`: esa clave se salta
   todas las políticas RLS.

## Estado de la base de datos

El proyecto vive en Supabase (`InvetarioNiveler`), región **São Paulo
(sa-east-1)**, la más cercana a Bolivia. Ya están ejecutados los ocho archivos
de `db/`: 17 tablas, 10 vistas, 19 funciones, 33 políticas RLS, los 6 roles,
las 7 sucursales, las 11 ubicaciones, 7 categorías y los 80 productos. El
bucket `productos` está creado y es público.

Falta lo que depende de elegir una contraseña, así que lo haces tú:

1. **Authentication → Users → Add user** con tu correo y contraseña.
2. Activarlo como administrador, en el SQL Editor:

```sql
update usuarios
   set rol_id = (select id from roles where codigo = 'ADMIN'),
       activo = true,
       nombre_completo = 'Tu nombre'
 where email = 'tu@correo.com';
```

Las 77 imágenes ya están en el bucket. Si hay que volver a subirlas (o cargar
las de un producto nuevo), hay dos caminos: con la `service_role` key en
`SUPABASE_SERVICE_ROLE_KEY`, o abriendo una política temporal de insert para
`anon` y pasando la anon key en `SUPABASE_KEY`. En los dos casos:

```bash
node scripts/subir-imagenes.mjs
```

## El sistema no maneja dinero

No hay precios, ni totales, ni formas de pago: una venta registra qué producto
salió, cuántas unidades y de dónde. El razonamiento completo está en la
"tercera regla" de [ESTRUCTURA.md](ESTRUCTURA.md). Si algún día hace falta
facturar, se agrega una tabla de precios aparte sin tocar el motor de stock.

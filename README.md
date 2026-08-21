# Niveler

Sistema de inventario multi-sucursal (7 ciudades + deliveries), como PWA instalable.
React 18 + Vite + TypeScript + Tailwind sobre Supabase (PostgreSQL, Auth y RLS).

El diseño completo del modelo de datos y las decisiones detrás está en
[ESTRUCTURA.md](ESTRUCTURA.md); la parte de imágenes, respaldos y costos, en
[ALMACENAMIENTO.md](ALMACENAMIENTO.md).

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

| Fase | Módulo | Estado |
|---|---|---|
| 1 | Auth, layout, productos | listo |
| 2 | Inventario y movimientos | pendiente |
| 3 | Transferencias | pendiente |
| 4 | Ventas y clientes | pendiente |
| 5 | Deliveries y rendición | pendiente |
| 6 | Dashboard y reportes | dashboard base listo, reportes pendientes |
| 7 | Usuarios, auditoría, exportar | pendiente |

Las rutas de los módulos pendientes ya existen y muestran un aviso de
"en construcción", con el nivel de permiso que les corresponde.

## Dos reglas que no se rompen

1. El stock **nunca** se edita con `update` desde el frontend. Solo por las
   funciones RPC (`rpc_registrar_movimiento`, `rpc_registrar_venta`,
   `rpc_ajustar_stock`, …). Es lo único que garantiza que el inventario cuadre.
2. En el `.env` va la `anon key`, jamás la `service_role`: esa clave se salta
   todas las políticas RLS.

## Estado de la base de datos

El proyecto vive en Supabase, región **São Paulo (sa-east-1)**, la más cercana
a Bolivia. Los archivos de `db/` se ejecutan en orden: `01` a `06`, más
`07_storage.sql` (bucket de imágenes) y `08_grants.sql` (permisos de tabla y
`security_invoker` en las vistas, sin los cuales un usuario logueado recibe
`permission denied` o, peor, ve datos de sucursales que no le tocan).

Pasos que dependen de elegir una contraseña, así que los haces tú:

1. **Authentication → Users → Add user** con tu correo y contraseña.
2. Activarlo como administrador, en el SQL Editor:

```sql
update usuarios
   set rol_id = (select id from roles where codigo = 'ADMIN'),
       activo = true,
       nombre_completo = 'Tu nombre'
 where email = 'tu@correo.com';
```

3. Subir las imágenes al bucket, con tu service_role key en el entorno:

```bash
node scripts/subir-imagenes.mjs
```

## El sistema no maneja dinero

No hay precios, ni totales, ni formas de pago: una venta registra qué producto
salió, cuántas unidades y de dónde. El razonamiento completo está en la
"tercera regla" de [ESTRUCTURA.md](ESTRUCTURA.md). Si algún día hace falta
facturar, se agrega una tabla de precios aparte sin tocar el motor de stock.

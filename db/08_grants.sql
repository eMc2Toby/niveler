-- =====================================================================
-- 08_grants.sql · permisos de tabla y vistas que respetan RLS
-- =====================================================================
-- Ejecutado el 2026-08-20 en el proyecto htsfrafhzptyxiqgahog.
--
-- Dos cosas que hacen falta y que 04_rls.sql no cubre:
--
-- 1. GRANTS. RLS filtra filas, pero antes Postgres exige el permiso de
--    tabla. Sin estos grants, un usuario logueado recibe
--    "permission denied for table productos" aunque las políticas lo
--    permitan. Se le dan a `authenticated`, nunca a `anon`: sin sesión
--    no se ve nada, ni siquiera el catálogo.
--
-- 2. security_invoker en las vistas. Una vista normal se ejecuta con los
--    permisos de quien la creó (postgres), así que v_stock devolvería el
--    stock de las 7 ciudades incluso a un repartidor. Con security_invoker
--    la vista corre con los permisos de quien consulta y las políticas de
--    04_rls.sql vuelven a aplicarse. Requiere PostgreSQL 15 o superior.
--
-- Ejecutar después de 02_vistas.sql y 04_rls.sql.
-- =====================================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Para que las tablas y funciones que se creen más adelante no repitan el problema.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

alter view v_stock                    set (security_invoker = on);
alter view v_productos_bajo_stock     set (security_invoker = on);
alter view v_dashboard_totales        set (security_invoker = on);
alter view v_stock_por_sucursal       set (security_invoker = on);
alter view v_stock_por_delivery       set (security_invoker = on);
alter view v_kardex                   set (security_invoker = on);
alter view v_productos_mas_vendidos   set (security_invoker = on);
alter view v_productos_sin_movimiento set (security_invoker = on);
alter view v_ventas_diarias           set (security_invoker = on);
alter view v_delivery_rendicion       set (security_invoker = on);

-- Verificación: las 10 vistas deben salir con invoker activado.
-- select c.relname, c.reloptions
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'v';

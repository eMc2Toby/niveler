-- =====================================================================
-- NIVELER — 24_reiniciar_operacion_conservar_productos.sql
-- Reinicia los datos operativos y conserva el catálogo completo.
--
-- Se conservan: productos y sus imagen_url, categorías, marcas, usuarios,
-- roles, sucursales y ubicaciones de sucursal/virtuales.
-- Se eliminan: stock, movimientos, ventas, transferencias, encomiendas,
-- clientes/pedidos, deliveries, reintentos offline y auditoría.
-- =====================================================================

begin;

create temporary table _productos_conservados on commit drop as
select id, sku, nombre, imagen_url
from productos;

delete from operaciones_idempotentes;
delete from encomiendas;
delete from ventas;
delete from transferencias;
delete from movimientos;
delete from cliente_pedidos;
delete from inventario;
delete from deliveries;
delete from clientes;

-- Las eliminaciones anteriores generan auditoría; se vacía al final para que
-- la nueva operación empiece realmente sin datos históricos.
delete from auditoria;

do $$
declare
  v_antes int := (select count(*) from _productos_conservados);
  v_despues int := (select count(*) from productos);
begin
  if v_antes <> v_despues or exists (
    select 1
    from _productos_conservados esperado
    left join productos actual on actual.id = esperado.id
    where actual.id is null
       or actual.sku is distinct from esperado.sku
       or actual.nombre is distinct from esperado.nombre
       or actual.imagen_url is distinct from esperado.imagen_url
  ) then
    raise exception 'La limpieza intentó modificar el catálogo de productos; se revirtió la transacción.';
  end if;

  if exists (select 1 from operaciones_idempotentes)
     or exists (select 1 from encomiendas)
     or exists (select 1 from ventas)
     or exists (select 1 from transferencias)
     or exists (select 1 from movimientos)
     or exists (select 1 from cliente_pedidos)
     or exists (select 1 from inventario)
     or exists (select 1 from deliveries)
     or exists (select 1 from clientes)
     or exists (select 1 from auditoria) then
    raise exception 'La limpieza operativa no terminó completamente; se revirtió la transacción.';
  end if;

  raise notice 'Operación reiniciada. Se conservaron % productos.', v_despues;
end $$;

-- Los próximos documentos vuelven a comenzar desde 1 porque sus tablas están
-- vacías. El SKU continúa después del mayor SKU numérico que se haya conservado.
select setval('seq_movimiento', 1, false);
select setval('seq_venta', 1, false);
select setval('seq_transferencia', 1, false);
select setval('seq_encomienda', 1, false);
select setval('deliveries_codigo_seq', 1, false);

do $$
declare
  v_max_sku bigint;
  v_secuencia text;
begin
  select max(sku::bigint) into v_max_sku
  from productos
  where trim(sku) ~ '^[0-9]+$';
  perform setval('seq_producto_sku', coalesce(v_max_sku, 1), v_max_sku is not null);

  v_secuencia := pg_get_serial_sequence('operaciones_idempotentes', 'id');
  if v_secuencia is not null then
    perform setval(v_secuencia::regclass, 1, false);
  end if;

  v_secuencia := pg_get_serial_sequence('auditoria', 'id');
  if v_secuencia is not null then
    perform setval(v_secuencia::regclass, 1, false);
  end if;
end $$;

commit;

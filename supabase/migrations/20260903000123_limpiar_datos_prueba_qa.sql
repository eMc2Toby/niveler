-- =====================================================================
-- NIVELER — 23_limpiar_datos_prueba_qa.sql
-- Retira exclusivamente los registros creados durante la validación QA.
-- Los identificadores son deliberadamente exactos y la migración aborta si
-- encuentra una cantidad inesperada de entidades principales.
-- =====================================================================

begin;

create temporary table _qa_productos on commit drop as
select id
from productos
where (sku = '1' and nombre = 'PRODUCTO PRUEBA QA 20260830')
   or sku = 'E2E-XLSX-20260830'
   or sku = 'PRUEBA-NIVELER-20260828-120150';

create temporary table _qa_sucursales on commit drop as
select id
from sucursales
where codigo = 'SUC-QA26'
   or nombre = 'Niveler QA20260830'
   or ciudad = 'CiudadQA';

create temporary table _qa_deliveries on commit drop as
select id
from deliveries
where nombre = 'DELIVERY PRUEBA QA 20260830';

create temporary table _qa_clientes on commit drop as
select id
from clientes
where nombre in ('CLIENTE PRUEBA QA20260830', 'CLIENTE PRUEBA QA 20260830');

create temporary table _qa_pedidos on commit drop as
select id
from cliente_pedidos
where cliente_id in (select id from _qa_clientes)
   or numero like 'PED-QA-%';

create temporary table _qa_ubicaciones on commit drop as
select id
from ubicaciones
where sucursal_id in (select id from _qa_sucursales)
   or delivery_id in (select id from _qa_deliveries);

create temporary table _qa_ventas on commit drop as
select distinct v.id
from ventas v
where v.cliente_id in (select id from _qa_clientes)
   or v.delivery_id in (select id from _qa_deliveries)
   or v.sucursal_id in (select id from _qa_sucursales)
   or v.ubicacion_id in (select id from _qa_ubicaciones)
   or v.pedido_cliente_id in (select id from _qa_pedidos)
   or exists (
     select 1 from ventas_detalle vd
     where vd.venta_id = v.id
       and vd.producto_id in (select id from _qa_productos)
   )
   or (
     v.created_at >= timestamptz '2026-08-28 00:00:00-04'
     and coalesce(v.observaciones, '') ilike '%QA%'
   );

create temporary table _qa_transferencias on commit drop as
select distinct t.id
from transferencias t
where t.ubicacion_origen_id in (select id from _qa_ubicaciones)
   or t.ubicacion_destino_id in (select id from _qa_ubicaciones)
   or exists (
     select 1 from transferencias_detalle td
     where td.transferencia_id = t.id
       and td.producto_id in (select id from _qa_productos)
   )
   or (
     t.created_at >= timestamptz '2026-08-28 00:00:00-04'
     and coalesce(t.observaciones, '') ilike '%QA%'
   );

create temporary table _qa_encomiendas on commit drop as
select id
from encomiendas
where cliente_id in (select id from _qa_clientes)
   or delivery_origen_id in (select id from _qa_deliveries)
   or delivery_destino_id in (select id from _qa_deliveries)
   or sucursal_origen_id in (select id from _qa_sucursales)
   or (
     created_at >= timestamptz '2026-08-28 00:00:00-04'
     and concat_ws(' ', descripcion, ciudad_destino, direccion_entrega, observaciones) ilike '%QA%'
   );

create temporary table _qa_movimientos on commit drop as
select distinct m.id
from movimientos m
where m.ubicacion_origen_id in (select id from _qa_ubicaciones)
   or m.ubicacion_destino_id in (select id from _qa_ubicaciones)
   or (m.referencia_tabla = 'ventas' and m.referencia_id in (select id from _qa_ventas))
   or (m.referencia_tabla = 'transferencias' and m.referencia_id in (select id from _qa_transferencias))
   or exists (
     select 1 from movimientos_detalle md
     where md.movimiento_id = m.id
       and md.producto_id in (select id from _qa_productos)
   )
   or (
     m.created_at >= timestamptz '2026-08-28 00:00:00-04'
     and (
       coalesce(m.observaciones, '') ilike '%QA%'
       or coalesce(m.observaciones, '') ilike '%PRUEBA OPERATIVA NIVELER%'
     )
   );

create temporary table _qa_productos_impactados on commit drop as
select distinct md.producto_id as id
from movimientos_detalle md
where md.movimiento_id in (select id from _qa_movimientos)
  and md.producto_id not in (select id from _qa_productos);

create temporary table _qa_registros (id text primary key) on commit drop;
insert into _qa_registros(id)
select id::text from _qa_productos
union select id::text from _qa_sucursales
union select id::text from _qa_deliveries
union select id::text from _qa_clientes
union select id::text from _qa_pedidos
union select id::text from _qa_ubicaciones
union select id::text from _qa_ventas
union select id::text from _qa_transferencias
union select id::text from _qa_encomiendas
union select id::text from _qa_movimientos;

insert into _qa_registros(id)
select id::text from ventas_detalle where venta_id in (select id from _qa_ventas)
union select id::text from transferencias_detalle where transferencia_id in (select id from _qa_transferencias)
union select id::text from movimientos_detalle where movimiento_id in (select id from _qa_movimientos)
union select id::text from inventario
  where producto_id in (select id from _qa_productos)
     or ubicacion_id in (select id from _qa_ubicaciones)
on conflict do nothing;

do $$
declare
  v_productos int := (select count(*) from _qa_productos);
  v_sucursales int := (select count(*) from _qa_sucursales);
  v_deliveries int := (select count(*) from _qa_deliveries);
  v_clientes int := (select count(*) from _qa_clientes);
  v_ventas int := (select count(*) from _qa_ventas);
  v_transferencias int := (select count(*) from _qa_transferencias);
  v_encomiendas int := (select count(*) from _qa_encomiendas);
  v_movimientos int := (select count(*) from _qa_movimientos);
begin
  if v_productos > 3 or v_sucursales > 1 or v_deliveries > 1 or v_clientes > 1
     or v_ventas > 20 or v_transferencias > 20 or v_encomiendas > 20 or v_movimientos > 60 then
    raise exception 'La limpieza QA encontró una cantidad inesperada: productos %, sucursales %, deliveries %, clientes %, ventas %, transferencias %, encomiendas %, movimientos %.',
      v_productos, v_sucursales, v_deliveries, v_clientes,
      v_ventas, v_transferencias, v_encomiendas, v_movimientos;
  end if;

  if exists (
    select 1 from usuarios where sucursal_id in (select id from _qa_sucursales)
  ) or exists (
    select 1 from deliveries
    where id in (select id from _qa_deliveries) and usuario_id is not null
  ) then
    raise exception 'La sucursal o el delivery QA tiene usuarios asociados; se abortó la limpieza.';
  end if;

  raise notice 'Limpieza QA: productos %, sucursales %, deliveries %, clientes %, ventas %, transferencias %, encomiendas %, movimientos %.',
    v_productos, v_sucursales, v_deliveries, v_clientes,
    v_ventas, v_transferencias, v_encomiendas, v_movimientos;
end $$;

delete from operaciones_idempotentes
where resultado::text ilike '%E2E-XLSX-20260830%'
   or resultado::text ilike '%PRUEBA-NIVELER-20260828-120150%'
   or resultado::text ilike '%SUC-QA26%'
   or resultado::text ilike '%PED-QA-%';

delete from encomiendas where id in (select id from _qa_encomiendas);
delete from ventas where id in (select id from _qa_ventas);
delete from transferencias where id in (select id from _qa_transferencias);
delete from movimientos where id in (select id from _qa_movimientos);
delete from cliente_pedidos where id in (select id from _qa_pedidos);

delete from inventario
where producto_id in (select id from _qa_productos)
   or ubicacion_id in (select id from _qa_ubicaciones);

delete from productos where id in (select id from _qa_productos);
delete from clientes where id in (select id from _qa_clientes);
delete from deliveries where id in (select id from _qa_deliveries);
delete from sucursales where id in (select id from _qa_sucursales);

-- Reconstruye únicamente los productos reales que participaron en movimientos
-- de QA, para que ningún saldo o reserva de prueba permanezca materializado.
delete from inventario
where producto_id in (select id from _qa_productos_impactados);

with deltas as (
  select md.producto_id, m.ubicacion_origen_id as ubicacion_id, -sum(md.cantidad) as delta
  from movimientos_detalle md
  join movimientos m on m.id = md.movimiento_id
  where m.estado = 'CONFIRMADO'
    and md.producto_id in (select id from _qa_productos_impactados)
  group by md.producto_id, m.ubicacion_origen_id
  union all
  select md.producto_id, m.ubicacion_destino_id, sum(md.cantidad)
  from movimientos_detalle md
  join movimientos m on m.id = md.movimiento_id
  where m.estado = 'CONFIRMADO'
    and md.producto_id in (select id from _qa_productos_impactados)
  group by md.producto_id, m.ubicacion_destino_id
), totales as (
  select producto_id, ubicacion_id, sum(delta) as cantidad
  from deltas
  group by producto_id, ubicacion_id
)
insert into inventario(producto_id, ubicacion_id, cantidad, cantidad_reservada)
select producto_id, ubicacion_id, cantidad, 0
from totales
where cantidad <> 0;

with reservas as (
  select v.ubicacion_id, vd.producto_id, sum(vd.cantidad) as cantidad
  from ventas v
  join ventas_detalle vd on vd.venta_id = v.id
  where v.estado = 'PENDIENTE'
    and vd.producto_id in (select id from _qa_productos_impactados)
  group by v.ubicacion_id, vd.producto_id
  union all
  select t.ubicacion_origen_id, td.producto_id, sum(td.cantidad_enviada)
  from transferencias t
  join transferencias_detalle td on td.transferencia_id = t.id
  where t.estado = 'BORRADOR'
    and td.producto_id in (select id from _qa_productos_impactados)
  group by t.ubicacion_origen_id, td.producto_id
), totales as (
  select ubicacion_id, producto_id, sum(cantidad) as cantidad
  from reservas
  group by ubicacion_id, producto_id
)
insert into inventario(producto_id, ubicacion_id, cantidad, cantidad_reservada)
select producto_id, ubicacion_id, 0, cantidad
from totales
on conflict (producto_id, ubicacion_id) do update
set cantidad_reservada = excluded.cantidad_reservada,
    actualizado_en = now();

-- Retira el rastro de los datos ficticios, incluidos los DELETE auditados
-- durante esta transacción. No afecta auditoría de entidades reales.
delete from auditoria
where registro_id in (select id from _qa_registros)
   or coalesce(datos_anteriores::text, '') ilike '%PRODUCTO PRUEBA QA 20260830%'
   or coalesce(datos_nuevos::text, '') ilike '%PRODUCTO PRUEBA QA 20260830%'
   or coalesce(datos_anteriores::text, '') ilike '%E2E-XLSX-20260830%'
   or coalesce(datos_nuevos::text, '') ilike '%E2E-XLSX-20260830%'
   or coalesce(datos_anteriores::text, '') ilike '%PRUEBA-NIVELER-20260828-120150%'
   or coalesce(datos_nuevos::text, '') ilike '%PRUEBA-NIVELER-20260828-120150%'
   or coalesce(datos_anteriores::text, '') ilike '%SUC-QA26%'
   or coalesce(datos_nuevos::text, '') ilike '%SUC-QA26%'
   or coalesce(datos_anteriores::text, '') ilike '%PED-QA-%'
   or coalesce(datos_nuevos::text, '') ilike '%PED-QA-%';

do $$
declare
  v_max bigint;
begin
  select max(sku::bigint) into v_max
  from productos where trim(sku) ~ '^[0-9]+$';
  perform setval('seq_producto_sku', coalesce(v_max, 1), v_max is not null);

  select max(substring(codigo from '^DEL-([0-9]+)$')::bigint) into v_max
  from deliveries where codigo ~ '^DEL-[0-9]+$';
  perform setval('deliveries_codigo_seq', coalesce(v_max, 1), v_max is not null);
end $$;

commit;

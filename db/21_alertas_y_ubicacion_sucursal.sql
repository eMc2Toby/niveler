-- =====================================================================
-- NIVELER BOLIVIA — 21_alertas_y_ubicacion_sucursal.sql
-- Corrige alertas de stock y crea la bodega de cada sucursal nueva.
-- =====================================================================

begin;

-- Una alerta "bajo el mínimo" sólo corresponde cuando el saldo es menor,
-- no cuando ambos valores son cero ni cuando el saldo está justo al mínimo.
create or replace view v_productos_bajo_stock as
select
  p.id as producto_id,
  p.sku,
  p.nombre as producto,
  p.imagen_url,
  c.nombre as categoria,
  p.stock_minimo,
  coalesce(sum(i.cantidad) filter (where u.tipo = 'SUCURSAL'), 0) as stock_sucursales,
  coalesce(sum(i.cantidad) filter (where u.tipo in ('SUCURSAL','DELIVERY')), 0) as stock_total,
  p.stock_minimo - coalesce(sum(i.cantidad) filter (where u.tipo in ('SUCURSAL','DELIVERY')), 0) as faltante
from productos p
left join inventario i on i.producto_id = p.id
left join ubicaciones u on u.id = i.ubicacion_id
left join categorias c on c.id = p.categoria_id
where p.activo = true
group by p.id, p.sku, p.nombre, p.imagen_url, c.nombre, p.stock_minimo
having coalesce(sum(i.cantidad) filter (where u.tipo in ('SUCURSAL','DELIVERY')), 0) < p.stock_minimo
order by faltante desc;

alter view v_productos_bajo_stock set (security_invoker = on);

-- La rendición anterior trataba transferencias y ajustes auditados como
-- faltantes. Se conserva su interfaz y se agrega el total de otras salidas.
create or replace view v_delivery_rendicion as
select
  d.id as delivery_id,
  d.nombre as delivery,
  p.id as producto_id,
  p.sku,
  p.nombre as producto,
  coalesce(i.cantidad, 0) as en_poder,
  coalesce(ent.entregado, 0) as total_recibido,
  coalesce(vt.vendido, 0) as total_vendido,
  coalesce(ret.retornado, 0) as total_retornado,
  coalesce(otros.cantidad, 0) as total_otros_salidas
from deliveries d
join ubicaciones u on u.delivery_id = d.id
cross join productos p
left join inventario i on i.ubicacion_id = u.id and i.producto_id = p.id
left join lateral (
  select sum(md.cantidad) as entregado
  from movimientos_detalle md
  join movimientos m on m.id = md.movimiento_id
  where m.estado = 'CONFIRMADO'
    and m.ubicacion_destino_id = u.id
    and md.producto_id = p.id
) ent on true
left join lateral (
  select sum(vd.cantidad) as vendido
  from ventas_detalle vd
  join ventas v on v.id = vd.venta_id
  where v.delivery_id = d.id
    and v.estado <> 'ANULADA'
    and vd.producto_id = p.id
) vt on true
left join lateral (
  select sum(md.cantidad) as retornado
  from movimientos_detalle md
  join movimientos m on m.id = md.movimiento_id
  where m.estado = 'CONFIRMADO'
    and m.tipo = 'RETORNO_DELIVERY'
    and m.ubicacion_origen_id = u.id
    and md.producto_id = p.id
) ret on true
left join lateral (
  select sum(md.cantidad) as cantidad
  from movimientos_detalle md
  join movimientos m on m.id = md.movimiento_id
  where m.estado = 'CONFIRMADO'
    and m.tipo not in ('VENTA', 'RETORNO_DELIVERY')
    and m.ubicacion_origen_id = u.id
    and md.producto_id = p.id
) otros on true
where d.activo = true
  and (
    coalesce(i.cantidad, 0) <> 0
    or coalesce(ent.entregado, 0) <> 0
    or coalesce(vt.vendido, 0) <> 0
    or coalesce(ret.retornado, 0) <> 0
    or coalesce(otros.cantidad, 0) <> 0
  );

alter view v_delivery_rendicion set (security_invoker = on);

create or replace function fn_sincronizar_ubicacion_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into ubicaciones (codigo, nombre, tipo, sucursal_id, activo)
  values ('UBI-' || new.codigo, 'Bodega ' || new.ciudad, 'SUCURSAL', new.id, new.activo)
  on conflict (sucursal_id) where sucursal_id is not null do update
  set codigo = excluded.codigo,
      nombre = excluded.nombre,
      activo = excluded.activo;
  return new;
end $$;

-- Completa las sucursales ya creadas desde la interfaz, incluida la de QA.
insert into ubicaciones (codigo, nombre, tipo, sucursal_id, activo)
select 'UBI-' || s.codigo, 'Bodega ' || s.ciudad, 'SUCURSAL', s.id, s.activo
from sucursales s
where not exists (
  select 1 from ubicaciones u where u.sucursal_id = s.id
)
on conflict do nothing;

drop trigger if exists trg_sucursal_ubicacion on sucursales;
create trigger trg_sucursal_ubicacion
after insert or update of codigo, ciudad, activo on sucursales
for each row execute function fn_sincronizar_ubicacion_sucursal();

revoke execute on function fn_sincronizar_ubicacion_sucursal()
from public, anon, authenticated;

commit;

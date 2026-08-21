-- =====================================================================
-- NIVELER BOLIVIA — 02_vistas.sql
-- Vistas que alimentan el dashboard y el módulo de reportes.
-- El frontend consulta estas vistas; no arma agregaciones por su cuenta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STOCK CONSOLIDADO POR PRODUCTO Y UBICACIÓN
-- ---------------------------------------------------------------------
create or replace view v_stock as
select
  i.id,
  p.id                as producto_id,
  p.sku,
  p.nombre            as producto,
  p.imagen_url,
  p.stock_minimo,
  p.precio_venta,
  p.precio_costo,
  c.nombre            as categoria,
  m.nombre            as marca,
  u.id                as ubicacion_id,
  u.nombre            as ubicacion,
  u.tipo              as tipo_ubicacion,
  s.id                as sucursal_id,
  s.nombre            as sucursal,
  d.id                as delivery_id,
  d.nombre            as delivery,
  i.cantidad,
  i.cantidad_reservada,
  i.cantidad_disponible,
  (i.cantidad * p.precio_costo) as valor_costo,
  i.actualizado_en
from inventario i
join productos p   on p.id = i.producto_id
join ubicaciones u on u.id = i.ubicacion_id
left join categorias c  on c.id = p.categoria_id
left join marcas m      on m.id = p.marca_id
left join sucursales s  on s.id = u.sucursal_id
left join deliveries d  on d.id = u.delivery_id
where u.tipo in ('SUCURSAL', 'DELIVERY');

-- ---------------------------------------------------------------------
-- ALERTAS: productos por debajo del mínimo
-- ---------------------------------------------------------------------
-- Va antes que v_dashboard_totales porque esa vista la consulta.
create or replace view v_productos_bajo_stock as
select
  p.id            as producto_id,
  p.sku,
  p.nombre        as producto,
  p.imagen_url,
  c.nombre        as categoria,
  p.stock_minimo,
  coalesce(sum(i.cantidad) filter (where u.tipo = 'SUCURSAL'), 0) as stock_sucursales,
  coalesce(sum(i.cantidad), 0)                                    as stock_total,
  p.stock_minimo - coalesce(sum(i.cantidad), 0)                   as faltante
from productos p
left join inventario i  on i.producto_id = p.id
left join ubicaciones u on u.id = i.ubicacion_id and u.tipo in ('SUCURSAL','DELIVERY')
left join categorias c  on c.id = p.categoria_id
where p.activo = true
group by p.id, p.sku, p.nombre, p.imagen_url, c.nombre, p.stock_minimo
having coalesce(sum(i.cantidad), 0) <= p.stock_minimo
order by faltante desc;

-- ---------------------------------------------------------------------
-- DASHBOARD: totales globales
-- ---------------------------------------------------------------------
create or replace view v_dashboard_totales as
select
  (select coalesce(sum(cantidad),0) from v_stock)                                   as stock_total,
  (select coalesce(sum(cantidad),0) from v_stock where tipo_ubicacion='SUCURSAL')   as stock_sucursales,
  (select coalesce(sum(cantidad),0) from v_stock where tipo_ubicacion='DELIVERY')   as stock_deliveries,
  (select coalesce(sum(valor_costo),0) from v_stock)                                as valor_inventario,
  (select count(*) from v_productos_bajo_stock)                                     as productos_bajo_stock,
  (select count(*) from transferencias where estado in ('ENVIADA','RECIBIDA_PARCIAL')) as transferencias_pendientes,
  (select coalesce(sum(total),0) from ventas
     where estado <> 'ANULADA' and fecha::date = current_date)                      as ventas_hoy_monto,
  (select count(*) from ventas
     where estado <> 'ANULADA' and fecha::date = current_date)                      as ventas_hoy_cantidad;

-- ---------------------------------------------------------------------
-- DASHBOARD: stock por sucursal
-- ---------------------------------------------------------------------
create or replace view v_stock_por_sucursal as
select
  s.id            as sucursal_id,
  s.codigo,
  s.nombre        as sucursal,
  s.ciudad,
  count(distinct v.producto_id)      as productos_distintos,
  coalesce(sum(v.cantidad), 0)       as unidades,
  coalesce(sum(v.valor_costo), 0)    as valor_costo
from sucursales s
left join v_stock v on v.sucursal_id = s.id
where s.activo = true
group by s.id, s.codigo, s.nombre, s.ciudad
order by s.nombre;

-- ---------------------------------------------------------------------
-- DASHBOARD: stock en poder de cada delivery
-- ---------------------------------------------------------------------
create or replace view v_stock_por_delivery as
select
  d.id             as delivery_id,
  d.codigo,
  d.nombre         as delivery,
  s.nombre         as sucursal_base,
  count(distinct v.producto_id)   as productos_distintos,
  coalesce(sum(v.cantidad), 0)    as unidades,
  coalesce(sum(v.cantidad * v.precio_venta), 0) as valor_venta
from deliveries d
join sucursales s on s.id = d.sucursal_base_id
left join v_stock v on v.delivery_id = d.id
where d.activo = true
group by d.id, d.codigo, d.nombre, s.nombre
order by d.nombre;

-- ---------------------------------------------------------------------
-- ALERTA: productos bajo el mínimo (consolidado por producto)
-- ---------------------------------------------------------------------
create or replace view v_kardex as
select
  md.id,
  m.fecha,
  m.codigo          as documento,
  m.tipo,
  md.producto_id,
  p.sku,
  p.nombre          as producto,
  uo.nombre         as origen,
  uo.tipo           as tipo_origen,
  ud.nombre         as destino,
  ud.tipo           as tipo_destino,
  md.cantidad,
  md.costo_unitario,
  us.nombre_completo as usuario,
  m.observaciones,
  m.referencia_tabla,
  m.referencia_id
from movimientos_detalle md
join movimientos m  on m.id = md.movimiento_id
join productos p    on p.id = md.producto_id
join ubicaciones uo on uo.id = m.ubicacion_origen_id
join ubicaciones ud on ud.id = m.ubicacion_destino_id
left join usuarios us on us.id = m.usuario_id
where m.estado = 'CONFIRMADO'
order by m.fecha desc;

-- ---------------------------------------------------------------------
-- REPORTE: productos más vendidos
-- ---------------------------------------------------------------------
create or replace view v_productos_mas_vendidos as
select
  p.id      as producto_id,
  p.sku,
  p.nombre  as producto,
  c.nombre  as categoria,
  sum(vd.cantidad)   as unidades_vendidas,
  sum(vd.subtotal)   as monto_vendido,
  count(distinct v.id) as numero_ventas,
  max(v.fecha)       as ultima_venta
from ventas_detalle vd
join ventas v    on v.id = vd.venta_id and v.estado <> 'ANULADA'
join productos p on p.id = vd.producto_id
left join categorias c on c.id = p.categoria_id
group by p.id, p.sku, p.nombre, c.nombre
order by unidades_vendidas desc;

-- ---------------------------------------------------------------------
-- REPORTE: productos sin movimiento (candidatos a liquidación)
-- ---------------------------------------------------------------------
create or replace view v_productos_sin_movimiento as
select
  p.id      as producto_id,
  p.sku,
  p.nombre  as producto,
  c.nombre  as categoria,
  coalesce(sum(i.cantidad), 0) as stock_actual,
  max(m.fecha)                 as ultimo_movimiento,
  current_date - max(m.fecha)::date as dias_sin_movimiento
from productos p
left join categorias c on c.id = p.categoria_id
left join inventario i on i.producto_id = p.id
left join movimientos_detalle md on md.producto_id = p.id
left join movimientos m on m.id = md.movimiento_id and m.estado = 'CONFIRMADO'
where p.activo = true
group by p.id, p.sku, p.nombre, c.nombre
having max(m.fecha) is null or max(m.fecha) < now() - interval '60 days'
order by dias_sin_movimiento desc nulls first;

-- ---------------------------------------------------------------------
-- REPORTE: ventas por día (para gráfico de línea del dashboard)
-- ---------------------------------------------------------------------
create or replace view v_ventas_diarias as
select
  v.fecha::date            as dia,
  v.sucursal_id,
  s.nombre                 as sucursal,
  count(*)                 as numero_ventas,
  sum(v.total)             as monto_total,
  sum(vd.unidades)         as unidades
from ventas v
left join sucursales s on s.id = v.sucursal_id
left join lateral (
  select sum(cantidad) as unidades from ventas_detalle where venta_id = v.id
) vd on true
where v.estado <> 'ANULADA'
group by v.fecha::date, v.sucursal_id, s.nombre
order by dia desc;

-- ---------------------------------------------------------------------
-- DELIVERY: rendición de cuentas (qué tiene vs. qué vendió)
-- ---------------------------------------------------------------------
create or replace view v_delivery_rendicion as
select
  d.id       as delivery_id,
  d.nombre   as delivery,
  p.id       as producto_id,
  p.sku,
  p.nombre   as producto,
  coalesce(i.cantidad, 0) as en_poder,
  coalesce(ent.entregado, 0) as total_recibido,
  coalesce(vt.vendido, 0)    as total_vendido,
  coalesce(ret.retornado, 0) as total_retornado
from deliveries d
join ubicaciones u on u.delivery_id = d.id
cross join productos p
left join inventario i on i.ubicacion_id = u.id and i.producto_id = p.id
left join lateral (
  select sum(md.cantidad) as entregado
  from movimientos_detalle md join movimientos m on m.id = md.movimiento_id
  where m.estado='CONFIRMADO' and m.ubicacion_destino_id = u.id and md.producto_id = p.id
) ent on true
left join lateral (
  select sum(vd.cantidad) as vendido
  from ventas_detalle vd join ventas v on v.id = vd.venta_id
  where v.delivery_id = d.id and v.estado <> 'ANULADA' and vd.producto_id = p.id
) vt on true
left join lateral (
  select sum(md.cantidad) as retornado
  from movimientos_detalle md join movimientos m on m.id = md.movimiento_id
  where m.estado='CONFIRMADO' and m.tipo='RETORNO_DELIVERY'
    and m.ubicacion_origen_id = u.id and md.producto_id = p.id
) ret on true
where d.activo = true
  and (coalesce(i.cantidad,0) <> 0 or coalesce(ent.entregado,0) <> 0);

-- =====================================================================
-- 12_integridad_y_permisos.sql
-- Autorizacion por alcance, operaciones atomicas y reportes consistentes.
--
-- Ejecutar despues de 11_borrar_imagenes.sql. El archivo es reejecutable:
-- las funciones y vistas se reemplazan y las politicas/trigger se eliminan
-- antes de volver a crearse.
-- =====================================================================

begin;


-- ---------------------------------------------------------------------
-- 1. Cerrar escrituras que deben pasar exclusivamente por RPC
-- ---------------------------------------------------------------------

-- El frontend actual no ofrece edicion del perfil propio. Esta politica
-- permitia que una cuenta inactiva se activara sola o cambiara de sucursal.
drop policy if exists usuarios_editar_propio on usuarios;

-- Ventas y transferencias cambian stock o reservas. Permitir escrituras
-- directas sobre cabecera/detalle dejaba esos documentos fuera de sincronía.
drop policy if exists ventas_crear on ventas;
drop policy if exists ventas_editar on ventas;
drop policy if exists ventas_detalle_escritura on ventas_detalle;
drop policy if exists transferencias_crear on transferencias;
drop policy if exists transferencias_editar on transferencias;
drop policy if exists trf_detalle_escritura on transferencias_detalle;


-- ---------------------------------------------------------------------
-- 2. Guardias comunes
-- ---------------------------------------------------------------------

create or replace function fn_exigir_nivel(p_minimo int, p_accion text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  -- SQL Editor y conexiones administrativas directas no llevan JWT.
  if session_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' then
    return;
  end if;

  if coalesce(auth_nivel(), 0) < p_minimo then
    raise exception 'Tu rol no tiene permiso para %.', p_accion
      using errcode = '42501';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. Motor interno de stock
-- ---------------------------------------------------------------------

-- Confirma un movimiento ya construido por una RPC. Para una ubicacion
-- fisica se usa cantidad_disponible, de modo que no se consuma mercaderia
-- reservada por pedidos o transferencias en borrador.
create or replace function sp_confirmar_movimiento(p_movimiento_id uuid)
returns movimientos language plpgsql security definer set search_path = public as $$
declare
  v_mov        movimientos;
  v_det        record;
  v_origen     ubicaciones;
  v_disponible numeric;
begin
  select * into v_mov from movimientos where id = p_movimiento_id for update;
  if not found then
    raise exception 'El movimiento no existe.';
  end if;
  if v_mov.estado <> 'BORRADOR' then
    raise exception 'El movimiento % ya fue procesado (estado: %).', v_mov.codigo, v_mov.estado;
  end if;
  if not exists (select 1 from movimientos_detalle where movimiento_id = p_movimiento_id) then
    raise exception 'El movimiento debe incluir al menos un producto.';
  end if;

  select * into v_origen from ubicaciones where id = v_mov.ubicacion_origen_id;

  for v_det in
    select * from movimientos_detalle where movimiento_id = p_movimiento_id
  loop
    if v_origen.tipo in ('SUCURSAL','DELIVERY','TRANSITO') then
      select cantidad_disponible into v_disponible
      from inventario
      where producto_id = v_det.producto_id
        and ubicacion_id = v_mov.ubicacion_origen_id
      for update;

      if coalesce(v_disponible, 0) < v_det.cantidad then
        raise exception 'Stock disponible insuficiente de % en %: hay %, se necesitan %.',
          (select nombre from productos where id = v_det.producto_id),
          v_origen.nombre, coalesce(v_disponible,0), v_det.cantidad;
      end if;
    end if;

    perform fn_aplicar_delta(v_det.producto_id, v_mov.ubicacion_origen_id, -v_det.cantidad);
    perform fn_aplicar_delta(v_det.producto_id, v_mov.ubicacion_destino_id, v_det.cantidad);
  end loop;

  update movimientos set estado = 'CONFIRMADO' where id = p_movimiento_id
  returning * into v_mov;
  return v_mov;
end $$;


-- Reversion interna. Antes de retirar mercaderia del destino comprueba que
-- esa existencia siga disponible; asi una anulacion antigua no crea stock
-- negativo despues de movimientos posteriores.
create or replace function fn_revertir_movimiento(p_movimiento_id uuid, p_motivo text)
returns movimientos language plpgsql security definer set search_path = public as $$
declare
  v_mov        movimientos;
  v_det        record;
  v_destino    ubicaciones;
  v_disponible numeric;
begin
  select * into v_mov from movimientos where id = p_movimiento_id for update;
  if not found then
    raise exception 'El movimiento no existe.';
  end if;
  if v_mov.estado <> 'CONFIRMADO' then
    raise exception 'Solo se pueden anular movimientos confirmados.';
  end if;

  select * into v_destino from ubicaciones where id = v_mov.ubicacion_destino_id;

  for v_det in select * from movimientos_detalle where movimiento_id = p_movimiento_id loop
    if v_destino.tipo in ('SUCURSAL','DELIVERY','TRANSITO') then
      select cantidad_disponible into v_disponible
      from inventario
      where producto_id = v_det.producto_id
        and ubicacion_id = v_mov.ubicacion_destino_id
      for update;

      if coalesce(v_disponible, 0) < v_det.cantidad then
        raise exception 'No se puede anular %: en % ya no quedan % unidades disponibles de %.',
          v_mov.codigo, v_destino.nombre, v_det.cantidad,
          (select nombre from productos where id = v_det.producto_id);
      end if;
    end if;

    perform fn_aplicar_delta(v_det.producto_id, v_mov.ubicacion_destino_id, -v_det.cantidad);
    perform fn_aplicar_delta(v_det.producto_id, v_mov.ubicacion_origen_id, v_det.cantidad);
  end loop;

  update movimientos
  set estado = 'ANULADO',
      observaciones = concat_ws(' | ', nullif(observaciones,''), 'ANULADO: ' || trim(p_motivo))
  where id = p_movimiento_id
  returning * into v_mov;

  return v_mov;
end $$;


-- Punto de entrada publico para anulaciones manuales. Los movimientos que
-- pertenecen a ventas o transferencias se anulan desde su propio modulo.
create or replace function sp_anular_movimiento(p_movimiento_id uuid, p_motivo text)
returns movimientos language plpgsql security definer set search_path = public as $$
declare
  v_mov movimientos;
begin
  perform fn_exigir_nivel(60, 'anular movimientos');

  if nullif(trim(p_motivo), '') is null then
    raise exception 'Escribe el motivo de la anulacion.';
  end if;

  select * into v_mov from movimientos where id = p_movimiento_id for update;
  if not found then
    raise exception 'El movimiento no existe.';
  end if;
  if not (auth_puede_ver_ubicacion(v_mov.ubicacion_origen_id)
       or auth_puede_ver_ubicacion(v_mov.ubicacion_destino_id)) then
    raise exception 'No puedes anular movimientos de otra sucursal.' using errcode = '42501';
  end if;
  if v_mov.referencia_tabla is not null then
    raise exception 'Este movimiento pertenece a %. Anula el documento desde su modulo.',
      v_mov.referencia_tabla;
  end if;

  return fn_revertir_movimiento(p_movimiento_id, p_motivo);
end $$;


-- ---------------------------------------------------------------------
-- 4. Movimientos manuales: ruta valida y alcance de sucursal
-- ---------------------------------------------------------------------

create or replace function rpc_registrar_movimiento(
  p_tipo tipo_movimiento,
  p_ubicacion_origen_id uuid,
  p_ubicacion_destino_id uuid,
  p_items jsonb,
  p_observaciones text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_mov_id       uuid;
  v_codigo       text;
  v_tipo_origen  tipo_ubicacion;
  v_tipo_destino tipo_ubicacion;
begin
  perform fn_exigir_nivel(40, 'registrar movimientos');

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El movimiento debe incluir al menos un producto.';
  end if;
  if p_ubicacion_origen_id = p_ubicacion_destino_id then
    raise exception 'El origen y el destino deben ser distintos.';
  end if;

  select tipo into v_tipo_origen from ubicaciones where id = p_ubicacion_origen_id and activo;
  select tipo into v_tipo_destino from ubicaciones where id = p_ubicacion_destino_id and activo;
  if v_tipo_origen is null or v_tipo_destino is null then
    raise exception 'El origen o el destino no existe o esta inactivo.';
  end if;

  if not (
    (p_tipo = 'ENTRADA'                and v_tipo_origen = 'PROVEEDOR' and v_tipo_destino = 'SUCURSAL') or
    (p_tipo = 'ENTREGA_DELIVERY'       and v_tipo_origen = 'SUCURSAL'  and v_tipo_destino = 'DELIVERY') or
    (p_tipo = 'RETORNO_DELIVERY'       and v_tipo_origen = 'DELIVERY'  and v_tipo_destino = 'SUCURSAL') or
    (p_tipo = 'TRANSFERENCIA_DELIVERY' and v_tipo_origen = 'DELIVERY'  and v_tipo_destino = 'DELIVERY') or
    (p_tipo = 'SALIDA'                 and v_tipo_origen = 'SUCURSAL'  and v_tipo_destino = 'MERMA') or
    (p_tipo = 'DEVOLUCION'             and v_tipo_origen = 'CLIENTE'   and v_tipo_destino = 'SUCURSAL')
  ) then
    raise exception 'La combinacion de tipo, origen y destino no es valida.';
  end if;

  if p_tipo in ('ENTRADA','DEVOLUCION') then
    if not auth_puede_ver_ubicacion(p_ubicacion_destino_id) then
      raise exception 'No puedes ingresar stock en otra sucursal.' using errcode = '42501';
    end if;
  elsif not auth_puede_ver_ubicacion(p_ubicacion_origen_id) then
    raise exception 'No puedes retirar stock de otra sucursal.' using errcode = '42501';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where nullif(item->>'producto_id','') is null
       or nullif(item->>'cantidad','') is null
       or (item->>'cantidad')::numeric <= 0
  ) then
    raise exception 'Cada producto debe tener una cantidad mayor que cero.';
  end if;

  v_codigo := fn_generar_codigo('MOV', 'seq_movimiento');
  insert into movimientos (codigo, tipo, estado, ubicacion_origen_id,
                           ubicacion_destino_id, usuario_id, observaciones)
  values (v_codigo, p_tipo, 'BORRADOR', p_ubicacion_origen_id,
          p_ubicacion_destino_id, auth.uid(), nullif(trim(p_observaciones),''))
  returning id into v_mov_id;

  insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
  select v_mov_id, (item->>'producto_id')::uuid, sum((item->>'cantidad')::numeric)
  from jsonb_array_elements(p_items) item
  group by (item->>'producto_id')::uuid;

  perform sp_confirmar_movimiento(v_mov_id);
  return jsonb_build_object('id', v_mov_id, 'codigo', v_codigo, 'estado', 'CONFIRMADO');
end $$;


-- ---------------------------------------------------------------------
-- 5. Ventas: registrar, entregar y anular dentro de una transaccion
-- ---------------------------------------------------------------------

create or replace function rpc_registrar_venta(
  p_ubicacion_id uuid,
  p_items jsonb,
  p_cliente_id uuid default null,
  p_estado estado_venta default 'ENTREGADA',
  p_observaciones text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_venta_id    uuid;
  v_codigo      text;
  v_ubic        ubicaciones;
  v_cliente     uuid;
  v_mov_id      uuid;
  v_det         record;
  v_disponible  numeric;
begin
  perform fn_exigir_nivel(10, 'registrar ventas');

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe incluir al menos un producto.';
  end if;
  if p_estado is null or p_estado not in ('PENDIENTE','ENTREGADA') then
    raise exception 'El estado inicial de la venta no es valido.';
  end if;

  select * into v_ubic from ubicaciones
  where id = p_ubicacion_id and activo and tipo in ('SUCURSAL','DELIVERY');
  if not found then
    raise exception 'Ubicacion de venta invalida.';
  end if;
  if not auth_puede_ver_ubicacion(p_ubicacion_id) then
    raise exception 'No puedes vender desde esa ubicacion.' using errcode = '42501';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where nullif(item->>'producto_id','') is null
       or nullif(item->>'cantidad','') is null
       or (item->>'cantidad')::numeric <= 0
  ) then
    raise exception 'Cada producto debe tener una cantidad mayor que cero.';
  end if;

  select id into v_cliente from ubicaciones where tipo = 'CLIENTE' and activo limit 1;
  if v_cliente is null then
    raise exception 'Falta la ubicacion virtual CLIENTE.';
  end if;

  v_codigo := fn_generar_codigo('VTA', 'seq_venta');
  insert into ventas (codigo, cliente_id, sucursal_id, delivery_id, ubicacion_id,
                      usuario_id, estado, observaciones)
  values (v_codigo, p_cliente_id,
          coalesce(v_ubic.sucursal_id,
                   (select sucursal_base_id from deliveries where id = v_ubic.delivery_id)),
          v_ubic.delivery_id, p_ubicacion_id, auth.uid(),
          p_estado, nullif(trim(p_observaciones),''))
  returning id into v_venta_id;

  insert into ventas_detalle (venta_id, producto_id, cantidad)
  select v_venta_id, (item->>'producto_id')::uuid, sum((item->>'cantidad')::numeric)
  from jsonb_array_elements(p_items) item
  group by (item->>'producto_id')::uuid;

  if p_estado = 'ENTREGADA' then
    insert into movimientos (codigo, tipo, estado, ubicacion_origen_id, ubicacion_destino_id,
                             usuario_id, referencia_tabla, referencia_id, observaciones)
    values (fn_generar_codigo('MOV','seq_movimiento'), 'VENTA', 'BORRADOR',
            p_ubicacion_id, v_cliente, auth.uid(), 'ventas', v_venta_id,
            'Venta ' || v_codigo)
    returning id into v_mov_id;

    insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
    select v_mov_id, producto_id, cantidad from ventas_detalle where venta_id = v_venta_id;
    perform sp_confirmar_movimiento(v_mov_id);
  else
    for v_det in select * from ventas_detalle where venta_id = v_venta_id loop
      select cantidad_disponible into v_disponible
      from inventario
      where producto_id = v_det.producto_id and ubicacion_id = p_ubicacion_id
      for update;

      if coalesce(v_disponible,0) < v_det.cantidad then
        raise exception 'Stock disponible insuficiente de %: hay %, se necesitan %.',
          (select nombre from productos where id = v_det.producto_id),
          coalesce(v_disponible,0), v_det.cantidad;
      end if;

      update inventario
      set cantidad_reservada = cantidad_reservada + v_det.cantidad,
          actualizado_en = now()
      where producto_id = v_det.producto_id and ubicacion_id = p_ubicacion_id;
    end loop;
  end if;

  return jsonb_build_object('id', v_venta_id, 'codigo', v_codigo, 'estado', p_estado);
end $$;


create or replace function rpc_entregar_venta(p_venta_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_venta      ventas;
  v_cliente    uuid;
  v_mov_id     uuid;
  v_det        record;
  v_cantidad   numeric;
  v_reservada  numeric;
begin
  perform fn_exigir_nivel(10, 'entregar ventas');

  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then raise exception 'La venta no existe.'; end if;
  if v_venta.estado <> 'PENDIENTE' then
    raise exception 'Solo se pueden entregar ventas pendientes.';
  end if;
  if not auth_puede_ver_ubicacion(v_venta.ubicacion_id) then
    raise exception 'No puedes entregar ventas de otra ubicacion.' using errcode = '42501';
  end if;

  for v_det in select * from ventas_detalle where venta_id = p_venta_id loop
    select cantidad, cantidad_reservada into v_cantidad, v_reservada
    from inventario
    where producto_id = v_det.producto_id and ubicacion_id = v_venta.ubicacion_id
    for update;

    if coalesce(v_reservada,0) < v_det.cantidad or coalesce(v_cantidad,0) < v_det.cantidad then
      raise exception 'La reserva de % ya no es suficiente para entregar la venta.',
        (select nombre from productos where id = v_det.producto_id);
    end if;

    update inventario
    set cantidad_reservada = cantidad_reservada - v_det.cantidad,
        actualizado_en = now()
    where producto_id = v_det.producto_id and ubicacion_id = v_venta.ubicacion_id;
  end loop;

  select id into v_cliente from ubicaciones where tipo = 'CLIENTE' and activo limit 1;
  if v_cliente is null then raise exception 'Falta la ubicacion virtual CLIENTE.'; end if;

  insert into movimientos (codigo, tipo, estado, ubicacion_origen_id, ubicacion_destino_id,
                           usuario_id, referencia_tabla, referencia_id, observaciones)
  values (fn_generar_codigo('MOV','seq_movimiento'), 'VENTA', 'BORRADOR',
          v_venta.ubicacion_id, v_cliente, auth.uid(), 'ventas', p_venta_id,
          'Entrega ' || v_venta.codigo)
  returning id into v_mov_id;

  insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
  select v_mov_id, producto_id, cantidad from ventas_detalle where venta_id = p_venta_id;
  perform sp_confirmar_movimiento(v_mov_id);

  update ventas set estado = 'ENTREGADA' where id = p_venta_id;
  return jsonb_build_object('id', p_venta_id, 'estado', 'ENTREGADA');
end $$;


create or replace function rpc_anular_venta(p_venta_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_venta ventas;
  v_det   record;
  v_mov   record;
begin
  perform fn_exigir_nivel(60, 'anular ventas');

  if nullif(trim(p_motivo), '') is null then
    raise exception 'Escribe el motivo de la anulacion.';
  end if;

  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then raise exception 'La venta no existe.'; end if;
  if v_venta.estado = 'ANULADA' then raise exception 'La venta ya esta anulada.'; end if;
  if not auth_puede_ver_ubicacion(v_venta.ubicacion_id) then
    raise exception 'No puedes anular ventas de otra ubicacion.' using errcode = '42501';
  end if;

  if v_venta.estado = 'PENDIENTE' then
    for v_det in select * from ventas_detalle where venta_id = p_venta_id loop
      update inventario
      set cantidad_reservada = cantidad_reservada - v_det.cantidad,
          actualizado_en = now()
      where producto_id = v_det.producto_id
        and ubicacion_id = v_venta.ubicacion_id
        and cantidad_reservada >= v_det.cantidad;
      if not found then
        raise exception 'La reserva de la venta esta incompleta; no se puede anular automaticamente.';
      end if;
    end loop;
  else
    if not exists (
      select 1 from movimientos
      where referencia_tabla = 'ventas' and referencia_id = p_venta_id and estado = 'CONFIRMADO'
    ) then
      raise exception 'La venta entregada no tiene un movimiento confirmado para revertir.';
    end if;

    for v_mov in
      select id from movimientos
      where referencia_tabla = 'ventas' and referencia_id = p_venta_id and estado = 'CONFIRMADO'
      order by fecha desc
    loop
      perform fn_revertir_movimiento(v_mov.id, p_motivo);
    end loop;
  end if;

  update ventas
  set estado = 'ANULADA',
      observaciones = concat_ws(' | ', nullif(observaciones,''), 'ANULADA: ' || trim(p_motivo))
  where id = p_venta_id;

  return jsonb_build_object('id', p_venta_id, 'estado', 'ANULADA');
end $$;


-- ---------------------------------------------------------------------
-- 6. Transferencias: reservar, despachar y recibir una sola vez
-- ---------------------------------------------------------------------

create or replace function rpc_crear_transferencia(
  p_origen_id uuid,
  p_destino_id uuid,
  p_items jsonb,
  p_observaciones text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id          uuid;
  v_codigo      text;
  v_det         record;
  v_disponible  numeric;
  v_tipo_origen tipo_ubicacion;
  v_tipo_destino tipo_ubicacion;
begin
  perform fn_exigir_nivel(40, 'crear transferencias');

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La transferencia debe incluir al menos un producto.';
  end if;
  if p_origen_id = p_destino_id then raise exception 'El origen y el destino deben ser distintos.'; end if;

  select tipo into v_tipo_origen from ubicaciones where id = p_origen_id and activo;
  select tipo into v_tipo_destino from ubicaciones where id = p_destino_id and activo;
  if v_tipo_origen is null or v_tipo_destino is null
     or v_tipo_origen not in ('SUCURSAL','DELIVERY')
     or v_tipo_destino not in ('SUCURSAL','DELIVERY') then
    raise exception 'Las transferencias solo pueden usar ubicaciones fisicas.';
  end if;
  if not auth_puede_ver_ubicacion(p_origen_id) then
    raise exception 'No puedes transferir stock de otra sucursal.' using errcode = '42501';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where nullif(item->>'producto_id','') is null
       or nullif(item->>'cantidad','') is null
       or (item->>'cantidad')::numeric <= 0
  ) then
    raise exception 'Cada producto debe tener una cantidad mayor que cero.';
  end if;

  v_codigo := fn_generar_codigo('TRF','seq_transferencia');
  insert into transferencias (codigo, ubicacion_origen_id, ubicacion_destino_id,
                              usuario_solicita_id, observaciones)
  values (v_codigo, p_origen_id, p_destino_id, auth.uid(), nullif(trim(p_observaciones),''))
  returning id into v_id;

  insert into transferencias_detalle (transferencia_id, producto_id, cantidad_enviada)
  select v_id, (item->>'producto_id')::uuid, sum((item->>'cantidad')::numeric)
  from jsonb_array_elements(p_items) item
  group by (item->>'producto_id')::uuid;

  for v_det in select * from transferencias_detalle where transferencia_id = v_id loop
    select cantidad_disponible into v_disponible
    from inventario
    where producto_id = v_det.producto_id and ubicacion_id = p_origen_id
    for update;

    if coalesce(v_disponible,0) < v_det.cantidad_enviada then
      raise exception 'Stock disponible insuficiente de %: hay %, se necesitan %.',
        (select nombre from productos where id = v_det.producto_id),
        coalesce(v_disponible,0), v_det.cantidad_enviada;
    end if;

    update inventario
    set cantidad_reservada = cantidad_reservada + v_det.cantidad_enviada,
        actualizado_en = now()
    where producto_id = v_det.producto_id and ubicacion_id = p_origen_id;
  end loop;

  return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'estado', 'BORRADOR');
end $$;


create or replace function rpc_enviar_transferencia(p_transferencia_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trf       transferencias;
  v_transito  uuid;
  v_mov_id    uuid;
  v_det       record;
begin
  perform fn_exigir_nivel(40, 'enviar transferencias');

  select * into v_trf from transferencias where id = p_transferencia_id for update;
  if not found then raise exception 'La transferencia no existe.'; end if;
  if v_trf.estado <> 'BORRADOR' then
    raise exception 'La transferencia % ya fue enviada.', v_trf.codigo;
  end if;
  if not auth_puede_ver_ubicacion(v_trf.ubicacion_origen_id) then
    raise exception 'Solo la ubicacion de origen puede enviar la transferencia.' using errcode = '42501';
  end if;

  for v_det in select * from transferencias_detalle where transferencia_id = p_transferencia_id loop
    update inventario
    set cantidad_reservada = cantidad_reservada - v_det.cantidad_enviada,
        actualizado_en = now()
    where producto_id = v_det.producto_id
      and ubicacion_id = v_trf.ubicacion_origen_id
      and cantidad_reservada >= v_det.cantidad_enviada;
    if not found then
      raise exception 'La reserva de % esta incompleta.',
        (select nombre from productos where id = v_det.producto_id);
    end if;
  end loop;

  select id into v_transito from ubicaciones where tipo = 'TRANSITO' and activo limit 1;
  if v_transito is null then raise exception 'Falta la ubicacion virtual TRANSITO.'; end if;

  insert into movimientos (codigo, tipo, estado, ubicacion_origen_id, ubicacion_destino_id,
                           usuario_id, referencia_tabla, referencia_id, observaciones)
  values (fn_generar_codigo('MOV','seq_movimiento'),
          'TRANSFERENCIA', 'BORRADOR', v_trf.ubicacion_origen_id, v_transito,
          auth.uid(), 'transferencias', p_transferencia_id, 'Envio ' || v_trf.codigo)
  returning id into v_mov_id;

  insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
  select v_mov_id, producto_id, cantidad_enviada
  from transferencias_detalle where transferencia_id = p_transferencia_id;

  perform sp_confirmar_movimiento(v_mov_id);

  update transferencias
  set estado = 'ENVIADA', fecha_envio = now(), usuario_envia_id = auth.uid()
  where id = p_transferencia_id;

  return jsonb_build_object('id', p_transferencia_id, 'estado', 'ENVIADA');
end $$;


create or replace function rpc_anular_transferencia(p_transferencia_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trf transferencias;
  v_det record;
begin
  perform fn_exigir_nivel(40, 'anular transferencias en borrador');

  if nullif(trim(p_motivo), '') is null then
    raise exception 'Escribe el motivo de la anulacion.';
  end if;

  select * into v_trf from transferencias where id = p_transferencia_id for update;
  if not found then raise exception 'La transferencia no existe.'; end if;
  if v_trf.estado <> 'BORRADOR' then
    raise exception 'Solo se pueden anular transferencias que aun estan en borrador.';
  end if;
  if not auth_puede_ver_ubicacion(v_trf.ubicacion_origen_id) then
    raise exception 'Solo la ubicacion de origen puede anular la transferencia.' using errcode = '42501';
  end if;

  for v_det in select * from transferencias_detalle where transferencia_id = p_transferencia_id loop
    update inventario
    set cantidad_reservada = cantidad_reservada - v_det.cantidad_enviada,
        actualizado_en = now()
    where producto_id = v_det.producto_id
      and ubicacion_id = v_trf.ubicacion_origen_id
      and cantidad_reservada >= v_det.cantidad_enviada;
    if not found then
      raise exception 'La reserva de % esta incompleta.',
        (select nombre from productos where id = v_det.producto_id);
    end if;
  end loop;

  update transferencias
  set estado = 'ANULADA',
      observaciones = concat_ws(' | ', nullif(observaciones,''), 'ANULADA: ' || trim(p_motivo))
  where id = p_transferencia_id;

  return jsonb_build_object('id', p_transferencia_id, 'estado', 'ANULADA');
end $$;


create or replace function rpc_recibir_transferencia(
  p_transferencia_id uuid,
  p_recibidos jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trf          transferencias;
  v_transito     uuid;
  v_merma        uuid;
  v_mov_id       uuid;
  v_merma_id     uuid;
  v_item         jsonb;
  v_filas        int;
  v_hay_faltante boolean := false;
begin
  perform fn_exigir_nivel(40, 'recibir transferencias');

  select * into v_trf from transferencias where id = p_transferencia_id for update;
  if not found then raise exception 'La transferencia no existe.'; end if;
  if v_trf.estado <> 'ENVIADA' then
    raise exception 'La transferencia % no esta pendiente de recepcion.', v_trf.codigo;
  end if;
  if not auth_puede_ver_ubicacion(v_trf.ubicacion_destino_id) then
    raise exception 'Solo la ubicacion de destino puede recibir la transferencia.' using errcode = '42501';
  end if;
  if p_recibidos is not null and jsonb_typeof(p_recibidos) <> 'array' then
    raise exception 'Las cantidades recibidas deben enviarse como una lista.';
  end if;

  select id into v_transito from ubicaciones where tipo = 'TRANSITO' and activo limit 1;
  select id into v_merma from ubicaciones where tipo = 'MERMA' and activo limit 1;
  if v_transito is null or v_merma is null then
    raise exception 'Faltan las ubicaciones virtuales TRANSITO o MERMA.';
  end if;

  update transferencias_detalle
  set cantidad_recibida = cantidad_enviada
  where transferencia_id = p_transferencia_id;

  if p_recibidos is not null then
    for v_item in select * from jsonb_array_elements(p_recibidos) loop
      update transferencias_detalle
      set cantidad_recibida = (v_item->>'cantidad_recibida')::numeric
      where transferencia_id = p_transferencia_id
        and id = (v_item->>'detalle_id')::uuid
        and (v_item->>'cantidad_recibida')::numeric between 0 and cantidad_enviada;

      get diagnostics v_filas = row_count;
      if v_filas <> 1 then
        raise exception 'Una cantidad recibida no pertenece a la transferencia o esta fuera de rango.';
      end if;
    end loop;
  end if;

  -- Si no llego ningun producto no se crea un movimiento vacio.
  if exists (
    select 1 from transferencias_detalle
    where transferencia_id = p_transferencia_id and cantidad_recibida > 0
  ) then
    insert into movimientos (codigo, tipo, estado, ubicacion_origen_id, ubicacion_destino_id,
                             usuario_id, referencia_tabla, referencia_id, observaciones)
    values (fn_generar_codigo('MOV','seq_movimiento'),
            'TRANSFERENCIA', 'BORRADOR', v_transito, v_trf.ubicacion_destino_id,
            auth.uid(), 'transferencias', p_transferencia_id, 'Recepcion ' || v_trf.codigo)
    returning id into v_mov_id;

    insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
    select v_mov_id, producto_id, cantidad_recibida
    from transferencias_detalle
    where transferencia_id = p_transferencia_id and cantidad_recibida > 0;

    perform sp_confirmar_movimiento(v_mov_id);
  end if;

  select exists (
    select 1 from transferencias_detalle
    where transferencia_id = p_transferencia_id and cantidad_recibida < cantidad_enviada
  ) into v_hay_faltante;

  if v_hay_faltante then
    insert into movimientos (codigo, tipo, estado, ubicacion_origen_id, ubicacion_destino_id,
                             usuario_id, referencia_tabla, referencia_id, observaciones)
    values (fn_generar_codigo('MOV','seq_movimiento'),
            'AJUSTE', 'BORRADOR', v_transito, v_merma, auth.uid(),
            'transferencias', p_transferencia_id, 'Faltante en ' || v_trf.codigo)
    returning id into v_merma_id;

    insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
    select v_merma_id, producto_id, cantidad_enviada - cantidad_recibida
    from transferencias_detalle
    where transferencia_id = p_transferencia_id and cantidad_recibida < cantidad_enviada;

    perform sp_confirmar_movimiento(v_merma_id);
  end if;

  update transferencias
  set estado = case when v_hay_faltante then 'RECIBIDA_PARCIAL'::estado_transferencia
                    else 'RECIBIDA'::estado_transferencia end,
      fecha_recepcion = now(), usuario_recibe_id = auth.uid()
  where id = p_transferencia_id;

  return jsonb_build_object('id', p_transferencia_id, 'con_faltante', v_hay_faltante);
end $$;


-- ---------------------------------------------------------------------
-- 7. Conteo fisico: bloqueo concurrente y alcance
-- ---------------------------------------------------------------------

create or replace function rpc_ajustar_stock(
  p_producto_id uuid,
  p_ubicacion_id uuid,
  p_cantidad_contada numeric,
  p_motivo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actual numeric;
  v_delta  numeric;
  v_merma  uuid;
  v_prov   uuid;
  v_mov_id uuid;
begin
  perform fn_exigir_nivel(60, 'ajustar el stock por conteo');

  if p_cantidad_contada is null or p_cantidad_contada < 0 then
    raise exception 'La cantidad contada no puede ser negativa.';
  end if;
  if nullif(trim(p_motivo), '') is null then raise exception 'Escribe el motivo del conteo.'; end if;
  if not exists (
    select 1 from ubicaciones
    where id = p_ubicacion_id and activo and tipo in ('SUCURSAL','DELIVERY')
  ) then
    raise exception 'La ubicacion del conteo no es valida.';
  end if;
  if not auth_puede_ver_ubicacion(p_ubicacion_id) then
    raise exception 'No puedes ajustar stock de otra sucursal.' using errcode = '42501';
  end if;

  select cantidad into v_actual
  from inventario
  where producto_id = p_producto_id and ubicacion_id = p_ubicacion_id
  for update;
  v_actual := coalesce(v_actual, 0);
  v_delta := p_cantidad_contada - v_actual;

  if v_delta = 0 then
    return jsonb_build_object('ajuste', false, 'mensaje', 'El conteo coincide con el sistema.');
  end if;

  select id into v_merma from ubicaciones where tipo = 'MERMA' and activo limit 1;
  select id into v_prov from ubicaciones where tipo = 'PROVEEDOR' and activo limit 1;
  if v_merma is null or v_prov is null then
    raise exception 'Faltan las ubicaciones virtuales MERMA o PROVEEDOR.';
  end if;

  insert into movimientos (codigo, tipo, estado, ubicacion_origen_id, ubicacion_destino_id,
                           usuario_id, observaciones)
  values (fn_generar_codigo('MOV','seq_movimiento'), 'AJUSTE', 'BORRADOR',
          case when v_delta < 0 then p_ubicacion_id else v_prov end,
          case when v_delta < 0 then v_merma else p_ubicacion_id end,
          auth.uid(),
          'Conteo fisico: sistema ' || v_actual || ', contado ' || p_cantidad_contada || '. ' || trim(p_motivo))
  returning id into v_mov_id;

  insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
  values (v_mov_id, p_producto_id, abs(v_delta));

  perform sp_confirmar_movimiento(v_mov_id);
  return jsonb_build_object('ajuste', true, 'diferencia', v_delta);
end $$;


-- ---------------------------------------------------------------------
-- 8. Una ubicacion de stock por cada delivery
-- ---------------------------------------------------------------------

create or replace function fn_sincronizar_ubicacion_delivery()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into ubicaciones (codigo, nombre, tipo, delivery_id, activo)
  values ('UBI-DEL-' || left(new.id::text, 8), 'Stock de ' || new.nombre,
          'DELIVERY', new.id, new.activo)
  on conflict (delivery_id) do update
  set nombre = excluded.nombre, activo = excluded.activo;
  return new;
end $$;

insert into ubicaciones (codigo, nombre, tipo, delivery_id, activo)
select 'UBI-DEL-' || left(d.id::text, 8), 'Stock de ' || d.nombre,
       'DELIVERY', d.id, d.activo
from deliveries d
where not exists (select 1 from ubicaciones u where u.delivery_id = d.id)
on conflict do nothing;

drop trigger if exists trg_delivery_ubicacion on deliveries;
create trigger trg_delivery_ubicacion
after insert or update of nombre, activo on deliveries
for each row execute function fn_sincronizar_ubicacion_delivery();


-- ---------------------------------------------------------------------
-- 9. Reportes: excluir ubicaciones virtuales y evitar productos cartesianos
-- ---------------------------------------------------------------------

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
having coalesce(sum(i.cantidad) filter (where u.tipo in ('SUCURSAL','DELIVERY')), 0) <= p.stock_minimo
order by faltante desc;

create or replace view v_productos_sin_movimiento as
with stock_fisico as (
  select i.producto_id, sum(i.cantidad) as stock_actual
  from inventario i
  join ubicaciones u on u.id = i.ubicacion_id and u.tipo in ('SUCURSAL','DELIVERY')
  group by i.producto_id
), ultimo as (
  select md.producto_id, max(m.fecha) as ultimo_movimiento
  from movimientos_detalle md
  join movimientos m on m.id = md.movimiento_id and m.estado = 'CONFIRMADO'
  group by md.producto_id
)
select
  p.id as producto_id,
  p.sku,
  p.nombre as producto,
  c.nombre as categoria,
  coalesce(sf.stock_actual, 0) as stock_actual,
  ul.ultimo_movimiento,
  current_date - ul.ultimo_movimiento::date as dias_sin_movimiento
from productos p
left join categorias c on c.id = p.categoria_id
left join stock_fisico sf on sf.producto_id = p.id
left join ultimo ul on ul.producto_id = p.id
where p.activo = true
  and (ul.ultimo_movimiento is null or ul.ultimo_movimiento < now() - interval '60 days')
order by dias_sin_movimiento desc nulls first;

alter view v_productos_bajo_stock set (security_invoker = on);
alter view v_productos_sin_movimiento set (security_invoker = on);


-- ---------------------------------------------------------------------
-- 10. Reconstruir reservas existentes y habilitar Realtime declarado
-- ---------------------------------------------------------------------

update inventario set cantidad_reservada = 0 where cantidad_reservada <> 0;

with reservas as (
  select v.ubicacion_id, vd.producto_id, sum(vd.cantidad) as cantidad
  from ventas v
  join ventas_detalle vd on vd.venta_id = v.id
  where v.estado = 'PENDIENTE'
  group by v.ubicacion_id, vd.producto_id
  union all
  select t.ubicacion_origen_id, td.producto_id, sum(td.cantidad_enviada)
  from transferencias t
  join transferencias_detalle td on td.transferencia_id = t.id
  where t.estado = 'BORRADOR'
  group by t.ubicacion_origen_id, td.producto_id
), totales as (
  select ubicacion_id, producto_id, sum(cantidad) as cantidad
  from reservas group by ubicacion_id, producto_id
)
insert into inventario (producto_id, ubicacion_id, cantidad, cantidad_reservada)
select producto_id, ubicacion_id, 0, cantidad from totales
on conflict (producto_id, ubicacion_id) do update
set cantidad_reservada = excluded.cantidad_reservada,
    actualizado_en = now();

do $$
begin
  if exists (select 1 from inventario where cantidad_disponible < 0) then
    raise warning 'Hay reservas historicas mayores que el stock fisico. Revisa ventas pendientes y transferencias en borrador.';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventario'
    ) then
      alter publication supabase_realtime add table inventario;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ventas'
    ) then
      alter publication supabase_realtime add table ventas;
    end if;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 11. Importacion atomica de productos desde Excel
-- ---------------------------------------------------------------------

create or replace function rpc_importar_productos(p_productos jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_sku text;
  v_nombre text;
  v_categoria_texto text;
  v_marca_texto text;
  v_categoria_id uuid;
  v_marca_id uuid;
  v_producto_id uuid;
  v_stock_minimo numeric;
  v_activo boolean;
  v_creados int := 0;
  v_actualizados int := 0;
begin
  perform fn_exigir_nivel(60, 'importar productos');

  if jsonb_typeof(p_productos) <> 'array' then
    raise exception 'El archivo no contiene una lista valida de productos.';
  end if;
  if jsonb_array_length(p_productos) = 0 then
    raise exception 'El archivo no contiene productos.';
  end if;
  if jsonb_array_length(p_productos) > 5000 then
    raise exception 'Solo se permiten 5.000 productos por importacion.';
  end if;

  for v_item in select value from jsonb_array_elements(p_productos)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Una fila del archivo no es valida.';
    end if;

    v_sku := upper(trim(coalesce(v_item->>'sku', '')));
    v_nombre := trim(coalesce(v_item->>'nombre', ''));
    v_categoria_texto := nullif(trim(coalesce(v_item->>'categoria', '')), '');
    v_marca_texto := nullif(trim(coalesce(v_item->>'marca', '')), '');
    v_stock_minimo := coalesce((v_item->>'stock_minimo')::numeric, 0);
    v_activo := coalesce((v_item->>'activo')::boolean, true);
    v_categoria_id := null;
    v_marca_id := null;

    if v_sku = '' or v_nombre = '' then
      raise exception 'Todas las filas necesitan SKU y nombre.';
    end if;
    if v_stock_minimo < 0 then
      raise exception 'El stock minimo de % no puede ser negativo.', v_sku;
    end if;

    if v_categoria_texto is not null then
      select c.id into v_categoria_id
      from categorias c
      where lower(trim(c.nombre)) = lower(v_categoria_texto) and c.activo
      limit 1;
      if v_categoria_id is null then
        raise exception 'La categoria "%" del producto % no existe o esta inactiva.', v_categoria_texto, v_sku;
      end if;
    end if;

    if v_marca_texto is not null then
      select m.id into v_marca_id
      from marcas m
      where lower(trim(m.nombre)) = lower(v_marca_texto) and m.activo
      limit 1;
      if v_marca_id is null then
        raise exception 'La marca "%" del producto % no existe o esta inactiva.', v_marca_texto, v_sku;
      end if;
    end if;

    select p.id into v_producto_id
    from productos p
    where upper(trim(p.sku)) = v_sku
    limit 1
    for update;

    if v_producto_id is null then
      insert into productos (
        sku, nombre, descripcion, categoria_id, marca_id,
        unidad_medida, stock_minimo, activo
      ) values (
        v_sku,
        v_nombre,
        nullif(trim(coalesce(v_item->>'descripcion', '')), ''),
        v_categoria_id,
        v_marca_id,
        coalesce(nullif(trim(v_item->>'unidad_medida'), ''), 'UNIDAD'),
        v_stock_minimo,
        v_activo
      );
      v_creados := v_creados + 1;
    else
      update productos
      set sku = v_sku,
          nombre = v_nombre,
          descripcion = nullif(trim(coalesce(v_item->>'descripcion', '')), ''),
          categoria_id = v_categoria_id,
          marca_id = v_marca_id,
          unidad_medida = coalesce(nullif(trim(v_item->>'unidad_medida'), ''), 'UNIDAD'),
          stock_minimo = v_stock_minimo,
          activo = v_activo,
          updated_at = now()
      where id = v_producto_id;
      v_actualizados := v_actualizados + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'creados', v_creados,
    'actualizados', v_actualizados,
    'total', v_creados + v_actualizados
  );
end $$;


-- ---------------------------------------------------------------------
-- 12. Auditoria consultable y cobertura de las entidades operativas
-- ---------------------------------------------------------------------

drop trigger if exists trg_audit_inventario on inventario;
create trigger trg_audit_inventario after insert or update or delete on inventario
for each row execute function fn_auditar();

drop trigger if exists trg_audit_transferencias on transferencias;
create trigger trg_audit_transferencias after insert or update or delete on transferencias
for each row execute function fn_auditar();

drop trigger if exists trg_audit_transferencias_detalle on transferencias_detalle;
create trigger trg_audit_transferencias_detalle after insert or update or delete on transferencias_detalle
for each row execute function fn_auditar();

drop trigger if exists trg_audit_ventas_detalle on ventas_detalle;
create trigger trg_audit_ventas_detalle after insert or update or delete on ventas_detalle
for each row execute function fn_auditar();

drop trigger if exists trg_audit_clientes on clientes;
create trigger trg_audit_clientes after insert or update or delete on clientes
for each row execute function fn_auditar();

drop trigger if exists trg_audit_deliveries on deliveries;
create trigger trg_audit_deliveries after insert or update or delete on deliveries
for each row execute function fn_auditar();

drop trigger if exists trg_audit_sucursales on sucursales;
create trigger trg_audit_sucursales after insert or update or delete on sucursales
for each row execute function fn_auditar();

create or replace function rpc_consultar_auditoria(
  p_tabla text default null,
  p_accion accion_auditoria default null,
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_limite int default 200
)
returns table (
  id bigint,
  tabla text,
  registro_id text,
  accion accion_auditoria,
  usuario_id uuid,
  usuario_nombre text,
  usuario_email text,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  fecha timestamptz,
  total bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform fn_exigir_nivel(80, 'consultar la auditoria');
  return query
  select
    a.id,
    a.tabla,
    a.registro_id,
    a.accion,
    a.usuario_id,
    u.nombre_completo,
    u.email,
    a.datos_anteriores,
    a.datos_nuevos,
    a.fecha,
    count(*) over() as total
  from auditoria a
  left join usuarios u on u.id = a.usuario_id
  where (p_tabla is null or a.tabla = p_tabla)
    and (p_accion is null or a.accion = p_accion)
    and (p_desde is null or a.fecha >= p_desde)
    and (p_hasta is null or a.fecha <= p_hasta)
  order by a.fecha desc, a.id desc
  limit least(greatest(coalesce(p_limite, 200), 1), 500);
end $$;


-- ---------------------------------------------------------------------
-- 13. Exponer solo las funciones que son endpoints de la aplicacion
-- ---------------------------------------------------------------------

revoke execute on function fn_generar_codigo(text, text) from public, anon, authenticated;
revoke execute on function fn_touch_updated_at() from public, anon, authenticated;
revoke execute on function fn_nuevo_usuario() from public, anon, authenticated;
revoke execute on function fn_aplicar_delta(uuid, uuid, numeric) from public, anon, authenticated;
revoke execute on function sp_confirmar_movimiento(uuid) from public, anon, authenticated;
revoke execute on function fn_revertir_movimiento(uuid, text) from public, anon, authenticated;
revoke execute on function fn_auditar() from public, anon, authenticated;
revoke execute on function fn_sincronizar_ubicacion_delivery() from public, anon, authenticated;
revoke execute on function fn_exigir_nivel(int, text) from public, anon, authenticated;

grant execute on function rpc_registrar_movimiento(tipo_movimiento, uuid, uuid, jsonb, text) to authenticated;
grant execute on function sp_anular_movimiento(uuid, text) to authenticated;
grant execute on function rpc_ajustar_stock(uuid, uuid, numeric, text) to authenticated;
grant execute on function rpc_registrar_venta(uuid, jsonb, uuid, estado_venta, text) to authenticated;
grant execute on function rpc_entregar_venta(uuid) to authenticated;
grant execute on function rpc_anular_venta(uuid, text) to authenticated;
grant execute on function rpc_crear_transferencia(uuid, uuid, jsonb, text) to authenticated;
grant execute on function rpc_enviar_transferencia(uuid) to authenticated;
grant execute on function rpc_anular_transferencia(uuid, text) to authenticated;
grant execute on function rpc_recibir_transferencia(uuid, jsonb) to authenticated;
grant execute on function rpc_importar_productos(jsonb) to authenticated;
grant execute on function rpc_consultar_auditoria(text, accion_auditoria, timestamptz, timestamptz, int) to authenticated;
grant execute on function fn_recalcular_inventario() to authenticated;

revoke execute on function rpc_registrar_movimiento(tipo_movimiento, uuid, uuid, jsonb, text) from anon;
revoke execute on function sp_anular_movimiento(uuid, text) from anon;
revoke execute on function rpc_ajustar_stock(uuid, uuid, numeric, text) from anon;
revoke execute on function rpc_registrar_venta(uuid, jsonb, uuid, estado_venta, text) from anon;
revoke execute on function rpc_entregar_venta(uuid) from anon;
revoke execute on function rpc_anular_venta(uuid, text) from anon;
revoke execute on function rpc_crear_transferencia(uuid, uuid, jsonb, text) from anon;
revoke execute on function rpc_enviar_transferencia(uuid) from anon;
revoke execute on function rpc_anular_transferencia(uuid, text) from anon;
revoke execute on function rpc_recibir_transferencia(uuid, jsonb) from anon;
revoke execute on function rpc_importar_productos(jsonb) from public, anon;
revoke execute on function rpc_consultar_auditoria(text, accion_auditoria, timestamptz, timestamptz, int) from public, anon;

-- Comprobaciones recomendadas despues de ejecutar:
--
-- select policyname, tablename, cmd from pg_policies
-- where schemaname = 'public' order by tablename, policyname;
--
-- select p.proname
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');

commit;

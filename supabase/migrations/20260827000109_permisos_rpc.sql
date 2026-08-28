-- =====================================================================
-- 09_permisos_rpc.sql · el nivel mínimo de cada operación, en la base
-- =====================================================================
-- Las funciones RPC son `security definer`: se ejecutan con los permisos
-- de quien las creó, no de quien las llama. Eso es lo que les permite
-- escribir en `inventario` cuando nadie más puede, pero también significa
-- que **RLS no las alcanza**. Con `grant execute ... to authenticated`,
-- cualquier usuario logueado podía llamarlas directamente contra la API:
-- un repartidor no ve el botón de "anular" en la app, pero un POST a
-- /rest/v1/rpc/sp_anular_movimiento le funcionaba igual.
--
-- Aquí va la otra mitad del permiso: el nivel se verifica dentro de la
-- función, que es el único lugar donde no se puede esquivar.
--
--   registrar movimiento / transferencias   nivel >= 40  (bodega)
--   ajustar stock / anular movimientos      nivel >= 60  (encargado)
--   recalcular inventario                   nivel >= 100 (admin)
--   registrar venta                         cualquier usuario activo,
--                                           y solo desde una ubicación
--                                           que le corresponda
--
-- Excepción deliberada: si `auth.uid()` es nulo, la llamada viene del SQL
-- Editor o de la service_role key, no de la app. Ahí no se bloquea, porque
-- es como se cargan los saldos iniciales y como se hacen las correcciones
-- de emergencia.
--
-- Ejecutar después de 04_rls.sql, que es donde nace auth_nivel().
-- =====================================================================

create or replace function fn_exigir_nivel(p_minimo int, p_accion text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  -- Sin sesión: es la consola o un script de administración.
  if auth.uid() is null then return; end if;

  if coalesce(auth_nivel(), 0) < p_minimo then
    raise exception 'Tu rol no tiene permiso para %.', p_accion
      using errcode = '42501';
  end if;
end $$;


-- --------------------------------------------------------------------
-- Se reemplazan solo las cabeceras: cada función arranca exigiendo nivel
-- --------------------------------------------------------------------

create or replace function rpc_registrar_movimiento(
  p_tipo tipo_movimiento,
  p_ubicacion_origen_id uuid,
  p_ubicacion_destino_id uuid,
  p_items jsonb,
  p_observaciones text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_mov_id uuid;
  v_codigo text;
  v_item   jsonb;
begin
  perform fn_exigir_nivel(40, 'registrar movimientos');

  if jsonb_array_length(p_items) = 0 then
    raise exception 'El movimiento debe incluir al menos un producto.';
  end if;

  v_codigo := fn_generar_codigo('MOV', 'seq_movimiento');

  insert into movimientos (codigo, tipo, estado, ubicacion_origen_id,
                           ubicacion_destino_id, usuario_id, observaciones)
  values (v_codigo, p_tipo, 'BORRADOR', p_ubicacion_origen_id,
          p_ubicacion_destino_id, auth.uid(), p_observaciones)
  returning id into v_mov_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
    values (
      v_mov_id,
      (v_item->>'producto_id')::uuid,
      (v_item->>'cantidad')::numeric
    );
  end loop;

  perform sp_confirmar_movimiento(v_mov_id);
  return jsonb_build_object('id', v_mov_id, 'codigo', v_codigo, 'estado', 'CONFIRMADO');
end $$;


create or replace function sp_anular_movimiento(p_movimiento_id uuid, p_motivo text)
returns movimientos language plpgsql security definer set search_path = public as $$
declare
  v_mov movimientos;
  v_det record;
begin
  perform fn_exigir_nivel(60, 'anular movimientos');

  select * into v_mov from movimientos where id = p_movimiento_id for update;
  if v_mov.estado <> 'CONFIRMADO' then
    raise exception 'Solo se pueden anular movimientos confirmados.';
  end if;

  for v_det in select * from movimientos_detalle where movimiento_id = p_movimiento_id loop
    perform fn_aplicar_delta(v_det.producto_id, v_mov.ubicacion_destino_id, -v_det.cantidad);
    perform fn_aplicar_delta(v_det.producto_id, v_mov.ubicacion_origen_id,   v_det.cantidad);
  end loop;

  update movimientos
    set estado = 'ANULADO',
        observaciones = coalesce(observaciones,'') || ' | ANULADO: ' || p_motivo
    where id = p_movimiento_id
  returning * into v_mov;
  return v_mov;
end $$;


create or replace function rpc_ajustar_stock(
  p_producto_id uuid,
  p_ubicacion_id uuid,
  p_cantidad_contada numeric,
  p_motivo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actual numeric; v_delta numeric; v_merma uuid; v_prov uuid; v_mov_id uuid;
begin
  perform fn_exigir_nivel(60, 'ajustar el stock por conteo');

  select coalesce(cantidad,0) into v_actual
  from inventario where producto_id = p_producto_id and ubicacion_id = p_ubicacion_id;
  v_actual := coalesce(v_actual, 0);
  v_delta  := p_cantidad_contada - v_actual;

  if v_delta = 0 then
    return jsonb_build_object('ajuste', false, 'mensaje', 'El conteo coincide con el sistema.');
  end if;

  select id into v_merma from ubicaciones where tipo = 'MERMA' limit 1;
  select id into v_prov  from ubicaciones where tipo = 'PROVEEDOR' limit 1;

  insert into movimientos (codigo, tipo, estado, ubicacion_origen_id, ubicacion_destino_id,
                           usuario_id, observaciones)
  values (fn_generar_codigo('MOV','seq_movimiento'), 'AJUSTE', 'BORRADOR',
          case when v_delta < 0 then p_ubicacion_id else v_prov end,
          case when v_delta < 0 then v_merma        else p_ubicacion_id end,
          auth.uid(),
          'Conteo físico: sistema ' || v_actual || ', contado ' || p_cantidad_contada || '. ' || p_motivo)
  returning id into v_mov_id;

  insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
  values (v_mov_id, p_producto_id, abs(v_delta));

  perform sp_confirmar_movimiento(v_mov_id);
  return jsonb_build_object('ajuste', true, 'diferencia', v_delta);
end $$;


-- Las tres de transferencias: nivel de bodega para las tres etapas.
create or replace function rpc_crear_transferencia(
  p_origen_id uuid,
  p_destino_id uuid,
  p_items jsonb,
  p_observaciones text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_codigo text; v_item jsonb;
begin
  perform fn_exigir_nivel(40, 'crear transferencias');

  v_codigo := fn_generar_codigo('TRF','seq_transferencia');
  insert into transferencias (codigo, ubicacion_origen_id, ubicacion_destino_id,
                              usuario_solicita_id, observaciones)
  values (v_codigo, p_origen_id, p_destino_id, auth.uid(), p_observaciones)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into transferencias_detalle (transferencia_id, producto_id, cantidad_enviada)
    values (v_id, (v_item->>'producto_id')::uuid, (v_item->>'cantidad')::numeric);
  end loop;

  return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'estado', 'BORRADOR');
end $$;


-- Recalcular el inventario entero es la operación más delicada del sistema:
-- solo un administrador, y solo si sospecha un descuadre.
create or replace function fn_recalcular_inventario()
returns int language plpgsql security definer set search_path = public as $$
declare v_filas int;
begin
  perform fn_exigir_nivel(100, 'recalcular todo el inventario');

  update inventario set cantidad = 0;

  with deltas as (
    select md.producto_id, m.ubicacion_origen_id as ubicacion_id, -sum(md.cantidad) as delta
    from movimientos_detalle md join movimientos m on m.id = md.movimiento_id
    where m.estado = 'CONFIRMADO'
    group by 1,2
    union all
    select md.producto_id, m.ubicacion_destino_id, sum(md.cantidad)
    from movimientos_detalle md join movimientos m on m.id = md.movimiento_id
    where m.estado = 'CONFIRMADO'
    group by 1,2
  ),
  totales as (
    select producto_id, ubicacion_id, sum(delta) as cantidad
    from deltas group by 1,2
  )
  insert into inventario (producto_id, ubicacion_id, cantidad)
  select producto_id, ubicacion_id, cantidad from totales
  on conflict (producto_id, ubicacion_id) do update
    set cantidad = excluded.cantidad, actualizado_en = now();

  get diagnostics v_filas = row_count;
  return v_filas;
end $$;


-- rpc_enviar_transferencia y rpc_recibir_transferencia se protegen igual;
-- sus cuerpos no cambian, solo se les antepone la verificación.
create or replace function rpc_enviar_transferencia(p_transferencia_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trf transferencias; v_transito uuid; v_mov_id uuid;
begin
  perform fn_exigir_nivel(40, 'enviar transferencias');

  select * into v_trf from transferencias where id = p_transferencia_id for update;
  if v_trf.estado <> 'BORRADOR' then
    raise exception 'La transferencia % ya fue enviada.', v_trf.codigo;
  end if;

  select id into v_transito from ubicaciones where tipo = 'TRANSITO' limit 1;

  insert into movimientos (codigo, tipo, estado, ubicacion_origen_id, ubicacion_destino_id,
                           usuario_id, referencia_tabla, referencia_id, observaciones)
  values (fn_generar_codigo('MOV','seq_movimiento'),
          'TRANSFERENCIA', 'BORRADOR', v_trf.ubicacion_origen_id, v_transito,
          auth.uid(), 'transferencias', p_transferencia_id, 'Envío ' || v_trf.codigo)
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


create or replace function rpc_recibir_transferencia(
  p_transferencia_id uuid,
  p_recibidos jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trf transferencias; v_transito uuid; v_merma uuid;
  v_mov_id uuid; v_merma_id uuid; v_item jsonb;
  v_hay_faltante boolean := false;
begin
  perform fn_exigir_nivel(40, 'recibir transferencias');

  select * into v_trf from transferencias where id = p_transferencia_id for update;
  if v_trf.estado not in ('ENVIADA','RECIBIDA_PARCIAL') then
    raise exception 'La transferencia % no está en camino.', v_trf.codigo;
  end if;

  select id into v_transito from ubicaciones where tipo = 'TRANSITO' limit 1;
  select id into v_merma    from ubicaciones where tipo = 'MERMA' limit 1;

  update transferencias_detalle
    set cantidad_recibida = cantidad_enviada
    where transferencia_id = p_transferencia_id and cantidad_recibida is null;

  if p_recibidos is not null then
    for v_item in select * from jsonb_array_elements(p_recibidos) loop
      update transferencias_detalle
        set cantidad_recibida = (v_item->>'cantidad_recibida')::numeric
        where id = (v_item->>'detalle_id')::uuid;
    end loop;
  end if;

  insert into movimientos (codigo, tipo, estado, ubicacion_origen_id, ubicacion_destino_id,
                           usuario_id, referencia_tabla, referencia_id, observaciones)
  values (fn_generar_codigo('MOV','seq_movimiento'),
          'TRANSFERENCIA', 'BORRADOR', v_transito, v_trf.ubicacion_destino_id,
          auth.uid(), 'transferencias', p_transferencia_id, 'Recepción ' || v_trf.codigo)
  returning id into v_mov_id;

  insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
  select v_mov_id, producto_id, cantidad_recibida
  from transferencias_detalle
  where transferencia_id = p_transferencia_id and cantidad_recibida > 0;

  perform sp_confirmar_movimiento(v_mov_id);

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


-- Verificación: un usuario con rol DELIVERY debe recibir un error 42501 al
-- llamar cualquiera de estas desde la app, aunque tenga sesión válida.

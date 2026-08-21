-- =====================================================================
-- NIVELER BOLIVIA — 03_funciones.sql
-- Lógica de negocio en la base de datos.
--
-- REGLA CENTRAL: el frontend NUNCA hace UPDATE sobre `inventario`.
-- Solo llama a estas funciones (RPC). El saldo es consecuencia de los
-- movimientos, nunca al revés. Esto hace imposible el descuadre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- UTILIDADES
-- ---------------------------------------------------------------------

create or replace function fn_generar_codigo(p_prefijo text, p_secuencia text)
returns text language plpgsql as $$
begin
  return p_prefijo || '-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval(p_secuencia)::text, 6, '0');
end $$;

create or replace function fn_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_productos_updated before update on productos
  for each row execute function fn_touch_updated_at();
create trigger trg_usuarios_updated before update on usuarios
  for each row execute function fn_touch_updated_at();
create trigger trg_ventas_updated before update on ventas
  for each row execute function fn_touch_updated_at();

-- Alta automática del perfil cuando alguien se registra en Supabase Auth.
create or replace function fn_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, email, nombre_completo, rol_id, activo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre_completo', split_part(new.email,'@',1)),
    (select id from roles where codigo = 'VENTAS'),  -- rol mínimo por defecto
    false  -- inactivo hasta que un ADMIN lo apruebe
  );
  return new;
end $$;

create trigger trg_auth_nuevo_usuario
  after insert on auth.users
  for each row execute function fn_nuevo_usuario();


-- ---------------------------------------------------------------------
-- MOTOR DE STOCK
-- ---------------------------------------------------------------------

-- Aplica un delta a una celda de inventario, creándola si no existe.
create or replace function fn_aplicar_delta(
  p_producto_id uuid,
  p_ubicacion_id uuid,
  p_delta numeric
) returns void language plpgsql as $$
begin
  insert into inventario (producto_id, ubicacion_id, cantidad)
  values (p_producto_id, p_ubicacion_id, p_delta)
  on conflict (producto_id, ubicacion_id) do update
    set cantidad = inventario.cantidad + excluded.cantidad,
        actualizado_en = now();
end $$;

-- Confirma un movimiento en BORRADOR: valida stock y mueve saldos.
-- Es atómica: si un solo producto falla, no se aplica nada.
create or replace function sp_confirmar_movimiento(p_movimiento_id uuid)
returns movimientos language plpgsql security definer set search_path = public as $$
declare
  v_mov      movimientos;
  v_det      record;
  v_origen   ubicaciones;
  v_stock    numeric;
begin
  select * into v_mov from movimientos where id = p_movimiento_id for update;
  if not found then
    raise exception 'El movimiento no existe.';
  end if;
  if v_mov.estado <> 'BORRADOR' then
    raise exception 'El movimiento % ya fue procesado (estado: %).', v_mov.codigo, v_mov.estado;
  end if;

  select * into v_origen from ubicaciones where id = v_mov.ubicacion_origen_id;

  for v_det in
    select * from movimientos_detalle where movimiento_id = p_movimiento_id
  loop
    -- Solo se valida stock si el origen es una ubicación física real.
    if v_origen.tipo in ('SUCURSAL','DELIVERY','TRANSITO') then
      select coalesce(cantidad, 0) into v_stock
      from inventario
      where producto_id = v_det.producto_id and ubicacion_id = v_mov.ubicacion_origen_id
      for update;

      if coalesce(v_stock, 0) < v_det.cantidad then
        raise exception 'Stock insuficiente de % en %: hay %, se necesitan %.',
          (select nombre from productos where id = v_det.producto_id),
          v_origen.nombre, coalesce(v_stock,0), v_det.cantidad;
      end if;
    end if;

    perform fn_aplicar_delta(v_det.producto_id, v_mov.ubicacion_origen_id,  -v_det.cantidad);
    perform fn_aplicar_delta(v_det.producto_id, v_mov.ubicacion_destino_id,  v_det.cantidad);
  end loop;

  update movimientos set estado = 'CONFIRMADO' where id = p_movimiento_id
  returning * into v_mov;
  return v_mov;
end $$;

-- Anula un movimiento confirmado revirtiendo los saldos.
-- No borra el registro: la trazabilidad se conserva.
create or replace function sp_anular_movimiento(p_movimiento_id uuid, p_motivo text)
returns movimientos language plpgsql security definer set search_path = public as $$
declare
  v_mov movimientos;
  v_det record;
begin
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


-- ---------------------------------------------------------------------
-- RPC: REGISTRAR MOVIMIENTO (entrada, salida, ajuste, entrega a delivery)
-- ---------------------------------------------------------------------
-- p_items: [{"producto_id":"uuid","cantidad":5}]
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


-- ---------------------------------------------------------------------
-- RPC: REGISTRAR VENTA
-- ---------------------------------------------------------------------
-- Crea la venta, su detalle y el movimiento de salida en una sola
-- transacción. Si no hay stock, no se crea nada.
-- p_items: [{"producto_id":"uuid","cantidad":2}]
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
  v_item        jsonb;
  v_ubic        ubicaciones;
  v_ubic_cliente uuid;
  v_mov_id      uuid;
begin
  select * into v_ubic from ubicaciones where id = p_ubicacion_id;
  if not found then raise exception 'Ubicación de venta inválida.'; end if;

  select id into v_ubic_cliente from ubicaciones where tipo = 'CLIENTE' limit 1;
  v_codigo := fn_generar_codigo('VTA', 'seq_venta');

  insert into ventas (codigo, cliente_id, sucursal_id, delivery_id, ubicacion_id,
                      usuario_id, estado, observaciones)
  values (v_codigo, p_cliente_id,
          coalesce(v_ubic.sucursal_id,
                   (select sucursal_base_id from deliveries where id = v_ubic.delivery_id)),
          v_ubic.delivery_id, p_ubicacion_id, auth.uid(),
          p_estado, p_observaciones)
  returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into ventas_detalle (venta_id, producto_id, cantidad)
    values (
      v_venta_id,
      (v_item->>'producto_id')::uuid,
      (v_item->>'cantidad')::numeric
    );
  end loop;

  -- El stock sale solo si la mercadería ya se entregó.
  if p_estado = 'ENTREGADA' then
    insert into movimientos (codigo, tipo, estado, ubicacion_origen_id, ubicacion_destino_id,
                             usuario_id, referencia_tabla, referencia_id, observaciones)
    values (fn_generar_codigo('MOV','seq_movimiento'), 'VENTA', 'BORRADOR',
            p_ubicacion_id, v_ubic_cliente, auth.uid(), 'ventas', v_venta_id,
            'Venta ' || v_codigo)
    returning id into v_mov_id;

    insert into movimientos_detalle (movimiento_id, producto_id, cantidad)
    select v_mov_id, vd.producto_id, vd.cantidad
    from ventas_detalle vd
    where vd.venta_id = v_venta_id;

    perform sp_confirmar_movimiento(v_mov_id);  -- lanza excepción si falta stock
  else
    -- PENDIENTE: se reserva el stock sin sacarlo todavía.
    update inventario i
      set cantidad_reservada = i.cantidad_reservada + vd.cantidad
      from ventas_detalle vd
      where vd.venta_id = v_venta_id
        and i.producto_id = vd.producto_id
        and i.ubicacion_id = p_ubicacion_id;
  end if;

  return jsonb_build_object('id', v_venta_id, 'codigo', v_codigo, 'estado', p_estado);
end $$;


-- ---------------------------------------------------------------------
-- RPC: TRANSFERENCIAS EN DOS PASOS
-- ---------------------------------------------------------------------
-- Sirve para los cuatro flujos: sucursal↔sucursal, sucursal↔delivery,
-- delivery↔delivery. La mercadería viaja por la ubicación TRANSITO, así
-- que nunca aparece duplicada ni desaparece mientras está en camino.

create or replace function rpc_crear_transferencia(
  p_origen_id uuid,
  p_destino_id uuid,
  p_items jsonb,
  p_observaciones text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_codigo text; v_item jsonb;
begin
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

-- Paso 1: el origen despacha. Stock sale del origen y entra a TRANSITO.
create or replace function rpc_enviar_transferencia(p_transferencia_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trf transferencias; v_transito uuid; v_mov_id uuid;
begin
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

-- Paso 2: el destino confirma lo que realmente llegó.
-- p_recibidos: [{"detalle_id":"uuid","cantidad_recibida":8}]
-- Si llega menos de lo enviado, la diferencia se registra como MERMA.
create or replace function rpc_recibir_transferencia(
  p_transferencia_id uuid,
  p_recibidos jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trf transferencias; v_transito uuid; v_merma uuid;
  v_mov_id uuid; v_merma_id uuid; v_item jsonb;
  v_hay_faltante boolean := false;
begin
  select * into v_trf from transferencias where id = p_transferencia_id for update;
  if v_trf.estado not in ('ENVIADA','RECIBIDA_PARCIAL') then
    raise exception 'La transferencia % no está en camino.', v_trf.codigo;
  end if;

  select id into v_transito from ubicaciones where tipo = 'TRANSITO' limit 1;
  select id into v_merma    from ubicaciones where tipo = 'MERMA' limit 1;

  -- Por defecto se recibe todo lo enviado.
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

  -- TRANSITO → destino (lo que efectivamente llegó)
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

  -- Faltantes: TRANSITO → MERMA, para que tránsito quede en cero.
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
-- RPC: AJUSTE POR CONTEO FÍSICO
-- ---------------------------------------------------------------------
-- Recibe la cantidad contada y genera el movimiento de diferencia.
create or replace function rpc_ajustar_stock(
  p_producto_id uuid,
  p_ubicacion_id uuid,
  p_cantidad_contada numeric,
  p_motivo text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actual numeric; v_delta numeric; v_merma uuid; v_prov uuid; v_mov_id uuid;
begin
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


-- ---------------------------------------------------------------------
-- MANTENIMIENTO: reconstruir todo el inventario desde los movimientos
-- ---------------------------------------------------------------------
-- Red de seguridad. Si alguna vez se sospecha un descuadre, esto
-- recalcula cada saldo desde cero usando el libro de movimientos.
create or replace function fn_recalcular_inventario()
returns int language plpgsql security definer set search_path = public as $$
declare v_filas int;
begin
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


-- ---------------------------------------------------------------------
-- AUDITORÍA AUTOMÁTICA
-- ---------------------------------------------------------------------
create or replace function fn_auditar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabla, registro_id, accion, usuario_id, datos_anteriores, datos_nuevos)
  values (
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    tg_op::accion_auditoria,
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger trg_audit_productos after insert or update or delete on productos
  for each row execute function fn_auditar();
create trigger trg_audit_inventario after update on inventario
  for each row execute function fn_auditar();
create trigger trg_audit_ventas after insert or update or delete on ventas
  for each row execute function fn_auditar();
create trigger trg_audit_movimientos after insert or update on movimientos
  for each row execute function fn_auditar();
create trigger trg_audit_usuarios after insert or update or delete on usuarios
  for each row execute function fn_auditar();

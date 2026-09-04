-- =====================================================================
-- NIVELER — 16_productos_stock_pedidos.sql
-- Stock inicial auditado y múltiples números de pedido por cliente.
-- =====================================================================

begin;

-- Un cliente puede comprar más de una vez. El número pertenece al pedido,
-- no a la ficha maestra del cliente, para conservar todo el historial.
create table cliente_pedidos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id) on delete restrict,
  numero      text not null check (char_length(trim(numero)) between 1 and 80),
  activo      boolean not null default true,
  creado_por  uuid references usuarios(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_cliente_pedidos_id_cliente unique (id, cliente_id)
);

create unique index uq_cliente_pedidos_numero
  on cliente_pedidos (cliente_id, lower(trim(numero)));
create index idx_cliente_pedidos_cliente_fecha
  on cliente_pedidos (cliente_id, created_at desc);

alter table ventas add column pedido_cliente_id uuid;
alter table ventas add constraint fk_ventas_pedido_cliente
  foreign key (pedido_cliente_id, cliente_id)
  references cliente_pedidos(id, cliente_id) on delete restrict;
create index idx_ventas_pedido_cliente on ventas(pedido_cliente_id);

alter table cliente_pedidos enable row level security;
create policy cliente_pedidos_lectura on cliente_pedidos for select
  using (auth_nivel() > 0);
create policy cliente_pedidos_escritura on cliente_pedidos for all
  using (auth_nivel() >= 30) with check (auth_nivel() >= 30);
grant select, insert, update, delete on table cliente_pedidos to authenticated;
revoke all on table cliente_pedidos from public, anon;

drop trigger if exists trg_cliente_pedidos_updated on cliente_pedidos;
create trigger trg_cliente_pedidos_updated before update on cliente_pedidos
for each row execute function fn_touch_updated_at();

drop trigger if exists trg_audit_cliente_pedidos on cliente_pedidos;
create trigger trg_audit_cliente_pedidos after insert or update or delete on cliente_pedidos
for each row execute function fn_auditar();

drop trigger if exists trg_audit_ventas on ventas;
create trigger trg_audit_ventas after insert or update or delete on ventas
for each row execute function fn_auditar();

-- Guarda la ficha y, si se escribió un número, agrega un pedido sin borrar
-- los anteriores. La columna histórica clientes.email se conserva para no
-- perder datos, aunque deja de editarse desde la aplicación.
create or replace function rpc_guardar_cliente(
  p_cliente_id uuid,
  p_nombre text,
  p_nit_ci text,
  p_telefono text,
  p_direccion text,
  p_ciudad text,
  p_activo boolean,
  p_numero_pedido text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cliente clientes;
  v_pedido_id uuid;
  v_numero text := nullif(trim(p_numero_pedido), '');
begin
  perform fn_exigir_nivel(30, 'guardar clientes');
  if char_length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception 'Escribe el nombre del cliente.';
  end if;

  if p_cliente_id is null then
    insert into clientes(nombre, nit_ci, telefono, direccion, ciudad, activo)
    values (trim(p_nombre), nullif(trim(p_nit_ci), ''), nullif(trim(p_telefono), ''),
            nullif(trim(p_direccion), ''), nullif(trim(p_ciudad), ''), coalesce(p_activo, true))
    returning * into v_cliente;
  else
    update clientes
    set nombre = trim(p_nombre),
        nit_ci = nullif(trim(p_nit_ci), ''),
        telefono = nullif(trim(p_telefono), ''),
        direccion = nullif(trim(p_direccion), ''),
        ciudad = nullif(trim(p_ciudad), ''),
        activo = coalesce(p_activo, true)
    where id = p_cliente_id
    returning * into v_cliente;
    if not found then raise exception 'El cliente no existe.'; end if;
  end if;

  if v_numero is not null then
    insert into cliente_pedidos(cliente_id, numero, creado_por)
    values (v_cliente.id, v_numero, auth.uid())
    on conflict do nothing
    returning id into v_pedido_id;

    if v_pedido_id is null then
      select id into v_pedido_id from cliente_pedidos
      where cliente_id = v_cliente.id and lower(trim(numero)) = lower(v_numero);
    end if;
  end if;

  return to_jsonb(v_cliente) || jsonb_build_object('pedido_agregado_id', v_pedido_id);
end $$;

-- El producto y su saldo inicial nacen en la misma transacción. El saldo se
-- genera llamando al motor normal de movimientos: nunca se escribe inventario.
create or replace function rpc_crear_producto_con_stock(
  p_sku text,
  p_nombre text,
  p_descripcion text,
  p_categoria_id uuid,
  p_marca_id uuid,
  p_unidad_medida text,
  p_stock_minimo numeric,
  p_activo boolean,
  p_stock_inicial numeric,
  p_ubicacion_destino_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_producto productos;
  v_proveedor_id uuid;
  v_movimiento jsonb := null;
begin
  perform fn_exigir_nivel(60, 'crear productos');
  if nullif(trim(p_sku), '') is null then raise exception 'El código es obligatorio.'; end if;
  if char_length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe el nombre del producto.'; end if;
  if coalesce(p_stock_minimo, 0) < 0 then raise exception 'El stock mínimo no puede ser negativo.'; end if;
  if coalesce(p_stock_inicial, 0) < 0 then raise exception 'El stock inicial no puede ser negativo.'; end if;
  if coalesce(p_stock_inicial, 0) > 0 and p_ubicacion_destino_id is null then
    raise exception 'Selecciona la sucursal que recibirá el stock inicial.';
  end if;

  insert into productos(sku, nombre, descripcion, categoria_id, marca_id,
                        unidad_medida, stock_minimo, activo)
  values (trim(p_sku), trim(p_nombre), nullif(trim(p_descripcion), ''),
          p_categoria_id, p_marca_id, trim(p_unidad_medida),
          coalesce(p_stock_minimo, 0), coalesce(p_activo, true))
  returning * into v_producto;

  if coalesce(p_stock_inicial, 0) > 0 then
    select id into v_proveedor_id from ubicaciones
    where tipo = 'PROVEEDOR' and activo order by id limit 1;
    if v_proveedor_id is null then raise exception 'Falta la ubicación virtual PROVEEDOR.'; end if;

    v_movimiento := rpc_registrar_movimiento(
      'ENTRADA', v_proveedor_id, p_ubicacion_destino_id,
      jsonb_build_array(jsonb_build_object(
        'producto_id', v_producto.id,
        'cantidad', p_stock_inicial
      )),
      'Stock inicial al registrar ' || v_producto.sku
    );
  end if;

  return to_jsonb(v_producto) || jsonb_build_object('movimiento_stock_inicial', v_movimiento);
end $$;

-- Extiende ventas sin reemplazar el endpoint histórico. Si el número no
-- existía para el cliente se crea dentro de la misma transacción de la venta.
create or replace function rpc_registrar_venta_con_pedido(
  p_ubicacion_id uuid,
  p_items jsonb,
  p_cliente_id uuid default null,
  p_estado estado_venta default 'ENTREGADA',
  p_observaciones text default null,
  p_numero_pedido text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_numero text := nullif(trim(p_numero_pedido), '');
  v_pedido_id uuid;
  v_resultado jsonb;
begin
  perform fn_exigir_nivel(10, 'registrar ventas');

  if p_cliente_id is null and v_numero is not null then
    raise exception 'Selecciona el cliente al que pertenece el número de pedido.';
  end if;

  if p_cliente_id is not null then
    if not exists (select 1 from clientes where id = p_cliente_id and activo) then
      raise exception 'El cliente no existe o está inactivo.';
    end if;

    if v_numero is not null then
      select id into v_pedido_id from cliente_pedidos
      where cliente_id = p_cliente_id and lower(trim(numero)) = lower(v_numero) and activo;

      if v_pedido_id is null then
        insert into cliente_pedidos(cliente_id, numero, creado_por)
        values (p_cliente_id, v_numero, auth.uid())
        on conflict do nothing
        returning id into v_pedido_id;

        if v_pedido_id is null then
          select id into v_pedido_id from cliente_pedidos
          where cliente_id = p_cliente_id and lower(trim(numero)) = lower(v_numero);
        end if;
      end if;
    end if;
  end if;

  v_resultado := rpc_registrar_venta(
    p_ubicacion_id, p_items, p_cliente_id, p_estado, p_observaciones
  );

  if v_pedido_id is not null then
    update ventas set pedido_cliente_id = v_pedido_id
    where id = (v_resultado->>'id')::uuid;
  end if;

  return v_resultado || jsonb_build_object(
    'pedido_cliente_id', v_pedido_id,
    'numero_pedido', v_numero
  );
end $$;

-- El outbox conserva la misma operación REGISTRAR_VENTA y ahora reenvía el
-- número. Las claves antiguas sin ese campo siguen siendo válidas.
create or replace function rpc_ejecutar_operacion_offline(p_clave uuid, p_tipo text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_usuario uuid := auth.uid();
  v_hash text;
  v_existente operaciones_idempotentes;
  v_resultado jsonb;
  v_nueva_id bigint;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión para sincronizar operaciones.' using errcode = '42501';
  end if;
  if p_clave is null or p_payload is null or nullif(trim(coalesce(p_tipo, '')), '') is null then
    raise exception 'La operación offline está incompleta.';
  end if;
  v_hash := encode(extensions.digest(convert_to(p_tipo || ':' || p_payload::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_existente from operaciones_idempotentes
  where usuario_id = v_usuario and clave = p_clave;
  if found then
    if v_existente.payload_hash <> v_hash or v_existente.tipo <> p_tipo then
      raise exception 'La clave idempotente ya fue usada con otros datos.';
    end if;
    if v_existente.resultado is null then
      raise exception 'La operación idempotente anterior no terminó correctamente.';
    end if;
    return v_existente.resultado;
  end if;

  insert into operaciones_idempotentes(usuario_id, clave, tipo, payload_hash, resultado, completed_at)
  values (v_usuario, p_clave, p_tipo, v_hash, null, null)
  on conflict (usuario_id, clave) do nothing
  returning id into v_nueva_id;
  if v_nueva_id is null then
    select * into v_existente from operaciones_idempotentes
    where usuario_id = v_usuario and clave = p_clave;
    if v_existente.payload_hash <> v_hash or v_existente.tipo <> p_tipo then
      raise exception 'La clave idempotente ya fue usada con otros datos.';
    end if;
    if v_existente.resultado is null then
      raise exception 'La operación idempotente anterior no terminó correctamente.';
    end if;
    return v_existente.resultado;
  end if;

  case p_tipo
    when 'REGISTRAR_MOVIMIENTO' then
      v_resultado := rpc_registrar_movimiento((p_payload->>'tipo')::tipo_movimiento,
        (p_payload->>'origen')::uuid, (p_payload->>'destino')::uuid,
        p_payload->'items', nullif(p_payload->>'observaciones', ''));
    when 'ANULAR_MOVIMIENTO' then
      v_resultado := to_jsonb(sp_anular_movimiento((p_payload->>'id')::uuid, p_payload->>'motivo'));
    when 'AJUSTAR_STOCK' then
      v_resultado := rpc_ajustar_stock((p_payload->>'producto_id')::uuid,
        (p_payload->>'ubicacion_id')::uuid, (p_payload->>'cantidad_contada')::numeric,
        p_payload->>'motivo');
    when 'REGISTRAR_VENTA' then
      v_resultado := rpc_registrar_venta_con_pedido((p_payload->>'ubicacion_id')::uuid,
        p_payload->'items', nullif(p_payload->>'cliente_id', '')::uuid,
        coalesce(nullif(p_payload->>'estado', ''), 'ENTREGADA')::estado_venta,
        nullif(p_payload->>'observaciones', ''), nullif(p_payload->>'numero_pedido', ''));
    when 'ENTREGAR_VENTA' then v_resultado := rpc_entregar_venta((p_payload->>'id')::uuid);
    when 'ANULAR_VENTA' then v_resultado := rpc_anular_venta((p_payload->>'id')::uuid, p_payload->>'motivo');
    when 'CREAR_TRANSFERENCIA' then
      v_resultado := rpc_crear_transferencia((p_payload->>'origen')::uuid,
        (p_payload->>'destino')::uuid, p_payload->'items', nullif(p_payload->>'observaciones', ''));
    when 'ENVIAR_TRANSFERENCIA' then v_resultado := rpc_enviar_transferencia((p_payload->>'id')::uuid);
    when 'ANULAR_TRANSFERENCIA' then
      v_resultado := rpc_anular_transferencia((p_payload->>'id')::uuid, p_payload->>'motivo');
    when 'RECIBIR_TRANSFERENCIA' then
      v_resultado := rpc_recibir_transferencia((p_payload->>'id')::uuid, p_payload->'recibidos');
    when 'CREAR_ENCOMIENDA' then
      v_resultado := rpc_crear_encomienda((p_payload->>'tipo')::tipo_encomienda,
        (p_payload->>'delivery_origen_id')::uuid, p_payload->>'descripcion',
        nullif(p_payload->>'cliente_id', '')::uuid, nullif(p_payload->>'delivery_destino_id', '')::uuid,
        coalesce((p_payload->>'cantidad_bultos')::int, 1), nullif(p_payload->>'peso_kg', '')::numeric,
        nullif(p_payload->>'ciudad_destino', ''), nullif(p_payload->>'direccion_entrega', ''),
        nullif(p_payload->>'observaciones', ''));
    when 'DESPACHAR_ENCOMIENDA' then v_resultado := rpc_despachar_encomienda((p_payload->>'id')::uuid);
    when 'ENTREGAR_ENCOMIENDA' then v_resultado := rpc_entregar_encomienda((p_payload->>'id')::uuid);
    when 'ANULAR_ENCOMIENDA' then
      v_resultado := rpc_anular_encomienda((p_payload->>'id')::uuid, p_payload->>'motivo');
    else raise exception 'Tipo de operación offline no permitido: %', p_tipo;
  end case;

  update operaciones_idempotentes set resultado = v_resultado, completed_at = now()
  where id = v_nueva_id;
  return v_resultado;
end $$;

grant execute on function rpc_guardar_cliente(uuid, text, text, text, text, text, boolean, text) to authenticated;
grant execute on function rpc_crear_producto_con_stock(text, text, text, uuid, uuid, text, numeric, boolean, numeric, uuid) to authenticated;
grant execute on function rpc_ejecutar_operacion_offline(uuid, text, jsonb) to authenticated;

revoke execute on function rpc_guardar_cliente(uuid, text, text, text, text, text, boolean, text) from public, anon;
revoke execute on function rpc_crear_producto_con_stock(text, text, text, uuid, uuid, text, numeric, boolean, numeric, uuid) from public, anon;
revoke execute on function rpc_registrar_venta_con_pedido(uuid, jsonb, uuid, estado_venta, text, text) from public, anon, authenticated;
revoke execute on function rpc_ejecutar_operacion_offline(uuid, text, jsonb) from public, anon;

notify pgrst, 'reload schema';

commit;

-- =====================================================================
-- NIVELER BOLIVIA — 14_offline_idempotencia.sql
-- Reintentos seguros para la cola offline de la PWA.
-- =====================================================================

begin;

create table operaciones_idempotentes (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  clave uuid not null,
  tipo text not null check (tipo in (
    'REGISTRAR_MOVIMIENTO', 'ANULAR_MOVIMIENTO', 'AJUSTAR_STOCK',
    'REGISTRAR_VENTA', 'ENTREGAR_VENTA', 'ANULAR_VENTA',
    'CREAR_TRANSFERENCIA', 'ENVIAR_TRANSFERENCIA', 'ANULAR_TRANSFERENCIA',
    'RECIBIR_TRANSFERENCIA', 'CREAR_ENCOMIENDA', 'DESPACHAR_ENCOMIENDA',
    'ENTREGAR_ENCOMIENDA', 'ANULAR_ENCOMIENDA'
  )),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  resultado jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint uq_operacion_idempotente unique (usuario_id, clave)
);

create index idx_operaciones_idempotentes_antiguas on operaciones_idempotentes(created_at);
alter table operaciones_idempotentes enable row level security;
revoke all on table operaciones_idempotentes from public, anon, authenticated;

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
      v_resultado := rpc_registrar_venta((p_payload->>'ubicacion_id')::uuid,
        p_payload->'items', nullif(p_payload->>'cliente_id', '')::uuid,
        coalesce(nullif(p_payload->>'estado', ''), 'ENTREGADA')::estado_venta,
        nullif(p_payload->>'observaciones', ''));
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

grant execute on function rpc_ejecutar_operacion_offline(uuid, text, jsonb) to authenticated;
revoke execute on function rpc_ejecutar_operacion_offline(uuid, text, jsonb) from public, anon;
comment on table operaciones_idempotentes is
  'Resultados de comandos offline. Puede purgarse por una tarea administrativa después del período de retención.';

commit;

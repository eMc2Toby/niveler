-- =====================================================================
-- NIVELER BOLIVIA — 13_encomiendas.sql
-- Seguimiento de bultos para clientes y entre repartidores.
--
-- Una encomienda describe la custodia y la entrega de un paquete. No mueve
-- inventario: si el contenido debe cambiar de ubicación de stock se usa el
-- módulo Transferencias, que conserva sus validaciones y reservas propias.
-- =====================================================================

create type tipo_encomienda as enum ('CLIENTE', 'ENTRE_DELIVERIES');
create type estado_encomienda as enum ('REGISTRADA', 'EN_TRANSITO', 'ENTREGADA', 'ANULADA');

create table encomiendas (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique,
  tipo                 tipo_encomienda not null,
  estado               estado_encomienda not null default 'REGISTRADA',
  cliente_id           uuid references clientes(id),
  delivery_origen_id   uuid not null references deliveries(id),
  delivery_destino_id  uuid references deliveries(id),
  sucursal_origen_id   uuid not null references sucursales(id),
  descripcion          text not null check (char_length(trim(descripcion)) >= 3),
  cantidad_bultos      int not null default 1 check (cantidad_bultos between 1 and 9999),
  peso_kg              numeric(10,2) check (peso_kg is null or peso_kg >= 0),
  ciudad_destino       text,
  direccion_entrega    text,
  observaciones        text,
  motivo_anulacion     text,
  usuario_crea_id      uuid not null references usuarios(id),
  usuario_despacha_id  uuid references usuarios(id),
  usuario_entrega_id   uuid references usuarios(id),
  fecha_registro       timestamptz not null default now(),
  fecha_despacho       timestamptz,
  fecha_entrega        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint chk_encomienda_destinatario check (
    (tipo = 'CLIENTE' and cliente_id is not null and delivery_destino_id is null)
    or
    (tipo = 'ENTRE_DELIVERIES' and cliente_id is null and delivery_destino_id is not null)
  ),
  constraint chk_encomienda_deliveries_distintos check (
    delivery_destino_id is null or delivery_origen_id <> delivery_destino_id
  )
);

comment on table encomiendas is
  'Trazabilidad de bultos enviados a clientes o entregados entre deliveries; no modifica stock.';
comment on column encomiendas.delivery_origen_id is
  'Delivery que recibe inicialmente la custodia o entrega el bulto.';
comment on column encomiendas.delivery_destino_id is
  'Delivery receptor cuando la modalidad es ENTRE_DELIVERIES.';

create sequence seq_encomienda start 1;
create index idx_encomiendas_estado on encomiendas(estado, fecha_registro desc);
create index idx_encomiendas_cliente on encomiendas(cliente_id) where cliente_id is not null;
create index idx_encomiendas_delivery_origen on encomiendas(delivery_origen_id, fecha_registro desc);
create index idx_encomiendas_delivery_destino on encomiendas(delivery_destino_id, fecha_registro desc)
  where delivery_destino_id is not null;
create index idx_encomiendas_sucursal on encomiendas(sucursal_origen_id, fecha_registro desc);

create trigger trg_encomiendas_updated
before update on encomiendas
for each row execute function fn_touch_updated_at();

create trigger trg_audit_encomiendas
after insert or update or delete on encomiendas
for each row execute function fn_auditar();

-- ---------------------------------------------------------------------
-- RLS: gerencia ve todo; una sucursal ve lo que sale o llega a sus
-- deliveries; cada delivery ve lo que entrega o recibe.
-- Las escrituras directas quedan cerradas: solo se usan las RPC de abajo.
-- ---------------------------------------------------------------------

alter table encomiendas enable row level security;

create policy encomiendas_lectura on encomiendas for select
using (
  auth_nivel() >= 80
  or usuario_crea_id = auth.uid()
  or delivery_origen_id = auth_delivery_id()
  or delivery_destino_id = auth_delivery_id()
  or sucursal_origen_id = auth_sucursal_id()
  or exists (
    select 1
    from deliveries d
    where d.id = delivery_destino_id
      and d.sucursal_base_id = auth_sucursal_id()
  )
);

grant select on table encomiendas to authenticated;
revoke insert, update, delete on table encomiendas from public, anon, authenticated;
grant usage, select on sequence seq_encomienda to authenticated;

-- ---------------------------------------------------------------------
-- Crear: para CLIENTE se asigna el delivery que llevará el bulto; para
-- ENTRE_DELIVERIES se indican remitente y receptor. La sucursal se deriva
-- del delivery de origen para impedir que el frontend falsee el ámbito.
-- ---------------------------------------------------------------------

create or replace function rpc_crear_encomienda(
  p_tipo tipo_encomienda,
  p_delivery_origen_id uuid,
  p_descripcion text,
  p_cliente_id uuid default null,
  p_delivery_destino_id uuid default null,
  p_cantidad_bultos int default 1,
  p_peso_kg numeric default null,
  p_ciudad_destino text default null,
  p_direccion_entrega text default null,
  p_observaciones text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_nivel             int;
  v_delivery_actual   uuid;
  v_origen            deliveries;
  v_destino           deliveries;
  v_cliente           clientes;
  v_ciudad            text;
  v_direccion         text;
  v_id                uuid;
  v_codigo            text;
begin
  perform fn_exigir_nivel(10, 'registrar encomiendas');
  v_nivel := auth_nivel();
  v_delivery_actual := auth_delivery_id();

  if nullif(trim(coalesce(p_descripcion, '')), '') is null
     or char_length(trim(p_descripcion)) < 3 then
    raise exception 'Describe el contenido de la encomienda.';
  end if;
  if coalesce(p_cantidad_bultos, 0) < 1 or p_cantidad_bultos > 9999 then
    raise exception 'La cantidad de bultos debe estar entre 1 y 9999.';
  end if;
  if p_peso_kg is not null and p_peso_kg < 0 then
    raise exception 'El peso no puede ser negativo.';
  end if;

  select * into v_origen
  from deliveries
  where id = p_delivery_origen_id and activo;
  if not found then raise exception 'El delivery remitente no existe o está inactivo.'; end if;

  if v_nivel < 80 then
    if v_delivery_actual is not null then
      if v_delivery_actual <> v_origen.id then
        raise exception 'Solo puedes registrar encomiendas desde tu propia cuenta de delivery.'
          using errcode = '42501';
      end if;
    elsif auth_sucursal_id() is distinct from v_origen.sucursal_base_id then
      raise exception 'Solo puedes registrar encomiendas de deliveries de tu sucursal.'
        using errcode = '42501';
    end if;
  end if;

  if p_tipo = 'CLIENTE' then
    if p_cliente_id is null or p_delivery_destino_id is not null then
      raise exception 'Una encomienda para cliente requiere cliente y un solo delivery responsable.';
    end if;
    select * into v_cliente from clientes where id = p_cliente_id and activo;
    if not found then raise exception 'El cliente no existe o está inactivo.'; end if;

    v_ciudad := coalesce(nullif(trim(coalesce(p_ciudad_destino, '')), ''), v_cliente.ciudad);
    v_direccion := coalesce(nullif(trim(coalesce(p_direccion_entrega, '')), ''), v_cliente.direccion);
    if v_direccion is null then
      raise exception 'Indica la dirección de entrega de la encomienda.';
    end if;
  elsif p_tipo = 'ENTRE_DELIVERIES' then
    if p_cliente_id is not null or p_delivery_destino_id is null then
      raise exception 'Una encomienda entre deliveries requiere un delivery receptor y no lleva cliente.';
    end if;
    if p_delivery_destino_id = p_delivery_origen_id then
      raise exception 'El delivery receptor debe ser distinto del remitente.';
    end if;
    select * into v_destino
    from deliveries
    where id = p_delivery_destino_id and activo;
    if not found then raise exception 'El delivery receptor no existe o está inactivo.'; end if;
    v_ciudad := null;
    v_direccion := null;
  else
    raise exception 'Modalidad de encomienda no válida.';
  end if;

  v_codigo := fn_generar_codigo('ENC', 'seq_encomienda');
  insert into encomiendas (
    codigo, tipo, cliente_id, delivery_origen_id, delivery_destino_id,
    sucursal_origen_id, descripcion, cantidad_bultos, peso_kg,
    ciudad_destino, direccion_entrega, observaciones, usuario_crea_id
  ) values (
    v_codigo, p_tipo, case when p_tipo = 'CLIENTE' then p_cliente_id end,
    p_delivery_origen_id,
    case when p_tipo = 'ENTRE_DELIVERIES' then p_delivery_destino_id end,
    v_origen.sucursal_base_id, trim(p_descripcion), p_cantidad_bultos, p_peso_kg,
    v_ciudad, v_direccion, nullif(trim(coalesce(p_observaciones, '')), ''), auth.uid()
  ) returning id into v_id;

  return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'estado', 'REGISTRADA');
end $$;

-- ---------------------------------------------------------------------
-- Despachar: el delivery de origen o un usuario autorizado de su sucursal
-- confirma que el bulto salió físicamente.
-- ---------------------------------------------------------------------

create or replace function rpc_despachar_encomienda(p_encomienda_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_encomienda       encomiendas;
  v_nivel            int;
  v_delivery_actual  uuid;
begin
  perform fn_exigir_nivel(10, 'despachar encomiendas');
  v_nivel := auth_nivel();
  v_delivery_actual := auth_delivery_id();

  select * into v_encomienda from encomiendas where id = p_encomienda_id for update;
  if not found then raise exception 'La encomienda no existe.'; end if;
  if v_encomienda.estado <> 'REGISTRADA' then
    raise exception 'Solo se pueden despachar encomiendas registradas.';
  end if;

  if v_nivel < 80
     and v_encomienda.usuario_crea_id <> auth.uid()
     and v_encomienda.delivery_origen_id is distinct from v_delivery_actual
     and not (v_nivel >= 30 and v_encomienda.sucursal_origen_id = auth_sucursal_id()) then
    raise exception 'No tienes permiso para despachar esta encomienda.' using errcode = '42501';
  end if;

  update encomiendas
  set estado = 'EN_TRANSITO', fecha_despacho = now(), usuario_despacha_id = auth.uid()
  where id = p_encomienda_id;

  return jsonb_build_object('id', p_encomienda_id, 'estado', 'EN_TRANSITO');
end $$;

-- ---------------------------------------------------------------------
-- Entregar/recibir: el delivery responsable confirma la entrega al cliente;
-- en un traspaso la confirma el delivery receptor.
-- ---------------------------------------------------------------------

create or replace function rpc_entregar_encomienda(p_encomienda_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_encomienda       encomiendas;
  v_nivel            int;
  v_delivery_actual  uuid;
  v_sucursal_destino uuid;
  v_autorizado       boolean := false;
begin
  perform fn_exigir_nivel(10, 'entregar encomiendas');
  v_nivel := auth_nivel();
  v_delivery_actual := auth_delivery_id();

  select * into v_encomienda from encomiendas where id = p_encomienda_id for update;
  if not found then raise exception 'La encomienda no existe.'; end if;
  if v_encomienda.estado <> 'EN_TRANSITO' then
    raise exception 'Solo se pueden entregar encomiendas que están en tránsito.';
  end if;

  if v_nivel >= 80 then
    v_autorizado := true;
  elsif v_encomienda.tipo = 'CLIENTE' then
    v_autorizado := v_encomienda.delivery_origen_id is not distinct from v_delivery_actual
      or (v_nivel >= 30 and v_encomienda.sucursal_origen_id = auth_sucursal_id());
  else
    select sucursal_base_id into v_sucursal_destino
    from deliveries where id = v_encomienda.delivery_destino_id;
    v_autorizado := v_encomienda.delivery_destino_id is not distinct from v_delivery_actual
      or (v_nivel >= 30 and v_sucursal_destino = auth_sucursal_id());
  end if;

  if not v_autorizado then
    raise exception 'No tienes permiso para confirmar la entrega de esta encomienda.'
      using errcode = '42501';
  end if;

  update encomiendas
  set estado = 'ENTREGADA', fecha_entrega = now(), usuario_entrega_id = auth.uid()
  where id = p_encomienda_id;

  return jsonb_build_object('id', p_encomienda_id, 'estado', 'ENTREGADA');
end $$;

-- ---------------------------------------------------------------------
-- Anular: únicamente antes del despacho. Se conserva el motivo en el
-- registro y en auditoría; no se borra el histórico.
-- ---------------------------------------------------------------------

create or replace function rpc_anular_encomienda(p_encomienda_id uuid, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_encomienda       encomiendas;
  v_nivel            int;
  v_delivery_actual  uuid;
begin
  perform fn_exigir_nivel(10, 'anular encomiendas');
  v_nivel := auth_nivel();
  v_delivery_actual := auth_delivery_id();

  if char_length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Indica el motivo de la anulación.';
  end if;

  select * into v_encomienda from encomiendas where id = p_encomienda_id for update;
  if not found then raise exception 'La encomienda no existe.'; end if;
  if v_encomienda.estado <> 'REGISTRADA' then
    raise exception 'Solo se pueden anular encomiendas que aún no fueron despachadas.';
  end if;

  if v_nivel < 80
     and v_encomienda.usuario_crea_id <> auth.uid()
     and v_encomienda.delivery_origen_id is distinct from v_delivery_actual
     and not (v_nivel >= 30 and v_encomienda.sucursal_origen_id = auth_sucursal_id()) then
    raise exception 'No tienes permiso para anular esta encomienda.' using errcode = '42501';
  end if;

  update encomiendas
  set estado = 'ANULADA', motivo_anulacion = trim(p_motivo)
  where id = p_encomienda_id;

  return jsonb_build_object('id', p_encomienda_id, 'estado', 'ANULADA');
end $$;

grant execute on function rpc_crear_encomienda(
  tipo_encomienda, uuid, text, uuid, uuid, int, numeric, text, text, text
) to authenticated;
grant execute on function rpc_despachar_encomienda(uuid) to authenticated;
grant execute on function rpc_entregar_encomienda(uuid) to authenticated;
grant execute on function rpc_anular_encomienda(uuid, text) to authenticated;

revoke execute on function rpc_crear_encomienda(
  tipo_encomienda, uuid, text, uuid, uuid, int, numeric, text, text, text
) from public, anon;
revoke execute on function rpc_despachar_encomienda(uuid) from public, anon;
revoke execute on function rpc_entregar_encomienda(uuid) from public, anon;
revoke execute on function rpc_anular_encomienda(uuid, text) from public, anon;


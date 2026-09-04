-- =====================================================================
-- NIVELER BOLIVIA — 15_almacenamiento_r2.sql
-- Metadatos, cuotas y ciclo de vida de imágenes almacenadas en Cloudflare R2.
-- R2 guarda bytes; PostgreSQL decide permisos, consumo y estado.
-- =====================================================================

begin;

create type estado_imagen_producto as enum (
  'TEMPORAL', 'ACTIVA', 'REEMPLAZADA', 'ELIMINADA', 'ABANDONADA'
);

create table configuracion_almacenamiento (
  id                       smallint primary key default 1 check (id = 1),
  limite_global_bytes      bigint not null default 8589934592 check (limite_global_bytes > 0),
  max_imagen_bytes         int not null default 512000 check (max_imagen_bytes between 10240 and 512000),
  max_dimension_px         int not null default 1200 check (max_dimension_px between 320 and 1200),
  max_imagenes_producto    int not null default 1 check (max_imagenes_producto between 1 and 20),
  advertencia_porcentaje   int not null default 70 check (advertencia_porcentaje between 1 and 99),
  critica_porcentaje       int not null default 85 check (critica_porcentaje between 1 and 99),
  temporales_horas         int not null default 24 check (temporales_horas between 1 and 720),
  subidas_por_hora         int not null default 20 check (subidas_por_hora between 1 and 1000),
  eliminaciones_por_hora   int not null default 60 check (eliminaciones_por_hora between 1 and 2000),
  updated_at               timestamptz not null default now(),
  constraint chk_umbrales_almacenamiento
    check (advertencia_porcentaje < critica_porcentaje)
);

insert into configuracion_almacenamiento(id) values (1);

create table limites_almacenamiento_sucursal (
  sucursal_id    uuid primary key references sucursales(id) on delete cascade,
  limite_bytes   bigint not null check (limite_bytes > 0),
  updated_at     timestamptz not null default now()
);

create table producto_imagenes (
  id                  uuid primary key default gen_random_uuid(),
  producto_id         uuid not null references productos(id) on delete cascade,
  sucursal_id         uuid references sucursales(id) on delete set null,
  object_key          text not null unique,
  public_reference    text not null unique,
  nombre_original     text not null,
  nombre_almacenado   text not null,
  mime_type           text not null check (mime_type in ('image/webp', 'image/avif')),
  formato_final       text not null check (formato_final in ('webp', 'avif')),
  tamano_bytes        int not null check (tamano_bytes between 1 and 512000),
  ancho               int not null check (ancho between 1 and 1200),
  alto                int not null check (alto between 1 and 1200),
  hash_sha256         text not null check (hash_sha256 ~ '^[0-9a-f]{64}$'),
  estado              estado_imagen_producto not null default 'TEMPORAL',
  reemplaza_activas   boolean not null default true,
  idempotency_key     uuid not null,
  usuario_carga_id    uuid not null references usuarios(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  r2_deleted_at       timestamptz,
  ultimo_error        text,
  intentos_eliminacion int not null default 0 check (intentos_eliminacion >= 0),
  constraint uq_imagen_idempotente unique (usuario_carga_id, idempotency_key),
  constraint chk_object_key_segura check (
    object_key !~ '(^|/)\.\.(/|$)' and object_key !~ '//' and
    object_key ~ '^productos/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|avif)$'
  ),
  constraint chk_public_reference_r2 check (public_reference = 'r2:' || object_key)
);

create unique index uq_imagen_activa_hash_producto
  on producto_imagenes(producto_id, hash_sha256)
  where estado in ('TEMPORAL', 'ACTIVA');
create index idx_producto_imagenes_producto_estado
  on producto_imagenes(producto_id, estado, created_at desc);
create index idx_producto_imagenes_sucursal_estado
  on producto_imagenes(sucursal_id, estado) where sucursal_id is not null;
create index idx_producto_imagenes_consumo
  on producto_imagenes(r2_deleted_at, estado) include (tamano_bytes);
create index idx_producto_imagenes_hash on producto_imagenes(hash_sha256);

create table cola_eliminacion_imagenes (
  imagen_id          uuid primary key references producto_imagenes(id) on delete cascade,
  object_key         text not null,
  intentos           int not null default 0 check (intentos >= 0),
  siguiente_intento  timestamptz not null default now(),
  ultimo_error       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table control_solicitudes_imagenes (
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  accion        text not null check (accion in ('SUBIR', 'ELIMINAR')),
  ventana       timestamptz not null,
  cantidad      int not null default 0 check (cantidad >= 0),
  primary key (usuario_id, accion, ventana)
);

create index idx_control_solicitudes_antiguas on control_solicitudes_imagenes(ventana);

create index idx_cola_eliminacion_pendiente
  on cola_eliminacion_imagenes(siguiente_intento, created_at);

create trigger trg_configuracion_almacenamiento_updated
before update on configuracion_almacenamiento
for each row execute function fn_touch_updated_at();

create trigger trg_limites_almacenamiento_updated
before update on limites_almacenamiento_sucursal
for each row execute function fn_touch_updated_at();

create trigger trg_producto_imagenes_updated
before update on producto_imagenes
for each row execute function fn_touch_updated_at();

alter table configuracion_almacenamiento enable row level security;
alter table limites_almacenamiento_sucursal enable row level security;
alter table producto_imagenes enable row level security;
alter table cola_eliminacion_imagenes enable row level security;
alter table control_solicitudes_imagenes enable row level security;

create policy producto_imagenes_lectura on producto_imagenes for select to authenticated
using (auth_nivel() >= 10);
create policy configuracion_almacenamiento_lectura on configuracion_almacenamiento
for select to authenticated using (auth_nivel() >= 80);
create policy limites_almacenamiento_lectura on limites_almacenamiento_sucursal
for select to authenticated using (auth_nivel() >= 80);

grant select on producto_imagenes, configuracion_almacenamiento,
  limites_almacenamiento_sucursal to authenticated;
revoke insert, update, delete on producto_imagenes, configuracion_almacenamiento,
  limites_almacenamiento_sucursal, cola_eliminacion_imagenes
  from public, anon, authenticated;
revoke select on cola_eliminacion_imagenes from public, anon, authenticated;
revoke all on control_solicitudes_imagenes from public, anon, authenticated;

create or replace function fn_consumir_limite_imagen(p_accion text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_usuario uuid := auth.uid(); v_ventana timestamptz; v_cantidad int; v_limite int; v_guc text;
begin
  if v_usuario is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  if p_accion not in ('SUBIR', 'ELIMINAR') then raise exception 'Acción de límite no válida.'; end if;
  v_guc := 'niveler.limite_' || lower(p_accion);
  if current_setting(v_guc, true) = '1' then return; end if;
  perform set_config(v_guc, '1', true);
  v_ventana := date_trunc('hour', now());
  select case p_accion when 'SUBIR' then subidas_por_hora else eliminaciones_por_hora end
  into v_limite from configuracion_almacenamiento where id = 1;
  insert into control_solicitudes_imagenes(usuario_id, accion, ventana, cantidad)
  values (v_usuario, p_accion, v_ventana, 1)
  on conflict (usuario_id, accion, ventana)
  do update set cantidad = control_solicitudes_imagenes.cantidad + 1
  returning cantidad into v_cantidad;
  if v_cantidad > v_limite then
    raise exception 'Demasiadas solicitudes de imágenes. Inténtalo más tarde.';
  end if;
end $$;

create or replace function rpc_autorizar_carga_imagen(p_producto_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cfg configuracion_almacenamiento;
begin
  perform fn_exigir_nivel(60, 'cargar imágenes de productos');
  perform fn_consumir_limite_imagen('SUBIR');
  if not exists (select 1 from productos where id = p_producto_id and activo) then
    raise exception 'El producto no existe o está inactivo.';
  end if;
  select * into v_cfg from configuracion_almacenamiento where id = 1;
  return jsonb_build_object('max_imagen_bytes', v_cfg.max_imagen_bytes,
    'max_dimension_px', v_cfg.max_dimension_px);
end $$;

-- Reserva cuota y metadatos antes de escribir en R2. La fila única de
-- configuración se bloquea para serializar el cálculo de la cuota global.
create or replace function rpc_reservar_imagen_producto(
  p_producto_id uuid,
  p_idempotency_key uuid,
  p_object_key text,
  p_nombre_original text,
  p_nombre_almacenado text,
  p_mime_type text,
  p_formato_final text,
  p_tamano_bytes int,
  p_ancho int,
  p_alto int,
  p_hash_sha256 text,
  p_reemplazar boolean default true
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cfg configuracion_almacenamiento;
  v_usuario uuid := auth.uid();
  v_sucursal uuid := auth_sucursal_id();
  v_producto productos;
  v_existente producto_imagenes;
  v_id uuid;
  v_usado bigint;
  v_reemplazado bigint := 0;
  v_usado_sucursal bigint;
  v_reemplazado_sucursal bigint := 0;
  v_limite_sucursal bigint;
  v_activas int;
begin
  perform fn_exigir_nivel(60, 'cargar imágenes de productos');
  if p_idempotency_key is null then raise exception 'Falta la clave idempotente.'; end if;

  select * into v_producto from productos where id = p_producto_id for update;
  if not found then raise exception 'El producto no existe.'; end if;
  if not v_producto.activo then raise exception 'No se pueden cargar imágenes en un producto inactivo.'; end if;

  select * into v_cfg from configuracion_almacenamiento where id = 1 for update;
  if p_tamano_bytes < 1 or p_tamano_bytes > v_cfg.max_imagen_bytes then
    raise exception 'La imagen final supera el máximo permitido de % bytes.', v_cfg.max_imagen_bytes;
  end if;
  if p_ancho < 1 or p_alto < 1 or p_ancho > v_cfg.max_dimension_px or p_alto > v_cfg.max_dimension_px then
    raise exception 'La imagen final supera las dimensiones máximas de % px.', v_cfg.max_dimension_px;
  end if;
  if p_mime_type not in ('image/webp', 'image/avif') or p_formato_final not in ('webp', 'avif') then
    raise exception 'El formato final no está permitido.';
  end if;
  if p_hash_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'El hash de la imagen no es válido.'; end if;
  if p_object_key not like 'productos/' || p_producto_id::text || '/%'
     or p_object_key ~ '(^|/)\.\.(/|$)' or p_object_key ~ '//'
     or p_object_key !~ '^productos/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|avif)$' then
    raise exception 'La ruta del objeto no es válida.';
  end if;
  if char_length(trim(coalesce(p_nombre_original, ''))) < 1
     or char_length(p_nombre_original) > 255
     or char_length(trim(coalesce(p_nombre_almacenado, ''))) < 1
     or char_length(p_nombre_almacenado) > 255 then
    raise exception 'El nombre de archivo no es válido.';
  end if;

  select * into v_existente from producto_imagenes
  where usuario_carga_id = v_usuario and idempotency_key = p_idempotency_key;
  if found then
    if v_existente.producto_id <> p_producto_id or v_existente.hash_sha256 <> p_hash_sha256 then
      raise exception 'La clave idempotente de imagen ya fue utilizada con otros datos.';
    end if;
    return jsonb_build_object('id', v_existente.id, 'duplicada', false,
      'estado', v_existente.estado, 'object_key', v_existente.object_key);
  end if;

  select * into v_existente from producto_imagenes
  where producto_id = p_producto_id and hash_sha256 = p_hash_sha256 and estado = 'ACTIVA'
  limit 1;
  if found then
    return jsonb_build_object('id', v_existente.id, 'duplicada', true,
      'estado', v_existente.estado, 'object_key', v_existente.object_key);
  end if;

  if exists (select 1 from producto_imagenes where producto_id = p_producto_id and estado = 'TEMPORAL') then
    raise exception 'Ya hay una carga de imagen en curso para este producto.';
  end if;

  select count(*), coalesce(sum(tamano_bytes), 0)
  into v_activas, v_reemplazado
  from producto_imagenes
  where producto_id = p_producto_id and estado = 'ACTIVA';
  if not coalesce(p_reemplazar, true) and v_activas >= v_cfg.max_imagenes_producto then
    raise exception 'El producto alcanzó el máximo de % imágenes.', v_cfg.max_imagenes_producto;
  end if;
  if not coalesce(p_reemplazar, true) then v_reemplazado := 0; end if;

  select coalesce(sum(tamano_bytes), 0) into v_usado
  from producto_imagenes where r2_deleted_at is null;
  if v_usado - v_reemplazado + p_tamano_bytes > v_cfg.limite_global_bytes then
    raise exception 'Se alcanzó el límite global de almacenamiento.';
  end if;

  if v_sucursal is not null then
    select limite_bytes into v_limite_sucursal
    from limites_almacenamiento_sucursal where sucursal_id = v_sucursal;
    if v_limite_sucursal is not null then
      select coalesce(sum(tamano_bytes), 0) into v_usado_sucursal
      from producto_imagenes where sucursal_id = v_sucursal and r2_deleted_at is null;
      if coalesce(p_reemplazar, true) then
        select coalesce(sum(tamano_bytes), 0) into v_reemplazado_sucursal
        from producto_imagenes where producto_id = p_producto_id
          and sucursal_id = v_sucursal and estado = 'ACTIVA';
      end if;
      if v_usado_sucursal - v_reemplazado_sucursal + p_tamano_bytes > v_limite_sucursal then
        raise exception 'La sucursal alcanzó su límite de almacenamiento.';
      end if;
    end if;
  end if;

  insert into producto_imagenes(
    producto_id, sucursal_id, object_key, public_reference,
    nombre_original, nombre_almacenado, mime_type, formato_final,
    tamano_bytes, ancho, alto, hash_sha256, reemplaza_activas,
    idempotency_key, usuario_carga_id
  ) values (
    p_producto_id, v_sucursal, p_object_key, 'r2:' || p_object_key,
    trim(p_nombre_original), trim(p_nombre_almacenado), p_mime_type, p_formato_final,
    p_tamano_bytes, p_ancho, p_alto, p_hash_sha256, coalesce(p_reemplazar, true),
    p_idempotency_key, v_usuario
  ) returning id into v_id;

  return jsonb_build_object('id', v_id, 'duplicada', false,
    'estado', 'TEMPORAL', 'object_key', p_object_key);
end $$;

create or replace function rpc_activar_imagen_producto(p_imagen_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_imagen producto_imagenes;
  v_reemplazadas jsonb := '[]'::jsonb;
begin
  perform fn_exigir_nivel(60, 'activar imágenes de productos');
  select * into v_imagen from producto_imagenes where id = p_imagen_id for update;
  if not found then raise exception 'La imagen reservada no existe.'; end if;
  if v_imagen.usuario_carga_id <> auth.uid() then
    raise exception 'No puedes activar una carga de otro usuario.' using errcode = '42501';
  end if;
  if v_imagen.estado = 'ACTIVA' then
    return jsonb_build_object('id', v_imagen.id, 'estado', 'ACTIVA',
      'referencia', v_imagen.public_reference, 'reemplazadas', '[]'::jsonb);
  end if;
  if v_imagen.estado <> 'TEMPORAL' then raise exception 'La carga ya no puede activarse.'; end if;

  if v_imagen.reemplaza_activas then
    with anteriores as (
      update producto_imagenes
      set estado = 'REEMPLAZADA', deleted_at = now()
      where producto_id = v_imagen.producto_id and estado = 'ACTIVA' and id <> v_imagen.id
      returning id, object_key
    ), encoladas as (
      insert into cola_eliminacion_imagenes(imagen_id, object_key)
      select id, object_key from anteriores on conflict (imagen_id) do nothing
      returning imagen_id
    )
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'object_key', object_key)), '[]'::jsonb)
    into v_reemplazadas from anteriores;
  end if;

  update producto_imagenes set estado = 'ACTIVA', deleted_at = null where id = v_imagen.id;
  update productos set imagen_url = v_imagen.public_reference, updated_at = now()
  where id = v_imagen.producto_id;

  return jsonb_build_object('id', v_imagen.id, 'estado', 'ACTIVA',
    'referencia', v_imagen.public_reference, 'reemplazadas', v_reemplazadas);
end $$;

create or replace function rpc_abandonar_imagen_producto(p_imagen_id uuid, p_error text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_imagen producto_imagenes;
begin
  select * into v_imagen from producto_imagenes where id = p_imagen_id for update;
  if not found then raise exception 'La imagen reservada no existe.'; end if;
  if v_imagen.usuario_carga_id <> auth.uid() and auth.role() <> 'service_role' then
    raise exception 'No puedes abandonar una carga de otro usuario.' using errcode = '42501';
  end if;
  if v_imagen.estado = 'TEMPORAL' then
    update producto_imagenes set estado = 'ABANDONADA', deleted_at = now(),
      ultimo_error = left(nullif(p_error, ''), 500) where id = p_imagen_id;
    insert into cola_eliminacion_imagenes(imagen_id, object_key)
    values (v_imagen.id, v_imagen.object_key) on conflict (imagen_id) do nothing;
  end if;
  return jsonb_build_object('id', p_imagen_id, 'estado', 'ABANDONADA');
end $$;

create or replace function rpc_solicitar_eliminar_imagen(p_imagen_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_imagen producto_imagenes; v_referencia text;
begin
  perform fn_exigir_nivel(60, 'eliminar imágenes de productos');
  perform fn_consumir_limite_imagen('ELIMINAR');
  select * into v_imagen from producto_imagenes where id = p_imagen_id for update;
  if not found then raise exception 'La imagen no existe.'; end if;
  if v_imagen.estado in ('ELIMINADA', 'ABANDONADA') then
    return jsonb_build_object('id', v_imagen.id, 'object_key', v_imagen.object_key);
  end if;

  update producto_imagenes set estado = 'ELIMINADA', deleted_at = now() where id = v_imagen.id;
  insert into cola_eliminacion_imagenes(imagen_id, object_key)
  values (v_imagen.id, v_imagen.object_key) on conflict (imagen_id) do nothing;

  select public_reference into v_referencia from producto_imagenes
  where producto_id = v_imagen.producto_id and estado = 'ACTIVA' and id <> v_imagen.id
  order by created_at desc limit 1;
  update productos set imagen_url = v_referencia, updated_at = now()
  where id = v_imagen.producto_id and imagen_url = v_imagen.public_reference;

  return jsonb_build_object('id', v_imagen.id, 'object_key', v_imagen.object_key);
end $$;

create or replace function rpc_solicitar_eliminar_imagen_activa(p_producto_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_imagen_id uuid; v_resultado jsonb;
begin
  perform fn_exigir_nivel(60, 'eliminar imágenes de productos');
  perform fn_consumir_limite_imagen('ELIMINAR');
  perform 1 from productos where id = p_producto_id for update;
  if not found then raise exception 'El producto no existe.'; end if;
  select id into v_imagen_id from producto_imagenes
  where producto_id = p_producto_id and estado = 'ACTIVA'
  order by created_at desc limit 1;
  if v_imagen_id is null then
    update productos set imagen_url = null, updated_at = now() where id = p_producto_id;
    return jsonb_build_object('legacy', true, 'object_key', null);
  end if;
  v_resultado := rpc_solicitar_eliminar_imagen(v_imagen_id);
  return v_resultado || jsonb_build_object('legacy', false);
end $$;

create or replace function rpc_preparar_limpieza_imagenes()
returns int
language plpgsql security definer set search_path = public as $$
declare v_horas int; v_total int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Esta operación es exclusiva del servicio.' using errcode = '42501';
  end if;
  select temporales_horas into v_horas from configuracion_almacenamiento where id = 1;
  delete from control_solicitudes_imagenes where ventana < now() - interval '7 days';
  with abandonadas as (
    update producto_imagenes set estado = 'ABANDONADA', deleted_at = now(),
      ultimo_error = coalesce(ultimo_error, 'Carga temporal vencida')
    where estado = 'TEMPORAL' and created_at < now() - make_interval(hours => v_horas)
    returning id, object_key
  ), insertadas as (
    insert into cola_eliminacion_imagenes(imagen_id, object_key)
    select id, object_key from abandonadas on conflict (imagen_id) do nothing returning 1
  ) select count(*) into v_total from insertadas;
  return v_total;
end $$;

create or replace function rpc_obtener_eliminaciones_pendientes(p_limite int default 100)
returns table(imagen_id uuid, object_key text, intentos int)
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Esta operación es exclusiva del servicio.' using errcode = '42501';
  end if;
  return query select c.imagen_id, c.object_key, c.intentos
  from cola_eliminacion_imagenes c
  where c.siguiente_intento <= now()
  order by c.created_at limit least(greatest(coalesce(p_limite, 100), 1), 500);
end $$;

create or replace function rpc_confirmar_imagen_r2_eliminada(p_imagen_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Esta operación es exclusiva del servicio.' using errcode = '42501';
  end if;
  update producto_imagenes set r2_deleted_at = now(), ultimo_error = null where id = p_imagen_id;
  delete from cola_eliminacion_imagenes where imagen_id = p_imagen_id;
end $$;

create or replace function rpc_registrar_error_eliminacion(p_imagen_id uuid, p_error text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Esta operación es exclusiva del servicio.' using errcode = '42501';
  end if;
  update producto_imagenes set intentos_eliminacion = intentos_eliminacion + 1,
    ultimo_error = left(coalesce(p_error, 'Error de R2'), 500) where id = p_imagen_id;
  update cola_eliminacion_imagenes set intentos = intentos + 1,
    ultimo_error = left(coalesce(p_error, 'Error de R2'), 500),
    siguiente_intento = now() + make_interval(secs => least(3600, 60 * (2 ^ least(intentos, 6))::int)),
    updated_at = now() where imagen_id = p_imagen_id;
end $$;

create or replace function rpc_resumen_almacenamiento()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cfg configuracion_almacenamiento; v_usado bigint; v_total bigint; v_pct numeric;
begin
  perform fn_exigir_nivel(80, 'consultar el almacenamiento');
  select * into v_cfg from configuracion_almacenamiento where id = 1;
  select coalesce(sum(tamano_bytes), 0), count(*) into v_usado, v_total
  from producto_imagenes where r2_deleted_at is null;
  v_pct := round((v_usado::numeric * 100) / v_cfg.limite_global_bytes, 2);
  return jsonb_build_object(
    'usado_bytes', v_usado, 'limite_bytes', v_cfg.limite_global_bytes,
    'porcentaje', v_pct, 'total_imagenes', v_total,
    'max_imagen_bytes', v_cfg.max_imagen_bytes,
    'max_dimension_px', v_cfg.max_dimension_px,
    'max_imagenes_producto', v_cfg.max_imagenes_producto,
    'nivel', case when v_pct >= 100 then 'BLOQUEADO'
                  when v_pct >= v_cfg.critica_porcentaje then 'CRITICO'
                  when v_pct >= v_cfg.advertencia_porcentaje then 'ADVERTENCIA'
                  else 'NORMAL' end
  );
end $$;

create or replace function rpc_listar_claves_imagenes()
returns table(imagen_id uuid, object_key text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Esta operación es exclusiva del servicio.' using errcode = '42501';
  end if;
  return query select p.id, p.object_key from producto_imagenes p where p.r2_deleted_at is null;
end $$;

grant execute on function rpc_reservar_imagen_producto(uuid, uuid, text, text, text, text, text, int, int, int, text, boolean) to authenticated;
grant execute on function rpc_autorizar_carga_imagen(uuid) to authenticated;
grant execute on function rpc_activar_imagen_producto(uuid) to authenticated;
grant execute on function rpc_abandonar_imagen_producto(uuid, text) to authenticated, service_role;
grant execute on function rpc_solicitar_eliminar_imagen(uuid) to authenticated;
grant execute on function rpc_solicitar_eliminar_imagen_activa(uuid) to authenticated;
grant execute on function rpc_resumen_almacenamiento() to authenticated;
grant execute on function rpc_preparar_limpieza_imagenes() to service_role;
grant execute on function rpc_obtener_eliminaciones_pendientes(int) to service_role;
grant execute on function rpc_confirmar_imagen_r2_eliminada(uuid) to service_role;
grant execute on function rpc_registrar_error_eliminacion(uuid, text) to service_role;
grant execute on function rpc_listar_claves_imagenes() to service_role;

revoke execute on function rpc_reservar_imagen_producto(uuid, uuid, text, text, text, text, text, int, int, int, text, boolean) from public, anon;
revoke execute on function rpc_autorizar_carga_imagen(uuid) from public, anon;
revoke execute on function rpc_activar_imagen_producto(uuid) from public, anon;
revoke execute on function rpc_abandonar_imagen_producto(uuid, text) from public, anon;
revoke execute on function rpc_solicitar_eliminar_imagen(uuid) from public, anon;
revoke execute on function rpc_solicitar_eliminar_imagen_activa(uuid) from public, anon;
revoke execute on function rpc_resumen_almacenamiento() from public, anon;
revoke execute on function rpc_preparar_limpieza_imagenes() from public, anon, authenticated;
revoke execute on function rpc_obtener_eliminaciones_pendientes(int) from public, anon, authenticated;
revoke execute on function rpc_confirmar_imagen_r2_eliminada(uuid) from public, anon, authenticated;
revoke execute on function rpc_registrar_error_eliminacion(uuid, text) from public, anon, authenticated;
revoke execute on function rpc_listar_claves_imagenes() from public, anon, authenticated;
revoke execute on function fn_consumir_limite_imagen(text) from public, anon, authenticated;

comment on table producto_imagenes is
  'Metadatos autoritativos de objetos de producto guardados en Cloudflare R2.';
comment on table cola_eliminacion_imagenes is
  'Borrados físicos pendientes o fallidos; el trabajo programado de Cloud Run los reintenta.';
comment on column productos.imagen_url is
  'Referencia compatible: ruta histórica de Supabase Storage o r2:<object_key> para imágenes nuevas.';

commit;

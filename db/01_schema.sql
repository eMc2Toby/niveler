-- =====================================================================
-- NIVELER BOLIVIA — Sistema de Inventario Multi-Sucursal
-- 01_schema.sql  ·  Estructura de base de datos (PostgreSQL / Supabase)
-- =====================================================================
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- Orden de ejecución: 01_schema → 02_vistas → 03_funciones → 04_rls → 05_seed
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. TIPOS ENUMERADOS
-- =====================================================================

-- Toda existencia física vive en una "ubicación". Sucursales y deliveries
-- son ubicaciones; TRANSITO, MERMA, PROVEEDOR y CLIENTE son ubicaciones
-- virtuales que permiten que TODO movimiento sea origen → destino.
create type tipo_ubicacion as enum (
  'SUCURSAL',    -- bodega física de una sucursal
  'DELIVERY',    -- mercadería en poder de un repartidor
  'TRANSITO',    -- enviado pero aún no recibido (transferencias)
  'MERMA',       -- pérdida, rotura, vencimiento
  'PROVEEDOR',   -- contraparte virtual de las compras (entradas)
  'CLIENTE'      -- contraparte virtual de las ventas (salidas)
);

create type tipo_movimiento as enum (
  'ENTRADA',                -- PROVEEDOR      → SUCURSAL
  'SALIDA',                 -- SUCURSAL       → MERMA / otro
  'TRANSFERENCIA',          -- SUCURSAL       → SUCURSAL
  'ENTREGA_DELIVERY',       -- SUCURSAL       → DELIVERY
  'RETORNO_DELIVERY',       -- DELIVERY       → SUCURSAL
  'TRANSFERENCIA_DELIVERY', -- DELIVERY       → DELIVERY
  'VENTA',                  -- SUCURSAL/DELIV → CLIENTE
  'DEVOLUCION',             -- CLIENTE        → SUCURSAL/DELIVERY
  'AJUSTE'                  -- corrección por conteo físico (±)
);

create type estado_movimiento as enum ('BORRADOR', 'CONFIRMADO', 'ANULADO');

create type estado_transferencia as enum (
  'BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL', 'RECIBIDA', 'ANULADA'
);

create type estado_venta as enum (
  'PENDIENTE',   -- registrada, mercadería aún no entregada
  'ENTREGADA',   -- entregada al cliente, puede estar impaga (crédito)
  'PAGADA',      -- cerrada
  'ANULADA'
);

create type forma_pago as enum (
  'EFECTIVO', 'QR_PAGO', 'TRANSFERENCIA_BANCARIA', 'TARJETA', 'CREDITO'
);

create type accion_auditoria as enum ('INSERT', 'UPDATE', 'DELETE');


-- =====================================================================
-- 2. SEGURIDAD: ROLES Y USUARIOS
-- =====================================================================

create table roles (
  id          serial primary key,
  codigo      text not null unique,   -- ADMIN, GERENTE, ENCARGADO, BODEGA, VENTAS, DELIVERY
  nombre      text not null,
  nivel       int  not null default 0, -- 100 admin … 10 delivery. Mayor nivel = más permisos
  permisos    jsonb not null default '{}'::jsonb, -- gating fino de UI: {"productos.editar": true}
  created_at  timestamptz not null default now()
);
comment on column roles.nivel is 'Jerarquía numérica usada por las políticas RLS.';

create table sucursales (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,   -- SUC-CBBA
  nombre      text not null,
  ciudad      text not null,
  direccion   text,
  telefono    text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table usuarios (
  id             uuid primary key references auth.users(id) on delete cascade,
  rol_id         int  not null references roles(id),
  nombre_completo text not null,
  email          text not null unique,
  telefono       text,
  sucursal_id    uuid references sucursales(id), -- sucursal a la que pertenece (null = acceso global)
  avatar_url     text,
  activo         boolean not null default true,
  ultimo_acceso  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_usuarios_rol on usuarios(rol_id);
create index idx_usuarios_sucursal on usuarios(sucursal_id);

-- Repartidor: un usuario con rol DELIVERY que además custodia stock.
create table deliveries (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique,   -- DEL-001
  usuario_id       uuid unique references usuarios(id) on delete set null,
  nombre           text not null,
  telefono         text,
  ci               text,
  vehiculo         text,
  sucursal_base_id uuid not null references sucursales(id),
  activo           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index idx_deliveries_sucursal on deliveries(sucursal_base_id);


-- =====================================================================
-- 3. UBICACIONES (el corazón del modelo de stock)
-- =====================================================================

create table ubicaciones (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  nombre       text not null,
  tipo         tipo_ubicacion not null,
  sucursal_id  uuid references sucursales(id) on delete cascade,
  delivery_id  uuid references deliveries(id) on delete cascade,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),

  -- Coherencia: una ubicación de sucursal apunta a una sucursal, una de
  -- delivery a un delivery, y las virtuales a ninguno.
  constraint chk_ubicacion_coherente check (
    (tipo = 'SUCURSAL' and sucursal_id is not null and delivery_id is null) or
    (tipo = 'DELIVERY' and delivery_id is not null and sucursal_id is null) or
    (tipo in ('TRANSITO','MERMA','PROVEEDOR','CLIENTE')
      and sucursal_id is null and delivery_id is null)
  )
);
create unique index idx_ubicacion_sucursal on ubicaciones(sucursal_id) where sucursal_id is not null;
create unique index idx_ubicacion_delivery on ubicaciones(delivery_id) where delivery_id is not null;
create index idx_ubicaciones_tipo on ubicaciones(tipo);


-- =====================================================================
-- 4. CATÁLOGO DE PRODUCTOS
-- =====================================================================

create table categorias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text,
  parent_id   uuid references categorias(id) on delete set null, -- subcategorías
  orden       int not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table marcas (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true
);

create table productos (
  id             uuid primary key default gen_random_uuid(),
  sku            text not null unique,          -- PRD-001
  nombre         text not null,
  descripcion    text,
  categoria_id   uuid references categorias(id),
  marca_id       uuid references marcas(id),
  unidad_medida  text not null default 'UNIDAD',
  precio_venta   numeric(12,2) not null default 0 check (precio_venta >= 0),
  precio_costo   numeric(12,2) not null default 0 check (precio_costo >= 0),
  imagen_url     text,                          -- ruta en Supabase Storage
  stock_minimo   numeric(12,2) not null default 0 check (stock_minimo >= 0),
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_productos_categoria on productos(categoria_id);
create index idx_productos_marca on productos(marca_id);
create index idx_productos_activo on productos(activo) where activo = true;
-- Búsqueda por nombre/SKU sin distinguir acentos ni mayúsculas
create index idx_productos_busqueda on productos
  using gin (to_tsvector('spanish', coalesce(nombre,'') || ' ' || coalesce(sku,'')));


-- =====================================================================
-- 5. INVENTARIO (saldo materializado, una fila por producto+ubicación)
-- =====================================================================
-- El saldo NO es la fuente de verdad: es una caché mantenida por trigger
-- a partir de movimientos_detalle. Siempre se puede reconstruir con
-- fn_recalcular_inventario().

create table inventario (
  id                  uuid primary key default gen_random_uuid(),
  producto_id         uuid not null references productos(id) on delete cascade,
  ubicacion_id        uuid not null references ubicaciones(id) on delete cascade,
  cantidad            numeric(12,2) not null default 0,
  cantidad_reservada  numeric(12,2) not null default 0 check (cantidad_reservada >= 0),
  cantidad_disponible numeric(12,2) generated always as (cantidad - cantidad_reservada) stored,
  actualizado_en      timestamptz not null default now(),
  unique (producto_id, ubicacion_id)
);
create index idx_inventario_producto on inventario(producto_id);
create index idx_inventario_ubicacion on inventario(ubicacion_id);
comment on column inventario.cantidad_reservada is
  'Comprometido por ventas PENDIENTE o transferencias BORRADOR. Aún no salió físicamente.';


-- =====================================================================
-- 6. MOVIMIENTOS (libro mayor inmutable)
-- =====================================================================

create table movimientos (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique,   -- MOV-2026-000001
  tipo                tipo_movimiento not null,
  estado              estado_movimiento not null default 'BORRADOR',
  fecha               timestamptz not null default now(),
  ubicacion_origen_id uuid not null references ubicaciones(id),
  ubicacion_destino_id uuid not null references ubicaciones(id),
  usuario_id          uuid references usuarios(id),
  -- Trazabilidad hacia el documento que originó el movimiento
  referencia_tabla    text,     -- 'ventas' | 'transferencias' | null
  referencia_id       uuid,
  observaciones       text,
  created_at          timestamptz not null default now(),
  constraint chk_origen_distinto check (ubicacion_origen_id <> ubicacion_destino_id)
);
create index idx_movimientos_fecha on movimientos(fecha desc);
create index idx_movimientos_tipo on movimientos(tipo);
create index idx_movimientos_origen on movimientos(ubicacion_origen_id);
create index idx_movimientos_destino on movimientos(ubicacion_destino_id);
create index idx_movimientos_referencia on movimientos(referencia_tabla, referencia_id);

create table movimientos_detalle (
  id             uuid primary key default gen_random_uuid(),
  movimiento_id  uuid not null references movimientos(id) on delete cascade,
  producto_id    uuid not null references productos(id),
  cantidad       numeric(12,2) not null check (cantidad > 0),
  costo_unitario numeric(12,2) not null default 0,
  observacion    text
);
create index idx_mov_detalle_movimiento on movimientos_detalle(movimiento_id);
create index idx_mov_detalle_producto on movimientos_detalle(producto_id);


-- =====================================================================
-- 7. CLIENTES Y VENTAS
-- =====================================================================

create table clientes (
  id         uuid primary key default gen_random_uuid(),
  codigo     text unique,
  nombre     text not null,
  nit_ci     text,
  telefono   text,
  email      text,
  direccion  text,
  ciudad     text,
  notas      text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_clientes_nombre on clientes(nombre);
create index idx_clientes_nit on clientes(nit_ci);

create table ventas (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,   -- VTA-2026-000001
  fecha        timestamptz not null default now(),
  cliente_id   uuid references clientes(id),
  sucursal_id  uuid references sucursales(id),
  delivery_id  uuid references deliveries(id),
  ubicacion_id uuid not null references ubicaciones(id), -- de dónde sale la mercadería
  usuario_id   uuid references usuarios(id),             -- quién registró
  forma_pago   forma_pago not null default 'EFECTIVO',
  estado       estado_venta not null default 'PENDIENTE',
  subtotal     numeric(12,2) not null default 0,
  descuento    numeric(12,2) not null default 0,
  total        numeric(12,2) not null default 0,
  observaciones text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_ventas_fecha on ventas(fecha desc);
create index idx_ventas_estado on ventas(estado);
create index idx_ventas_sucursal on ventas(sucursal_id);
create index idx_ventas_delivery on ventas(delivery_id);
create index idx_ventas_cliente on ventas(cliente_id);

create table ventas_detalle (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references ventas(id) on delete cascade,
  producto_id     uuid not null references productos(id),
  cantidad        numeric(12,2) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  descuento       numeric(12,2) not null default 0,
  subtotal        numeric(12,2) generated always as
                    (cantidad * precio_unitario - descuento) stored
);
create index idx_venta_detalle_venta on ventas_detalle(venta_id);
create index idx_venta_detalle_producto on ventas_detalle(producto_id);


-- =====================================================================
-- 8. TRANSFERENCIAS (flujo en dos pasos: envío y recepción)
-- =====================================================================

create table transferencias (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique,   -- TRF-2026-000001
  estado               estado_transferencia not null default 'BORRADOR',
  ubicacion_origen_id  uuid not null references ubicaciones(id),
  ubicacion_destino_id uuid not null references ubicaciones(id),
  usuario_solicita_id  uuid references usuarios(id),
  usuario_envia_id     uuid references usuarios(id),
  usuario_recibe_id    uuid references usuarios(id),
  fecha_solicitud      timestamptz not null default now(),
  fecha_envio          timestamptz,
  fecha_recepcion      timestamptz,
  observaciones        text,
  created_at           timestamptz not null default now(),
  constraint chk_trf_origen_distinto check (ubicacion_origen_id <> ubicacion_destino_id)
);
create index idx_transferencias_estado on transferencias(estado);
create index idx_transferencias_origen on transferencias(ubicacion_origen_id);
create index idx_transferencias_destino on transferencias(ubicacion_destino_id);

create table transferencias_detalle (
  id                uuid primary key default gen_random_uuid(),
  transferencia_id  uuid not null references transferencias(id) on delete cascade,
  producto_id       uuid not null references productos(id),
  cantidad_enviada  numeric(12,2) not null check (cantidad_enviada > 0),
  cantidad_recibida numeric(12,2) check (cantidad_recibida >= 0),
  observacion       text
);
create index idx_trf_detalle_transferencia on transferencias_detalle(transferencia_id);


-- =====================================================================
-- 9. AUDITORÍA
-- =====================================================================

create table auditoria (
  id              bigserial primary key,
  tabla           text not null,
  registro_id     text not null,
  accion          accion_auditoria not null,
  usuario_id      uuid references usuarios(id),
  datos_anteriores jsonb,
  datos_nuevos    jsonb,
  fecha           timestamptz not null default now()
);
create index idx_auditoria_tabla on auditoria(tabla, registro_id);
create index idx_auditoria_fecha on auditoria(fecha desc);
create index idx_auditoria_usuario on auditoria(usuario_id);


-- =====================================================================
-- 10. SECUENCIAS PARA CÓDIGOS DE DOCUMENTO
-- =====================================================================

create sequence seq_movimiento start 1;
create sequence seq_venta start 1;
create sequence seq_transferencia start 1;

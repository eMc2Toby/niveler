-- =====================================================================
-- NIVELER BOLIVIA — 04_rls.sql
-- Row Level Security: quién ve y quién modifica qué.
--
-- El permiso vive en la base de datos, no en el frontend. Aunque alguien
-- abra la consola del navegador o llame la API directamente, solo recibe
-- lo que su rol le permite.
--
-- Jerarquía de niveles:
--   100 ADMIN      todo, incluida configuración y usuarios
--    80 GERENTE    ve todas las sucursales, no administra usuarios
--    60 ENCARGADO  manda en su sucursal
--    40 BODEGA     movimientos y transferencias de su sucursal
--    30 VENTAS     registra ventas de su sucursal
--    10 DELIVERY   solo su propio stock y sus propias ventas
-- =====================================================================

-- ---------------------------------------------------------------------
-- FUNCIONES AUXILIARES DE SESIÓN
-- ---------------------------------------------------------------------

create or replace function auth_nivel()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(r.nivel, 0)
  from usuarios u join roles r on r.id = u.rol_id
  where u.id = auth.uid() and u.activo = true;
$$;

create or replace function auth_sucursal_id()
returns uuid language sql stable security definer set search_path = public as $$
  select sucursal_id from usuarios where id = auth.uid();
$$;

create or replace function auth_delivery_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from deliveries where usuario_id = auth.uid();
$$;

-- ¿La ubicación pertenece al ámbito del usuario actual?
create or replace function auth_puede_ver_ubicacion(p_ubicacion_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth_nivel() >= 80 then true          -- gerencia ve todo
    else exists (
      select 1 from ubicaciones u
      left join deliveries d on d.id = u.delivery_id
      where u.id = p_ubicacion_id
        and (
          u.sucursal_id = auth_sucursal_id()          -- su sucursal
          or d.sucursal_base_id = auth_sucursal_id()  -- deliveries de su sucursal
          or u.delivery_id = auth_delivery_id()       -- su propio stock
        )
    )
  end;
$$;

-- ---------------------------------------------------------------------
-- ACTIVAR RLS EN TODAS LAS TABLAS
-- ---------------------------------------------------------------------
alter table usuarios               enable row level security;
alter table roles                  enable row level security;
alter table sucursales             enable row level security;
alter table deliveries             enable row level security;
alter table ubicaciones            enable row level security;
alter table categorias             enable row level security;
alter table marcas                 enable row level security;
alter table productos              enable row level security;
alter table inventario             enable row level security;
alter table movimientos            enable row level security;
alter table movimientos_detalle    enable row level security;
alter table clientes               enable row level security;
alter table ventas                 enable row level security;
alter table ventas_detalle         enable row level security;
alter table transferencias         enable row level security;
alter table transferencias_detalle enable row level security;
alter table auditoria              enable row level security;

-- ---------------------------------------------------------------------
-- CATÁLOGOS: todos los usuarios activos leen; solo mandos altos escriben
-- ---------------------------------------------------------------------
create policy cat_lectura on productos for select
  using (auth_nivel() > 0);
create policy cat_escritura on productos for all
  using (auth_nivel() >= 60) with check (auth_nivel() >= 60);

create policy categorias_lectura on categorias for select using (auth_nivel() > 0);
create policy categorias_escritura on categorias for all
  using (auth_nivel() >= 60) with check (auth_nivel() >= 60);

create policy marcas_lectura on marcas for select using (auth_nivel() > 0);
create policy marcas_escritura on marcas for all
  using (auth_nivel() >= 60) with check (auth_nivel() >= 60);

create policy sucursales_lectura on sucursales for select using (auth_nivel() > 0);
create policy sucursales_escritura on sucursales for all
  using (auth_nivel() >= 100) with check (auth_nivel() >= 100);

create policy ubicaciones_lectura on ubicaciones for select using (auth_nivel() > 0);
create policy ubicaciones_escritura on ubicaciones for all
  using (auth_nivel() >= 100) with check (auth_nivel() >= 100);

create policy roles_lectura on roles for select using (auth_nivel() > 0);
create policy roles_escritura on roles for all
  using (auth_nivel() >= 100) with check (auth_nivel() >= 100);

create policy deliveries_lectura on deliveries for select using (auth_nivel() > 0);
create policy deliveries_escritura on deliveries for all
  using (auth_nivel() >= 60) with check (auth_nivel() >= 60);

-- ---------------------------------------------------------------------
-- USUARIOS: cada quien ve su perfil; el admin ve y administra todos
-- ---------------------------------------------------------------------
create policy usuarios_propio on usuarios for select
  using (id = auth.uid() or auth_nivel() >= 60);
create policy usuarios_editar_propio on usuarios for update
  using (id = auth.uid()) with check (id = auth.uid() and rol_id = (select rol_id from usuarios where id = auth.uid()));
create policy usuarios_admin on usuarios for all
  using (auth_nivel() >= 100) with check (auth_nivel() >= 100);

-- ---------------------------------------------------------------------
-- INVENTARIO: se lee según ámbito. NADIE lo escribe directamente:
-- el saldo solo cambia a través de las funciones RPC (security definer).
-- ---------------------------------------------------------------------
create policy inventario_lectura on inventario for select
  using (auth_puede_ver_ubicacion(ubicacion_id));

-- ---------------------------------------------------------------------
-- MOVIMIENTOS
-- ---------------------------------------------------------------------
create policy movimientos_lectura on movimientos for select
  using (auth_puede_ver_ubicacion(ubicacion_origen_id)
      or auth_puede_ver_ubicacion(ubicacion_destino_id));

create policy movimientos_detalle_lectura on movimientos_detalle for select
  using (exists (select 1 from movimientos m where m.id = movimiento_id
    and (auth_puede_ver_ubicacion(m.ubicacion_origen_id)
      or auth_puede_ver_ubicacion(m.ubicacion_destino_id))));

-- ---------------------------------------------------------------------
-- TRANSFERENCIAS: las ve el origen, el destino y la gerencia
-- ---------------------------------------------------------------------
create policy transferencias_lectura on transferencias for select
  using (auth_puede_ver_ubicacion(ubicacion_origen_id)
      or auth_puede_ver_ubicacion(ubicacion_destino_id));

create policy transferencias_crear on transferencias for insert
  with check (auth_nivel() >= 40 and auth_puede_ver_ubicacion(ubicacion_origen_id));

create policy transferencias_editar on transferencias for update
  using (auth_nivel() >= 40 and (auth_puede_ver_ubicacion(ubicacion_origen_id)
                              or auth_puede_ver_ubicacion(ubicacion_destino_id)));

create policy trf_detalle_lectura on transferencias_detalle for select
  using (exists (select 1 from transferencias t where t.id = transferencia_id
    and (auth_puede_ver_ubicacion(t.ubicacion_origen_id)
      or auth_puede_ver_ubicacion(t.ubicacion_destino_id))));

create policy trf_detalle_escritura on transferencias_detalle for all
  using (auth_nivel() >= 40) with check (auth_nivel() >= 40);

-- ---------------------------------------------------------------------
-- VENTAS: el delivery solo ve las suyas; la sucursal ve las de su ciudad
-- ---------------------------------------------------------------------
create policy ventas_lectura on ventas for select
  using (
    auth_nivel() >= 80
    or sucursal_id = auth_sucursal_id()
    or delivery_id = auth_delivery_id()
    or usuario_id = auth.uid()
  );

create policy ventas_crear on ventas for insert
  with check (auth_nivel() >= 10 and auth_puede_ver_ubicacion(ubicacion_id));

create policy ventas_editar on ventas for update
  using (auth_nivel() >= 60 or usuario_id = auth.uid());

create policy ventas_detalle_lectura on ventas_detalle for select
  using (exists (select 1 from ventas v where v.id = venta_id
    and (auth_nivel() >= 80 or v.sucursal_id = auth_sucursal_id()
         or v.delivery_id = auth_delivery_id() or v.usuario_id = auth.uid())));

create policy ventas_detalle_escritura on ventas_detalle for all
  using (auth_nivel() >= 10) with check (auth_nivel() >= 10);

-- ---------------------------------------------------------------------
-- CLIENTES: visibles para quien vende
-- ---------------------------------------------------------------------
create policy clientes_lectura on clientes for select using (auth_nivel() > 0);
create policy clientes_escritura on clientes for all
  using (auth_nivel() >= 30) with check (auth_nivel() >= 30);

-- ---------------------------------------------------------------------
-- AUDITORÍA: solo lectura y solo para gerencia. Nadie la modifica.
-- ---------------------------------------------------------------------
create policy auditoria_lectura on auditoria for select using (auth_nivel() >= 80);

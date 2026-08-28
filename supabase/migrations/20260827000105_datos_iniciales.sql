-- =====================================================================
-- NIVELER BOLIVIA — 05_seed.sql
-- Datos mínimos para que el sistema arranque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ROLES
-- ---------------------------------------------------------------------
insert into roles (codigo, nombre, nivel, permisos) values
('ADMIN',     'Administrador',        100, '{"todo": true}'),
('GERENTE',   'Gerente general',       80, '{"reportes": true, "anular": true}'),
('ENCARGADO', 'Encargado de sucursal', 60, '{"productos.editar": true, "ajustes": true}'),
('BODEGA',    'Bodega',                40, '{"movimientos": true, "transferencias": true}'),
('VENTAS',    'Ventas',                30, '{"ventas": true, "clientes": true}'),
('DELIVERY',  'Delivery',              10, '{"ventas": true, "mi_stock": true}')
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------
-- SUCURSALES (las siete ciudades)
-- ---------------------------------------------------------------------
insert into sucursales (codigo, nombre, ciudad) values
('SUC-LPZ', 'Niveler La Paz',      'La Paz'),
('SUC-CBB', 'Niveler Cochabamba',  'Cochabamba'),
('SUC-SCZ', 'Niveler Santa Cruz',  'Santa Cruz'),
('SUC-PTS', 'Niveler Potosí',      'Potosí'),
('SUC-TJA', 'Niveler Tarija',      'Tarija'),
('SUC-ORU', 'Niveler Oruro',       'Oruro'),
('SUC-SUC', 'Niveler Sucre',       'Sucre')
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------
-- UBICACIONES FÍSICAS (una por sucursal, generada automáticamente)
-- ---------------------------------------------------------------------
insert into ubicaciones (codigo, nombre, tipo, sucursal_id)
select 'UBI-' || s.codigo, 'Bodega ' || s.ciudad, 'SUCURSAL', s.id
from sucursales s
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------
-- UBICACIONES VIRTUALES (contrapartes del sistema de doble entrada)
-- ---------------------------------------------------------------------
insert into ubicaciones (codigo, nombre, tipo) values
('UBI-TRANSITO',  'En tránsito',           'TRANSITO'),
('UBI-MERMA',     'Merma / pérdidas',      'MERMA'),
('UBI-PROVEEDOR', 'Proveedores',           'PROVEEDOR'),
('UBI-CLIENTE',   'Clientes',              'CLIENTE')
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------
-- CATEGORÍAS BASE (ajustar al catálogo real)
-- ---------------------------------------------------------------------
insert into categorias (nombre) values
('Electrodomésticos'), ('Iluminación'), ('Limpieza'),
('Cocina'), ('Ventilación'), ('Accesorios'), ('Sin categoría')
on conflict (nombre) do nothing;


-- =====================================================================
-- CREAR EL PRIMER ADMINISTRADOR
-- =====================================================================
-- 1. Registrar el usuario en Supabase Dashboard > Authentication > Users
--    > Add user (con email y contraseña).
-- 2. Ejecutar esto reemplazando el correo:
--
--    update usuarios
--      set rol_id = (select id from roles where codigo='ADMIN'),
--          activo = true,
--          nombre_completo = 'Nombre del administrador'
--      where email = 'admin@niveler.bo';
--
-- A partir de ahí, ese usuario da de alta a los demás desde la app.
-- =====================================================================


-- =====================================================================
-- CARGA DE DATOS REALES
-- =====================================================================
-- Los 80 productos del Excel ya están en 06_migracion_productos.sql, y
-- las imágenes se suben con scripts/subir-imagenes.mjs.
--
-- Los saldos iniciales NO se importan movimiento por movimiento: se
-- registra una sola ENTRADA por sucursal con el conteo físico actual.
-- El Excel viejo queda archivado como respaldo y el sistema arranca con
-- saldos verificados.
--
--    select rpc_registrar_movimiento(
--      'ENTRADA',
--      (select id from ubicaciones where codigo='UBI-PROVEEDOR'),
--      (select id from ubicaciones where codigo='UBI-SUC-CBB'),
--      '[{"producto_id":"...","cantidad":12}]'::jsonb,
--      'Saldo inicial, conteo físico'
--    );
-- =====================================================================

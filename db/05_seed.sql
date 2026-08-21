-- =====================================================================
-- NIVELER BOLIVIA — 05_seed.sql
-- Datos mínimos para que el sistema arranque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ROLES
-- ---------------------------------------------------------------------
insert into roles (codigo, nombre, nivel, permisos) values
('ADMIN',     'Administrador',        100, '{"todo": true}'),
('GERENTE',   'Gerente general',       80, '{"reportes": true, "ver_costos": true, "anular": true}'),
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
-- MIGRACIÓN DEL EXCEL HISTÓRICO
-- =====================================================================
-- Los datos actuales (80 productos, 7 ciudades, 1589 movimientos) se
-- cargan así:
--
-- 1. PRODUCTOS: exportar la hoja Productos a CSV y subirla con
--    Supabase > Table Editor > productos > Import data from CSV.
--    Columnas: sku, nombre, categoria_id, precio_venta, stock_minimo, activo
--
-- 2. SALDOS INICIALES: en lugar de importar los 1589 movimientos
--    históricos uno por uno, registrar un único movimiento de ENTRADA
--    por sucursal con el saldo actual de cada producto. El histórico
--    viejo queda archivado en Drive como respaldo; el sistema nuevo
--    empieza con saldos limpios y verificados.
--
--    select rpc_registrar_movimiento(
--      'ENTRADA',
--      (select id from ubicaciones where codigo='UBI-PROVEEDOR'),
--      (select id from ubicaciones where codigo='UBI-SUC-CBB'),
--      '[{"producto_id":"...","cantidad":12,"costo_unitario":80}]'::jsonb,
--      'Saldo inicial migrado desde Excel — corte 2026-08-20'
--    );
--
-- 3. IMÁGENES: subir el contenido de imagenes_productos.zip al bucket
--    "productos" de Supabase Storage y actualizar imagen_url:
--
--    update productos set imagen_url = sku || '.jpg';
-- =====================================================================

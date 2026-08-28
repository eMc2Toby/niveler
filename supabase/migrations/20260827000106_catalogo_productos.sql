-- =====================================================================
-- 06_migracion_productos.sql  ·  generado desde INVENTARIO_NIVELER.xlsx
-- =====================================================================
-- Los 80 productos del Excel, con su codigo, nombre e imagen. Las rutas
-- apuntan a los .webp: los originales del Excel eran PNG y JPG de hasta
-- 2 MB, y comprimidos pesan la sexta parte sin diferencia visible en un
-- celular. Los originales quedan versionados en imagenes_productos/. El sistema no
-- maneja precios: solo se registra que un producto salio y de donde. El
-- stock minimo queda en 0 y se ajusta desde la app (Productos > Editar).
--
-- Es idempotente: se puede volver a ejecutar sin duplicar nada.
-- Ejecutar despues de 05_seed.sql.
-- =====================================================================

insert into productos (sku, nombre, imagen_url, stock_minimo, activo) values
  ('PRD-001', 'PORTAJABÓN MULTIFUNCIONAL', 'PRD-001.webp', 0, true),
  ('PRD-002', 'DEPILADOR FACIAL FLAWLESS', 'PRD-002.webp', 0, true),
  ('PRD-003', 'SET DE FOCOS PARA TOCADOR 10 EN 1', 'PRD-003.webp', 0, true),
  ('PRD-004', 'LIBRO MÁGICO MI LIBRO EN ESPAÑOL', 'PRD-004.webp', 0, true),
  ('PRD-005', 'MASAJEADOR FACIAL FOREVER', 'PRD-005.webp', 0, true),
  ('PRD-006', 'VAPORIZADOR FACIAL PORTÁTIL', 'PRD-006.webp', 0, true),
  ('PRD-007', 'ASPIRADORA ULTRAVIOLETA PRO', 'PRD-007.webp', 0, true),
  ('PRD-008', 'PROYECTOR DE DIBUJO DINOSAURIO', 'PRD-008.webp', 0, true),
  ('PRD-009', 'SECADOR 3 CABEZALES EN 1', 'PRD-009.webp', 0, true),
  ('PRD-010', 'LLAVERO LINTERNA RECARGABLE', 'PRD-010.webp', 0, true),
  ('PRD-011', 'SECADOR DE ZAPATOS ULTRAVIOLETA 2 BRAZOS', 'PRD-011.webp', 0, true),
  ('PRD-012', 'CEPILLO DE LIMPIEZA 7 EN 1', 'PRD-012.webp', 0, true),
  ('PRD-013', 'LAVADORA PERSONAL INTELIGENTE', 'PRD-013.webp', 0, true),
  ('PRD-014', 'JUEGO PIPOCAS EN ACCIÓN', 'PRD-014.webp', 0, true),
  ('PRD-015', 'CINTA MÁGICA FLAXE TAPE', 'PRD-015.webp', 0, true),
  ('PRD-016', 'MOCHILA DE AHORRO PARA NIÑOS', 'PRD-016.webp', 0, true),
  ('PRD-017', 'PARLANTE CHELERO PORTÁTIL', 'PRD-017.webp', 0, true),
  ('PRD-018', 'BLOQUE MAGNÉTICO - 194 PCS', 'PRD-018.webp', 0, true),
  ('PRD-019', 'CASTILLO PARK', 'PRD-019.webp', 0, true),
  ('PRD-020', 'BLOQUE MAGNÉTICO - 81 PCS', 'PRD-020.webp', 0, true),
  ('PRD-021', 'TRICICLO 3 EN 1 PARA BEBÉS', 'PRD-021.webp', 0, true),
  ('PRD-022', 'ESTUCHE DE MAQUILLAJE EXPANDIBLE', 'PRD-022.webp', 0, true),
  ('PRD-023', 'CEPILLO SECADOR 2 EN 1 DORADO Y VERDE', 'PRD-023.webp', 0, true),
  ('PRD-024', 'MINIPLANCHA DE ROPA PORTÁTIL', 'PRD-024.webp', 0, true),
  ('PRD-025', 'PIEDRA VOLCÁNICA PARA PIEL GRASA', 'PRD-025.webp', 0, true),
  ('PRD-026', 'JOYERO DESMONTABLE', 'PRD-026.webp', 0, true),
  ('PRD-027', 'MÁQUINA DE EXFOLIACIÓN RECARGABLE CELESTE', 'PRD-027.webp', 0, true),
  ('PRD-028', 'AGENDA DE AHORROS', 'PRD-028.webp', 0, true),
  ('PRD-029', 'SET DE CUCHILLOS 5 EN 1', 'PRD-029.webp', 0, true),
  ('PRD-030', 'PIEDRA DEPILADORA', 'PRD-030.webp', 0, true),
  ('PRD-031', 'PORTACUBO DE HIELO 3 EN 1', 'PRD-031.webp', 0, true),
  ('PRD-032', 'MASAJEADOR DE PIES', 'PRD-032.webp', 0, true),
  ('PRD-033', 'CEPILLO PLANCHA', 'PRD-033.webp', 0, true),
  ('PRD-034', 'FOCO VENTILADOR A CONTROL REMOTO', 'PRD-034.webp', 0, true),
  ('PRD-035', 'MINI PANEL LED PARA CELULAR', 'PRD-035.webp', 0, true),
  ('PRD-036', 'CACTUS BAILARIN', 'PRD-036.webp', 0, true),
  ('PRD-037', 'DUCHA PORTÁTIL RECARGABLE', 'PRD-037.webp', 0, true),
  ('PRD-038', 'PARLANTE G', 'PRD-038.webp', 0, true),
  ('PRD-039', 'SECADOR DE ROPA PORTÁTIL', 'PRD-039.webp', 0, true),
  ('PRD-040', 'BOLSAS AHORRA ESPACIO 8 EN 1', 'PRD-040.webp', 0, true),
  ('PRD-041', 'LIMADOR DE UÑAS PARA BEBÉS', 'PRD-041.webp', 0, true),
  ('PRD-042', 'AIRPOP MAGIC - Máquina de Pipocas sin Aceite', 'PRD-042.webp', 0, true),
  ('PRD-043', 'SET 7 EN 1 DE ENVASES PARA CEREALES', 'PRD-043.webp', 0, true),
  ('PRD-044', 'CINTURÓN DE CÓLICOS', 'PRD-044.webp', 0, true),
  ('PRD-045', 'MALLA PARA VENTANAS MAGNÉTICA', 'PRD-045.webp', 0, true),
  ('PRD-046', 'SOMBRILLA PARA PARABRISAS', 'PRD-046.webp', 0, true),
  ('PRD-047', 'ROMANILLA DIGITAL', 'PRD-047.webp', 0, true),
  ('PRD-048', 'SMARTPACK ORGANIZADORES DE VIAJE', 'PRD-048.webp', 0, true),
  ('PRD-049', 'COLÁGENO RENOVA', 'PRD-049.webp', 0, true),
  ('PRD-050', 'GIMNASIO Y ANDADOR 2 EN 1 PARA BEBÉ', 'PRD-050.webp', 0, true),
  ('PRD-051', 'GATITO A CONTROL REMOTO', 'PRD-051.webp', 0, true),
  ('PRD-052', 'PISTOLA LANZA BURBUJAS', 'PRD-052.webp', 0, true),
  ('PRD-053', 'PERRO ROBOT A CONTROL BLANCO', 'PRD-053.webp', 0, true),
  ('PRD-054', 'BLOQUES MAGNETICOS 209 PCS (SIN LUCES)', 'PRD-054.webp', 0, true),
  ('PRD-055', 'BLOQUES MAGNETICOS 68PCS (SIN LUCES)', 'PRD-055.webp', 0, true),
  ('PRD-056', 'BASTA ELECTRÓNICO', 'PRD-056.webp', 0, true),
  ('PRD-057', 'BOLSAS AHORRA ESPACIO 5 EN 1', 'PRD-057.webp', 0, true),
  ('PRD-058', 'KIT DE VINO Y BILLETERA DE REGALO', 'PRD-058.webp', 0, true),
  ('PRD-059', 'BOLSO MAGNÉTICO', 'PRD-059.webp', 0, true),
  ('PRD-060', 'MAQUINA SACA PICADOS', 'PRD-060.webp', 0, true),
  ('PRD-061', 'LINTERNA DE CABEZA 2 LED', 'PRD-061.webp', 0, true),
  ('PRD-062', 'LINTERNA DE CABEZA 3 LED', 'PRD-062.webp', 0, true),
  ('PRD-063', 'CUELLERA MASAJEADOR DE VIAJE', 'PRD-063.webp', 0, true),
  ('PRD-064', 'MINI MALETA DE MAQUILLAJE', 'PRD-064.webp', 0, true),
  ('PRD-065', 'DESINFECTANTE SECA ZAPATOS 4 BRAZOS EN 1', 'PRD-065.webp', 0, true),
  ('PRD-066', 'SET DE VAJILLA DE SILICONA PARA BEBÉ', 'PRD-066.webp', 0, true),
  ('PRD-067', 'MINI LAVADORA DE ROPA INTERIOR', 'PRD-067.webp', 0, true),
  ('PRD-068', 'MINI EXTRACTOR DE NARANJA', 'PRD-068.webp', 0, true),
  ('PRD-069', 'LINTERNA DE CABEZA 1 LED', 'PRD-069.webp', 0, true),
  ('PRD-070', 'EXTRACTOR DE PUNTOS NEGROS Y ESPINILLAS A VAPOR', 'PRD-070.webp', 0, true),
  ('PRD-071', 'MASAJEADOR 4 BRAZOS PARA CUELLO', 'PRD-071.webp', 0, true),
  ('PRD-072', 'MÁQUINA DE RADIO FRECUENCIA CON OZONO FACIAL', 'PRD-072.webp', 0, true),
  ('PRD-073', 'PARLANTE ALAXE', 'PRD-073.webp', 0, true),
  ('PRD-074', 'PEINE MASAJEADOR VIBRATORIO PORTÁTIL', 'PRD-074.webp', 0, true),
  ('PRD-075', 'MINI PISTOLA MASAJEADORA FISIOTERAPIA', 'PRD-075.webp', 0, true),
  ('PRD-076', 'PACK 2X1 PARCHES BAJA FIEBRE Y DOLOR DE CABEZA PARA BEBÉ (PAGA 6 U Y RECIBE 12 U)', 'PRD-076.webp', 0, true),
  ('PRD-077', 'LIMPIADOR FACIAL FOREVER', null, 0, true),
  ('PRD-078', 'DEPILADORA LÁSER IPL 999.990 DISPAROS', 'PRD-078.webp', 0, true),
  ('PRD-079', 'ESTANTE VERDURERO DE 5 NIVELES', null, 0, true),
  ('PRD-080', 'ASISTENTE AMAZON ALEXA', null, 0, true)
on conflict (sku) do update set
  nombre     = excluded.nombre,
  imagen_url = excluded.imagen_url,
  activo     = excluded.activo,
  updated_at = now();

-- Verificacion rapida
-- select count(*) as productos, count(imagen_url) as con_imagen from productos;

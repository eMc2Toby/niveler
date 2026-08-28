-- =====================================================================
-- 11_borrar_imagenes.sql · permitir reemplazar la foto de un producto
-- =====================================================================
-- 07_storage.sql dejó el bucket con lectura pública y escritura para
-- nivel 60 o más, pero sin borrado. Con eso, subir una foto nueva
-- funcionaba y la vieja se quedaba para siempre ocupando espacio: cada
-- reemplazo dejaba un archivo huérfano que nadie volvería a mirar.
--
-- El nombre de archivo lleva marca de tiempo (SKU-1787361723192.webp)
-- justamente para que la foto nueva tenga una URL distinta y aparezca al
-- instante, sin esperar a que expire la caché de 30 días del service
-- worker. El precio de esa decisión es que hay que borrar la anterior a
-- mano, y para eso hace falta esta política.
--
-- Mismo nivel que para subir: encargado de sucursal para arriba.
-- =====================================================================

create policy productos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and auth_nivel() >= 60);

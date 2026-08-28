-- =====================================================================
-- 07_storage.sql · bucket de imágenes de productos
-- =====================================================================
--
-- El bucket es público: las imágenes se sirven por URL directa y quedan
-- en caché del service worker, así el delivery las ve sin datos. Lo que
-- sí está cerrado es la escritura: solo un usuario autenticado con nivel
-- 60 o más (encargado para arriba) puede subir o reemplazar imágenes.
--
-- Ejecutar después de 04_rls.sql, que es donde nace auth_nivel().
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy productos_lectura_publica on storage.objects for select
  using (bucket_id = 'productos');

create policy productos_escritura on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and auth_nivel() >= 60);

create policy productos_actualizar on storage.objects for update to authenticated
  using (bucket_id = 'productos' and auth_nivel() >= 60);

-- Si hay que volver a correrlo sobre una base donde ya existen, primero:
--   drop policy if exists productos_lectura_publica on storage.objects;
--   drop policy if exists productos_escritura      on storage.objects;
--   drop policy if exists productos_actualizar     on storage.objects;

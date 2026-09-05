# Imágenes de productos

Niveler guarda las imágenes en el bucket público `productos` de Supabase
Storage. PostgreSQL conserva únicamente la ruta en `productos.imagen_url`.

## Flujo de carga

1. El navegador valida que el archivo sea una imagen y que el original no
   supere 15 MB.
2. La imagen se reduce a un máximo de 1200 px y 500 KiB antes de enviarse.
3. El cliente autenticado la sube al bucket con un nombre nuevo que incluye una
   marca de tiempo. Así el navegador no reutiliza una versión anterior.
4. La ruta se guarda junto al producto.
5. Después de confirmar el cambio se elimina la imagen reemplazada.

La política `productos_escritura` de `db/07_storage.sql` exige nivel 60 o
superior. La lectura es pública para que el catálogo pueda mostrar las fotos.
`db/11_borrar_imagenes.sql` aplica el mismo nivel al borrado.

## Variables

El frontend solo necesita:

```env
VITE_SUPABASE_URL=https://PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=CLAVE_PUBLICA
```

La clave `service_role` no pertenece al frontend y nunca debe llevar el prefijo
`VITE_`.

## Verificación manual

1. Crear un producto sin foto.
2. Crear otro con foto y comprobar que se vea en la lista y el detalle.
3. Cambiar la foto y verificar que aparezca inmediatamente.
4. Quitarla y confirmar que el producto quede sin imagen.
5. Probar con un rol inferior a nivel 60 y confirmar que la carga sea rechazada.
6. Desconectar la red y confirmar que no se guarden cambios pendientes; volver
   a conectar y repetir la operación correctamente.

Para una carga masiva inicial se conserva `scripts/subir-imagenes.mjs`. Las
imágenes también pueden prepararse previamente con
`scripts/comprimir-imagenes.mjs`.

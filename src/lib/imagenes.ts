/**
 * Compresión de fotos en el propio navegador, antes de subirlas.
 *
 * La foto de un celular moderno pesa entre 3 y 8 MB. Subirla tal cual
 * castiga dos veces: los datos de quien la sube, y los de cada repartidor
 * que después la descargue. Convertirla aquí, antes de que salga del
 * teléfono, evita las dos cosas y no necesita servidor.
 *
 * Los mismos números que usa `scripts/comprimir-imagenes.mjs` para las
 * fotos del catálogo original, para que todo el bucket sea homogéneo:
 * 1000 px de ancho máximo y calidad 82.
 */

const ANCHO_MAXIMO = 1000
const CALIDAD = 0.82

export const LIMITE_ORIGEN = 15 * 1024 * 1024 // 15 MB de foto de entrada

export async function comprimirAWebp(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('Ese archivo no es una imagen.')
  }
  if (archivo.size > LIMITE_ORIGEN) {
    throw new Error('La imagen pesa demasiado. Usa una foto de menos de 15 MB.')
  }

  // createImageBitmap respeta la orientación EXIF, que es lo que hace que
  // una foto tomada en vertical no termine acostada.
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })

  const escala = Math.min(1, ANCHO_MAXIMO / bitmap.width)
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto

  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('El navegador no pudo procesar la imagen.')
  ctx.drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/webp', CALIDAD),
  )

  // Safari viejo no sabe escribir WebP y devuelve null o un PNG. Si pasa,
  // mejor subir un JPEG comprimido que dejar al usuario sin poder guardar.
  if (!blob || blob.type !== 'image/webp') {
    const respaldo = await new Promise<Blob | null>((resolver) =>
      lienzo.toBlob(resolver, 'image/jpeg', CALIDAD),
    )
    if (!respaldo) throw new Error('El navegador no pudo convertir la imagen.')
    return respaldo
  }

  return blob
}

/** Extensión que le corresponde al blob que salió de comprimirAWebp. */
export const extensionDe = (blob: Blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg')

/**
 * Compresión de fotos en el propio navegador, antes de subirlas.
 *
 * La foto de un celular moderno pesa entre 3 y 8 MB. Subirla tal cual
 * castiga dos veces: los datos de quien la sube, y los de cada repartidor
 * que después la descargue. Convertirla aquí, antes de que salga del
 * teléfono, evita las dos cosas y no necesita servidor.
 *
 * Los mismos límites que usa `scripts/comprimir-imagenes.mjs` para las
 * fotos del catálogo original: 1200 px por lado y 500 KB como máximo.
 */

export const DIMENSION_MAXIMA = 1200
export const LIMITE_FINAL = 500 * 1024

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

  const dimensiones = [DIMENSION_MAXIMA, 1000, 800, 640, 480]
  const calidades = [0.82, 0.74, 0.66, 0.58, 0.50, 0.42]

  try {
    for (const dimension of dimensiones) {
      const escala = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height))
      const ancho = Math.max(1, Math.round(bitmap.width * escala))
      const alto = Math.max(1, Math.round(bitmap.height * escala))
      const lienzo = document.createElement('canvas')
      lienzo.width = ancho
      lienzo.height = alto
      const ctx = lienzo.getContext('2d')
      if (!ctx) throw new Error('El navegador no pudo procesar la imagen.')
      ctx.drawImage(bitmap, 0, 0, ancho, alto)

      for (const calidad of calidades) {
        const webp = await new Promise<Blob | null>((resolver) =>
          lienzo.toBlob(resolver, 'image/webp', calidad),
        )
        if (webp?.type === 'image/webp' && webp.size <= LIMITE_FINAL) return webp

        // Safari antiguo puede no codificar WebP. JPEG también es válido
        // en el bucket de productos y permite completar la carga.
        const jpeg = await new Promise<Blob | null>((resolver) =>
          lienzo.toBlob(resolver, 'image/jpeg', calidad),
        )
        if (jpeg?.type === 'image/jpeg' && jpeg.size <= LIMITE_FINAL) return jpeg
      }
    }
  } finally {
    bitmap.close()
  }

  throw new Error('La imagen continúa pesando más de 500 KB después de optimizarla.')
}

/** Extensión que le corresponde al blob que salió de comprimirAWebp. */
export const extensionDe = (blob: Blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg')

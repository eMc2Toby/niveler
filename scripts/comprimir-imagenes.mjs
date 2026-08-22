/**
 * Convierte las fotos de producto a WebP para que carguen rápido en el
 * celular de un repartidor con datos móviles.
 *
 *   node scripts/comprimir-imagenes.mjs
 *
 * Lee de `imagenes_productos/` y escribe en `imagenes_productos_webp/`.
 * Los originales no se tocan: son el archivo maestro y viven versionados
 * en el repositorio. Si algún día hay que rehacer la conversión con otra
 * calidad, se rehace desde ellos.
 *
 * Dos decisiones y su porqué:
 *
 * - 1000 px de ancho máximo. Las fotos vienen de hasta 2000 px, y en una
 *   pantalla de celular eso es el doble de lo que se llega a ver. Lo que
 *   sobra son megabytes que el repartidor paga en datos.
 *
 * - Calidad 82. Por debajo empiezan a verse manchas en los fondos lisos
 *   de las fotos de catálogo; por encima el archivo crece sin que la
 *   diferencia se note en un teléfono.
 */
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { extname, join, parse } from 'node:path'
import sharp from 'sharp'

const ORIGEN = 'imagenes_productos'
const DESTINO = 'imagenes_productos_webp'
const ANCHO_MAXIMO = 1000
const CALIDAD = 82

const ENTRADAS = ['.jpg', '.jpeg', '.png', '.webp']

mkdirSync(DESTINO, { recursive: true })

const archivos = readdirSync(ORIGEN).filter((f) => ENTRADAS.includes(extname(f).toLowerCase()))

let pesoAntes = 0
let pesoDespues = 0
let convertidas = 0

console.log(`${archivos.length} imágenes por convertir\n`)

for (const archivo of archivos) {
  const rutaOrigen = join(ORIGEN, archivo)
  const rutaDestino = join(DESTINO, `${parse(archivo).name}.webp`)

  const info = await sharp(rutaOrigen)
    // `withoutEnlargement` evita agrandar las que ya son chicas: estirarlas
    // solo sumaría peso sin agregar un solo detalle.
    .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
    .webp({ quality: CALIDAD })
    .toFile(rutaDestino)

  const antes = statSync(rutaOrigen).size
  pesoAntes += antes
  pesoDespues += info.size
  convertidas++

  const ahorro = Math.round((1 - info.size / antes) * 100)
  console.log(
    `${archivo.padEnd(16)} ${(antes / 1024).toFixed(0).padStart(5)} KB → ` +
    `${(info.size / 1024).toFixed(0).padStart(5)} KB  (−${ahorro}%)`,
  )
}

const mb = (b) => (b / 1024 / 1024).toFixed(1)
console.log(
  `\n${convertidas} convertidas · ${mb(pesoAntes)} MB → ${mb(pesoDespues)} MB ` +
  `(−${Math.round((1 - pesoDespues / pesoAntes) * 100)}%)`,
)
console.log(`\nQuedaron en ${DESTINO}/. Para subirlas:`)
console.log('  SUPABASE_URL=... SUPABASE_KEY=... node scripts/subir-imagenes.mjs --webp')

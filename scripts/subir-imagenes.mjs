/**
 * Sube imagenes_productos/ al bucket `productos` de Supabase Storage.
 *
 * Se corre UNA vez, a mano, desde tu PC:
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/subir-imagenes.mjs
 *
 * En PowerShell:
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/subir-imagenes.mjs
 *
 * La service_role key se pasa por variable de entorno y NUNCA se guarda en
 * el repo ni en .env: esa clave se salta todas las políticas RLS. Escribir
 * en Storage requiere ese permiso, por eso este script vive fuera de la app.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, '')
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'productos'
const CARPETA = 'imagenes_productos'

if (!URL_BASE || !CLAVE) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Mira el encabezado de este archivo.')
  process.exit(1)
}

const TIPOS = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

const archivos = readdirSync(CARPETA).filter((f) => TIPOS[extname(f).toLowerCase()])
console.log(`${archivos.length} imágenes por subir al bucket "${BUCKET}"`)

let subidas = 0
let fallidas = 0

for (const archivo of archivos) {
  const cuerpo = readFileSync(join(CARPETA, archivo))
  const r = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${archivo}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLAVE}`,
      'Content-Type': TIPOS[extname(archivo).toLowerCase()],
      // Sobrescribe si ya existe: así el script se puede repetir sin limpiar antes.
      'x-upsert': 'true',
    },
    body: cuerpo,
  })

  if (r.ok) {
    subidas++
    process.stdout.write('.')
  } else {
    fallidas++
    console.error(`\n${archivo}: ${r.status} ${await r.text()}`)
  }
}

console.log(`\nListo. ${subidas} subidas, ${fallidas} con error.`)
if (subidas > 0) {
  console.log(`Verifica una: ${URL_BASE}/storage/v1/object/public/${BUCKET}/${archivos[0]}`)
}

/**
 * Regenera src/types/database.ts desde el proyecto real de Supabase.
 *
 * Toma el project ref de SUPABASE_PROJECT_ID o de VITE_SUPABASE_URL en los
 * archivos .env del proyecto. Requiere una sesion previa de `supabase login`,
 * o SUPABASE_ACCESS_TOKEN en el entorno. El archivo solo se reemplaza si el
 * comando termina bien y devuelve una definicion de Database valida.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))

function leerProjectId() {
  const configurado = process.env.SUPABASE_PROJECT_ID?.trim()
  if (configurado) return configurado

  for (const archivo of ['.env.local', '.env.production', '.env']) {
    const ruta = fileURLToPath(new URL(`../${archivo}`, import.meta.url))
    if (!existsSync(ruta)) continue

    const linea = readFileSync(ruta, 'utf8')
      .split(/\r?\n/)
      .find((valor) => valor.trim().startsWith('VITE_SUPABASE_URL='))
    if (!linea) continue

    const valor = linea.slice(linea.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')
    try {
      const host = new URL(valor).hostname
      const projectId = host.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1]
      if (projectId) return projectId
    } catch {
      // Se prueba el siguiente archivo y se emite un unico error al final.
    }
  }

  return undefined
}

const projectId = leerProjectId()
if (!projectId) {
  console.error('No se pudo obtener el project ref de SUPABASE_PROJECT_ID ni de VITE_SUPABASE_URL.')
  process.exit(1)
}

const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url))
const resultado = spawnSync(
  process.execPath,
  [cli, 'gen', 'types', 'typescript', '--project-id', projectId],
  { cwd: raiz, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] },
)

if (resultado.error) throw resultado.error
if (resultado.status !== 0) process.exit(resultado.status ?? 1)
if (!resultado.stdout.includes('export type Database')) {
  console.error('Supabase no devolvio una definicion valida; se conserva el archivo actual.')
  process.exit(1)
}

const destino = fileURLToPath(new URL('../src/types/database.ts', import.meta.url))
writeFileSync(destino, resultado.stdout)
console.log('Tipos actualizados en src/types/database.ts')

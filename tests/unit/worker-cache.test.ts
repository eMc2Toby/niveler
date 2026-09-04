import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(import.meta.dirname, '../..')
const worker = readFileSync(resolve(raiz, 'src/worker.ts'), 'utf8')
const configuracion = readFileSync(resolve(raiz, 'wrangler.jsonc'), 'utf8')

describe('publicación de la SPA', () => {
  it('evita conservar HTML antiguo sin quitar la caché de assets con hash', () => {
    expect(configuracion).toContain('"binding": "ASSETS"')
    expect(configuracion).toContain('"run_worker_first"')
    expect(configuracion).toContain('"!/assets/*"')
    expect(worker).toContain("env.ASSETS.fetch(request)")
    expect(worker).toContain("tipoContenido.includes('text/html')")
    expect(worker).toContain("'no-store, no-cache, must-revalidate'")
  })
})

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(import.meta.dirname, '../..')

describe('almacenamiento de imágenes', () => {
  it('sube y elimina las imágenes mediante el cliente autenticado de Supabase', () => {
    const codigo = readFileSync(join(raiz, 'src/lib/supabase.ts'), 'utf8')
    expect(codigo).toMatch(/supabase\.storage\s*\.from\('productos'\)\s*\.upload/)
    expect(codigo).toContain("supabase.storage.from('productos').remove([ruta])")
  })

  it('mantiene la escritura del bucket limitada por rol', () => {
    const sql = readFileSync(join(raiz, 'db/07_storage.sql'), 'utf8')
    expect(sql).toContain("bucket_id = 'productos' and auth_nivel() >= 60")
  })
})

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(import.meta.dirname, '../..')

describe('contratos offline y almacenamiento de imágenes', () => {
  it('reserva la clave idempotente antes de ejecutar el comando', () => {
    const sql = readFileSync(join(raiz, 'db/14_offline_idempotencia.sql'), 'utf8')
    const reserva = sql.indexOf('returning id into v_nueva_id')
    const ejecucion = sql.indexOf('case p_tipo')
    expect(reserva).toBeGreaterThan(0)
    expect(reserva).toBeLessThan(ejecucion)
    expect(sql).toContain('constraint uq_operacion_idempotente unique (usuario_id, clave)')
  })

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

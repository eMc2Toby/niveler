import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(import.meta.dirname, '../..')
const cliente = readFileSync(resolve(raiz, 'src/lib/supabase.ts'), 'utf8')
const sql = readdirSync(resolve(raiz, 'db'))
  .filter((nombre) => nombre.endsWith('.sql'))
  .sort()
  .map((nombre) => readFileSync(resolve(raiz, 'db', nombre), 'utf8'))
  .join('\n')

describe('contrato frontend-Supabase', () => {
  it('define en SQL cada RPC invocada por el frontend', () => {
    const llamadas = [...cliente.matchAll(/\.rpc\(['"]([^'"]+)['"]/g)].map((m) => m[1])
    const definidas = new Set(
      [...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_]+)/gi)]
        .map((m) => m[1]),
    )
    expect([...new Set(llamadas)].filter((nombre) => !definidas.has(nombre))).toEqual([])
  })

  it('mantiene balanceados los delimitadores de funciones SQL', () => {
    for (const archivo of readdirSync(resolve(raiz, 'db')).filter((n) => n.endsWith('.sql'))) {
      const contenido = readFileSync(resolve(raiz, 'db', archivo), 'utf8')
      expect((contenido.match(/\$\$/g) ?? []).length % 2, archivo).toBe(0)
    }
  })
})

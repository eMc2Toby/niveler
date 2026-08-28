import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(import.meta.dirname, '../..')
const sqlManual = readFileSync(resolve(raiz, 'db/13_encomiendas.sql'), 'utf8')
const sqlFormal = readFileSync(
  resolve(raiz, 'supabase/migrations/20260828000113_encomiendas.sql'),
  'utf8',
)

const rpc = [
  'rpc_crear_encomienda',
  'rpc_despachar_encomienda',
  'rpc_entregar_encomienda',
  'rpc_anular_encomienda',
]

describe('migración de encomiendas', () => {
  it.each([
    ['script manual', sqlManual],
    ['migración formal', sqlFormal],
  ])('%s incluye el modelo, RLS y la auditoría', (_nombre, sql) => {
    expect(sql).toMatch(/create table encomiendas/i)
    expect(sql).toMatch(/alter table encomiendas enable row level security/i)
    expect(sql).toMatch(/create policy encomiendas_lectura/i)
    expect(sql).toMatch(/create trigger trg_audit_encomiendas/i)
    expect(sql).toMatch(/revoke insert, update, delete on table encomiendas from public, anon, authenticated/i)
  })

  it.each(rpc)('%s es security definer y está expuesta solo a usuarios autenticados', (nombre) => {
    const definicion = new RegExp(
      `create or replace function ${nombre}[\\s\\S]*?language plpgsql security definer`,
      'i',
    )
    expect(sqlFormal).toMatch(definicion)
    expect(sqlFormal).toMatch(new RegExp(`grant execute on function ${nombre}`, 'i'))
    expect(sqlFormal).toMatch(new RegExp(`revoke execute on function ${nombre}`, 'i'))
  })

  it('mantiene separados el seguimiento de bultos y el inventario', () => {
    const cuerpoRpc = sqlFormal.slice(sqlFormal.indexOf('create or replace function rpc_crear_encomienda'))
    expect(cuerpoRpc).not.toMatch(/insert into inventario/i)
    expect(cuerpoRpc).not.toMatch(/update inventario/i)
    expect(cuerpoRpc).not.toMatch(/fn_aplicar_delta/i)
  })
})

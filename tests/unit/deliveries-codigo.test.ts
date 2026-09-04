import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(import.meta.dirname, '../..')

describe('código automático de deliveries', () => {
  it('usa una secuencia y un trigger para asignar códigos concurrentes', () => {
    const sql = readFileSync(join(raiz, 'db/18_codigo_delivery_automatico.sql'), 'utf8')
    expect(sql).toContain('create sequence if not exists deliveries_codigo_seq')
    expect(sql).toContain("new.codigo := 'DEL-' || lpad(nextval('deliveries_codigo_seq')::text, 3, '0')")
    expect(sql).toContain('before insert on deliveries')
  })

  it('no permite editar ni exige el código en el formulario', () => {
    const formulario = readFileSync(join(raiz, 'src/features/deliveries/Deliveries.tsx'), 'utf8')
    expect(formulario).toContain("value={delivery?.codigo ?? 'Automático al guardar'}")
    expect(formulario).not.toContain("set('codigo')")
    expect(formulario).not.toContain('!f.codigo.trim()')
  })

  it('excluye cuentas ya vinculadas con otro delivery', () => {
    const formulario = readFileSync(join(raiz, 'src/features/deliveries/Deliveries.tsx'), 'utf8')
    expect(formulario).toContain('actual.usuario_id === cuenta.id && actual.id !== delivery?.id')
  })

  it('hace coincidir el upsert de ubicación con el índice único parcial', () => {
    const sql = readFileSync(join(raiz, 'db/19_corregir_ubicacion_delivery.sql'), 'utf8')
    expect(sql).toContain('on conflict (delivery_id) where delivery_id is not null do update')
  })
})

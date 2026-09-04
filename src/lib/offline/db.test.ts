import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { dbLocal, limpiarDatosLocales } from './db'

describe('base offline por usuario', () => {
  beforeEach(async () => {
    await dbLocal.cache.clear()
    await dbLocal.outbox.clear()
  })

  afterAll(async () => {
    await dbLocal.delete()
  })

  it('separa la caché y la cola por usuario', async () => {
    await dbLocal.cache.bulkAdd([
      { id: 'u1:productos', usuarioId: 'u1', clave: 'productos', datos: [1], actualizadoEn: Date.now() },
      { id: 'u2:productos', usuarioId: 'u2', clave: 'productos', datos: [2], actualizadoEn: Date.now() },
    ])
    await dbLocal.outbox.bulkAdd([
      { id: 'o1', usuarioId: 'u1', tipo: 'PRUEBA', payload: {}, estado: 'PENDIENTE', intentos: 0, creadaEn: 1, siguienteIntentoEn: 1 },
      { id: 'o2', usuarioId: 'u2', tipo: 'PRUEBA', payload: {}, estado: 'PENDIENTE', intentos: 0, creadaEn: 2, siguienteIntentoEn: 2 },
    ])

    await limpiarDatosLocales('u1')

    expect(await dbLocal.cache.where('usuarioId').equals('u1').count()).toBe(0)
    expect(await dbLocal.outbox.where('usuarioId').equals('u1').count()).toBe(0)
    expect(await dbLocal.cache.where('usuarioId').equals('u2').count()).toBe(1)
    expect(await dbLocal.outbox.where('usuarioId').equals('u2').count()).toBe(1)
  })
})

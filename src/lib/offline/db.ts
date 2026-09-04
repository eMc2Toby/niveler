import Dexie, { type Table } from 'dexie'
import type { Json } from '@/types/database'

export type RegistroCache = {
  id: string
  usuarioId: string
  clave: string
  datos: unknown
  actualizadoEn: number
}

export type EstadoOutbox = 'PENDIENTE' | 'SINCRONIZANDO' | 'ERROR'

export type OperacionOutbox = {
  id: string
  usuarioId: string
  tipo: string
  payload: Record<string, Json | undefined>
  estado: EstadoOutbox
  intentos: number
  creadaEn: number
  siguienteIntentoEn: number
  ultimoError?: string
}

class BaseLocalNiveler extends Dexie {
  cache!: Table<RegistroCache, string>
  outbox!: Table<OperacionOutbox, string>

  constructor() {
    super('niveler-local')
    this.version(1).stores({
      cache: 'id, usuarioId, [usuarioId+clave], actualizadoEn',
      outbox: 'id, usuarioId, estado, [usuarioId+estado], creadaEn, siguienteIntentoEn',
    })
  }
}

export const dbLocal = new BaseLocalNiveler()

export async function limpiarDatosLocales(usuarioId: string) {
  await dbLocal.transaction('rw', dbLocal.cache, dbLocal.outbox, async () => {
    await dbLocal.cache.where('usuarioId').equals(usuarioId).delete()
    await dbLocal.outbox.where('usuarioId').equals(usuarioId).delete()
  })
  notificarCambioOutbox()
}

export function notificarCambioOutbox() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('niveler:outbox'))
}

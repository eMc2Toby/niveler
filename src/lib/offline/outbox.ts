import { dbLocal, notificarCambioOutbox, type OperacionOutbox } from './db'
import { esErrorConexion } from './cache'
import { supabase } from '@/lib/clienteSupabase'
import type { Json } from '@/types/database'

export type TipoOperacionOffline =
  | 'REGISTRAR_MOVIMIENTO' | 'ANULAR_MOVIMIENTO' | 'AJUSTAR_STOCK'
  | 'REGISTRAR_VENTA' | 'ENTREGAR_VENTA' | 'ANULAR_VENTA'
  | 'CREAR_TRANSFERENCIA' | 'ENVIAR_TRANSFERENCIA'
  | 'ANULAR_TRANSFERENCIA' | 'RECIBIR_TRANSFERENCIA'
  | 'CREAR_ENCOMIENDA' | 'DESPACHAR_ENCOMIENDA'
  | 'ENTREGAR_ENCOMIENDA' | 'ANULAR_ENCOMIENDA'

export type ResultadoPendiente = {
  pendiente_offline: true
  operacion_id: string
}

export const esResultadoPendiente = (valor: unknown): valor is ResultadoPendiente =>
  !!valor && typeof valor === 'object' && (valor as ResultadoPendiente).pendiente_offline === true

function demoraReintento(intentos: number) {
  return Math.min(5 * 60_000, 2 ** Math.min(intentos, 8) * 1_000)
}

async function ejecutarRemoto(operacion: OperacionOutbox) {
  const { data, error } = await supabase.rpc('rpc_ejecutar_operacion_offline', {
    p_clave: operacion.id,
    p_tipo: operacion.tipo,
    p_payload: operacion.payload,
  })
  if (error) throw new Error(error.message)
  return data
}

async function sincronizarUna(operacion: OperacionOutbox) {
  await dbLocal.outbox.update(operacion.id, { estado: 'SINCRONIZANDO' })
  notificarCambioOutbox()
  try {
    const resultado = await ejecutarRemoto(operacion)
    await dbLocal.outbox.delete(operacion.id)
    notificarCambioOutbox()
    return resultado
  } catch (error) {
    const intentos = operacion.intentos + 1
    if (esErrorConexion(error)) {
      await dbLocal.outbox.update(operacion.id, {
        estado: 'PENDIENTE',
        intentos,
        siguienteIntentoEn: Date.now() + demoraReintento(intentos),
        ultimoError: error instanceof Error ? error.message : 'Sin conexión',
      })
      notificarCambioOutbox()
      return undefined
    }
    await dbLocal.outbox.update(operacion.id, {
      estado: 'ERROR',
      intentos,
      ultimoError: error instanceof Error ? error.message : 'La operación fue rechazada',
    })
    notificarCambioOutbox()
    throw error
  }
}

/** Guarda primero la intención local. La RPC idempotente permite reintentar sin duplicar. */
export async function ejecutarOEncolar<T>(
  tipo: TipoOperacionOffline,
  payload: Record<string, Json | undefined>,
): Promise<T | ResultadoPendiente> {
  const { data } = await supabase.auth.getSession()
  const usuarioId = data.session?.user.id
  if (!usuarioId) throw new Error('Debes iniciar sesión para registrar operaciones.')

  const operacion: OperacionOutbox = {
    id: crypto.randomUUID(),
    usuarioId,
    tipo,
    payload,
    estado: 'PENDIENTE',
    intentos: 0,
    creadaEn: Date.now(),
    siguienteIntentoEn: Date.now(),
  }
  await dbLocal.outbox.add(operacion)
  notificarCambioOutbox()

  if (!navigator.onLine) return { pendiente_offline: true, operacion_id: operacion.id }
  const resultado = await sincronizarUna(operacion)
  return resultado === undefined
    ? { pendiente_offline: true, operacion_id: operacion.id }
    : resultado as T
}

export async function sincronizarOutbox(usuarioId: string) {
  if (!navigator.onLine) return
  const pendientes = await dbLocal.outbox
    .where('[usuarioId+estado]')
    .equals([usuarioId, 'PENDIENTE'])
    .sortBy('creadaEn')

  for (const operacion of pendientes) {
    if (!navigator.onLine) break
    if (operacion.siguienteIntentoEn > Date.now()) continue
    try {
      await sincronizarUna(operacion)
    } catch {
      // Los rechazos de negocio quedan visibles como ERROR; una operación
      // posterior puede seguir sincronizándose de manera independiente.
    }
  }
}

export function activarSincronizacionOutbox(usuarioId: string) {
  const sincronizar = () => void sincronizarOutbox(usuarioId)
  window.addEventListener('online', sincronizar)
  const intervalo = window.setInterval(sincronizar, 30_000)
  sincronizar()
  return () => {
    window.removeEventListener('online', sincronizar)
    window.clearInterval(intervalo)
  }
}

export async function contarOutbox(usuarioId: string) {
  const [pendientes, errores] = await Promise.all([
    dbLocal.outbox.where('[usuarioId+estado]').equals([usuarioId, 'PENDIENTE']).count(),
    dbLocal.outbox.where('[usuarioId+estado]').equals([usuarioId, 'ERROR']).count(),
  ])
  return { pendientes, errores }
}

export async function listarOutbox(usuarioId: string) {
  return dbLocal.outbox.where('usuarioId').equals(usuarioId).sortBy('creadaEn')
}

export async function reintentarOperacion(usuarioId: string, id: string) {
  const operacion = await dbLocal.outbox.get(id)
  if (!operacion || operacion.usuarioId !== usuarioId) return
  await dbLocal.outbox.update(id, {
    estado: 'PENDIENTE', siguienteIntentoEn: Date.now(), ultimoError: undefined,
  })
  notificarCambioOutbox()
  await sincronizarOutbox(usuarioId)
}

export async function descartarOperacion(usuarioId: string, id: string) {
  const operacion = await dbLocal.outbox.get(id)
  if (!operacion || operacion.usuarioId !== usuarioId) return
  await dbLocal.outbox.delete(id)
  notificarCambioOutbox()
}

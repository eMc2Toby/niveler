import { dbLocal } from './db'
import { supabase } from '@/lib/clienteSupabase'

const VIGENCIA_CACHE_MS = 24 * 60 * 60_000

export function esErrorConexion(error: unknown) {
  const mensaje = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : String(error ?? '')
  return !navigator.onLine || /failed to fetch|fetch failed|network|networkerror|load failed/i.test(mensaje)
}

export async function guardarCacheUsuario<T>(usuarioId: string, clave: string, datos: T) {
  await dbLocal.cache.put({
    id: `${usuarioId}:${clave}`,
    usuarioId,
    clave,
    datos,
    actualizadoEn: Date.now(),
  })
}

export async function leerCacheUsuario<T>(usuarioId: string, clave: string): Promise<T | undefined> {
  const registro = await dbLocal.cache.get(`${usuarioId}:${clave}`)
  if (registro && registro.actualizadoEn + VIGENCIA_CACHE_MS < Date.now()) {
    await dbLocal.cache.delete(registro.id)
    return undefined
  }
  return registro?.datos as T | undefined
}

/**
 * Consulta primero al servidor y conserva la última respuesta autorizada.
 * Si no hay red, solo devuelve datos del mismo usuario autenticado.
 */
export async function conCacheOffline<T>(clave: string, consultar: () => Promise<T>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const usuarioId = data.session?.user.id
  if (!usuarioId) return consultar()

  if (navigator.onLine) {
    try {
      const remoto = await consultar()
      await guardarCacheUsuario(usuarioId, clave, remoto)
      return remoto
    } catch (error) {
      if (!esErrorConexion(error)) throw error
    }
  }

  const local = await leerCacheUsuario<T>(usuarioId, clave)
  if (local !== undefined) return local
  throw new Error('No hay una copia disponible para consultar sin conexión.')
}

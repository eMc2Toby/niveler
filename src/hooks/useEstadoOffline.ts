import { useCallback, useEffect, useState } from 'react'
import { contarOutbox } from '@/lib/offline/outbox'
import { useAuth } from './useAuth'

export function useEstadoOffline() {
  const { sesion } = useAuth()
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [pendientes, setPendientes] = useState(0)
  const [errores, setErrores] = useState(0)

  const actualizar = useCallback(async () => {
    const usuarioId = sesion?.user.id
    if (!usuarioId) { setPendientes(0); setErrores(0); return }
    const conteo = await contarOutbox(usuarioId)
    setPendientes(conteo.pendientes)
    setErrores(conteo.errores)
  }, [sesion?.user.id])

  useEffect(() => {
    const online = () => { setEnLinea(true); void actualizar() }
    const offline = () => setEnLinea(false)
    const cambio = () => void actualizar()
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    window.addEventListener('niveler:outbox', cambio)
    void actualizar()
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.removeEventListener('niveler:outbox', cambio)
    }
  }, [actualizar])

  return { enLinea, pendientes, errores }
}

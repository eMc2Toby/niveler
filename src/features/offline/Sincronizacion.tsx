import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock3, RefreshCw, Trash2, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, EstadoVacio } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import {
  descartarOperacion, listarOutbox, reintentarOperacion,
} from '@/lib/offline/outbox'
import type { OperacionOutbox } from '@/lib/offline/db'
import { fechaHora } from '@/lib/formato'

const NOMBRES: Record<string, string> = {
  REGISTRAR_MOVIMIENTO: 'Registrar movimiento', ANULAR_MOVIMIENTO: 'Anular movimiento',
  AJUSTAR_STOCK: 'Ajustar stock', REGISTRAR_VENTA: 'Registrar venta',
  ENTREGAR_VENTA: 'Entregar venta', ANULAR_VENTA: 'Anular venta',
  CREAR_TRANSFERENCIA: 'Crear transferencia', ENVIAR_TRANSFERENCIA: 'Enviar transferencia',
  ANULAR_TRANSFERENCIA: 'Anular transferencia', RECIBIR_TRANSFERENCIA: 'Recibir transferencia',
  CREAR_ENCOMIENDA: 'Crear encomienda', DESPACHAR_ENCOMIENDA: 'Despachar encomienda',
  ENTREGAR_ENCOMIENDA: 'Entregar encomienda', ANULAR_ENCOMIENDA: 'Anular encomienda',
}

export default function Sincronizacion() {
  const { sesion } = useAuth()
  const [operaciones, setOperaciones] = useState<OperacionOutbox[]>([])
  const [procesando, setProcesando] = useState<string | null>(null)
  const usuarioId = sesion?.user.id

  const cargar = useCallback(async () => {
    setOperaciones(usuarioId ? await listarOutbox(usuarioId) : [])
  }, [usuarioId])

  useEffect(() => {
    const cambio = () => void cargar()
    window.addEventListener('niveler:outbox', cambio)
    void cargar()
    return () => window.removeEventListener('niveler:outbox', cambio)
  }, [cargar])

  async function reintentar(op: OperacionOutbox) {
    if (!usuarioId || !navigator.onLine) {
      toast.info('Necesitas conexión para volver a intentar.'); return
    }
    setProcesando(op.id)
    await reintentarOperacion(usuarioId, op.id)
    await cargar()
    setProcesando(null)
  }

  async function descartar(op: OperacionOutbox) {
    if (!usuarioId) return
    if (!window.confirm('¿Descartar esta operación local? No se enviará a Supabase.')) return
    await descartarOperacion(usuarioId, op.id)
    await cargar()
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="nv-kicker">Modo sin conexión</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Sincronización</h1>
        <p className="mt-1 text-sm text-slate-500">Operaciones guardadas en este dispositivo.</p>
      </div>

      {!navigator.onLine && (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
          Se enviarán automáticamente al recuperar conexión.
        </div>
      )}

      {!operaciones.length ? (
        <EstadoVacio
          titulo="Todo sincronizado"
          detalle="Este dispositivo no tiene operaciones pendientes ni rechazadas."
        />
      ) : (
        <div className="space-y-3">
          {operaciones.map((op) => {
            const error = op.estado === 'ERROR'
            return (
              <article key={op.id} className={`nv-panel p-4 ${error ? 'border-red-200' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    error ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'
                  }`}>
                    {error ? <AlertTriangle className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="font-medium text-slate-900">{NOMBRES[op.tipo] ?? op.tipo}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">{fechaHora(new Date(op.creadaEn).toISOString())}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        error ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'
                      }`}>{error ? 'Requiere revisión' : 'Pendiente'}</span>
                    </div>
                    {op.ultimoError && <p className="mt-3 text-sm text-red-700">{op.ultimoError}</p>}
                    {error && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Boton
                          variante="secundario"
                          onClick={() => reintentar(op)}
                          cargando={procesando === op.id}
                        >
                          <RefreshCw className="h-4 w-4" /> Reintentar
                        </Boton>
                        <Boton variante="peligro" onClick={() => descartar(op)}>
                          <Trash2 className="h-4 w-4" /> Descartar
                        </Boton>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

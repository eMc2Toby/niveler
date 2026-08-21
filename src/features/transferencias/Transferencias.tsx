import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, Plus, Send, PackageCheck } from 'lucide-react'
import {
  Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal, Selector,
} from '@/components/ui'
import { SelectorItems, type Item } from '@/components/comunes/SelectorItems'
import { useMisUbicaciones, useUbicaciones, type Ubicacion } from '@/hooks/useCatalogos'
import { usePermisos } from '@/hooks/useAuth'
import { api } from '@/lib/supabase'
import { fecha, numero } from '@/lib/formato'
import { mensajeError } from '@/lib/utils'

const TONO: Record<string, 'neutro' | 'verde' | 'ambar' | 'rojo'> = {
  BORRADOR: 'neutro',
  ENVIADA: 'ambar',
  RECIBIDA_PARCIAL: 'ambar',
  RECIBIDA: 'verde',
  ANULADA: 'rojo',
}

export default function Transferencias() {
  const { moverStock } = usePermisos()
  const qc = useQueryClient()
  const transferencias = useQuery({ queryKey: ['transferencias'], queryFn: api.transferencias })
  const [creando, setCreando] = useState(false)
  const [recibiendo, setRecibiendo] = useState<any | null>(null)

  const enviar = useMutation({
    mutationFn: (id: string) => api.enviarTransferencia(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      toast.success('Enviada: la mercadería está en tránsito')
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo enviar.')),
  })

  if (transferencias.isLoading) return <Cargando />
  if (transferencias.isError) return <ErrorCarga onReintentar={() => transferencias.refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Transferencias</h1>
          <p className="text-sm text-slate-500">Entre ciudades, en dos pasos</p>
        </div>
        {moverStock && (
          <Boton className="ml-auto" onClick={() => setCreando(true)}>
            <Plus className="h-4 w-4" />
            Nueva
          </Boton>
        )}
      </div>

      {!transferencias.data?.length ? (
        <EstadoVacio
          titulo="Todavía no hay transferencias"
          detalle="Lo que se envía queda en tránsito hasta que la otra ciudad confirma la recepción. Así no desaparece de los saldos mientras viaja."
          accion={
            moverStock ? (
              <Boton onClick={() => setCreando(true)}>
                <Plus className="h-4 w-4" />
                Nueva transferencia
              </Boton>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {transferencias.data.map((t: any) => (
            <li key={t.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{t.codigo}</span>
                <Etiqueta tono={TONO[t.estado] ?? 'neutro'}>
                  {t.estado.replace(/_/g, ' ').toLowerCase()}
                </Etiqueta>
              </div>

              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-900">
                <span className="truncate">{t.origen?.nombre}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{t.destino?.nombre}</span>
              </p>

              <ul className="mt-2 space-y-0.5">
                {t.detalle?.map((d: any) => (
                  <li key={d.id} className="text-sm text-slate-600">
                    {numero(d.cantidad_enviada)} × {d.producto?.nombre}
                    {d.cantidad_recibida !== null &&
                      Number(d.cantidad_recibida) !== Number(d.cantidad_enviada) && (
                        <span className="text-amber-700">
                          {' '}· llegaron {numero(d.cantidad_recibida)}
                        </span>
                      )}
                  </li>
                ))}
              </ul>

              <p className="mt-2 text-xs text-slate-500">
                Solicitada {fecha(t.fecha_solicitud)}
                {t.fecha_envio ? ` · enviada ${fecha(t.fecha_envio)}` : ''}
                {t.fecha_recepcion ? ` · recibida ${fecha(t.fecha_recepcion)}` : ''}
              </p>

              {moverStock && (
                <div className="mt-3 flex gap-2">
                  {t.estado === 'BORRADOR' && (
                    <Boton
                      variante="secundario"
                      cargando={enviar.isPending}
                      onClick={() => enviar.mutate(t.id)}
                    >
                      <Send className="h-4 w-4" />
                      Enviar
                    </Boton>
                  )}
                  {(t.estado === 'ENVIADA' || t.estado === 'RECIBIDA_PARCIAL') && (
                    <Boton onClick={() => setRecibiendo(t)}>
                      <PackageCheck className="h-4 w-4" />
                      Recibir
                    </Boton>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {creando && <FormularioTransferencia onCerrar={() => setCreando(false)} />}
      {recibiendo && (
        <ModalRecepcion transferencia={recibiendo} onCerrar={() => setRecibiendo(null)} />
      )}
    </div>
  )
}

function FormularioTransferencia({ onCerrar }: { onCerrar: () => void }) {
  const qc = useQueryClient()
  const { propias } = useMisUbicaciones()
  const todas = (useUbicaciones().data ?? []) as Ubicacion[]

  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [observaciones, setObservaciones] = useState('')

  const origenes = propias.filter((u) => u.tipo === 'SUCURSAL')
  const destinos = todas.filter((u) => u.tipo === 'SUCURSAL' && u.id !== origen)

  const existencias = useQuery({
    queryKey: ['stock-ubicacion', origen],
    queryFn: () => api.stockDeUbicacion(origen),
    enabled: !!origen,
  })

  const crear = useMutation({
    mutationFn: () =>
      api.crearTransferencia(
        origen,
        destino,
        items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        observaciones.trim() || undefined,
      ),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['transferencias'] })
      toast.success(`Transferencia ${r?.codigo ?? ''} creada en borrador`)
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo crear la transferencia.')),
  })

  return (
    <Modal abierto titulo="Nueva transferencia" onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
          Se crea en borrador. El stock recién sale de la bodega cuando la marques
          como enviada, y llega al destino cuando allá confirmen la recepción.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Desde"
            value={origen}
            onChange={(e) => { setOrigen(e.target.value); setItems([]) }}
          >
            <option value="">Elegir…</option>
            {origenes.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </Selector>
          <Selector etiqueta="Hacia" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Elegir…</option>
            {destinos.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </Selector>
        </div>

        {!origen ? (
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Elige primero la bodega de origen.
          </p>
        ) : existencias.isLoading ? (
          <Cargando className="py-8" />
        ) : (
          <SelectorItems items={items} onCambiar={setItems} existencias={existencias.data ?? []} />
        )}

        <Campo
          etiqueta="Observaciones"
          placeholder="Transporte, guía, quién lo lleva…"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />

        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            className="flex-1"
            disabled={!origen || !destino || !items.length}
            cargando={crear.isPending}
            onClick={() => crear.mutate()}
          >
            Crear
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Recepción. Por defecto llega todo lo enviado; si algo falta se corrige la
 * cantidad y la base manda la diferencia a MERMA en un movimiento aparte.
 * Ahí es donde aparecen los faltantes de transporte, en vez de disolverse.
 */
function ModalRecepcion({ transferencia, onCerrar }: { transferencia: any; onCerrar: () => void }) {
  const qc = useQueryClient()
  const [recibidos, setRecibidos] = useState<Record<string, string>>(
    Object.fromEntries(
      transferencia.detalle.map((d: any) => [d.id, String(d.cantidad_enviada)]),
    ),
  )

  const recibir = useMutation({
    mutationFn: () =>
      api.recibirTransferencia(
        transferencia.id,
        transferencia.detalle.map((d: any) => ({
          detalle_id: d.id,
          cantidad_recibida: Number(recibidos[d.id] ?? d.cantidad_enviada),
        })),
      ),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['transferencias'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['movimientos'] })
      toast.success(
        r?.con_faltante
          ? 'Recibida con faltantes: la diferencia quedó en merma'
          : 'Recibida completa',
      )
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo registrar la recepción.')),
  })

  const hayFaltante = transferencia.detalle.some(
    (d: any) => Number(recibidos[d.id]) < Number(d.cantidad_enviada),
  )

  return (
    <Modal abierto titulo={`Recibir ${transferencia.codigo}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Cuenta lo que llegó de verdad. Si falta algo, corrige la cantidad: la
          diferencia se registra como merma y queda rastreable.
        </p>

        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {transferencia.detalle.map((d: any) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-900">{d.producto?.nombre}</p>
                <p className="text-xs text-slate-500">
                  {d.producto?.sku} · enviadas {numero(d.cantidad_enviada)}
                </p>
              </div>
              <input
                type="number"
                inputMode="numeric"
                aria-label={`Recibidas de ${d.producto?.nombre}`}
                value={recibidos[d.id]}
                onChange={(e) => setRecibidos({ ...recibidos, [d.id]: e.target.value })}
                className="w-20 rounded-lg border border-slate-300 py-1.5 text-center"
              />
            </li>
          ))}
        </ul>

        {hayFaltante && (
          <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            Hay faltantes. La diferencia saldrá a merma en un movimiento aparte.
          </p>
        )}

        <div className="flex gap-3">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton className="flex-1" cargando={recibir.isPending} onClick={() => recibir.mutate()}>
            Confirmar recepción
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

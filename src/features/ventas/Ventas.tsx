import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PackageCheck, Plus } from 'lucide-react'
import {
  Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal, Selector,
} from '@/components/ui'
import { SelectorItems, type Item } from '@/components/comunes/SelectorItems'
import { useClientes, useMisUbicaciones } from '@/hooks/useCatalogos'
import { useAuth, usePermisos } from '@/hooks/useAuth'
import { api } from '@/lib/supabase'
import { fechaHora, numero } from '@/lib/formato'
import { mensajeError } from '@/lib/utils'

export default function Ventas() {
  const { anularVentas, vender } = usePermisos()
  const qc = useQueryClient()
  const ventas = useQuery({ queryKey: ['ventas'], queryFn: () => api.ventas() })
  const [registrando, setRegistrando] = useState(false)
  const [anulando, setAnulando] = useState<any | null>(null)

  const entregar = useMutation({
    mutationFn: (id: string) => api.entregarVenta(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['stock-ubicacion'] })
      qc.invalidateQueries({ queryKey: ['producto-stock'] })
      qc.invalidateQueries({ queryKey: ['movimientos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Venta entregada; la reserva salio del stock')
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo entregar la venta.')),
  })

  if (ventas.isLoading) return <Cargando />
  if (ventas.isError) return <ErrorCarga onReintentar={() => ventas.refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ventas</h1>
          <p className="text-sm text-slate-500">
            Últimas {numero(ventas.data?.length ?? 0)}
          </p>
        </div>
        <Boton className="ml-auto" onClick={() => setRegistrando(true)}>
          <Plus className="h-4 w-4" />
          Registrar venta
        </Boton>
      </div>

      {!ventas.data?.length ? (
        <EstadoVacio
          titulo="Todavía no hay ventas"
          detalle="Al registrar una, el stock sale de la ubicación elegida en el mismo momento."
          accion={
            <Boton onClick={() => setRegistrando(true)}>
              <Plus className="h-4 w-4" />
              Registrar venta
            </Boton>
          }
        />
      ) : (
        <ul className="space-y-2">
          {ventas.data.map((v: any) => {
            const unidades = (v.detalle ?? []).reduce(
              (s: number, d: any) => s + Number(d.cantidad), 0,
            )
            return (
              <li key={v.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{v.codigo}</span>
                      <Etiqueta
                        tono={
                          v.estado === 'ANULADA' ? 'rojo'
                          : v.estado === 'PENDIENTE' ? 'ambar'
                          : 'verde'
                        }
                      >
                        {v.estado.toLowerCase()}
                      </Etiqueta>
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      {v.cliente?.nombre ?? 'Sin cliente'}
                      {v.delivery?.nombre
                        ? ` · ${v.delivery.nombre}`
                        : v.sucursal?.ciudad ? ` · ${v.sucursal.ciudad}` : ''}
                    </p>

                    <ul className="mt-2 space-y-0.5">
                      {v.detalle?.map((d: any, i: number) => (
                        <li key={i} className="text-sm text-slate-600">
                          {numero(d.cantidad)} × {d.producto?.nombre}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-2 text-xs text-slate-500">
                      {fechaHora(v.fecha)} · {numero(unidades)} unidades
                      {v.usuario?.nombre_completo ? ` · ${v.usuario.nombre_completo}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    {vender && v.estado === 'PENDIENTE' && (
                      <Boton
                        variante="secundario"
                        className="px-3"
                        cargando={entregar.isPending && entregar.variables === v.id}
                        onClick={() => entregar.mutate(v.id)}
                      >
                        <PackageCheck className="h-4 w-4" />
                        Entregar
                      </Boton>
                    )}
                    {anularVentas && v.estado !== 'ANULADA' && (
                      <Boton variante="fantasma" className="px-3" onClick={() => setAnulando(v)}>
                        Anular
                      </Boton>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {registrando && <FormularioVenta onCerrar={() => setRegistrando(false)} />}
      {anulando && <ModalAnularVenta venta={anulando} onCerrar={() => setAnulando(null)} />}
    </div>
  )
}

function FormularioVenta({ onCerrar }: { onCerrar: () => void }) {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  const { propias } = useMisUbicaciones()
  const clientes = useClientes()

  const fisicas = propias.filter((u) => u.tipo === 'SUCURSAL' || u.tipo === 'DELIVERY')
  const [ubicacionId, setUbicacionId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [entregada, setEntregada] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [observaciones, setObservaciones] = useState('')

  // El repartidor vende de su propio stock y no tiene nada que elegir.
  useEffect(() => {
    if (!ubicacionId && fisicas.length) {
      setUbicacionId(perfil?.ubicacion_id ?? (fisicas.length === 1 ? fisicas[0].id : ''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fisicas.length])

  const existencias = useQuery({
    queryKey: ['stock-ubicacion', ubicacionId],
    queryFn: () => api.stockDeUbicacion(ubicacionId),
    enabled: !!ubicacionId,
  })

  const registrar = useMutation({
    mutationFn: () =>
      api.registrarVenta({
        ubicacionId,
        items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        clienteId: clienteId || undefined,
        estado: entregada ? 'ENTREGADA' : 'PENDIENTE',
        observaciones: observaciones.trim() || undefined,
      }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['stock-ubicacion'] })
      qc.invalidateQueries({ queryKey: ['producto-stock'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['movimientos'] })
      toast.success(`Venta ${r?.codigo ?? ''} registrada`)
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo registrar la venta.')),
  })

  return (
    <Modal abierto titulo="Registrar venta" onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Sale de"
            value={ubicacionId}
            onChange={(e) => { setUbicacionId(e.target.value); setItems([]) }}
          >
            <option value="">Elegir…</option>
            {fisicas.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </Selector>

          <Selector
            etiqueta="Cliente"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Sin cliente</option>
            {clientes.data?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Selector>
        </div>

        {!ubicacionId ? (
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Elige primero de dónde sale la mercadería.
          </p>
        ) : existencias.isLoading ? (
          <Cargando className="py-8" />
        ) : (
          <SelectorItems
            items={items}
            onCambiar={setItems}
            existencias={existencias.data ?? []}
          />
        )}

        {/* PENDIENTE reserva el stock sin sacarlo; ENTREGADA lo saca ya. */}
        <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-emerald-600"
            checked={entregada}
            onChange={(e) => setEntregada(e.target.checked)}
          />
          <span>
            La mercadería ya salió
            <span className="block text-xs text-slate-500">
              Si la desmarcas, queda pendiente: el stock se reserva pero no sale hasta la entrega.
            </span>
          </span>
        </label>

        <Campo
          etiqueta="Observaciones"
          placeholder="Referencia del pedido, quién recibió…"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />

        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            className="flex-1"
            disabled={!ubicacionId || !items.length}
            cargando={registrar.isPending}
            onClick={() => registrar.mutate()}
          >
            Registrar venta
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function ModalAnularVenta({ venta, onCerrar }: { venta: any; onCerrar: () => void }) {
  const qc = useQueryClient()
  const [motivo, setMotivo] = useState('')

  const anular = useMutation({
    mutationFn: () => api.anularVenta(venta.id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['stock-ubicacion'] })
      qc.invalidateQueries({ queryKey: ['producto-stock'] })
      qc.invalidateQueries({ queryKey: ['movimientos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Venta anulada y stock actualizado')
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo anular la venta.')),
  })

  return (
    <Modal abierto titulo={`Anular ${venta.codigo}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {venta.estado === 'PENDIENTE'
            ? 'Se libera la reserva y la venta queda en el historial marcada como anulada.'
            : 'Se revierte el movimiento de salida y la mercadería vuelve a la ubicación de donde salió. La venta queda en el historial marcada como anulada.'}
        </p>
        <Campo
          etiqueta="Motivo"
          placeholder="Cliente devolvió, se registró por error…"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <div className="flex gap-3">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            className="flex-1"
            disabled={!motivo.trim()}
            cargando={anular.isPending}
            onClick={() => anular.mutate()}
          >
            Anular venta
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

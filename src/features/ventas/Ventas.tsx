import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PackageCheck, Plus } from 'lucide-react'
import {
  Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal, Selector,
} from '@/components/ui'
import { SelectorItems, type Item } from '@/components/comunes/SelectorItems'
import { useClientes, useDeliveries, useMisUbicaciones } from '@/hooks/useCatalogos'
import { useAuth, usePermisos } from '@/hooks/useAuth'
import { api } from '@/lib/supabase'
import { fechaHora, numero } from '@/lib/formato'
import { mensajeError } from '@/lib/utils'
import { avisarSiPendiente } from '@/lib/offline/ui'

export default function Ventas() {
  const { anularVentas, vender } = usePermisos()
  const qc = useQueryClient()
  const ventas = useQuery({ queryKey: ['ventas'], queryFn: () => api.ventas() })
  const [registrando, setRegistrando] = useState(false)
  const [anulando, setAnulando] = useState<any | null>(null)

  const entregar = useMutation({
    mutationFn: (id: string) => api.entregarVenta(id),
    onSuccess: (resultado) => {
      if (avisarSiPendiente(resultado)) return
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
                      {v.pedido?.numero ? ` · Pedido ${v.pedido.numero}` : ''}
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
  const deliveries = useDeliveries()

  const fisicas = propias.filter((u) => u.tipo === 'SUCURSAL' || u.tipo === 'DELIVERY')
  const [ubicacionId, setUbicacionId] = useState('')
  const [deliveryId, setDeliveryId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState('')
  const [nuevoNumeroPedido, setNuevoNumeroPedido] = useState('')
  const [entregada, setEntregada] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [observaciones, setObservaciones] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})

  const ubicacionesDelivery = fisicas
    .filter((ubicacion) => ubicacion.tipo === 'DELIVERY' && ubicacion.delivery_id)
    .map((ubicacion) => ({
      ubicacion,
      delivery: (deliveries.data ?? []).find((item: any) => item.id === ubicacion.delivery_id),
    }))
    .sort((a, b) => String(a.delivery?.nombre ?? a.ubicacion.nombre)
      .localeCompare(String(b.delivery?.nombre ?? b.ubicacion.nombre), 'es'))
  const permiteVentaDirecta = fisicas.some((ubicacion) => ubicacion.tipo === 'SUCURSAL')

  const clienteSeleccionado: any = (clientes.data ?? []).find((cliente: any) => cliente.id === clienteId)
  const pedidos = [...(clienteSeleccionado?.pedidos ?? [])]
    .filter((pedido: any) => pedido.activo !== false)
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
  const numeroPedido = !clienteId
    ? undefined
    : pedidoSeleccionado === '__nuevo__'
      ? nuevoNumeroPedido.trim()
      : pedidoSeleccionado

  function cambiarCliente(id: string) {
    setClienteId(id)
    setNuevoNumeroPedido('')
    const cliente: any = (clientes.data ?? []).find((item: any) => item.id === id)
    const disponibles = [...(cliente?.pedidos ?? [])]
      .filter((pedido: any) => pedido.activo !== false)
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
    setPedidoSeleccionado(id ? (disponibles[0]?.numero ?? '__nuevo__') : '')
    setErrores((actuales) => ({ ...actuales, cliente: '', pedido: '' }))
  }

  function cambiarUbicacion(id: string) {
    const ubicacion = fisicas.find((item) => item.id === id)
    setUbicacionId(id)
    setDeliveryId(ubicacion?.delivery_id ?? '')
    setItems([])
    setErrores((actuales) => ({ ...actuales, ubicacion: '', delivery: '', items: '' }))
  }

  function cambiarDelivery(id: string) {
    setDeliveryId(id)
    if (id) {
      const destino = ubicacionesDelivery.find((item) => item.ubicacion.delivery_id === id)
      setUbicacionId(destino?.ubicacion.id ?? '')
    } else {
      const actual = fisicas.find((item) => item.id === ubicacionId)
      if (actual?.tipo === 'DELIVERY') {
        const sucursalPreferida = fisicas.find(
          (item) => item.tipo === 'SUCURSAL' && item.sucursal_id === perfil?.sucursal_id,
        ) ?? fisicas.find((item) => item.tipo === 'SUCURSAL')
        setUbicacionId(sucursalPreferida?.id ?? '')
      }
    }
    setItems([])
    setErrores((actuales) => ({ ...actuales, ubicacion: '', delivery: '', items: '' }))
  }

  // El repartidor vende de su propio stock y no tiene nada que elegir.
  useEffect(() => {
    if (!ubicacionId && fisicas.length) {
      const inicial = perfil?.ubicacion_id ?? (fisicas.length === 1 ? fisicas[0].id : '')
      const ubicacion = fisicas.find((item) => item.id === inicial)
      setUbicacionId(inicial)
      setDeliveryId(ubicacion?.delivery_id ?? '')
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
        numeroPedido,
        estado: entregada ? 'ENTREGADA' : 'PENDIENTE',
        observaciones: observaciones.trim() || undefined,
      }),
    onSuccess: (r: any) => {
      if (avisarSiPendiente(r)) { onCerrar(); return }
      qc.invalidateQueries({ queryKey: ['ventas'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['stock-ubicacion'] })
      qc.invalidateQueries({ queryKey: ['producto-stock'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['movimientos'] })
      qc.invalidateQueries({ queryKey: ['clientes'] })
      toast.success(`Venta ${r?.codigo ?? ''} registrada`)
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo registrar la venta.')),
  })

  function validar() {
    const nuevos: Record<string, string> = {}
    const ubicacion = fisicas.find((item) => item.id === ubicacionId)
    const pedido = numeroPedido?.trim() ?? ''

    if (!ubicacion) nuevos.ubicacion = 'Selecciona de dónde sale el stock'
    if (deliveryId && ubicacion?.delivery_id !== deliveryId) {
      nuevos.delivery = 'El delivery no coincide con la ubicación de stock'
    }
    if (clienteId && !pedido) nuevos.pedido = 'Selecciona o agrega un número de pedido'
    else if (pedido.length > 60) nuevos.pedido = 'Máximo 60 caracteres'
    else if (/[\r\n]/.test(pedido)) nuevos.pedido = 'El pedido debe ir en una sola línea'

    if (!items.length) nuevos.items = 'Agrega al menos un producto'
    else if (items.some((item) => !Number.isFinite(item.cantidad) || item.cantidad <= 0)) {
      nuevos.items = 'Todas las cantidades deben ser mayores que cero'
    }
    if (observaciones.trim().length > 500) nuevos.observaciones = 'Máximo 500 caracteres'

    setErrores(nuevos)
    return Object.keys(nuevos).length === 0
  }

  function intentarRegistrar() {
    if (validar()) registrar.mutate()
  }

  return (
    <Modal abierto titulo="Registrar venta" onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Sale de"
            error={errores.ubicacion}
            value={ubicacionId}
            onChange={(e) => cambiarUbicacion(e.target.value)}
          >
            <option value="">Elegir…</option>
            {fisicas.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </Selector>

          <Selector
            etiqueta="Delivery que realizó la venta"
            error={errores.delivery}
            value={deliveryId}
            onChange={(e) => cambiarDelivery(e.target.value)}
          >
            {permiteVentaDirecta && <option value="">Venta directa (sin delivery)</option>}
            {ubicacionesDelivery.map(({ ubicacion, delivery }) => (
              <option key={ubicacion.id} value={ubicacion.delivery_id ?? ''}>
                {delivery?.nombre ?? ubicacion.nombre}
              </option>
            ))}
          </Selector>
        </div>

        <Selector
          etiqueta="Cliente"
          value={clienteId}
          onChange={(e) => cambiarCliente(e.target.value)}
        >
          <option value="">Sin cliente</option>
          {clientes.data?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Selector>

        {clienteId && (
          <div className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:grid-cols-2">
            <Selector
              etiqueta="Número de pedido"
              error={pedidoSeleccionado === '__nuevo__' ? undefined : errores.pedido}
              value={pedidoSeleccionado}
              onChange={(e) => {
                setPedidoSeleccionado(e.target.value)
                if (e.target.value !== '__nuevo__') setNuevoNumeroPedido('')
                setErrores((actuales) => ({ ...actuales, pedido: '' }))
              }}
            >
              {pedidos.map((pedido: any) => (
                <option key={pedido.id} value={pedido.numero}>{pedido.numero}</option>
              ))}
              <option value="__nuevo__">Agregar nuevo número…</option>
            </Selector>

            {pedidoSeleccionado === '__nuevo__' ? (
              <Campo
                etiqueta="Nuevo número de pedido"
                placeholder="PED-00126"
                maxLength={60}
                error={errores.pedido}
                value={nuevoNumeroPedido}
                onChange={(e) => {
                  setNuevoNumeroPedido(e.target.value)
                  setErrores((actuales) => ({ ...actuales, pedido: '' }))
                }}
              />
            ) : (
              <div className="rounded-lg bg-white px-3.5 py-2.5 shadow-sm">
                <p className="text-xs text-slate-500">Pedido seleccionado</p>
                <p className="mt-1 font-medium text-emerald-800">{pedidoSeleccionado}</p>
              </div>
            )}
          </div>
        )}

        {!ubicacionId ? (
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Elige primero de dónde sale la mercadería.
          </p>
        ) : existencias.isLoading ? (
          <Cargando className="py-8" />
        ) : (
          <SelectorItems
            items={items}
            onCambiar={(nuevos) => {
              setItems(nuevos)
              setErrores((actuales) => ({ ...actuales, items: '' }))
            }}
            existencias={existencias.data ?? []}
          />
        )}
        {errores.items && <p role="alert" className="text-sm text-red-600">{errores.items}</p>}

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
          maxLength={500}
          error={errores.observaciones}
          value={observaciones}
          onChange={(e) => {
            setObservaciones(e.target.value)
            setErrores((actuales) => ({ ...actuales, observaciones: '' }))
          }}
        />

        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            className="flex-1"
            cargando={registrar.isPending}
            onClick={intentarRegistrar}
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
  const motivoLimpio = motivo.trim()
  const errorMotivo = motivoLimpio.length > 0 && motivoLimpio.length < 3
    ? 'Escribe al menos 3 caracteres'
    : motivoLimpio.length > 300 ? 'Máximo 300 caracteres' : undefined

  const anular = useMutation({
    mutationFn: () => api.anularVenta(venta.id, motivoLimpio),
    onSuccess: (resultado) => {
      if (avisarSiPendiente(resultado)) { onCerrar(); return }
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
          maxLength={300}
          error={errorMotivo}
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
            disabled={motivoLimpio.length < 3 || !!errorMotivo}
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

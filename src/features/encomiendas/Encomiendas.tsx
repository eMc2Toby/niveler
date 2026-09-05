import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowRight, Boxes, CheckCircle2, MapPin, PackageOpen, Plus,
  Search, Send, Truck, UserRound, XCircle,
} from 'lucide-react'
import {
  Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal, Selector,
} from '@/components/ui'
import { useAuth, usePermisos } from '@/hooks/useAuth'
import { useClientes, useDeliveries } from '@/hooks/useCatalogos'
import {
  api, type EstadoEncomienda, type NuevaEncomienda, type TipoEncomienda,
} from '@/lib/supabase'
import { fechaHora, numero } from '@/lib/formato'
import { mensajeError, normalizar } from '@/lib/utils'

type Encomienda = Awaited<ReturnType<typeof api.encomiendas>>[number]
type FiltroTipo = 'TODAS' | TipoEncomienda
type Accion = 'DESPACHAR' | 'ENTREGAR'

const TONOS: Record<EstadoEncomienda, 'neutro' | 'verde' | 'ambar' | 'rojo'> = {
  REGISTRADA: 'neutro',
  EN_TRANSITO: 'ambar',
  ENTREGADA: 'verde',
  ANULADA: 'rojo',
}

const ESTADOS: Record<EstadoEncomienda, string> = {
  REGISTRADA: 'Registrada',
  EN_TRANSITO: 'En tránsito',
  ENTREGADA: 'Entregada',
  ANULADA: 'Anulada',
}

export default function Encomiendas() {
  const { perfil } = useAuth()
  const { nivel } = usePermisos()
  const qc = useQueryClient()
  const encomiendas = useQuery({ queryKey: ['encomiendas'], queryFn: () => api.encomiendas() })
  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState<FiltroTipo>('TODAS')
  const [estado, setEstado] = useState<'TODOS' | EstadoEncomienda>('TODOS')
  const [anulando, setAnulando] = useState<Encomienda | null>(null)

  const refrescar = () => qc.invalidateQueries({ queryKey: ['encomiendas'] })

  const cambiarEstado = useMutation({
    mutationFn: ({ accion, id }: { accion: Accion; id: string }) =>
      accion === 'DESPACHAR' ? api.despacharEncomienda(id) : api.entregarEncomienda(id),
    onSuccess: (_, variables) => {
      refrescar()
      toast.success(variables.accion === 'DESPACHAR' ? 'Encomienda despachada' : 'Entrega confirmada')
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo actualizar la encomienda.')),
  })

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return (encomiendas.data ?? []).filter((item) => {
      if (tipo !== 'TODAS' && item.tipo !== tipo) return false
      if (estado !== 'TODOS' && item.estado !== estado) return false
      if (!q) return true
      return normalizar([
        item.codigo,
        item.descripcion,
        item.cliente?.nombre,
        item.origen?.nombre,
        item.destino?.nombre,
        item.ciudad_destino,
      ].filter(Boolean).join(' ')).includes(q)
    })
  }, [busqueda, encomiendas.data, estado, tipo])

  if (encomiendas.isLoading) return <Cargando />
  if (encomiendas.isError) return <ErrorCarga onReintentar={() => encomiendas.refetch()} />

  const totales = (encomiendas.data ?? []).reduce(
    (acc, item) => ({ ...acc, [item.estado]: acc[item.estado] + 1 }),
    { REGISTRADA: 0, EN_TRANSITO: 0, ENTREGADA: 0, ANULADA: 0 } as Record<EstadoEncomienda, number>,
  )

  function puedeGestionarOrigen(item: Encomienda) {
    return nivel >= 80
      || item.usuario_crea_id === perfil?.id
      || item.origen?.id === perfil?.delivery_id
      || (nivel >= 30 && item.sucursal_origen_id === perfil?.sucursal_id)
  }

  function puedeConfirmar(item: Encomienda) {
    if (nivel >= 80) return true
    if (item.tipo === 'CLIENTE') {
      return item.origen?.id === perfil?.delivery_id
        || (nivel >= 30 && item.sucursal_origen_id === perfil?.sucursal_id)
    }
    return item.destino?.id === perfil?.delivery_id
      || (nivel >= 30 && item.destino?.sucursal_base_id === perfil?.sucursal_id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Encomiendas</h1>
          <p className="text-sm text-slate-500">Entregas a clientes y traspasos entre deliveries</p>
        </div>
        <Boton className="ml-auto" onClick={() => setCreando(true)}>
          <Plus className="h-4 w-4" />
          Nueva encomienda
        </Boton>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Resumen Icono={Boxes} etiqueta="Registradas" valor={totales.REGISTRADA} tono="slate" />
        <Resumen Icono={Truck} etiqueta="En tránsito" valor={totales.EN_TRANSITO} tono="amber" />
        <Resumen Icono={CheckCircle2} etiqueta="Entregadas" valor={totales.ENTREGADA} tono="emerald" />
      </div>

      <div className="nv-panel space-y-3 p-3 sm:flex sm:items-center sm:gap-3 sm:space-y-0 sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <Campo
            className="pl-10"
            placeholder="Buscar código, cliente o delivery"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar encomiendas"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-[25rem]">
          <Selector value={tipo} onChange={(e) => setTipo(e.target.value as FiltroTipo)} aria-label="Modalidad">
            <option value="TODAS">Todas las modalidades</option>
            <option value="CLIENTE">Para clientes</option>
            <option value="ENTRE_DELIVERIES">Entre deliveries</option>
          </Selector>
          <Selector
            value={estado}
            onChange={(e) => setEstado(e.target.value as 'TODOS' | EstadoEncomienda)}
            aria-label="Estado"
          >
            <option value="TODOS">Todos los estados</option>
            {Object.entries(ESTADOS).map(([valor, texto]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </Selector>
        </div>
      </div>

      {!filtradas.length ? (
        <EstadoVacio
          titulo={encomiendas.data?.length ? 'No hay resultados con esos filtros' : 'Todavía no hay encomiendas'}
          detalle={
            encomiendas.data?.length
              ? 'Cambia la búsqueda, modalidad o estado.'
              : 'Registra una entrega para cliente o un bulto que pasará de un delivery a otro.'
          }
          accion={!encomiendas.data?.length ? (
            <Boton onClick={() => setCreando(true)}>
              <Plus className="h-4 w-4" />
              Nueva encomienda
            </Boton>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtradas.map((item) => {
            const esCliente = item.tipo === 'CLIENTE'
            const destinatario = esCliente ? item.cliente?.nombre : item.destino?.nombre
            const puedeDespachar = item.estado === 'REGISTRADA' && puedeGestionarOrigen(item)
            const puedeEntregar = item.estado === 'EN_TRANSITO' && puedeConfirmar(item)
            return (
              <article key={item.id} className="nv-panel overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${esCliente ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
                      {esCliente ? <UserRound className="h-5 w-5" /> : <PackageOpen className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold tracking-tight text-slate-950">{item.codigo}</p>
                        <Etiqueta tono={TONOS[item.estado]}>{ESTADOS[item.estado]}</Etiqueta>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {esCliente ? 'Entrega a cliente' : 'Entre deliveries'} · {fechaHora(item.fecha_registro)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{numero(item.cantidad_bultos)}</p>
                      <p className="text-[11px] text-slate-500">{item.cantidad_bultos === 1 ? 'bulto' : 'bultos'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-3.5 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{item.origen?.nombre}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-right font-semibold text-slate-950">{destinatario}</span>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-medium text-slate-900">{item.descripcion}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {item.peso_kg != null && <span>{numero(item.peso_kg)} kg</span>}
                      {esCliente && item.ciudad_destino && <span>{item.ciudad_destino}</span>}
                      <span>Registró {item.usuario_crea?.nombre_completo ?? 'Usuario'}</span>
                    </div>
                    {esCliente && item.direccion_entrega && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        {item.direccion_entrega}
                      </p>
                    )}
                    {item.motivo_anulacion && (
                      <p className="mt-2 text-xs text-red-600">Motivo: {item.motivo_anulacion}</p>
                    )}
                  </div>
                </div>

                {(puedeDespachar || puedeEntregar || (item.estado === 'REGISTRADA' && puedeGestionarOrigen(item))) && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
                    {item.estado === 'REGISTRADA' && puedeGestionarOrigen(item) && (
                      <Boton variante="fantasma" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setAnulando(item)}>
                        <XCircle className="h-4 w-4" />
                        Anular
                      </Boton>
                    )}
                    {puedeDespachar && (
                      <Boton
                        cargando={cambiarEstado.isPending && cambiarEstado.variables?.id === item.id}
                        onClick={() => cambiarEstado.mutate({ accion: 'DESPACHAR', id: item.id })}
                      >
                        <Send className="h-4 w-4" />
                        Despachar
                      </Boton>
                    )}
                    {puedeEntregar && (
                      <Boton
                        cargando={cambiarEstado.isPending && cambiarEstado.variables?.id === item.id}
                        onClick={() => cambiarEstado.mutate({ accion: 'ENTREGAR', id: item.id })}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {esCliente ? 'Confirmar entrega' : 'Confirmar recepción'}
                      </Boton>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {creando && <FormularioEncomienda onCerrar={() => setCreando(false)} />}
      {anulando && (
        <ModalAnulacion
          encomienda={anulando}
          onCerrar={() => setAnulando(null)}
          onCompletado={refrescar}
        />
      )}
    </div>
  )
}

function Resumen({
  Icono, etiqueta, valor, tono,
}: {
  Icono: typeof Boxes
  etiqueta: string
  valor: number
  tono: 'slate' | 'amber' | 'emerald'
}) {
  const clases = {
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  }
  return (
    <div className="nv-panel flex items-center gap-3 p-3 sm:p-4">
      <div className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid ${clases[tono]}`}>
        <Icono className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{numero(valor)}</p>
        <p className="text-[11px] leading-tight text-slate-500 sm:text-xs">{etiqueta}</p>
      </div>
    </div>
  )
}

function FormularioEncomienda({ onCerrar }: { onCerrar: () => void }) {
  const { perfil } = useAuth()
  const { nivel, esDelivery, verTodasLasSucursales } = usePermisos()
  const deliveries = useDeliveries()
  const clientes = useClientes()
  const qc = useQueryClient()
  const [f, setF] = useState({
    tipo: 'CLIENTE' as TipoEncomienda,
    delivery_origen_id: perfil?.delivery_id ?? '',
    cliente_id: '',
    delivery_destino_id: '',
    descripcion: '',
    cantidad_bultos: '1',
    peso_kg: '',
    ciudad_destino: '',
    direccion_entrega: '',
    observaciones: '',
  })

  const activos = useMemo(
    () => (deliveries.data ?? []).filter((d: any) => d.activo),
    [deliveries.data],
  )
  const origenes = useMemo(() => {
    if (esDelivery) return activos.filter((d: any) => d.id === perfil?.delivery_id)
    if (verTodasLasSucursales) return activos
    return activos.filter((d: any) => d.sucursal_base_id === perfil?.sucursal_id)
  }, [activos, esDelivery, perfil?.delivery_id, perfil?.sucursal_id, verTodasLasSucursales])
  const destinos = activos.filter((d: any) => d.id !== f.delivery_origen_id)
  const clientesActivos = (clientes.data ?? []).filter((c: any) => c.activo)

  useEffect(() => {
    if (!f.delivery_origen_id && origenes.length === 1) {
      setF((actual) => ({ ...actual, delivery_origen_id: origenes[0].id }))
    }
  }, [f.delivery_origen_id, origenes])

  const guardar = useMutation({
    mutationFn: () => {
      const datos: NuevaEncomienda = {
        tipo: f.tipo,
        deliveryOrigenId: f.delivery_origen_id,
        descripcion: f.descripcion.trim(),
        cantidadBultos: Number(f.cantidad_bultos),
        pesoKg: f.peso_kg ? Number(f.peso_kg) : undefined,
        observaciones: f.observaciones.trim() || undefined,
      }
      if (f.tipo === 'CLIENTE') {
        datos.clienteId = f.cliente_id
        datos.ciudadDestino = f.ciudad_destino.trim() || undefined
        datos.direccionEntrega = f.direccion_entrega.trim()
      } else {
        datos.deliveryDestinoId = f.delivery_destino_id
      }
      return api.crearEncomienda(datos)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['encomiendas'] })
      toast.success('Encomienda registrada')
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo registrar la encomienda.')),
  })

  function cambiarCliente(id: string) {
    const cliente = clientesActivos.find((c: any) => c.id === id)
    setF({
      ...f,
      cliente_id: id,
      ciudad_destino: cliente?.ciudad ?? '',
      direccion_entrega: cliente?.direccion ?? '',
    })
  }

  const bultos = Number(f.cantidad_bultos)
  const valido = !!f.delivery_origen_id
    && f.descripcion.trim().length >= 3
    && Number.isInteger(bultos)
    && bultos >= 1
    && (f.tipo === 'CLIENTE'
      ? !!f.cliente_id && f.direccion_entrega.trim().length >= 3
      : !!f.delivery_destino_id)

  return (
    <Modal abierto titulo="Nueva encomienda" onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Modalidad</p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => setF({ ...f, tipo: 'CLIENTE', delivery_destino_id: '' })}
              className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${f.tipo === 'CLIENTE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Para cliente
            </button>
            <button
              type="button"
              onClick={() => setF({ ...f, tipo: 'ENTRE_DELIVERIES', cliente_id: '', ciudad_destino: '', direccion_entrega: '' })}
              className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${f.tipo === 'ENTRE_DELIVERIES' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Entre deliveries
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta={f.tipo === 'CLIENTE' ? 'Delivery responsable' : 'Delivery remitente'}
            value={f.delivery_origen_id}
            disabled={esDelivery || origenes.length === 1}
            onChange={(e) => setF({ ...f, delivery_origen_id: e.target.value, delivery_destino_id: '' })}
          >
            <option value="">Elegir…</option>
            {origenes.map((d: any) => (
              <option key={d.id} value={d.id}>{d.nombre} · {d.sucursal?.ciudad}</option>
            ))}
          </Selector>

          {f.tipo === 'CLIENTE' ? (
            <Selector etiqueta="Cliente receptor" value={f.cliente_id} onChange={(e) => cambiarCliente(e.target.value)}>
              <option value="">Elegir…</option>
              {clientesActivos.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nombre}{c.ciudad ? ` · ${c.ciudad}` : ''}</option>
              ))}
            </Selector>
          ) : (
            <Selector
              etiqueta="Delivery receptor"
              value={f.delivery_destino_id}
              onChange={(e) => setF({ ...f, delivery_destino_id: e.target.value })}
            >
              <option value="">Elegir…</option>
              {destinos.map((d: any) => (
                <option key={d.id} value={d.id}>{d.nombre} · {d.sucursal?.ciudad}</option>
              ))}
            </Selector>
          )}
        </div>

        {!origenes.length && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No hay un delivery activo disponible en tu ámbito. Créalo o actívalo desde Deliveries.
          </p>
        )}
        {f.tipo === 'CLIENTE' && !clientesActivos.length && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No hay clientes activos. Registra primero al destinatario desde Clientes.
          </p>
        )}

        <Campo
          etiqueta="Contenido o referencia"
          placeholder="Ej.: caja con material promocional"
          value={f.descripcion}
          onChange={(e) => setF({ ...f, descripcion: e.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Cantidad de bultos"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={f.cantidad_bultos}
            onChange={(e) => setF({ ...f, cantidad_bultos: e.target.value })}
          />
          <Campo
            etiqueta="Peso total (kg)"
            ayuda="Opcional"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={f.peso_kg}
            onChange={(e) => setF({ ...f, peso_kg: e.target.value })}
          />
        </div>

        {f.tipo === 'CLIENTE' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Ciudad de entrega"
              value={f.ciudad_destino}
              onChange={(e) => setF({ ...f, ciudad_destino: e.target.value })}
            />
            <Campo
              etiqueta="Dirección de entrega"
              value={f.direccion_entrega}
              onChange={(e) => setF({ ...f, direccion_entrega: e.target.value })}
            />
          </div>
        )}

        <div>
          <label htmlFor="encomienda-observaciones" className="mb-1.5 block text-sm font-medium text-slate-700">
            Observaciones <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            id="encomienda-observaciones"
            rows={3}
            value={f.observaciones}
            onChange={(e) => setF({ ...f, observaciones: e.target.value })}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          Este registro controla el bulto y su entrega. No mueve unidades del inventario;
          para trasladar productos usa el módulo Transferencias.
        </p>

        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            className="flex-1"
            disabled={!valido || nivel < 10}
            cargando={guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            Registrar
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function ModalAnulacion({
  encomienda, onCerrar, onCompletado,
}: {
  encomienda: Encomienda
  onCerrar: () => void
  onCompletado: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const anular = useMutation({
    mutationFn: () => api.anularEncomienda(encomienda.id, motivo.trim()),
    onSuccess: () => {
      onCompletado()
      toast.success('Encomienda anulada')
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo anular la encomienda.')),
  })

  return (
    <Modal abierto titulo={`Anular ${encomienda.codigo}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-600">
          Solo puede anularse antes del despacho. El registro seguirá visible para conservar la trazabilidad.
        </p>
        <Campo
          etiqueta="Motivo"
          placeholder="Indica por qué se cancela"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>Volver</Boton>
          <Boton
            variante="peligro"
            className="flex-1"
            disabled={motivo.trim().length < 3}
            cargando={anular.isPending}
            onClick={() => anular.mutate()}
          >
            Anular encomienda
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

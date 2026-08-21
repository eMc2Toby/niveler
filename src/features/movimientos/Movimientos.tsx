import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, Plus } from 'lucide-react'
import {
  Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal, Selector,
} from '@/components/ui'
import { SelectorItems, type Item } from '@/components/comunes/SelectorItems'
import { useMisUbicaciones, useUbicaciones, type Ubicacion } from '@/hooks/useCatalogos'
import { useProductos } from '@/hooks/useProductos'
import { usePermisos } from '@/hooks/useAuth'
import { api } from '@/lib/supabase'
import { fechaHora, numero } from '@/lib/formato'
import { mensajeError } from '@/lib/utils'

/**
 * Los cinco movimientos que se registran a mano. Los otros tres —venta,
 * transferencia y ajuste— los genera el sistema desde su propio módulo,
 * porque llevan pasos extra (reserva, tránsito, conteo).
 */
const TIPOS = [
  { valor: 'ENTRADA',                texto: 'Entrada de mercadería', origen: 'PROVEEDOR', destino: 'SUCURSAL' },
  { valor: 'ENTREGA_DELIVERY',       texto: 'Entrega a repartidor',  origen: 'SUCURSAL',  destino: 'DELIVERY' },
  { valor: 'RETORNO_DELIVERY',       texto: 'Devolución del repartidor', origen: 'DELIVERY', destino: 'SUCURSAL' },
  { valor: 'TRANSFERENCIA_DELIVERY', texto: 'Entre repartidores',    origen: 'DELIVERY',  destino: 'DELIVERY' },
  { valor: 'SALIDA',                 texto: 'Baja por merma o rotura', origen: 'SUCURSAL', destino: 'MERMA' },
  { valor: 'DEVOLUCION',             texto: 'Devolución de cliente',  origen: 'CLIENTE',   destino: 'SUCURSAL' },
] as const

const COLOR: Record<string, 'verde' | 'ambar' | 'rojo' | 'neutro'> = {
  ENTRADA: 'verde',
  DEVOLUCION: 'verde',
  SALIDA: 'rojo',
  VENTA: 'neutro',
  AJUSTE: 'ambar',
}

export default function Movimientos() {
  const { moverStock } = usePermisos()
  const movimientos = useQuery({ queryKey: ['movimientos'], queryFn: () => api.movimientos() })
  const [registrando, setRegistrando] = useState(false)
  const [anulando, setAnulando] = useState<any | null>(null)

  if (movimientos.isLoading) return <Cargando />
  if (movimientos.isError) return <ErrorCarga onReintentar={() => movimientos.refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Movimientos</h1>
          <p className="text-sm text-slate-500">Últimos {numero(movimientos.data?.length ?? 0)}</p>
        </div>
        {moverStock && (
          <Boton className="ml-auto" onClick={() => setRegistrando(true)}>
            <Plus className="h-4 w-4" />
            Registrar
          </Boton>
        )}
      </div>

      {!movimientos.data?.length ? (
        <EstadoVacio
          titulo="Todavía no hay movimientos"
          detalle="El primero suele ser la entrada con el stock inicial de cada bodega."
          accion={
            moverStock ? (
              <Boton onClick={() => setRegistrando(true)}>
                <Plus className="h-4 w-4" />
                Registrar movimiento
              </Boton>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {movimientos.data.map((m: any) => (
            <li key={m.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Etiqueta tono={COLOR[m.tipo] ?? 'neutro'}>
                      {m.tipo.replace(/_/g, ' ').toLowerCase()}
                    </Etiqueta>
                    <span className="text-xs text-slate-500">{m.codigo}</span>
                    {m.estado === 'ANULADO' && <Etiqueta tono="rojo">anulado</Etiqueta>}
                  </div>

                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-900">
                    <span className="truncate">{m.origen?.nombre}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{m.destino?.nombre}</span>
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {fechaHora(m.fecha)}
                    {m.usuario?.nombre_completo ? ` · ${m.usuario.nombre_completo}` : ''}
                  </p>

                  <ul className="mt-2 space-y-0.5">
                    {m.detalle?.map((d: any, i: number) => (
                      <li key={i} className="text-sm text-slate-600">
                        {numero(d.cantidad)} × {d.producto?.nombre}
                      </li>
                    ))}
                  </ul>

                  {m.observaciones && (
                    <p className="mt-2 text-xs italic text-slate-500">{m.observaciones}</p>
                  )}
                </div>

                {moverStock && m.estado === 'CONFIRMADO' && (
                  <Boton variante="fantasma" className="px-3" onClick={() => setAnulando(m)}>
                    Anular
                  </Boton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {registrando && <FormularioMovimiento onCerrar={() => setRegistrando(false)} />}
      {anulando && <ModalAnular movimiento={anulando} onCerrar={() => setAnulando(null)} />}
    </div>
  )
}

function FormularioMovimiento({ onCerrar }: { onCerrar: () => void }) {
  const qc = useQueryClient()
  const { propias } = useMisUbicaciones()
  const todas = (useUbicaciones().data ?? []) as Ubicacion[]
  const productos = useProductos()

  const [tipo, setTipo] = useState<string>(TIPOS[0].valor)
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [observaciones, setObservaciones] = useState('')

  const definicion = TIPOS.find((t) => t.valor === tipo)!

  // El origen sale de las ubicaciones del usuario; el destino puede ser de
  // otra sucursal (entregar a un repartidor de otra ciudad, por ejemplo).
  const origenes = propias.filter((u) => u.tipo === definicion.origen)
  const destinos = todas.filter((u) => u.tipo === definicion.destino)

  // Al cambiar de tipo, las ubicaciones anteriores ya no aplican.
  useEffect(() => {
    setOrigen(origenes.length === 1 ? origenes[0].id : '')
    setDestino(destinos.length === 1 ? destinos[0].id : '')
    setItems([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  // Si el origen es una ubicación física, solo se puede sacar lo que hay.
  const origenEsFisico = definicion.origen === 'SUCURSAL' || definicion.origen === 'DELIVERY'
  const existencias = useQuery({
    queryKey: ['stock-ubicacion', origen],
    queryFn: () => api.stockDeUbicacion(origen),
    enabled: origenEsFisico && !!origen,
  })

  const registrar = useMutation({
    mutationFn: () =>
      api.registrarMovimiento({
        tipo,
        origen,
        destino,
        items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        observaciones: observaciones.trim() || undefined,
      }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['movimientos'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(`Movimiento ${r?.codigo ?? ''} registrado`)
      onCerrar()
    },
    // El mensaje viene de la base: "Stock insuficiente de X en Y: hay 3…"
    onError: (e) => toast.error(mensajeError(e, 'No se pudo registrar el movimiento.')),
  })

  const listo = origen && destino && origen !== destino && items.length > 0

  return (
    <Modal abierto titulo="Registrar movimiento" onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-4">
        <Selector etiqueta="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>{t.texto}</option>
          ))}
        </Selector>

        <div className="grid gap-4 sm:grid-cols-2">
          <Selector etiqueta="Desde" value={origen} onChange={(e) => setOrigen(e.target.value)}>
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

        {origenEsFisico && !origen ? (
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Elige primero de dónde sale la mercadería.
          </p>
        ) : origenEsFisico && existencias.isLoading ? (
          <Cargando className="py-8" />
        ) : (
          <SelectorItems
            items={items}
            onCambiar={setItems}
            existencias={origenEsFisico ? (existencias.data ?? []) : undefined}
            catalogo={origenEsFisico ? undefined : (productos.data ?? [])}
          />
        )}

        <Campo
          etiqueta="Observaciones"
          placeholder="Factura 1234, guía de remisión, motivo…"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />

        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            className="flex-1"
            disabled={!listo}
            cargando={registrar.isPending}
            onClick={() => registrar.mutate()}
          >
            Registrar
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Anular en vez de borrar: revierte los saldos y deja el movimiento en el
 * historial marcado como anulado. Un inventario sin historial no se audita.
 */
function ModalAnular({ movimiento, onCerrar }: { movimiento: any; onCerrar: () => void }) {
  const qc = useQueryClient()
  const [motivo, setMotivo] = useState('')

  const anular = useMutation({
    mutationFn: () => api.anularMovimiento(movimiento.id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimientos'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Movimiento anulado, saldos revertidos')
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo anular.')),
  })

  return (
    <Modal abierto titulo={`Anular ${movimiento.codigo}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Los saldos vuelven a como estaban antes. El movimiento no se borra: queda
          en el historial marcado como anulado, con este motivo.
        </p>
        <Campo
          etiqueta="Motivo"
          placeholder="Se registró por error, cantidad equivocada…"
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
            Anular
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

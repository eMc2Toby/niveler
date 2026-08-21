import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Truck } from 'lucide-react'
import {
  Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal, Selector,
} from '@/components/ui'
import { useDeliveries, useSucursales } from '@/hooks/useCatalogos'
import { usePermisos } from '@/hooks/useAuth'
import { api } from '@/lib/supabase'
import { numero } from '@/lib/formato'
import { mensajeError } from '@/lib/utils'

export default function Deliveries() {
  const { editarProductos } = usePermisos()
  const deliveries = useDeliveries()
  const stock = useQuery({ queryKey: ['stock-deliveries'], queryFn: api.stockPorDelivery })

  const [editando, setEditando] = useState<any | null>(null)
  const [creando, setCreando] = useState(false)
  const [rindiendo, setRindiendo] = useState<any | null>(null)

  if (deliveries.isLoading) return <Cargando />
  if (deliveries.isError) return <ErrorCarga onReintentar={() => deliveries.refetch()} />

  const porDelivery = new Map(
    (stock.data ?? []).map((s: any) => [s.delivery_id, s]),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Deliveries</h1>
          <p className="text-sm text-slate-500">
            Cada repartidor tiene su propia ubicación de stock
          </p>
        </div>
        {editarProductos && (
          <Boton className="ml-auto" onClick={() => setCreando(true)}>
            <Plus className="h-4 w-4" />
            Nuevo
          </Boton>
        )}
      </div>

      {!deliveries.data?.length ? (
        <EstadoVacio
          titulo="Todavía no hay repartidores"
          detalle="Al crear uno, la base le abre su propia ubicación: lo que lleva encima deja de ser stock de la bodega y pasa a ser suyo."
          accion={
            editarProductos ? (
              <Boton onClick={() => setCreando(true)}>
                <Plus className="h-4 w-4" />
                Nuevo repartidor
              </Boton>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {deliveries.data.map((d: any) => {
            const s: any = porDelivery.get(d.id)
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100">
                  <Truck className="h-5 w-5 text-slate-500" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{d.nombre}</p>
                  <p className="truncate text-xs text-slate-500">
                    {d.codigo} · {d.sucursal?.ciudad ?? 'sin base'}
                    {d.telefono ? ` · ${d.telefono}` : ''}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {numero(s?.unidades ?? 0)}
                  </p>
                  <p className="text-xs text-slate-500">en su poder</p>
                </div>

                {!d.activo && <Etiqueta>Inactivo</Etiqueta>}

                <div className="flex shrink-0 gap-1">
                  <Boton variante="fantasma" className="px-3" onClick={() => setRindiendo(d)}>
                    Rendición
                  </Boton>
                  {editarProductos && (
                    <Boton variante="fantasma" className="px-3" onClick={() => setEditando(d)}>
                      Editar
                    </Boton>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {creando && <FormularioDelivery onCerrar={() => setCreando(false)} />}
      {editando && (
        <FormularioDelivery
          key={editando.id}
          delivery={editando}
          onCerrar={() => setEditando(null)}
        />
      )}
      {rindiendo && <ModalRendicion delivery={rindiendo} onCerrar={() => setRindiendo(null)} />}
    </div>
  )
}

/**
 * La rendición contesta la pregunta del gerente: de lo que le entregué,
 * ¿cuánto vendió, cuánto devolvió y cuánto sigue teniendo? Las tres cifras
 * salen de los movimientos, no de un conteo aparte, así que siempre cuadran.
 */
function ModalRendicion({ delivery, onCerrar }: { delivery: any; onCerrar: () => void }) {
  const rendicion = useQuery({
    queryKey: ['rendicion', delivery.id],
    queryFn: () => api.rendicion(delivery.id),
  })

  return (
    <Modal abierto titulo={`Rendición de ${delivery.nombre}`} onCerrar={onCerrar} ancho="max-w-2xl">
      {rendicion.isLoading ? (
        <Cargando />
      ) : !rendicion.data?.length ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Este repartidor no tiene movimientos todavía.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3 font-medium">Producto</th>
                <th className="py-2 px-2 text-right font-medium">Recibió</th>
                <th className="py-2 px-2 text-right font-medium">Vendió</th>
                <th className="py-2 px-2 text-right font-medium">Devolvió</th>
                <th className="py-2 pl-2 text-right font-medium">Tiene</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rendicion.data.map((r: any) => {
                // Lo que debería tener menos lo que tiene: si no da cero, falta algo.
                const esperado =
                  Number(r.total_recibido) - Number(r.total_vendido) - Number(r.total_retornado)
                const descuadre = esperado - Number(r.en_poder)
                return (
                  <tr key={r.producto_id}>
                    <td className="py-2 pr-3">
                      <p className="text-slate-900">{r.producto}</p>
                      <p className="text-xs text-slate-500">{r.sku}</p>
                    </td>
                    <td className="py-2 px-2 text-right text-slate-600">
                      {numero(r.total_recibido)}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-600">
                      {numero(r.total_vendido)}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-600">
                      {numero(r.total_retornado)}
                    </td>
                    <td className="py-2 pl-2 text-right font-medium text-slate-900">
                      {numero(r.en_poder)}
                      {descuadre !== 0 && (
                        <span className="block text-xs font-normal text-amber-600">
                          {descuadre > 0 ? `faltan ${numero(descuadre)}` : `sobran ${numero(-descuadre)}`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

function FormularioDelivery({ delivery, onCerrar }: { delivery?: any; onCerrar: () => void }) {
  const qc = useQueryClient()
  const sucursales = useSucursales()
  const [f, setF] = useState({
    codigo: delivery?.codigo ?? '',
    nombre: delivery?.nombre ?? '',
    telefono: delivery?.telefono ?? '',
    ci: delivery?.ci ?? '',
    vehiculo: delivery?.vehiculo ?? '',
    sucursal_base_id: delivery?.sucursal_base_id ?? '',
    activo: delivery?.activo ?? true,
  })

  const guardar = useMutation({
    mutationFn: () =>
      api.guardarDelivery(delivery?.id ?? null, {
        ...f,
        telefono: f.telefono.trim() || null,
        ci: f.ci.trim() || null,
        vehiculo: f.vehiculo.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: ['ubicaciones'] })
      toast.success(delivery ? 'Repartidor actualizado' : 'Repartidor creado')
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo guardar el repartidor.')),
  })

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal abierto titulo={delivery ? 'Editar repartidor' : 'Nuevo repartidor'} onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Código" placeholder="DEL-001" value={f.codigo} onChange={set('codigo')} />
          <Campo etiqueta="Nombre" value={f.nombre} onChange={set('nombre')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Teléfono" inputMode="tel" value={f.telefono} onChange={set('telefono')} />
          <Campo etiqueta="CI" value={f.ci} onChange={set('ci')} />
        </div>
        <Campo etiqueta="Vehículo" placeholder="Moto, placa 1234" value={f.vehiculo} onChange={set('vehiculo')} />

        <Selector
          etiqueta="Sucursal base"
          value={f.sucursal_base_id}
          onChange={set('sucursal_base_id')}
        >
          <option value="">Elegir…</option>
          {sucursales.data?.map((s: any) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </Selector>

        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-600"
            checked={f.activo}
            onChange={(e) => setF({ ...f, activo: e.target.checked })}
          />
          Repartidor activo
        </label>

        <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          Para que además pueda entrar a la app, créale un usuario con rol Delivery
          en Usuarios y vincúlalo desde la base.
        </p>

        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            className="flex-1"
            disabled={!f.codigo.trim() || !f.nombre.trim() || !f.sucursal_base_id}
            cargando={guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

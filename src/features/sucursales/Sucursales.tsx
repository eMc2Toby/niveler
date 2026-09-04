import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, Plus } from 'lucide-react'
import { Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal } from '@/components/ui'
import { useSucursales } from '@/hooks/useCatalogos'
import { api } from '@/lib/supabase'
import { numero } from '@/lib/formato'
import { mensajeError } from '@/lib/utils'

export default function Sucursales() {
  const sucursales = useSucursales()
  const stock = useQuery({ queryKey: ['stock-sucursales'], queryFn: api.stockPorSucursal })
  const [editando, setEditando] = useState<any | null>(null)
  const [creando, setCreando] = useState(false)

  if (sucursales.isLoading) return <Cargando />
  if (sucursales.isError) return <ErrorCarga onReintentar={() => sucursales.refetch()} />

  const porSucursal = new Map((stock.data ?? []).map((s: any) => [s.sucursal_id, s]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sucursales</h1>
          <p className="text-sm text-slate-500">{sucursales.data?.length ?? 0} ciudades</p>
        </div>
        <Boton className="ml-auto" onClick={() => setCreando(true)}>
          <Plus className="h-4 w-4" />
          Nueva
        </Boton>
      </div>

      {!sucursales.data?.length ? (
        <EstadoVacio titulo="Todavía no hay sucursales" />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {sucursales.data.map((s: any) => {
            const st: any = porSucursal.get(s.id)
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100">
                  <Building2 className="h-5 w-5 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{s.nombre}</p>
                  <p className="truncate text-xs text-slate-500">
                    {s.codigo} · {s.ciudad}
                    {s.telefono ? ` · ${s.telefono}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{numero(st?.unidades ?? 0)}</p>
                  <p className="text-xs text-slate-500">
                    {numero(st?.productos_distintos ?? 0)} productos
                  </p>
                </div>
                {!s.activo && <Etiqueta>Inactiva</Etiqueta>}
                <Boton variante="fantasma" className="px-3" onClick={() => setEditando(s)}>
                  Editar
                </Boton>
              </li>
            )
          })}
        </ul>
      )}

      {creando && <FormularioSucursal onCerrar={() => setCreando(false)} />}
      {editando && (
        <FormularioSucursal
          key={editando.id}
          sucursal={editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function FormularioSucursal({ sucursal, onCerrar }: { sucursal?: any; onCerrar: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({
    codigo: sucursal?.codigo ?? '',
    nombre: sucursal?.nombre ?? '',
    ciudad: sucursal?.ciudad ?? '',
    direccion: sucursal?.direccion ?? '',
    telefono: sucursal?.telefono ?? '',
    activo: sucursal?.activo ?? true,
  })

  const guardar = useMutation({
    mutationFn: () =>
      api.guardarSucursal(sucursal?.id ?? null, {
        ...f,
        direccion: f.direccion.trim() || null,
        telefono: f.telefono.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sucursales'] })
      toast.success(sucursal ? 'Sucursal actualizada' : 'Sucursal creada')
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo guardar la sucursal.')),
  })

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal abierto titulo={sucursal ? 'Editar sucursal' : 'Nueva sucursal'} onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Código" placeholder="SUC-LPZ" value={f.codigo} onChange={set('codigo')} />
          <Campo etiqueta="Ciudad" value={f.ciudad} onChange={set('ciudad')} />
        </div>
        <Campo etiqueta="Nombre" placeholder="Niveler La Paz" value={f.nombre} onChange={set('nombre')} />
        <Campo etiqueta="Dirección" value={f.direccion} onChange={set('direccion')} />
        <Campo etiqueta="Teléfono" inputMode="tel" value={f.telefono} onChange={set('telefono')} />

        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-600"
            checked={f.activo}
            onChange={(e) => setF({ ...f, activo: e.target.checked })}
          />
          Sucursal activa
        </label>

        {!sucursal && (
          <p className="rounded-lg bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
            Al guardar se creará automáticamente su ubicación de bodega para recibir stock.
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            className="flex-1"
            disabled={!f.codigo.trim() || !f.nombre.trim() || !f.ciudad.trim()}
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

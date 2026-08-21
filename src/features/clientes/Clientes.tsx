import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Search } from 'lucide-react'
import { Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal } from '@/components/ui'
import { useClientes } from '@/hooks/useCatalogos'
import { usePermisos } from '@/hooks/useAuth'
import { api } from '@/lib/supabase'
import { mensajeError, normalizar } from '@/lib/utils'

export default function Clientes() {
  const { editarClientes } = usePermisos()
  const clientes = useClientes()
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<any | null>(null)
  const [creando, setCreando] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return (clientes.data ?? []).filter(
      (c: any) => !q || normalizar(`${c.nombre} ${c.nit_ci ?? ''} ${c.telefono ?? ''}`).includes(q),
    )
  }, [clientes.data, busqueda])

  if (clientes.isLoading) return <Cargando />
  if (clientes.isError) return <ErrorCarga onReintentar={() => clientes.refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500">{filtrados.length} registrados</p>
        </div>
        {editarClientes && (
          <Boton className="ml-auto" onClick={() => setCreando(true)}>
            <Plus className="h-4 w-4" />
            Nuevo
          </Boton>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
        <Campo
          className="pl-10"
          placeholder="Buscar por nombre, NIT o teléfono"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar clientes"
        />
      </div>

      {!filtrados.length ? (
        <EstadoVacio
          titulo={busqueda ? 'Sin resultados' : 'Todavía no hay clientes'}
          detalle={
            busqueda
              ? 'Prueba con otro dato.'
              : 'El cliente es opcional en una venta: sirve para saber a quién se le entregó.'
          }
          accion={
            editarClientes && !busqueda ? (
              <Boton onClick={() => setCreando(true)}>
                <Plus className="h-4 w-4" />
                Nuevo cliente
              </Boton>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filtrados.map((c: any) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{c.nombre}</p>
                <p className="truncate text-xs text-slate-500">
                  {[c.nit_ci, c.telefono, c.ciudad].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                </p>
              </div>
              {!c.activo && <Etiqueta>Inactivo</Etiqueta>}
              {editarClientes && (
                <Boton variante="fantasma" className="px-3" onClick={() => setEditando(c)}>
                  Editar
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}

      {creando && <FormularioCliente onCerrar={() => setCreando(false)} />}
      {editando && (
        <FormularioCliente
          key={editando.id}
          cliente={editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function FormularioCliente({ cliente, onCerrar }: { cliente?: any; onCerrar: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({
    nombre: cliente?.nombre ?? '',
    nit_ci: cliente?.nit_ci ?? '',
    telefono: cliente?.telefono ?? '',
    email: cliente?.email ?? '',
    direccion: cliente?.direccion ?? '',
    ciudad: cliente?.ciudad ?? '',
    activo: cliente?.activo ?? true,
  })

  const guardar = useMutation({
    mutationFn: () =>
      api.guardarCliente(cliente?.id ?? null, {
        ...f,
        nit_ci: f.nit_ci.trim() || null,
        telefono: f.telefono.trim() || null,
        email: f.email.trim() || null,
        direccion: f.direccion.trim() || null,
        ciudad: f.ciudad.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      toast.success(cliente ? 'Cliente actualizado' : 'Cliente creado')
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo guardar el cliente.')),
  })

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal abierto titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={onCerrar}>
      <div className="space-y-4">
        <Campo etiqueta="Nombre" value={f.nombre} onChange={set('nombre')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="NIT o CI" value={f.nit_ci} onChange={set('nit_ci')} />
          <Campo etiqueta="Teléfono" inputMode="tel" value={f.telefono} onChange={set('telefono')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Ciudad" value={f.ciudad} onChange={set('ciudad')} />
          <Campo etiqueta="Correo" type="email" value={f.email} onChange={set('email')} />
        </div>
        <Campo etiqueta="Dirección" value={f.direccion} onChange={set('direccion')} />

        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-600"
            checked={f.activo}
            onChange={(e) => setF({ ...f, activo: e.target.checked })}
          />
          Cliente activo
        </label>

        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            className="flex-1"
            disabled={f.nombre.trim().length < 2}
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

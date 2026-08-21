import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserCog } from 'lucide-react'
import { Boton, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal, Selector } from '@/components/ui'
import { useSucursales } from '@/hooks/useCatalogos'
import { api } from '@/lib/supabase'
import { fecha } from '@/lib/formato'
import { mensajeError } from '@/lib/utils'

export default function Usuarios() {
  const usuarios = useQuery({ queryKey: ['usuarios'], queryFn: api.usuarios })
  const [editando, setEditando] = useState<any | null>(null)

  if (usuarios.isLoading) return <Cargando />
  if (usuarios.isError) return <ErrorCarga onReintentar={() => usuarios.refetch()} />

  const pendientes = (usuarios.data ?? []).filter((u: any) => !u.activo)

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500">{usuarios.data?.length ?? 0} cuentas</p>
      </div>

      {/* Quien se registra nace inactivo y con el rol más bajo: alguien
          tiene que aprobarlo a mano. Es la puerta de entrada al sistema. */}
      {pendientes.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {pendientes.length === 1
            ? 'Hay 1 cuenta esperando aprobación.'
            : `Hay ${pendientes.length} cuentas esperando aprobación.`}
        </p>
      )}

      {!usuarios.data?.length ? (
        <EstadoVacio
          titulo="No hay usuarios"
          detalle="Las cuentas se crean desde Supabase → Authentication → Users. Aquí se les asigna rol y sucursal."
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {usuarios.data.map((u: any) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100">
                <UserCog className="h-5 w-5 text-slate-500" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{u.nombre_completo}</p>
                <p className="truncate text-xs text-slate-500">
                  {u.email}
                  {u.sucursal?.ciudad ? ` · ${u.sucursal.ciudad}` : ' · todas las ciudades'}
                </p>
                {u.ultimo_acceso && (
                  <p className="text-xs text-slate-400">Último acceso {fecha(u.ultimo_acceso)}</p>
                )}
              </div>

              <Etiqueta tono={u.activo ? 'verde' : 'ambar'}>
                {u.activo ? u.rol?.nombre ?? 'sin rol' : 'pendiente'}
              </Etiqueta>

              <Boton variante="fantasma" className="px-3" onClick={() => setEditando(u)}>
                Cambiar
              </Boton>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <ModalPermisos key={editando.id} usuario={editando} onCerrar={() => setEditando(null)} />
      )}
    </div>
  )
}

function ModalPermisos({ usuario, onCerrar }: { usuario: any; onCerrar: () => void }) {
  const qc = useQueryClient()
  const roles = useQuery({ queryKey: ['roles'], queryFn: api.roles, staleTime: 10 * 60_000 })
  const sucursales = useSucursales()

  const [rolId, setRolId] = useState(String(usuario.rol?.id ?? ''))
  const [sucursalId, setSucursalId] = useState(usuario.sucursal?.id ?? '')
  const [activo, setActivo] = useState(usuario.activo)

  const guardar = useMutation({
    mutationFn: () =>
      api.actualizarUsuario(usuario.id, {
        rol_id: Number(rolId),
        sucursal_id: sucursalId || null,
        activo,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      toast.success('Permisos actualizados')
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudieron cambiar los permisos.')),
  })

  return (
    <Modal abierto titulo={usuario.nombre_completo} onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">{usuario.email}</p>

        <Selector etiqueta="Rol" value={rolId} onChange={(e) => setRolId(e.target.value)}>
          <option value="">Elegir…</option>
          {roles.data?.map((r: any) => (
            <option key={r.id} value={r.id}>{r.nombre} · nivel {r.nivel}</option>
          ))}
        </Selector>

        <Selector
          etiqueta="Sucursal"
          value={sucursalId}
          onChange={(e) => setSucursalId(e.target.value)}
        >
          <option value="">Todas (gerencia)</option>
          {sucursales.data?.map((s: any) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </Selector>

        <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          Esto no es solo el menú: el rol y la sucursal son lo que usan las políticas
          RLS de la base. Un repartidor que consulte la API directamente seguirá
          viendo únicamente sus datos.
        </p>

        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-600"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />
          Cuenta activa
        </label>

        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            className="flex-1"
            disabled={!rolId}
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

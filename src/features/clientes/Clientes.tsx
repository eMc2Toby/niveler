import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Search } from 'lucide-react'
import { Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal, Selector } from '@/components/ui'
import { useClientes } from '@/hooks/useCatalogos'
import { usePermisos } from '@/hooks/useAuth'
import { api } from '@/lib/supabase'
import { mensajeError, normalizar } from '@/lib/utils'

const DEPARTAMENTOS = [
  'Beni',
  'Chuquisaca',
  'Cochabamba',
  'La Paz',
  'Oruro',
  'Pando',
  'Potosí',
  'Santa Cruz',
  'Tarija',
] as const

export default function Clientes() {
  const { editarClientes } = usePermisos()
  const clientes = useClientes()
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<any | null>(null)
  const [creando, setCreando] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return (clientes.data ?? []).filter(
      (c: any) => !q || normalizar(
        `${c.nombre} ${c.telefono ?? ''} ${c.ciudad ?? ''} ${pedidosDe(c).map((p: any) => p.numero).join(' ')}`,
      ).includes(q),
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
          placeholder="Buscar por nombre, teléfono, departamento o pedido"
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
                  {[c.telefono, c.ciudad].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                </p>
                {!!pedidosDe(c).length && (
                  <p className="truncate text-xs text-emerald-700">
                    Pedidos: {pedidosDe(c).map((pedido: any) => pedido.numero).join(' · ')}
                  </p>
                )}
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
    telefono: cliente?.telefono ?? '',
    direccion: cliente?.direccion ?? '',
    ciudad: cliente?.ciudad ?? '',
    numero_pedido: '',
    activo: cliente?.activo ?? true,
  })
  const [errores, setErrores] = useState<Record<string, string>>({})

  const guardar = useMutation({
    mutationFn: () =>
      api.guardarCliente(cliente?.id ?? null, {
        ...f,
        // Se conserva el dato histórico al editar, pero ya no se solicita ni
        // muestra NIT/CI en la interfaz.
        nit_ci: cliente?.nit_ci ?? null,
        telefono: f.telefono.trim() || null,
        direccion: f.direccion.trim() || null,
        ciudad: f.ciudad.trim() || null,
        numero_pedido: f.numero_pedido.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      toast.success(cliente ? 'Cliente actualizado' : 'Cliente creado')
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo guardar el cliente.')),
  })

  const set = (k: keyof typeof f) => (e: any) => {
    setF({ ...f, [k]: e.target.value })
    setErrores((actuales) => ({ ...actuales, [k]: '' }))
  }

  function validar() {
    const nuevos: Record<string, string> = {}
    const nombre = f.nombre.trim()
    const telefono = f.telefono.trim()
    const direccion = f.direccion.trim()
    const pedido = f.numero_pedido.trim()

    if (nombre.length < 2) nuevos.nombre = 'Escribe al menos 2 caracteres'
    else if (nombre.length > 120) nuevos.nombre = 'Máximo 120 caracteres'

    if (telefono && !/^[0-9+()\s-]{7,20}$/.test(telefono)) {
      nuevos.telefono = 'Usa entre 7 y 20 dígitos o símbolos de teléfono'
    }

    if (!f.ciudad) nuevos.ciudad = 'Selecciona un departamento'
    if (direccion.length > 200) nuevos.direccion = 'Máximo 200 caracteres'
    if (pedido.length > 60) nuevos.numero_pedido = 'Máximo 60 caracteres'
    if (/[\r\n]/.test(pedido)) nuevos.numero_pedido = 'El pedido debe ir en una sola línea'

    setErrores(nuevos)
    return Object.keys(nuevos).length === 0
  }

  function intentarGuardar() {
    if (validar()) guardar.mutate()
  }

  const ciudadHistorica = f.ciudad && !DEPARTAMENTOS.includes(f.ciudad as typeof DEPARTAMENTOS[number])

  return (
    <Modal abierto titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={onCerrar}>
      <div className="space-y-4">
        <Campo
          etiqueta="Nombre"
          maxLength={120}
          autoComplete="name"
          error={errores.nombre}
          value={f.nombre}
          onChange={set('nombre')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Teléfono"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            error={errores.telefono}
            value={f.telefono}
            onChange={set('telefono')}
          />
          <Selector
            etiqueta="Departamento"
            error={errores.ciudad}
            value={f.ciudad}
            onChange={set('ciudad')}
          >
            <option value="">Seleccionar…</option>
            {ciudadHistorica && <option value={f.ciudad}>{f.ciudad} (dato anterior)</option>}
            {DEPARTAMENTOS.map((departamento) => (
              <option key={departamento} value={departamento}>{departamento}</option>
            ))}
          </Selector>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta={cliente ? 'Agregar número de pedido' : 'Número de pedido'}
            placeholder="PED-00125"
            ayuda={cliente ? 'Los números anteriores se conservarán' : 'Opcional; también puede agregarse al vender'}
            maxLength={60}
            error={errores.numero_pedido}
            value={f.numero_pedido}
            onChange={set('numero_pedido')}
          />
          <Campo
            etiqueta="Dirección"
            maxLength={200}
            autoComplete="street-address"
            error={errores.direccion}
            value={f.direccion}
            onChange={set('direccion')}
          />
        </div>

        {cliente && !!pedidosDe(cliente).length && (
          <div className="rounded-lg bg-slate-50 px-3.5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pedidos registrados</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pedidosDe(cliente).map((pedido: any) => (
                <Etiqueta key={pedido.id} tono="verde">{pedido.numero}</Etiqueta>
              ))}
            </div>
          </div>
        )}

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
            cargando={guardar.isPending}
            onClick={intentarGuardar}
          >
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function pedidosDe(cliente: any) {
  return [...(cliente?.pedidos ?? [])]
    .filter((pedido: any) => pedido.activo !== false)
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
}

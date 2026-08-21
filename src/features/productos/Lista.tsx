import { useMemo, useState } from 'react'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta } from '@/components/ui'
import { useActivarProducto, useProductos } from '@/hooks/useProductos'
import { usePermisos } from '@/hooks/useAuth'
import { bs, numero } from '@/lib/formato'
import { normalizar } from '@/lib/utils'
import FormularioProducto from './Formulario'
import DetalleProducto, { Imagen } from './Detalle'

export default function ListaProductos() {
  const { editarProductos, verCostos } = usePermisos()
  const productos = useProductos()
  const activar = useActivarProducto()

  const [busqueda, setBusqueda] = useState('')
  const [verInactivos, setVerInactivos] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [creando, setCreando] = useState(false)
  const [detalle, setDetalle] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return (productos.data ?? []).filter((p: any) => {
      if (!verInactivos && !p.activo) return false
      if (!q) return true
      // Se busca por nombre, código y marca: en bodega la gente teclea
      // lo primero que recuerda del producto.
      return normalizar(`${p.nombre} ${p.sku} ${p.marca?.nombre ?? ''}`).includes(q)
    })
  }, [productos.data, busqueda, verInactivos])

  if (productos.isLoading) return <Cargando />
  if (productos.isError) return <ErrorCarga onReintentar={() => productos.refetch()} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Productos</h1>
          <p className="text-sm text-slate-500">
            {numero(filtrados.length)} de {numero(productos.data?.length ?? 0)}
          </p>
        </div>
        {editarProductos && (
          <Boton className="ml-auto" onClick={() => setCreando(true)}>
            <Plus className="h-4 w-4" />
            Nuevo
          </Boton>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <Campo
            className="pl-10"
            placeholder="Buscar por nombre, código o marca"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar productos"
          />
        </div>
        <button
          onClick={() => setVerInactivos((v) => !v)}
          aria-pressed={verInactivos}
          title="Mostrar también los productos inactivos"
          className={`grid min-h-[44px] w-[44px] place-items-center rounded-lg border transition ${
            verInactivos
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-slate-300 bg-white text-slate-500'
          }`}
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" />
        </button>
      </div>

      {!filtrados.length ? (
        <EstadoVacio
          titulo={busqueda ? 'Sin resultados' : 'Todavía no hay productos'}
          detalle={
            busqueda
              ? 'Prueba con otra palabra o revisa el código.'
              : 'Carga el catálogo desde 05_seed.sql o crea el primero a mano.'
          }
          accion={
            editarProductos && !busqueda ? (
              <Boton onClick={() => setCreando(true)}>
                <Plus className="h-4 w-4" />
                Nuevo producto
              </Boton>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filtrados.map((p: any) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => setDetalle(p.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Imagen ruta={p.imagen_url} nombre={p.nombre} className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{p.nombre}</p>
                  <p className="truncate text-xs text-slate-500">
                    {p.sku}
                    {p.marca?.nombre ? ` · ${p.marca.nombre}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{bs(p.precio_venta)}</p>
                  {verCostos && (
                    <p className="text-xs text-slate-500">costo {bs(p.precio_costo)}</p>
                  )}
                </div>
              </button>

              {!p.activo && <Etiqueta>Inactivo</Etiqueta>}

              {editarProductos && (
                <div className="flex shrink-0 gap-1">
                  <Boton
                    variante="fantasma"
                    className="px-3"
                    onClick={() => setEditando(p)}
                  >
                    Editar
                  </Boton>
                  <Boton
                    variante="fantasma"
                    className="px-3"
                    onClick={() => activar.mutate({ id: p.id, activo: !p.activo })}
                  >
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </Boton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {creando && <FormularioProducto abierto onCerrar={() => setCreando(false)} />}
      {editando && (
        <FormularioProducto
          key={editando.id}
          abierto
          producto={editando}
          onCerrar={() => setEditando(null)}
        />
      )}
      <DetalleProducto productoId={detalle} onCerrar={() => setDetalle(null)} />
    </div>
  )
}

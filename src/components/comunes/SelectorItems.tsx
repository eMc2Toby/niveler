import { useMemo, useState } from 'react'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import { Campo, EstadoVacio } from '@/components/ui'
import { Imagen } from '@/features/productos/Detalle'
import { numero } from '@/lib/formato'
import { normalizar } from '@/lib/utils'

export type Item = {
  producto_id: string
  sku: string
  nombre: string
  imagen_url: string | null
  cantidad: number
  disponible?: number // si viene, no se deja pasar de ahí
}

/**
 * El armador de listas de productos que comparten movimientos, ventas y
 * transferencias. Todo lo que mueve stock termina siendo lo mismo: elegir
 * productos y decir cuántos.
 *
 * Cuando la operación sale de una ubicación con stock (`existencias`), solo
 * se ofrecen los productos que realmente están ahí y con su tope. Es la
 * misma validación que hace `sp_confirmar_movimiento`, pero antes de que el
 * usuario escriba veinte líneas y reciba un error al final.
 */
export function SelectorItems({
  items, onCambiar, existencias, catalogo,
}: {
  items: Item[]
  onCambiar: (items: Item[]) => void
  /** Filas de v_stock de la ubicación origen. Si falta, se usa el catálogo. */
  existencias?: any[]
  /** Catálogo completo, para entradas donde el origen no tiene stock previo. */
  catalogo?: any[]
}) {
  const [busqueda, setBusqueda] = useState('')

  const disponibles = useMemo(() => {
    const fuente = existencias
      ? existencias.map((f: any) => ({
          producto_id: f.producto_id,
          sku: f.sku,
          nombre: f.producto,
          imagen_url: f.imagen_url,
          disponible: Number(f.cantidad_disponible ?? f.cantidad),
        }))
      : (catalogo ?? []).map((p: any) => ({
          producto_id: p.id,
          sku: p.sku,
          nombre: p.nombre,
          imagen_url: p.imagen_url,
          disponible: undefined,
        }))

    const q = normalizar(busqueda.trim())
    const elegidos = new Set(items.map((i) => i.producto_id))
    return fuente
      .filter((p) => !elegidos.has(p.producto_id))
      .filter((p) => !q || normalizar(`${p.nombre} ${p.sku}`).includes(q))
      .slice(0, 30)
  }, [existencias, catalogo, busqueda, items])

  const agregar = (p: any) =>
    onCambiar([...items, { ...p, cantidad: 1 }])

  const cambiarCantidad = (id: string, cantidad: number) =>
    onCambiar(
      items.map((i) =>
        i.producto_id === id
          ? { ...i, cantidad: Math.max(1, Math.min(cantidad, i.disponible ?? Infinity)) }
          : i,
      ),
    )

  const quitar = (id: string) => onCambiar(items.filter((i) => i.producto_id !== id))

  return (
    <div className="space-y-4">
      {/* Elegidos */}
      {items.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {items.map((i) => (
            <li key={i.producto_id} className="flex items-center gap-3 px-3 py-2.5">
              <Imagen ruta={i.imagen_url} nombre={i.nombre} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{i.nombre}</p>
                <p className="text-xs text-slate-500">
                  {i.sku}
                  {i.disponible !== undefined ? ` · hay ${numero(i.disponible)}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Quitar uno"
                  onClick={() => cambiarCantidad(i.producto_id, i.cantidad - 1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-600"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={`Cantidad de ${i.nombre}`}
                  value={i.cantidad}
                  onChange={(e) => cambiarCantidad(i.producto_id, Number(e.target.value))}
                  className="w-14 rounded-lg border border-slate-300 py-1.5 text-center"
                />
                <button
                  type="button"
                  aria-label="Agregar uno"
                  onClick={() => cambiarCantidad(i.producto_id, i.cantidad + 1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-600"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Sacar ${i.nombre}`}
                  onClick={() => quitar(i.producto_id)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
        <Campo
          className="pl-10"
          placeholder="Buscar producto para agregar"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar producto"
        />
      </div>

      {!disponibles.length ? (
        <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {existencias && !existencias.length
            ? 'Esta ubicación no tiene stock.'
            : busqueda
              ? 'Ningún producto coincide.'
              : 'Todo lo disponible ya está en la lista.'}
        </p>
      ) : (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {disponibles.map((p: any) => (
            <li key={p.producto_id}>
              <button
                type="button"
                onClick={() => agregar(p)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
              >
                <Imagen ruta={p.imagen_url} nombre={p.nombre} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-900">{p.nombre}</p>
                  <p className="text-xs text-slate-500">{p.sku}</p>
                </div>
                {p.disponible !== undefined && (
                  <span className="text-sm text-slate-500">{numero(p.disponible)}</span>
                )}
                <Plus className="h-4 w-4 shrink-0 text-emerald-600" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SinNada({ que }: { que: string }) {
  return <EstadoVacio titulo={`Todavía no hay ${que}`} />
}

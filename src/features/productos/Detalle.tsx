import { Package } from 'lucide-react'
import { Cargando, Etiqueta, Modal } from '@/components/ui'
import { useProducto, useStockDeProducto } from '@/hooks/useProductos'
import { urlImagen } from '@/lib/supabase'
import { bs, numero } from '@/lib/formato'
import { usePermisos } from '@/hooks/useAuth'

export default function DetalleProducto({
  productoId, onCerrar,
}: {
  productoId: string | null
  onCerrar: () => void
}) {
  const { verCostos } = usePermisos()
  const producto = useProducto(productoId ?? undefined)
  const stock = useStockDeProducto(productoId ?? undefined)

  const p: any = producto.data
  const total = (stock.data ?? []).reduce((s: number, f: any) => s + Number(f.cantidad), 0)

  return (
    <Modal abierto={!!productoId} onCerrar={onCerrar} titulo={p?.nombre ?? 'Producto'}>
      {producto.isLoading ? (
        <Cargando />
      ) : !p ? (
        <p className="py-10 text-center text-sm text-slate-500">No se encontró el producto.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-4">
            <Imagen ruta={p.imagen_url} nombre={p.nombre} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm text-slate-500">{p.sku}</p>
              <p className="font-medium text-slate-900">{p.nombre}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {p.categoria?.nombre && <Etiqueta>{p.categoria.nombre}</Etiqueta>}
                {p.marca?.nombre && <Etiqueta>{p.marca.nombre}</Etiqueta>}
                <Etiqueta tono={p.activo ? 'verde' : 'neutro'}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </Etiqueta>
              </div>
            </div>
          </div>

          {p.descripcion && <p className="text-sm text-slate-600">{p.descripcion}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Dato titulo="Precio de venta" valor={bs(p.precio_venta)} />
            {verCostos && <Dato titulo="Costo" valor={bs(p.precio_costo)} />}
            <Dato titulo="Stock mínimo" valor={`${numero(p.stock_minimo)} ${p.unidad_medida.toLowerCase()}`} />
            <Dato titulo="Stock total" valor={numero(total)} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-900">Dónde está</h3>
            {stock.isLoading ? (
              <Cargando className="py-8" />
            ) : !stock.data?.length ? (
              <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Sin existencias en ninguna ubicación.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {stock.data.map((f: any) => (
                  <li key={f.ubicacion_id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-900">{f.ubicacion}</p>
                      <p className="text-xs text-slate-500">{f.tipo_ubicacion.toLowerCase()}</p>
                    </div>
                    <span className="text-sm font-medium text-slate-900">{numero(f.cantidad)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className="mt-0.5 font-medium text-slate-900">{valor}</p>
    </div>
  )
}

export function Imagen({ ruta, nombre, className = 'h-20 w-20' }: {
  ruta: string | null
  nombre: string
  className?: string
}) {
  const url = urlImagen(ruta)
  if (!url) {
    return (
      <div className={`grid shrink-0 place-items-center rounded-lg bg-slate-100 ${className}`}>
        <Package className="h-5 w-5 text-slate-400" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={nombre}
      loading="lazy"
      className={`shrink-0 rounded-lg border border-slate-200 object-cover ${className}`}
    />
  )
}

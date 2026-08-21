import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boton, Campo, Modal, Selector } from '@/components/ui'
import { useCategorias, useGuardarProducto, useMarcas } from '@/hooks/useProductos'

// El mismo contrato que impone la base en 01_schema.sql: SKU único y
// mínimo no negativo. Validar aquí evita un viaje al servidor para
// enterarse de algo que ya sabíamos.
const esquema = z.object({
  sku: z.string().trim().min(1, 'El código es obligatorio').max(30),
  nombre: z.string().trim().min(2, 'Escribe el nombre del producto').max(120),
  descripcion: z.string().trim().max(500).optional(),
  categoria_id: z.string().optional(),
  marca_id: z.string().optional(),
  unidad_medida: z.string().min(1),
  stock_minimo: z.coerce.number().min(0, 'No puede ser negativo'),
  activo: z.boolean(),
})

export type ValoresProducto = z.infer<typeof esquema>

const UNIDADES = ['UNIDAD', 'CAJA', 'PAQUETE', 'PAR', 'METRO', 'KILO', 'LITRO']

export default function FormularioProducto({
  abierto, onCerrar, producto,
}: {
  abierto: boolean
  onCerrar: () => void
  producto?: any
}) {
  const categorias = useCategorias()
  const marcas = useMarcas()
  const guardar = useGuardarProducto(producto?.id)

  const {
    register, handleSubmit, formState: { errors },
  } = useForm<ValoresProducto>({
    resolver: zodResolver(esquema),
    // `key` en el Modal fuerza el remonte al cambiar de producto, así que
    // los valores por defecto se leen una sola vez y no hace falta reset().
    defaultValues: {
      sku: producto?.sku ?? '',
      nombre: producto?.nombre ?? '',
      descripcion: producto?.descripcion ?? '',
      categoria_id: producto?.categoria_id ?? '',
      marca_id: producto?.marca_id ?? '',
      unidad_medida: producto?.unidad_medida ?? 'UNIDAD',
      stock_minimo: producto?.stock_minimo ?? 0,
      activo: producto?.activo ?? true,
    },
  })

  async function enviar(v: ValoresProducto) {
    await guardar.mutateAsync({
      ...v,
      descripcion: v.descripcion?.trim() || null,
      // El select vacío entrega '' y la columna espera null o un uuid válido.
      categoria_id: v.categoria_id || null,
      marca_id: v.marca_id || null,
    })
    onCerrar()
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={producto ? 'Editar producto' : 'Nuevo producto'}
    >
      <form onSubmit={handleSubmit(enviar)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Código (SKU)"
            placeholder="PRD-081"
            error={errors.sku?.message}
            {...register('sku')}
          />
          <Selector etiqueta="Unidad" {...register('unidad_medida')}>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>{u.toLowerCase()}</option>
            ))}
          </Selector>
        </div>

        <Campo
          etiqueta="Nombre"
          placeholder="Aspiradora 1400W"
          error={errors.nombre?.message}
          {...register('nombre')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Selector etiqueta="Categoría" {...register('categoria_id')}>
            <option value="">Sin categoría</option>
            {categorias.data?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Selector>
          <Selector etiqueta="Marca" {...register('marca_id')}>
            <option value="">Sin marca</option>
            {marcas.data?.map((m: any) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </Selector>
        </div>

        <Campo
          etiqueta="Stock mínimo"
          type="number" step="1" inputMode="numeric"
          ayuda="El sistema avisa cuando el stock baje de aquí"
          error={errors.stock_minimo?.message}
          {...register('stock_minimo')}
        />

        <div>
          <label htmlFor="descripcion" className="mb-1.5 block text-sm font-medium text-slate-700">
            Descripción
          </label>
          <textarea
            id="descripcion"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900
                       focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            {...register('descripcion')}
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-emerald-600" {...register('activo')} />
          Producto activo
        </label>

        <div className="flex gap-3 pt-2">
          <Boton type="button" variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" className="flex-1" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

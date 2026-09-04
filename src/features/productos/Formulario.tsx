import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Boton, Campo, Cargando, Modal, Selector } from '@/components/ui'
import { useCategorias, useGuardarProducto, useMarcas, useStockDeProducto } from '@/hooks/useProductos'
import { useMisUbicaciones } from '@/hooks/useCatalogos'
import { CampoImagen } from './CampoImagen'
import { api } from '@/lib/supabase'
import { extensionDe } from '@/lib/imagenes'
import { mensajeError } from '@/lib/utils'
import { numero } from '@/lib/formato'

const UNIDADES = ['UNIDAD', 'CAJA', 'PAQUETE', 'PAR', 'METRO', 'KILO', 'LITRO'] as const

// El SKU lo define la persona que registra el producto. PostgreSQL conserva la
// restricción única para impedir duplicados aunque dos personas guarden a la vez.
const esquema = z.object({
  sku: z.preprocess(
    (valor) => typeof valor === 'string' ? valor.trim().toUpperCase() : valor,
    z.string()
      .min(1, 'Escribe el código SKU')
      .max(50, 'Máximo 50 caracteres')
      .regex(/^[A-Z0-9_-]+$/, 'Usa letras, números, guiones o guion bajo'),
  ),
  nombre: z.string().trim().min(2, 'Escribe al menos 2 caracteres').max(120, 'Máximo 120 caracteres'),
  descripcion: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
  categoria_id: z.string().uuid('Categoría inválida').or(z.literal('')).optional(),
  marca_id: z.string().uuid('Marca inválida').or(z.literal('')).optional(),
  unidad_medida: z.preprocess(
    (valor) => typeof valor === 'string' ? valor.trim().toUpperCase() : valor,
    z.enum(UNIDADES, { message: 'Selecciona una unidad válida' }),
  ),
  stock_minimo: z.coerce.number().finite('Escribe una cantidad válida').min(0, 'No puede ser negativo').max(999999999, 'Cantidad demasiado alta'),
  stock_inicial: z.coerce.number().finite('Escribe una cantidad válida').min(0, 'No puede ser negativo').max(999999999, 'Cantidad demasiado alta').optional(),
  ubicacion_destino_id: z.string().uuid('Sucursal inválida').or(z.literal('')).optional(),
  activo: z.boolean(),
}).superRefine((datos, contexto) => {
  if (Number(datos.stock_inicial ?? 0) > 0 && !datos.ubicacion_destino_id) {
    contexto.addIssue({
      code: 'custom',
      path: ['ubicacion_destino_id'],
      message: 'Selecciona la sucursal que recibe el stock inicial',
    })
  }
})

export type ValoresProducto = z.infer<typeof esquema>

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
  const stock = useStockDeProducto(producto?.id)
  const { propias, isLoading: ubicacionesCargando } = useMisUbicaciones()
  const sucursales = propias.filter((ubicacion) => ubicacion.tipo === 'SUCURSAL')

  // `undefined` = no se tocó · Blob = nueva · null = se quitó.
  const [foto, setFoto] = useState<Blob | null | undefined>(undefined)
  const [subiendo, setSubiendo] = useState(false)

  const {
    register, handleSubmit, watch, formState: { errors },
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
      unidad_medida: producto?.unidad_medida?.trim().toUpperCase() ?? 'UNIDAD',
      stock_minimo: producto?.stock_minimo ?? 0,
      stock_inicial: 0,
      ubicacion_destino_id: '',
      activo: producto?.activo ?? true,
    },
  })

  const stockInicial = Number(watch('stock_inicial') ?? 0)
  const saldos = stock.data ?? []
  const stockFisico = saldos.reduce((total: number, fila: any) => total + Number(fila.cantidad), 0)
  const stockReservado = saldos.reduce(
    (total: number, fila: any) => total + Number(fila.cantidad_reservada), 0,
  )
  const stockDisponible = saldos.reduce(
    (total: number, fila: any) => total + Number(fila.cantidad_disponible), 0,
  )

  async function enviar(v: ValoresProducto) {
    const { stock_inicial, ubicacion_destino_id, ...catalogo } = v
    const datos: any = {
      ...catalogo,
      descripcion: v.descripcion?.trim() || null,
      // El select vacío entrega '' y la columna espera null o un uuid válido.
      categoria_id: v.categoria_id || null,
      marca_id: v.marca_id || null,
      ...(!producto ? {
        stock_inicial: Number(stock_inicial ?? 0),
        ubicacion_destino_id: ubicacion_destino_id || null,
      } : {}),
    }
    let imagenNueva: string | null = null
    if (foto !== undefined) {
      setSubiendo(true)
      try {
        imagenNueva = foto
          ? await api.subirImagen(v.sku, foto, extensionDe(foto))
          : null
        datos.imagen_url = imagenNueva
      } catch (e) {
        toast.error(mensajeError(e, 'No se pudo subir la imagen.'))
        setSubiendo(false)
        return
      } finally {
        setSubiendo(false)
      }
    }

    try {
      await guardar.mutateAsync(datos)
    } catch {
      if (imagenNueva) await api.borrarImagen(imagenNueva)
      return
    }

    if (foto !== undefined && producto?.imagen_url) {
      await api.borrarImagen(producto.imagen_url)
    }

    onCerrar()
  }

  // Los selectores deben montarse con sus opciones disponibles. Si se montan
  // vacíos, el navegador descarta el valor inicial del producto y al editar
  // parece que su categoría o marca no estuvieran asignadas.
  if (categorias.isLoading || marcas.isLoading || ubicacionesCargando) {
    return (
      <Modal
        abierto={abierto}
        onCerrar={onCerrar}
        titulo={producto ? 'Editar producto' : 'Nuevo producto'}
      >
        <Cargando />
      </Modal>
    )
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
            placeholder="Ej.: PRD-081"
            maxLength={50}
            autoCapitalize="characters"
            spellCheck={false}
            readOnly={!!producto}
            ayuda={producto
              ? 'El código no cambia al editar'
              : 'Obligatorio y único. Usa letras, números, guiones o guion bajo'}
            error={errors.sku?.message}
            {...register('sku')}
          />
          <Selector etiqueta="Unidad" error={errors.unidad_medida?.message} {...register('unidad_medida')}>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>{u.toLowerCase()}</option>
            ))}
          </Selector>
        </div>

        <Campo
          etiqueta="Nombre"
          placeholder="Aspiradora 1400W"
          maxLength={120}
          error={errors.nombre?.message}
          {...register('nombre')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Selector etiqueta="Categoría" error={errors.categoria_id?.message} {...register('categoria_id')}>
            <option value="">Sin categoría</option>
            {categorias.data?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Selector>
          <Selector etiqueta="Marca" error={errors.marca_id?.message} {...register('marca_id')}>
            <option value="">Sin marca</option>
            {marcas.data?.map((m: any) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </Selector>
        </div>

        <CampoImagen
          rutaActual={producto?.imagen_url ?? null}
          nombre={producto?.nombre ?? ''}
          onElegir={setFoto}
        />

        <Campo
          etiqueta="Stock mínimo"
          type="number" step="1" inputMode="numeric"
          min="0"
          max="999999999"
          ayuda="El sistema avisa cuando el stock baje de aquí"
          error={errors.stock_minimo?.message}
          {...register('stock_minimo')}
        />

        {!producto && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="mb-3 text-sm font-medium text-emerald-950">Existencia inicial</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Stock inicial (opcional)"
                type="number"
                min="0"
                max="999999999"
                step="0.01"
                inputMode="decimal"
                ayuda="Se registrará como una entrada auditada"
                error={errors.stock_inicial?.message}
                {...register('stock_inicial')}
              />
              <Selector
                etiqueta="Sucursal de destino"
                disabled={stockInicial <= 0}
                error={errors.ubicacion_destino_id?.message}
                {...register('ubicacion_destino_id')}
              >
                <option value="">Seleccionar…</option>
                {sucursales.map((ubicacion) => (
                  <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.nombre}</option>
                ))}
              </Selector>
            </div>
          </div>
        )}

        {producto && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">Existencias actuales</p>
            {stock.isLoading ? (
              <Cargando className="py-5" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <ResumenStock titulo="Físico" valor={stockFisico} />
                  <ResumenStock titulo="Reservado" valor={stockReservado} />
                  <ResumenStock titulo="Disponible" valor={stockDisponible} />
                </div>
                {!saldos.length ? (
                  <p className="text-sm text-slate-500">Sin existencias en sucursales ni deliveries.</p>
                ) : (
                  <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                    {saldos.map((fila: any) => (
                      <li key={fila.ubicacion_id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-800">{fila.ubicacion}</p>
                          <p className="text-xs text-slate-500">{fila.tipo_ubicacion.toLowerCase()}</p>
                        </div>
                        <p className="text-right text-sm text-slate-700">
                          {numero(fila.cantidad_disponible)} / {numero(fila.cantidad)}
                          <span className="block text-xs text-slate-400">disponible / físico</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        <div>
          <label htmlFor="descripcion" className="mb-1.5 block text-sm font-medium text-slate-700">
            Descripción
          </label>
          <textarea
            id="descripcion"
            rows={3}
            maxLength={500}
            aria-invalid={!!errors.descripcion}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900
                       focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            {...register('descripcion')}
          />
          {errors.descripcion?.message && (
            <p role="alert" className="mt-1.5 text-sm text-red-600">{errors.descripcion.message}</p>
          )}
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-emerald-600" {...register('activo')} />
          Producto activo
        </label>

        <div className="flex gap-3 pt-2">
          <Boton type="button" variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" className="flex-1" cargando={guardar.isPending || subiendo}>
            {subiendo ? 'Subiendo foto' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

function ResumenStock({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className="font-semibold text-slate-900">{numero(valor)}</p>
    </div>
  )
}

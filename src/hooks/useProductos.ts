import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, type ProductoFormulario } from '@/lib/supabase'
import { mensajeError } from '@/lib/utils'

export const claves = {
  lista: ['productos'] as const,
  uno: (id: string) => ['producto', id] as const,
  stock: (id: string) => ['producto-stock', id] as const,
}

export function useProductos() {
  return useQuery({ queryKey: claves.lista, queryFn: api.productos })
}

export function useProducto(id: string | undefined) {
  return useQuery({
    queryKey: claves.uno(id ?? ''),
    queryFn: () => api.producto(id!),
    enabled: !!id,
  })
}

export function useStockDeProducto(id: string | undefined) {
  return useQuery({
    queryKey: claves.stock(id ?? ''),
    queryFn: () => api.stockDeProducto(id!),
    enabled: !!id,
  })
}

export function useCategorias() {
  // El catálogo de categorías y marcas casi nunca cambia: no vale la pena
  // volver a pedirlo cada vez que se abre el formulario.
  return useQuery({ queryKey: ['categorias'], queryFn: api.categorias, staleTime: 10 * 60_000 })
}

export function useMarcas() {
  return useQuery({ queryKey: ['marcas'], queryFn: api.marcas, staleTime: 10 * 60_000 })
}

export function useGuardarProducto(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datos: ProductoFormulario) =>
      id ? api.actualizarProducto(id, datos) : api.crearProducto(datos),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claves.lista })
      if (id) qc.invalidateQueries({ queryKey: claves.uno(id) })
      toast.success(id ? 'Producto actualizado' : 'Producto creado')
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo guardar el producto.')),
  })
}

export function useActivarProducto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api.desactivarProducto(id, activo),
    onSuccess: (_r, { activo }) => {
      qc.invalidateQueries({ queryKey: claves.lista })
      toast.success(activo ? 'Producto activado' : 'Producto desactivado')
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo cambiar el estado.')),
  })
}

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env')
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: true,   // la sesión sobrevive al cierre de la PWA
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// ---------------------------------------------------------------------
// Capa de datos: toda escritura de stock pasa por una función RPC.
// El frontend nunca hace update sobre `inventario`.
// ---------------------------------------------------------------------

/** Los errores de Postgres llegan crudos; esto los vuelve legibles. */
function traducir(mensaje: string) {
  if (mensaje.includes('productos_sku_key')) return 'Ya existe un producto con ese código SKU.'
  if (mensaje.includes('duplicate key')) return 'Ese registro ya existe.'
  if (mensaje.includes('violates row-level security'))
    return 'Tu rol no tiene permiso para hacer este cambio.'
  if (mensaje.includes('violates foreign key')) return 'Falta seleccionar un dato relacionado.'
  return mensaje
}

/** URL pública de una imagen del bucket `productos` de Supabase Storage. */
export function urlImagen(ruta: string | null | undefined) {
  if (!ruta) return null
  if (ruta.startsWith('http')) return ruta
  return supabase.storage.from('productos').getPublicUrl(ruta).data.publicUrl
}

export type ItemMovimiento = {
  producto_id: string
  cantidad: number
}

/** Una venta registra qué salió y cuánto, nada de dinero. */
export type ItemVenta = {
  producto_id: string
  cantidad: number
}

export type ProductoFormulario = {
  sku: string
  nombre: string
  descripcion?: string | null
  categoria_id?: string | null
  marca_id?: string | null
  unidad_medida: string
  stock_minimo: number
  activo: boolean
}

export const api = {
  // ------------------------------------------------------------- catálogo

  async productos() {
    const { data, error } = await supabase
      .from('productos')
      .select('*, categoria:categorias ( id, nombre ), marca:marcas ( id, nombre )')
      .order('sku')
    if (error) throw error
    return data
  },

  async producto(id: string) {
    const { data, error } = await supabase
      .from('productos')
      .select('*, categoria:categorias ( id, nombre ), marca:marcas ( id, nombre )')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async crearProducto(p: ProductoFormulario) {
    const { data, error } = await supabase.from('productos').insert(p).select().single()
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async actualizarProducto(id: string, p: Partial<ProductoFormulario>) {
    const { data, error } = await supabase
      .from('productos')
      .update({ ...p, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(traducir(error.message))
    return data
  },

  /** Los productos no se borran: se desactivan. El histórico de movimientos
   *  los sigue referenciando y un producto borrado dejaría huecos en el kardex. */
  async desactivarProducto(id: string, activo: boolean) {
    const { error } = await supabase.from('productos').update({ activo }).eq('id', id)
    if (error) throw new Error(traducir(error.message))
  },

  /** Stock del producto en todas las ubicaciones donde queda algo. */
  async stockDeProducto(productoId: string) {
    const { data, error } = await supabase
      .from('v_stock')
      .select('*')
      .eq('producto_id', productoId)
      .gt('cantidad', 0)
      .order('ubicacion')
    if (error) throw error
    return data
  },

  async categorias() {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nombre')
      .eq('activo', true)
      .order('orden')
    if (error) throw error
    return data
  },

  async marcas() {
    const { data, error } = await supabase
      .from('marcas')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return data
  },

  // ----------------------------------------------------------- dashboard

  async dashboard() {
    const { data, error } = await supabase.from('v_dashboard_totales').select('*').single()
    if (error) throw error
    return data
  },

  async stockPorSucursal() {
    const { data, error } = await supabase.from('v_stock_por_sucursal').select('*')
    if (error) throw error
    return data
  },

  async bajoStock() {
    const { data, error } = await supabase
      .from('v_productos_bajo_stock')
      .select('*')
      .order('faltante', { ascending: false })
    if (error) throw error
    return data
  },

  async stockDeUbicacion(ubicacionId: string) {
    const { data, error } = await supabase
      .from('v_stock')
      .select('*')
      .eq('ubicacion_id', ubicacionId)
      .gt('cantidad', 0)
      .order('producto')
    if (error) throw error
    return data
  },

  async kardex(productoId: string) {
    const { data, error } = await supabase
      .from('v_kardex')
      .select('*')
      .eq('producto_id', productoId)
      .limit(200)
    if (error) throw error
    return data
  },

  async registrarMovimiento(args: {
    tipo: string
    origen: string
    destino: string
    items: ItemMovimiento[]
    observaciones?: string
  }) {
    const { data, error } = await supabase.rpc('rpc_registrar_movimiento', {
      p_tipo: args.tipo,
      p_ubicacion_origen_id: args.origen,
      p_ubicacion_destino_id: args.destino,
      p_items: args.items,
      p_observaciones: args.observaciones ?? null,
    })
    // El mensaje del error viene de la base: "Stock insuficiente de X en Y…"
    if (error) throw new Error(error.message)
    return data
  },

  async registrarVenta(args: {
    ubicacionId: string
    items: ItemVenta[]
    clienteId?: string
    estado?: 'ENTREGADA' | 'PENDIENTE'
    observaciones?: string
  }) {
    const { data, error } = await supabase.rpc('rpc_registrar_venta', {
      p_ubicacion_id: args.ubicacionId,
      p_items: args.items,
      p_cliente_id: args.clienteId ?? null,
      p_estado: args.estado ?? 'ENTREGADA',
      p_observaciones: args.observaciones ?? null,
    })
    if (error) throw new Error(error.message)
    return data
  },

  async crearTransferencia(origen: string, destino: string, items: ItemMovimiento[], obs?: string) {
    const { data, error } = await supabase.rpc('rpc_crear_transferencia', {
      p_origen_id: origen,
      p_destino_id: destino,
      p_items: items,
      p_observaciones: obs ?? null,
    })
    if (error) throw new Error(error.message)
    return data
  },

  async enviarTransferencia(id: string) {
    const { data, error } = await supabase.rpc('rpc_enviar_transferencia', { p_transferencia_id: id })
    if (error) throw new Error(error.message)
    return data
  },

  async recibirTransferencia(id: string, recibidos?: { detalle_id: string; cantidad_recibida: number }[]) {
    const { data, error } = await supabase.rpc('rpc_recibir_transferencia', {
      p_transferencia_id: id,
      p_recibidos: recibidos ?? null,
    })
    if (error) throw new Error(error.message)
    return data
  },

  async ajustarStock(productoId: string, ubicacionId: string, contada: number, motivo: string) {
    const { data, error } = await supabase.rpc('rpc_ajustar_stock', {
      p_producto_id: productoId,
      p_ubicacion_id: ubicacionId,
      p_cantidad_contada: contada,
      p_motivo: motivo,
    })
    if (error) throw new Error(error.message)
    return data
  },
}

// ---------------------------------------------------------------------
// Tiempo real: el dashboard del gerente se actualiza solo cuando
// cualquier sucursal registra un movimiento.
// ---------------------------------------------------------------------
export function suscribirInventario(alCambiar: () => void) {
  const canal = supabase
    .channel('inventario-vivo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, alCambiar)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas' }, alCambiar)
    .subscribe()

  return () => { supabase.removeChannel(canal) }
}

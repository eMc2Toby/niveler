import type { Database } from '@/types/database'
import type { ProductoExcel } from '@/lib/excel'
import { supabase } from '@/lib/clienteSupabase'

export { supabase }

// ---------------------------------------------------------------------
// Capa de datos: toda escritura de stock pasa por una función RPC.
// El frontend nunca hace update sobre `inventario`.
// ---------------------------------------------------------------------

/** Los errores de Postgres llegan crudos; esto los vuelve legibles. */
function traducir(mensaje: string) {
  if (mensaje.includes('productos_sku_key')) return 'Ya existe un producto con ese código SKU.'
  if (mensaje.includes('deliveries_usuario_id_key'))
    return 'Esa cuenta ya está vinculada con otro delivery.'
  if (mensaje.includes('deliveries_codigo_key'))
    return 'No se pudo asignar el código automático. Inténtalo nuevamente.'
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

type TipoMovimiento = Database['public']['Enums']['tipo_movimiento']
export type TipoEncomienda = Database['public']['Enums']['tipo_encomienda']
export type EstadoEncomienda = Database['public']['Enums']['estado_encomienda']
type SucursalInsert = Database['public']['Tables']['sucursales']['Insert']
type DeliveryInsert = Database['public']['Tables']['deliveries']['Insert']

export type ProductoFormulario = {
  sku: string
  nombre: string
  descripcion?: string | null
  categoria_id?: string | null
  marca_id?: string | null
  unidad_medida: string
  stock_minimo: number
  activo: boolean
  imagen_url?: string | null
  stock_inicial?: number
  ubicacion_destino_id?: string | null
}

export type ClienteFormulario = {
  nombre: string
  nit_ci?: string | null
  telefono?: string | null
  direccion?: string | null
  ciudad?: string | null
  activo: boolean
  numero_pedido?: string | null
}

export type NuevaEncomienda = {
  tipo: TipoEncomienda
  deliveryOrigenId: string
  descripcion: string
  clienteId?: string
  deliveryDestinoId?: string
  cantidadBultos: number
  pesoKg?: number
  ciudadDestino?: string
  direccionEntrega?: string
  observaciones?: string
}

export const api = {
  // -------------------------------------------------------------- fotos

  /** Sube la foto comprimida al bucket de productos y devuelve su ruta. */
  async subirImagen(sku: string, blob: Blob, extension: string) {
    const skuSeguro = sku.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'producto'
    const ruta = `${skuSeguro}-${Date.now()}.${extension}`
    const { error } = await supabase.storage
      .from('productos')
      .upload(ruta, blob, { contentType: blob.type, cacheControl: '2592000' })
    if (error) {
      if (error.message.includes('row-level security')) {
        throw new Error('Tu rol no tiene permiso para subir imágenes.')
      }
      throw new Error('No se pudo subir la imagen. Revisa tu conexión.')
    }
    return ruta
  },

  /** Borra la foto reemplazada para no dejar archivos huérfanos. */
  async borrarImagen(ruta: string | null | undefined) {
    if (!ruta || ruta.startsWith('http')) return
    await supabase.storage.from('productos').remove([ruta])
  },

  // ------------------------------------------------------------- catálogo

  async productos() {
    const [catalogo, existencias] = await Promise.all([
      supabase
        .from('productos')
        .select('*, categoria:categorias ( id, nombre ), marca:marcas ( id, nombre )')
        .order('sku'),
      supabase
        .from('v_stock')
        .select('producto_id, cantidad, cantidad_reservada, cantidad_disponible'),
    ])
    if (catalogo.error) throw catalogo.error
    if (existencias.error) throw existencias.error

    const porProducto = new Map<string, { total: number; reservado: number; disponible: number }>()
    for (const fila of existencias.data ?? []) {
      if (!fila.producto_id) continue
      const actual = porProducto.get(fila.producto_id) ?? { total: 0, reservado: 0, disponible: 0 }
      actual.total += Number(fila.cantidad)
      actual.reservado += Number(fila.cantidad_reservada)
      actual.disponible += Number(fila.cantidad_disponible)
      porProducto.set(fila.producto_id, actual)
    }

    return (catalogo.data ?? []).map((producto) => {
      const saldo = porProducto.get(producto.id) ?? { total: 0, reservado: 0, disponible: 0 }
      return {
        ...producto,
        stock_total: saldo.total,
        stock_reservado: saldo.reservado,
        stock_disponible: saldo.disponible,
      }
    })
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
    // Supabase genera UUID/text como no-null aunque PostgreSQL permite null en
    // estos parámetros. El cast se limita al contrato RPC; los valores siguen
    // llegando como null real y la función valida las reglas de negocio.
    const argumentos = {
      p_sku: p.sku.trim().toUpperCase(),
      p_nombre: p.nombre,
      p_descripcion: p.descripcion ?? null,
      p_categoria_id: p.categoria_id || null,
      p_marca_id: p.marca_id || null,
      p_unidad_medida: p.unidad_medida,
      p_stock_minimo: p.stock_minimo,
      p_activo: p.activo,
      p_stock_inicial: p.stock_inicial ?? 0,
      p_ubicacion_destino_id: p.ubicacion_destino_id || null,
      p_imagen_url: p.imagen_url ?? null,
    } as unknown as Database['public']['Functions']['rpc_crear_producto_con_stock']['Args']
    const { data, error } = await supabase.rpc('rpc_crear_producto_con_stock', argumentos)
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async actualizarProducto(id: string, p: Partial<ProductoFormulario>) {
    const datos: Database['public']['Tables']['productos']['Update'] = {
      nombre: p.nombre,
      descripcion: p.descripcion,
      categoria_id: p.categoria_id,
      marca_id: p.marca_id,
      unidad_medida: p.unidad_medida,
      stock_minimo: p.stock_minimo,
      activo: p.activo,
      imagen_url: p.imagen_url,
    }
    const { data, error } = await supabase
      .from('productos')
      .update({ ...datos, updated_at: new Date().toISOString() })
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
    // El orden se pide explicito: la vista lo trae, pero PostgREST no
    // garantiza conservarlo y el saldo acumulado depende de la secuencia.
    const { data, error } = await supabase
      .from('v_kardex')
      .select('*')
      .eq('producto_id', productoId)
      .order('fecha', { ascending: false })
      // Desempate: dos movimientos del mismo segundo llegan en orden
      // arbitrario, y el saldo acumulado depende de cuál va primero.
      // El código de documento es secuencial, así que sirve de criterio.
      .order('documento', { ascending: false })
      .limit(300)
    if (error) throw error
    return data
  },

  async registrarMovimiento(args: {
    tipo: TipoMovimiento
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
      p_observaciones: args.observaciones,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async registrarVenta(args: {
    ubicacionId: string
    items: ItemVenta[]
    clienteId?: string
    numeroPedido?: string
    estado?: 'ENTREGADA' | 'PENDIENTE'
    observaciones?: string
  }) {
    const { data, error } = await supabase.rpc('rpc_registrar_venta_con_pedido', {
      p_ubicacion_id: args.ubicacionId,
      p_items: args.items,
      p_cliente_id: args.clienteId,
      p_numero_pedido: args.numeroPedido,
      p_estado: args.estado ?? 'ENTREGADA',
      p_observaciones: args.observaciones,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async crearTransferencia(origen: string, destino: string, items: ItemMovimiento[], obs?: string) {
    const { data, error } = await supabase.rpc('rpc_crear_transferencia', {
      p_origen_id: origen,
      p_destino_id: destino,
      p_items: items,
      p_observaciones: obs,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async enviarTransferencia(id: string) {
    const { data, error } = await supabase.rpc('rpc_enviar_transferencia', {
      p_transferencia_id: id,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  /** Importación atómica: validación, resolución de catálogos y upsert viven en PostgreSQL. */
  async importarProductos(productos: ProductoExcel[]) {
    const { data, error } = await supabase.rpc('rpc_importar_productos', {
      p_productos: productos,
    })
    if (error) throw new Error(traducir(error.message))
    return data as { creados: number; actualizados: number; total: number }
  },

  async anularTransferencia(id: string, motivo: string) {
    const { data, error } = await supabase.rpc('rpc_anular_transferencia', {
      p_transferencia_id: id,
      p_motivo: motivo,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async recibirTransferencia(id: string, recibidos?: { detalle_id: string; cantidad_recibida: number }[]) {
    const { data, error } = await supabase.rpc('rpc_recibir_transferencia', {
      p_transferencia_id: id,
      p_recibidos: recibidos,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async ajustarStock(productoId: string, ubicacionId: string, contada: number, motivo: string) {
    const { data, error } = await supabase.rpc('rpc_ajustar_stock', {
      p_producto_id: productoId,
      p_ubicacion_id: ubicacionId,
      p_cantidad_contada: contada,
      p_motivo: motivo,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  // --------------------------------------------------------- ubicaciones

  /** Todas las ubicaciones activas, para los selectores de origen y destino. */
  async ubicaciones() {
    const { data, error } = await supabase
      .from('ubicaciones')
      .select('id, codigo, nombre, tipo, sucursal_id, delivery_id')
      .eq('activo', true)
      .order('tipo')
      .order('nombre')
    if (error) throw error
    return data
  },

  async sucursales() {
    const { data, error } = await supabase.from('sucursales').select('*').order('ciudad')
    if (error) throw error
    return data
  },

  async guardarSucursal(id: string | null, datos: SucursalInsert) {
    const q = id
      ? supabase.from('sucursales').update(datos).eq('id', id)
      : supabase.from('sucursales').insert(datos)
    const { data, error } = await q.select().single()
    if (error) throw new Error(traducir(error.message))
    return data
  },

  // ---------------------------------------------------------- inventario

  async stock() {
    const { data, error } = await supabase
      .from('v_stock')
      .select('*')
      .gt('cantidad', 0)
      .order('producto')
    if (error) throw error
    return data
  },

  // --------------------------------------------------------- movimientos

  async movimientos(limite = 100) {
    const { data, error } = await supabase.from('movimientos').select(`
        id, codigo, tipo, estado, fecha, observaciones, referencia_tabla, referencia_id,
        origen:ubicaciones!movimientos_ubicacion_origen_id_fkey ( nombre, tipo ),
        destino:ubicaciones!movimientos_ubicacion_destino_id_fkey ( nombre, tipo ),
        usuario:usuarios ( nombre_completo ),
        detalle:movimientos_detalle ( cantidad, producto:productos ( sku, nombre ) )
        `).order('fecha', { ascending: false }).limit(limite)
    if (error) throw error
    return data
  },

  async anularMovimiento(id: string, motivo: string) {
    const { data, error } = await supabase.rpc('sp_anular_movimiento', {
      p_movimiento_id: id,
      p_motivo: motivo,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  // ------------------------------------------------------ transferencias

  async transferencias() {
    const { data, error } = await supabase.from('transferencias').select(`
        id, codigo, estado, fecha_solicitud, fecha_envio, fecha_recepcion, observaciones,
        origen:ubicaciones!transferencias_ubicacion_origen_id_fkey ( id, nombre ),
        destino:ubicaciones!transferencias_ubicacion_destino_id_fkey ( id, nombre ),
        detalle:transferencias_detalle (
          id, cantidad_enviada, cantidad_recibida, producto:productos ( sku, nombre )
        )
        `).order('fecha_solicitud', { ascending: false }).limit(100)
    if (error) throw error
    return data
  },

  // --------------------------------------------------------- encomiendas

  /**
   * Las encomiendas controlan custodia y entrega de bultos. No modifican
   * inventario: una entrega de productos entre ubicaciones sigue usando
   * el flujo transaccional de Transferencias.
   */
  async encomiendas(limite = 150) {
    const { data, error } = await supabase.from('encomiendas').select(`
        id, codigo, tipo, estado, descripcion, cantidad_bultos, peso_kg,
        sucursal_origen_id, usuario_crea_id,
        ciudad_destino, direccion_entrega, observaciones, motivo_anulacion,
        fecha_registro, fecha_despacho, fecha_entrega,
        cliente:clientes ( id, nombre, telefono, ciudad, direccion ),
        origen:deliveries!encomiendas_delivery_origen_id_fkey (
          id, codigo, nombre, telefono, sucursal_base_id,
          sucursal:sucursales ( nombre, ciudad )
        ),
        destino:deliveries!encomiendas_delivery_destino_id_fkey (
          id, codigo, nombre, telefono, sucursal_base_id,
          sucursal:sucursales ( nombre, ciudad )
        ),
        usuario_crea:usuarios!encomiendas_usuario_crea_id_fkey ( nombre_completo )
        `).order('fecha_registro', { ascending: false }).limit(limite)
    if (error) throw error
    return data
  },

  async crearEncomienda(args: NuevaEncomienda) {
    const { data, error } = await supabase.rpc('rpc_crear_encomienda', {
      p_tipo: args.tipo,
      p_delivery_origen_id: args.deliveryOrigenId,
      p_descripcion: args.descripcion,
      p_cliente_id: args.clienteId,
      p_delivery_destino_id: args.deliveryDestinoId,
      p_cantidad_bultos: args.cantidadBultos,
      p_peso_kg: args.pesoKg,
      p_ciudad_destino: args.ciudadDestino,
      p_direccion_entrega: args.direccionEntrega,
      p_observaciones: args.observaciones,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async despacharEncomienda(id: string) {
    const { data, error } = await supabase.rpc('rpc_despachar_encomienda', {
      p_encomienda_id: id,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async entregarEncomienda(id: string) {
    const { data, error } = await supabase.rpc('rpc_entregar_encomienda', {
      p_encomienda_id: id,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async anularEncomienda(id: string, motivo: string) {
    const { data, error } = await supabase.rpc('rpc_anular_encomienda', {
      p_encomienda_id: id,
      p_motivo: motivo,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  // --------------------------------------------------------------ventas

  async ventas(limite = 100) {
    const { data, error } = await supabase.from('ventas').select(`
        id, codigo, fecha, estado, observaciones,
        cliente:clientes ( id, nombre ),
        pedido:cliente_pedidos ( id, numero ),
        sucursal:sucursales ( nombre, ciudad ),
        delivery:deliveries ( nombre ),
        usuario:usuarios ( nombre_completo ),
        detalle:ventas_detalle ( cantidad, producto:productos ( sku, nombre ) )
        `).order('fecha', { ascending: false }).limit(limite)
    if (error) throw error
    return data
  },

  /** Convierte una reserva pendiente en una salida real de stock. */
  async entregarVenta(ventaId: string) {
    const { data, error } = await supabase.rpc('rpc_entregar_venta', { p_venta_id: ventaId })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  /**
   * Anula la venta y su efecto de stock en una sola transacción de base.
   * Si estaba pendiente libera la reserva; si fue entregada revierte la salida.
   */
  async anularVenta(ventaId: string, motivo: string) {
    const { data, error } = await supabase.rpc('rpc_anular_venta', {
      p_venta_id: ventaId,
      p_motivo: motivo,
    })
    if (error) throw new Error(traducir(error.message))
    return data
  },

  // ------------------------------------------------------------ clientes

  async clientes() {
    const { data, error } = await supabase
      .from('clientes')
      .select('*, pedidos:cliente_pedidos ( id, numero, activo, created_at )')
      .order('nombre')
    if (error) throw error
    return data
  },

  async guardarCliente(id: string | null, datos: ClienteFormulario) {
    const argumentos = {
      p_cliente_id: id,
      p_nombre: datos.nombre,
      p_nit_ci: datos.nit_ci ?? null,
      p_telefono: datos.telefono ?? null,
      p_direccion: datos.direccion ?? null,
      p_ciudad: datos.ciudad ?? null,
      p_activo: datos.activo,
      p_numero_pedido: datos.numero_pedido ?? null,
    } as unknown as Database['public']['Functions']['rpc_guardar_cliente']['Args']
    const { data, error } = await supabase.rpc('rpc_guardar_cliente', argumentos)
    if (error) throw new Error(traducir(error.message))
    return data
  },

  // ---------------------------------------------------------- deliveries

  async deliveries() {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*, sucursal:sucursales ( nombre, ciudad ), usuario:usuarios ( nombre_completo, email )')
      .order('nombre')
    if (error) throw error
    return data
  },

  /** Cuentas con rol DELIVERY, para vincularlas con su ficha. */
  async usuariosDelivery() {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email, rol:roles!inner ( codigo )')
      .eq('roles.codigo', 'DELIVERY')
      .order('nombre_completo')
    if (error) throw error
    return data
  },

  async guardarDelivery(id: string | null, datos: Omit<DeliveryInsert, 'codigo'>) {
    const q = id
      ? supabase.from('deliveries').update(datos).eq('id', id)
      : supabase.from('deliveries').insert(datos)
    const { data, error } = await q.select().single()
    if (error) throw new Error(traducir(error.message))
    return data
  },

  async stockPorDelivery() {
    const { data, error } = await supabase.from('v_stock_por_delivery').select('*')
    if (error) throw error
    return data
  },

  async rendicion(deliveryId: string) {
    const { data, error } = await supabase
      .from('v_delivery_rendicion')
      .select('*')
      .eq('delivery_id', deliveryId)
      .order('producto')
    if (error) throw error
    return data
  },

  // ------------------------------------------------------------ usuarios

  async usuarios() {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email, telefono, activo, ultimo_acceso, rol:roles ( id, codigo, nombre, nivel ), sucursal:sucursales ( id, nombre, ciudad )')
      .order('nombre_completo')
    if (error) throw error
    return data
  },

  async roles() {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('nivel', { ascending: false })
    if (error) throw error
    return data
  },

  async actualizarUsuario(
    id: string,
    datos: { rol_id?: number; sucursal_id?: string | null; activo?: boolean },
  ) {
    const { error } = await supabase.from('usuarios').update(datos).eq('id', id)
    if (error) throw new Error(traducir(error.message))
  },

  // ------------------------------------------------------------ reportes

  async masVendidos() {
    const { data, error } = await supabase
      .from('v_productos_mas_vendidos')
      .select('*')
      .order('unidades_vendidas', { ascending: false })
      .limit(50)
    if (error) throw error
    return data
  },

  async sinMovimiento() {
    const { data, error } = await supabase
      .from('v_productos_sin_movimiento')
      .select('*')
      .order('dias_sin_movimiento', { ascending: false, nullsFirst: true })
      .limit(100)
    if (error) throw error
    return data
  },

  async ventasDiarias() {
    const { data, error } = await supabase
      .from('v_ventas_diarias')
      .select('*')
      .order('dia', { ascending: false })
      .limit(60)
    if (error) throw error
    return data
  },

  // ----------------------------------------------------------- auditoría

  async auditoria(filtros: {
    tabla?: string
    accion?: 'INSERT' | 'UPDATE' | 'DELETE' | ''
    desde?: string
    hasta?: string
    limite?: number
  } = {}) {
    const limite = Math.min(Math.max(filtros.limite ?? 200, 1), 500)
    const { data, error } = await supabase.rpc('rpc_consultar_auditoria', {
      p_tabla: filtros.tabla || undefined,
      p_accion: filtros.accion || undefined,
      p_desde: filtros.desde || undefined,
      p_hasta: filtros.hasta || undefined,
      p_limite: limite,
    })
    if (error) throw error
    const filas = (data ?? []) as any[]
    return { filas, total: Number(filas[0]?.total ?? 0) }
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

/**
 * Tipos de la base de datos.
 *
 * Este archivo es un PUENTE temporal: describe lo justo para que el cliente
 * de Supabase tipe las tablas y vistas que ya usa la app. En cuanto exista el
 * proyecto en Supabase, se reemplaza entero por el generado:
 *
 *   npx supabase login
 *   npx supabase gen types typescript --project-id TU_ID > src/types/database.ts
 *
 * A partir de ahí no se edita a mano: se regenera cada vez que cambie el esquema.
 */

type Json = string | number | boolean | null | { [k: string]: Json } | Json[]

/** Fila genérica mientras no existan los tipos generados. */
type Fila = Record<string, any>

type Tabla<Row extends Fila> = {
  Row: Row
  // Escrituras sin tipar a proposito: estos tipos son un puente hasta que
  // exista el generado por Supabase, y ahi los defaults y las columnas
  // generadas ya vienen resueltos. Row si esta tipado, que es lo que se lee.
  Insert: Record<string, any>
  Update: Record<string, any>
  Relationships: []
}

type Vista<Row extends Fila> = { Row: Row; Relationships: [] }

export type Rol = {
  id: number
  codigo: string
  nombre: string
  nivel: number
  permisos: Json
  created_at: string
}

export type Sucursal = {
  id: string
  codigo: string
  nombre: string
  ciudad: string
  direccion: string | null
  telefono: string | null
  activo: boolean
  created_at: string
}

export type Usuario = {
  id: string
  rol_id: number
  nombre_completo: string
  email: string
  telefono: string | null
  sucursal_id: string | null
  avatar_url: string | null
  activo: boolean
  ultimo_acceso: string | null
  created_at: string
  updated_at: string
}

export type Producto = {
  id: string
  sku: string
  nombre: string
  descripcion: string | null
  categoria_id: string | null
  marca_id: string | null
  unidad_medida: string
  imagen_url: string | null
  stock_minimo: number
  activo: boolean
  created_at: string
  updated_at: string
}

export type Categoria = {
  id: string
  nombre: string
  descripcion: string | null
  parent_id: string | null
  orden: number
  activo: boolean
  created_at: string
}

export type Marca = { id: string; nombre: string; activo: boolean }

export type Ubicacion = {
  id: string
  codigo: string
  nombre: string
  tipo: 'SUCURSAL' | 'DELIVERY' | 'TRANSITO' | 'MERMA' | 'PROVEEDOR' | 'CLIENTE'
  sucursal_id: string | null
  delivery_id: string | null
  activo: boolean
  created_at: string
}

export type FilaStock = {
  id: string
  producto_id: string
  sku: string
  producto: string
  imagen_url: string | null
  stock_minimo: number
  categoria: string | null
  marca: string | null
  ubicacion_id: string
  ubicacion: string
  tipo_ubicacion: Ubicacion['tipo']
  sucursal_id: string | null
  sucursal: string | null
  delivery_id: string | null
  delivery: string | null
  cantidad: number
  cantidad_reservada: number
  cantidad_disponible: number
  actualizado_en: string
}

export type Database = {
  public: {
    Tables: {
      roles: Tabla<Rol>
      sucursales: Tabla<Sucursal>
      usuarios: Tabla<Usuario>
      deliveries: Tabla<Fila>
      ubicaciones: Tabla<Ubicacion>
      categorias: Tabla<Categoria>
      marcas: Tabla<Marca>
      productos: Tabla<Producto>
      inventario: Tabla<Fila>
      movimientos: Tabla<Fila>
      movimientos_detalle: Tabla<Fila>
      transferencias: Tabla<Fila>
      transferencias_detalle: Tabla<Fila>
      ventas: Tabla<Fila>
      ventas_detalle: Tabla<Fila>
      clientes: Tabla<Fila>
      auditoria: Tabla<Fila>
    }
    Views: {
      v_stock: Vista<FilaStock>
      v_dashboard_totales: Vista<Fila>
      v_stock_por_sucursal: Vista<Fila>
      v_stock_por_delivery: Vista<Fila>
      v_productos_bajo_stock: Vista<Fila>
      v_kardex: Vista<Fila>
      v_productos_mas_vendidos: Vista<Fila>
      v_productos_sin_movimiento: Vista<Fila>
      v_ventas_diarias: Vista<Fila>
      v_delivery_rendicion: Vista<Fila>
    }
    Functions: {
      [nombre: string]: { Args: Record<string, any>; Returns: any }
    }
    Enums: {
      tipo_ubicacion: Ubicacion['tipo']
    }
    CompositeTypes: Record<string, never>
  }
}

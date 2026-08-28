export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          accion: Database["public"]["Enums"]["accion_auditoria"]
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          fecha: string
          id: number
          registro_id: string
          tabla: string
          usuario_id: string | null
        }
        Insert: {
          accion: Database["public"]["Enums"]["accion_auditoria"]
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          fecha?: string
          id?: number
          registro_id: string
          tabla: string
          usuario_id?: string | null
        }
        Update: {
          accion?: Database["public"]["Enums"]["accion_auditoria"]
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          fecha?: string
          id?: number
          registro_id?: string
          tabla?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          orden: number
          parent_id: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number
          parent_id?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean
          ciudad: string | null
          codigo: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          nit_ci: string | null
          nombre: string
          notas: string | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          ciudad?: string | null
          codigo?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nit_ci?: string | null
          nombre: string
          notas?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          ciudad?: string | null
          codigo?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nit_ci?: string | null
          nombre?: string
          notas?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          activo: boolean
          ci: string | null
          codigo: string
          created_at: string
          id: string
          nombre: string
          sucursal_base_id: string
          telefono: string | null
          usuario_id: string | null
          vehiculo: string | null
        }
        Insert: {
          activo?: boolean
          ci?: string | null
          codigo: string
          created_at?: string
          id?: string
          nombre: string
          sucursal_base_id: string
          telefono?: string | null
          usuario_id?: string | null
          vehiculo?: string | null
        }
        Update: {
          activo?: boolean
          ci?: string | null
          codigo?: string
          created_at?: string
          id?: string
          nombre?: string
          sucursal_base_id?: string
          telefono?: string | null
          usuario_id?: string | null
          vehiculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sucursal_base_id_fkey"
            columns: ["sucursal_base_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_sucursal_base_id_fkey"
            columns: ["sucursal_base_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "deliveries_sucursal_base_id_fkey"
            columns: ["sucursal_base_id"]
            isOneToOne: false
            referencedRelation: "v_stock_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "deliveries_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario: {
        Row: {
          actualizado_en: string
          cantidad: number
          cantidad_disponible: number | null
          cantidad_reservada: number
          id: string
          producto_id: string
          ubicacion_id: string
        }
        Insert: {
          actualizado_en?: string
          cantidad?: number
          cantidad_disponible?: number | null
          cantidad_reservada?: number
          id?: string
          producto_id: string
          ubicacion_id: string
        }
        Update: {
          actualizado_en?: string
          cantidad?: number
          cantidad_disponible?: number | null
          cantidad_reservada?: number
          id?: string
          producto_id?: string
          ubicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_rendicion"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_bajo_stock"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mas_vendidos"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_sin_movimiento"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "inventario_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_destino_id"]
          },
          {
            foreignKeyName: "inventario_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_origen_id"]
          },
          {
            foreignKeyName: "inventario_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["ubicacion_id"]
          },
        ]
      }
      marcas: {
        Row: {
          activo: boolean
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      movimientos: {
        Row: {
          codigo: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_movimiento"]
          fecha: string
          id: string
          observaciones: string | null
          referencia_id: string | null
          referencia_tabla: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          ubicacion_destino_id: string
          ubicacion_origen_id: string
          usuario_id: string | null
        }
        Insert: {
          codigo: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_movimiento"]
          fecha?: string
          id?: string
          observaciones?: string | null
          referencia_id?: string | null
          referencia_tabla?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          ubicacion_destino_id: string
          ubicacion_origen_id: string
          usuario_id?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_movimiento"]
          fecha?: string
          id?: string
          observaciones?: string | null
          referencia_id?: string | null
          referencia_tabla?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          ubicacion_destino_id?: string
          ubicacion_origen_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_ubicacion_destino_id_fkey"
            columns: ["ubicacion_destino_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_ubicacion_destino_id_fkey"
            columns: ["ubicacion_destino_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_destino_id"]
          },
          {
            foreignKeyName: "movimientos_ubicacion_destino_id_fkey"
            columns: ["ubicacion_destino_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_origen_id"]
          },
          {
            foreignKeyName: "movimientos_ubicacion_destino_id_fkey"
            columns: ["ubicacion_destino_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["ubicacion_id"]
          },
          {
            foreignKeyName: "movimientos_ubicacion_origen_id_fkey"
            columns: ["ubicacion_origen_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_ubicacion_origen_id_fkey"
            columns: ["ubicacion_origen_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_destino_id"]
          },
          {
            foreignKeyName: "movimientos_ubicacion_origen_id_fkey"
            columns: ["ubicacion_origen_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_origen_id"]
          },
          {
            foreignKeyName: "movimientos_ubicacion_origen_id_fkey"
            columns: ["ubicacion_origen_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["ubicacion_id"]
          },
          {
            foreignKeyName: "movimientos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_detalle: {
        Row: {
          cantidad: number
          id: string
          movimiento_id: string
          observacion: string | null
          producto_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          movimiento_id: string
          observacion?: string | null
          producto_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          movimiento_id?: string
          observacion?: string | null
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_detalle_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_rendicion"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_bajo_stock"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mas_vendidos"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_sin_movimiento"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          categoria_id: string | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          marca_id: string | null
          nombre: string
          sku: string
          stock_minimo: number
          unidad_medida: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_id?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          marca_id?: string | null
          nombre: string
          sku: string
          stock_minimo?: number
          unidad_medida?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          marca_id?: string | null
          nombre?: string
          sku?: string
          stock_minimo?: number
          unidad_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          codigo: string
          created_at: string
          id: number
          nivel: number
          nombre: string
          permisos: Json
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: number
          nivel?: number
          nombre: string
          permisos?: Json
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: number
          nivel?: number
          nombre?: string
          permisos?: Json
        }
        Relationships: []
      }
      sucursales: {
        Row: {
          activo: boolean
          ciudad: string
          codigo: string
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          ciudad: string
          codigo: string
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          ciudad?: string
          codigo?: string
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      transferencias: {
        Row: {
          codigo: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_transferencia"]
          fecha_envio: string | null
          fecha_recepcion: string | null
          fecha_solicitud: string
          id: string
          observaciones: string | null
          ubicacion_destino_id: string
          ubicacion_origen_id: string
          usuario_envia_id: string | null
          usuario_recibe_id: string | null
          usuario_solicita_id: string | null
        }
        Insert: {
          codigo: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_transferencia"]
          fecha_envio?: string | null
          fecha_recepcion?: string | null
          fecha_solicitud?: string
          id?: string
          observaciones?: string | null
          ubicacion_destino_id: string
          ubicacion_origen_id: string
          usuario_envia_id?: string | null
          usuario_recibe_id?: string | null
          usuario_solicita_id?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_transferencia"]
          fecha_envio?: string | null
          fecha_recepcion?: string | null
          fecha_solicitud?: string
          id?: string
          observaciones?: string | null
          ubicacion_destino_id?: string
          ubicacion_origen_id?: string
          usuario_envia_id?: string | null
          usuario_recibe_id?: string | null
          usuario_solicita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_ubicacion_destino_id_fkey"
            columns: ["ubicacion_destino_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_ubicacion_destino_id_fkey"
            columns: ["ubicacion_destino_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_destino_id"]
          },
          {
            foreignKeyName: "transferencias_ubicacion_destino_id_fkey"
            columns: ["ubicacion_destino_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_origen_id"]
          },
          {
            foreignKeyName: "transferencias_ubicacion_destino_id_fkey"
            columns: ["ubicacion_destino_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["ubicacion_id"]
          },
          {
            foreignKeyName: "transferencias_ubicacion_origen_id_fkey"
            columns: ["ubicacion_origen_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_ubicacion_origen_id_fkey"
            columns: ["ubicacion_origen_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_destino_id"]
          },
          {
            foreignKeyName: "transferencias_ubicacion_origen_id_fkey"
            columns: ["ubicacion_origen_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_origen_id"]
          },
          {
            foreignKeyName: "transferencias_ubicacion_origen_id_fkey"
            columns: ["ubicacion_origen_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["ubicacion_id"]
          },
          {
            foreignKeyName: "transferencias_usuario_envia_id_fkey"
            columns: ["usuario_envia_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_usuario_recibe_id_fkey"
            columns: ["usuario_recibe_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_usuario_solicita_id_fkey"
            columns: ["usuario_solicita_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias_detalle: {
        Row: {
          cantidad_enviada: number
          cantidad_recibida: number | null
          id: string
          observacion: string | null
          producto_id: string
          transferencia_id: string
        }
        Insert: {
          cantidad_enviada: number
          cantidad_recibida?: number | null
          id?: string
          observacion?: string | null
          producto_id: string
          transferencia_id: string
        }
        Update: {
          cantidad_enviada?: number
          cantidad_recibida?: number | null
          id?: string
          observacion?: string | null
          producto_id?: string
          transferencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_rendicion"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "transferencias_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_bajo_stock"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "transferencias_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mas_vendidos"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "transferencias_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_sin_movimiento"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "transferencias_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "transferencias_detalle_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias"
            referencedColumns: ["id"]
          },
        ]
      }
      ubicaciones: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          delivery_id: string | null
          id: string
          nombre: string
          sucursal_id: string | null
          tipo: Database["public"]["Enums"]["tipo_ubicacion"]
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          nombre: string
          sucursal_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_ubicacion"]
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          nombre?: string
          sucursal_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_ubicacion"]
        }
        Relationships: [
          {
            foreignKeyName: "ubicaciones_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubicaciones_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_rendicion"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "ubicaciones_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "ubicaciones_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v_stock_por_delivery"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "ubicaciones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubicaciones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "ubicaciones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_stock_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      usuarios: {
        Row: {
          activo: boolean
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nombre_completo: string
          rol_id: number
          sucursal_id: string | null
          telefono: string | null
          ultimo_acceso: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nombre_completo: string
          rol_id: number
          sucursal_id?: string | null
          telefono?: string | null
          ultimo_acceso?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre_completo?: string
          rol_id?: number
          sucursal_id?: string | null
          telefono?: string | null
          ultimo_acceso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "usuarios_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_stock_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
      ventas: {
        Row: {
          cliente_id: string | null
          codigo: string
          created_at: string
          delivery_id: string | null
          estado: Database["public"]["Enums"]["estado_venta"]
          fecha: string
          id: string
          observaciones: string | null
          sucursal_id: string | null
          ubicacion_id: string
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          codigo: string
          created_at?: string
          delivery_id?: string | null
          estado?: Database["public"]["Enums"]["estado_venta"]
          fecha?: string
          id?: string
          observaciones?: string | null
          sucursal_id?: string | null
          ubicacion_id: string
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          codigo?: string
          created_at?: string
          delivery_id?: string | null
          estado?: Database["public"]["Enums"]["estado_venta"]
          fecha?: string
          id?: string
          observaciones?: string | null
          sucursal_id?: string | null
          ubicacion_id?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_rendicion"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "ventas_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "ventas_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v_stock_por_delivery"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_stock_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "ventas_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_destino_id"]
          },
          {
            foreignKeyName: "ventas_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "v_kardex"
            referencedColumns: ["ubicacion_origen_id"]
          },
          {
            foreignKeyName: "ventas_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["ubicacion_id"]
          },
          {
            foreignKeyName: "ventas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas_detalle: {
        Row: {
          cantidad: number
          id: string
          producto_id: string
          venta_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          producto_id: string
          venta_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          producto_id?: string
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_rendicion"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "ventas_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_bajo_stock"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "ventas_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mas_vendidos"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "ventas_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_sin_movimiento"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "ventas_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "ventas_detalle_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_dashboard_totales: {
        Row: {
          productos_bajo_stock: number | null
          stock_deliveries: number | null
          stock_sucursales: number | null
          stock_total: number | null
          transferencias_pendientes: number | null
          unidades_hoy: number | null
          ventas_hoy_cantidad: number | null
        }
        Relationships: []
      }
      v_delivery_rendicion: {
        Row: {
          delivery: string | null
          delivery_id: string | null
          en_poder: number | null
          producto: string | null
          producto_id: string | null
          sku: string | null
          total_recibido: number | null
          total_retornado: number | null
          total_vendido: number | null
        }
        Relationships: []
      }
      v_kardex: {
        Row: {
          cantidad: number | null
          destino: string | null
          documento: string | null
          fecha: string | null
          id: string | null
          observaciones: string | null
          origen: string | null
          producto: string | null
          producto_id: string | null
          referencia_id: string | null
          referencia_tabla: string | null
          sku: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"] | null
          tipo_destino: Database["public"]["Enums"]["tipo_ubicacion"] | null
          tipo_origen: Database["public"]["Enums"]["tipo_ubicacion"] | null
          ubicacion_destino_id: string | null
          ubicacion_origen_id: string | null
          usuario: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_delivery_rendicion"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_bajo_stock"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_mas_vendidos"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_sin_movimiento"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "movimientos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      v_productos_bajo_stock: {
        Row: {
          categoria: string | null
          faltante: number | null
          imagen_url: string | null
          producto: string | null
          producto_id: string | null
          sku: string | null
          stock_minimo: number | null
          stock_sucursales: number | null
          stock_total: number | null
        }
        Relationships: []
      }
      v_productos_mas_vendidos: {
        Row: {
          categoria: string | null
          numero_ventas: number | null
          producto: string | null
          producto_id: string | null
          sku: string | null
          ultima_venta: string | null
          unidades_vendidas: number | null
        }
        Relationships: []
      }
      v_productos_sin_movimiento: {
        Row: {
          categoria: string | null
          dias_sin_movimiento: number | null
          producto: string | null
          producto_id: string | null
          sku: string | null
          stock_actual: number | null
          ultimo_movimiento: string | null
        }
        Relationships: []
      }
      v_stock: {
        Row: {
          actualizado_en: string | null
          cantidad: number | null
          cantidad_disponible: number | null
          cantidad_reservada: number | null
          categoria: string | null
          delivery: string | null
          delivery_id: string | null
          id: string | null
          imagen_url: string | null
          marca: string | null
          producto: string | null
          producto_id: string | null
          sku: string | null
          stock_minimo: number | null
          sucursal: string | null
          sucursal_id: string | null
          tipo_ubicacion: Database["public"]["Enums"]["tipo_ubicacion"] | null
          ubicacion: string | null
          ubicacion_id: string | null
        }
        Relationships: []
      }
      v_stock_por_delivery: {
        Row: {
          codigo: string | null
          delivery: string | null
          delivery_id: string | null
          productos_distintos: number | null
          sucursal_base: string | null
          unidades: number | null
        }
        Relationships: []
      }
      v_stock_por_sucursal: {
        Row: {
          ciudad: string | null
          codigo: string | null
          productos_distintos: number | null
          sucursal: string | null
          sucursal_id: string | null
          unidades: number | null
        }
        Relationships: []
      }
      v_ventas_diarias: {
        Row: {
          dia: string | null
          numero_ventas: number | null
          sucursal: string | null
          sucursal_id: string | null
          unidades: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["sucursal_id"]
          },
          {
            foreignKeyName: "ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "v_stock_por_sucursal"
            referencedColumns: ["sucursal_id"]
          },
        ]
      }
    }
    Functions: {
      auth_delivery_id: { Args: never; Returns: string }
      auth_nivel: { Args: never; Returns: number }
      auth_puede_ver_ubicacion: {
        Args: { p_ubicacion_id: string }
        Returns: boolean
      }
      auth_sucursal_id: { Args: never; Returns: string }
      fn_aplicar_delta: {
        Args: { p_delta: number; p_producto_id: string; p_ubicacion_id: string }
        Returns: undefined
      }
      fn_exigir_nivel: {
        Args: { p_accion: string; p_minimo: number }
        Returns: undefined
      }
      fn_generar_codigo: {
        Args: { p_prefijo: string; p_secuencia: string }
        Returns: string
      }
      fn_recalcular_inventario: { Args: never; Returns: number }
      fn_revertir_movimiento: {
        Args: { p_motivo: string; p_movimiento_id: string }
        Returns: {
          codigo: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_movimiento"]
          fecha: string
          id: string
          observaciones: string | null
          referencia_id: string | null
          referencia_tabla: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          ubicacion_destino_id: string
          ubicacion_origen_id: string
          usuario_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "movimientos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_ajustar_stock: {
        Args: {
          p_cantidad_contada: number
          p_motivo: string
          p_producto_id: string
          p_ubicacion_id: string
        }
        Returns: Json
      }
      rpc_anular_transferencia: {
        Args: { p_motivo: string; p_transferencia_id: string }
        Returns: Json
      }
      rpc_anular_venta: {
        Args: { p_motivo: string; p_venta_id: string }
        Returns: Json
      }
      rpc_consultar_auditoria: {
        Args: {
          p_accion?: Database["public"]["Enums"]["accion_auditoria"]
          p_desde?: string
          p_hasta?: string
          p_limite?: number
          p_tabla?: string
        }
        Returns: {
          accion: Database["public"]["Enums"]["accion_auditoria"]
          datos_anteriores: Json
          datos_nuevos: Json
          fecha: string
          id: number
          registro_id: string
          tabla: string
          total: number
          usuario_email: string
          usuario_id: string
          usuario_nombre: string
        }[]
      }
      rpc_crear_transferencia: {
        Args: {
          p_destino_id: string
          p_items: Json
          p_observaciones?: string
          p_origen_id: string
        }
        Returns: Json
      }
      rpc_entregar_venta: { Args: { p_venta_id: string }; Returns: Json }
      rpc_enviar_transferencia: {
        Args: { p_transferencia_id: string }
        Returns: Json
      }
      rpc_importar_productos: { Args: { p_productos: Json }; Returns: Json }
      rpc_recibir_transferencia: {
        Args: { p_recibidos?: Json; p_transferencia_id: string }
        Returns: Json
      }
      rpc_registrar_movimiento: {
        Args: {
          p_items: Json
          p_observaciones?: string
          p_tipo: Database["public"]["Enums"]["tipo_movimiento"]
          p_ubicacion_destino_id: string
          p_ubicacion_origen_id: string
        }
        Returns: Json
      }
      rpc_registrar_venta: {
        Args: {
          p_cliente_id?: string
          p_estado?: Database["public"]["Enums"]["estado_venta"]
          p_items: Json
          p_observaciones?: string
          p_ubicacion_id: string
        }
        Returns: Json
      }
      sp_anular_movimiento: {
        Args: { p_motivo: string; p_movimiento_id: string }
        Returns: {
          codigo: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_movimiento"]
          fecha: string
          id: string
          observaciones: string | null
          referencia_id: string | null
          referencia_tabla: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          ubicacion_destino_id: string
          ubicacion_origen_id: string
          usuario_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "movimientos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sp_confirmar_movimiento: {
        Args: { p_movimiento_id: string }
        Returns: {
          codigo: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_movimiento"]
          fecha: string
          id: string
          observaciones: string | null
          referencia_id: string | null
          referencia_tabla: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          ubicacion_destino_id: string
          ubicacion_origen_id: string
          usuario_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "movimientos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      accion_auditoria: "INSERT" | "UPDATE" | "DELETE"
      estado_movimiento: "BORRADOR" | "CONFIRMADO" | "ANULADO"
      estado_transferencia:
        | "BORRADOR"
        | "ENVIADA"
        | "RECIBIDA_PARCIAL"
        | "RECIBIDA"
        | "ANULADA"
      estado_venta: "PENDIENTE" | "ENTREGADA" | "ANULADA"
      tipo_movimiento:
        | "ENTRADA"
        | "SALIDA"
        | "TRANSFERENCIA"
        | "ENTREGA_DELIVERY"
        | "RETORNO_DELIVERY"
        | "TRANSFERENCIA_DELIVERY"
        | "VENTA"
        | "DEVOLUCION"
        | "AJUSTE"
      tipo_ubicacion:
        | "SUCURSAL"
        | "DELIVERY"
        | "TRANSITO"
        | "MERMA"
        | "PROVEEDOR"
        | "CLIENTE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      accion_auditoria: ["INSERT", "UPDATE", "DELETE"],
      estado_movimiento: ["BORRADOR", "CONFIRMADO", "ANULADO"],
      estado_transferencia: [
        "BORRADOR",
        "ENVIADA",
        "RECIBIDA_PARCIAL",
        "RECIBIDA",
        "ANULADA",
      ],
      estado_venta: ["PENDIENTE", "ENTREGADA", "ANULADA"],
      tipo_movimiento: [
        "ENTRADA",
        "SALIDA",
        "TRANSFERENCIA",
        "ENTREGA_DELIVERY",
        "RETORNO_DELIVERY",
        "TRANSFERENCIA_DELIVERY",
        "VENTA",
        "DEVOLUCION",
        "AJUSTE",
      ],
      tipo_ubicacion: [
        "SUCURSAL",
        "DELIVERY",
        "TRANSITO",
        "MERMA",
        "PROVEEDOR",
        "CLIENTE",
      ],
    },
  },
} as const

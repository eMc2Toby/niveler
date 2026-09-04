import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(import.meta.dirname, '../..')
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8')

const migracion = leer('db/20_sku_producto_automatico.sql')
const productos = leer('src/features/productos/Formulario.tsx')
const clientes = leer('src/features/clientes/Clientes.tsx')
const ventas = leer('src/features/ventas/Ventas.tsx')
const transferencias = leer('src/features/transferencias/Transferencias.tsx')
const inventario = leer('src/features/inventario/Inventario.tsx')
const datos = leer('src/lib/supabase.ts')

describe('catálogo y operación con deliveries', () => {
  it('genera SKU numérico en PostgreSQL y conserva el endpoint anterior', () => {
    expect(migracion).toContain('create sequence if not exists seq_producto_sku')
    expect(migracion).toContain("where trim(sku) ~ '^[0-9]+$'")
    expect(migracion).toContain("new.sku := nextval('seq_producto_sku')::text")
    expect(migracion).toContain('rpc_crear_producto_con_stock_auto')
    expect(migracion).not.toContain('drop function if exists rpc_crear_producto_con_stock(')
    expect(productos).toContain('Código (SKU automático)')
    expect(productos).not.toContain("register('sku')")
  })

  it('usa los nueve departamentos y ya no muestra NIT/CI al cliente', () => {
    for (const departamento of [
      'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro',
      'Pando', 'Potosí', 'Santa Cruz', 'Tarija',
    ]) {
      expect(clientes).toContain(`'${departamento}'`)
    }
    expect(clientes).toContain('etiqueta="Departamento"')
    expect(clientes).not.toContain('etiqueta="NIT o CI"')
    expect(clientes).not.toContain('Buscar por nombre, NIT')
  })

  it('atribuye la venta al delivery mediante su ubicación de stock', () => {
    expect(ventas).toContain('etiqueta="Delivery que realizó la venta"')
    expect(ventas).toContain("ubicacion.delivery_id")
    expect(ventas).toContain('setUbicacionId(destino?.ubicacion.id')
    expect(datos).toContain("delivery:deliveries ( nombre )")
  })

  it('permite transferencias entre bodegas y deliveries', () => {
    expect(transferencias).toMatch(/u\.tipo === 'SUCURSAL' \|\| u\.tipo === 'DELIVERY'/)
    expect(transferencias).toContain('etiquetaUbicacion(u)')
    expect(transferencias).toContain("? 'Delivery' : 'Bodega'")
  })

  it('agrupa el inventario por producto y detalla sus ubicaciones', () => {
    expect(inventario).toContain('new Map<string, any>()')
    expect(inventario).toContain('porProducto.get(saldo.producto_id)')
    expect(inventario).toContain('f.ubicaciones.map')
    expect(inventario).toContain('disponibles /')
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(import.meta.dirname, '../..')
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8')

const productos = leer('src/features/productos/Formulario.tsx')
const clientes = leer('src/features/clientes/Clientes.tsx')
const ventas = leer('src/features/ventas/Ventas.tsx')
const transferencias = leer('src/features/transferencias/Transferencias.tsx')
const inventario = leer('src/features/inventario/Inventario.tsx')
const datos = leer('src/lib/supabase.ts')

describe('catálogo y operación con deliveries', () => {
  it('exige un SKU manual y usa el endpoint de creación manual', () => {
    expect(productos).toContain('etiqueta="Código (SKU)"')
    expect(productos).toContain("register('sku')")
    expect(productos).toContain(".regex(/^[A-Z0-9_-]+$/")
    expect(datos).toContain('p_sku: p.sku.trim().toUpperCase()')
    expect(datos).toContain("supabase.rpc('rpc_crear_producto_con_stock', argumentos)")
    expect(datos).not.toContain("supabase.rpc('rpc_crear_producto_con_stock_auto', argumentos)")
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

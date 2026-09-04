import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(import.meta.dirname, '../..')
const sql = readFileSync(resolve(raiz, 'db/16_productos_stock_pedidos.sql'), 'utf8')
const productos = readFileSync(resolve(raiz, 'src/features/productos/Formulario.tsx'), 'utf8')
const lista = readFileSync(resolve(raiz, 'src/features/productos/Lista.tsx'), 'utf8')
const clientes = readFileSync(resolve(raiz, 'src/features/clientes/Clientes.tsx'), 'utf8')
const ventas = readFileSync(resolve(raiz, 'src/features/ventas/Ventas.tsx'), 'utf8')

describe('stock inicial y números de pedido', () => {
  it('crea el stock inicial mediante un movimiento de entrada', () => {
    const funcion = sql.slice(
      sql.indexOf('create or replace function rpc_crear_producto_con_stock'),
      sql.indexOf('-- Extiende ventas'),
    )
    expect(funcion).toContain("rpc_registrar_movimiento(")
    expect(funcion).toContain("'ENTRADA'")
    expect(funcion).not.toMatch(/insert\s+into\s+inventario/i)
    expect(funcion.indexOf('insert into productos')).toBeLessThan(funcion.indexOf('rpc_registrar_movimiento('))
  })

  it('mantiene varios pedidos por cliente y referencia el usado por la venta', () => {
    expect(sql).toContain('create table cliente_pedidos')
    expect(sql).toContain('foreign key (pedido_cliente_id, cliente_id)')
    expect(sql).toContain('references cliente_pedidos(id, cliente_id)')
    expect(sql).toContain("nullif(p_payload->>'numero_pedido', '')")
  })

  it('muestra stock físico, reservado y disponible sin hacerlo editable', () => {
    expect(productos).toContain('Existencias actuales')
    expect(productos).toContain('ResumenStock titulo="Físico"')
    expect(productos).toContain('ResumenStock titulo="Reservado"')
    expect(productos).toContain('ResumenStock titulo="Disponible"')
    expect(lista).toContain('disponible / total')
  })

  it('reemplaza correo por número de pedido en el formulario de clientes', () => {
    expect(clientes).not.toContain('etiqueta="Correo"')
    expect(clientes).toContain("etiqueta={cliente ? 'Agregar número de pedido' : 'Número de pedido'}")
  })

  it('permite seleccionar un pedido anterior o agregar uno nuevo al vender', () => {
    expect(ventas).toContain('etiqueta="Número de pedido"')
    expect(ventas).toContain('Agregar nuevo número…')
    expect(ventas).toContain('numeroPedido,')
  })
})

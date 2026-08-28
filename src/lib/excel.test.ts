import { describe, expect, it } from 'vitest'
import { interpretarFilasProductos } from './excel'

describe('interpretarFilasProductos', () => {
  it('normaliza encabezados, decimales y valores booleanos', () => {
    const resultado = interpretarFilasProductos([
      ['Código SKU', 'Nombre', 'Descripción', 'Categoría', 'Marca', 'Unidad', 'Stock mínimo', 'Estado'],
      [' prd-01 ', 'Lámpara', '', 'Iluminación', 'Niveler', 'pieza', '2,5', 'Sí'],
      ['prd-02', 'Cable', null, '', '', '', 0, 'inactivo'],
    ])

    expect(resultado.errores).toEqual([])
    expect(resultado.productos).toEqual([
      {
        sku: 'PRD-01',
        nombre: 'Lámpara',
        descripcion: null,
        categoria: 'Iluminación',
        marca: 'Niveler',
        unidad_medida: 'pieza',
        stock_minimo: 2.5,
        activo: true,
      },
      {
        sku: 'PRD-02',
        nombre: 'Cable',
        descripcion: null,
        categoria: null,
        marca: null,
        unidad_medida: 'unidad',
        stock_minimo: 0,
        activo: false,
      },
    ])
  })

  it('detecta encabezados obligatorios y archivos vacíos', () => {
    expect(interpretarFilasProductos([]).errores[0].mensaje).toContain('vacío')
    expect(interpretarFilasProductos([['Producto']]).errores[0].mensaje).toContain('SKU')
  })

  it('rechaza duplicados y valores inválidos sin omitir la fila de la vista previa', () => {
    const resultado = interpretarFilasProductos([
      ['SKU', 'Nombre', 'Stock mínimo', 'Activo'],
      ['A-1', 'Uno', 2, true],
      ['a-1', '', -1, 'quizás'],
    ])

    expect(resultado.productos).toHaveLength(2)
    expect(resultado.errores.map((e) => e.mensaje)).toEqual(expect.arrayContaining([
      expect.stringContaining('repetido'),
      expect.stringContaining('nombre'),
      expect.stringContaining('mayor o igual a cero'),
      expect.stringContaining('Activo'),
    ]))
  })
})

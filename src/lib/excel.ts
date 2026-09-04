import type { SheetData } from 'write-excel-file/browser'

export type ProductoExcel = {
  sku: string
  nombre: string
  descripcion: string | null
  categoria: string | null
  marca: string | null
  unidad_medida: string
  stock_minimo: number
  activo: boolean
}

export type ErrorImportacion = {
  fila: number
  mensaje: string
}

export type ResultadoImportacion = {
  productos: ProductoExcel[]
  errores: ErrorImportacion[]
  totalFilas: number
}

type ValorExcel = string | number | boolean | Date | null | undefined

const COLUMNAS_PRODUCTO: Record<keyof ProductoExcel, string[]> = {
  sku: ['sku', 'codigo', 'codigo sku'],
  nombre: ['nombre', 'producto'],
  descripcion: ['descripcion', 'detalle'],
  categoria: ['categoria'],
  marca: ['marca'],
  unidad_medida: ['unidad medida', 'unidad', 'unidad de medida'],
  stock_minimo: ['stock minimo', 'minimo'],
  activo: ['activo', 'estado'],
}

const UNIDADES_PRODUCTO = new Set(['UNIDAD', 'CAJA', 'PAQUETE', 'PAR', 'METRO', 'KILO', 'LITRO'])

const ETIQUETAS: Record<string, string> = {
  sku: 'SKU',
  producto: 'Producto',
  nombre: 'Nombre',
  descripcion: 'Descripción',
  categoria: 'Categoría',
  marca: 'Marca',
  unidad_medida: 'Unidad de medida',
  stock_minimo: 'Stock mínimo',
  activo: 'Activo',
  unidades_vendidas: 'Unidades vendidas',
  numero_ventas: 'Número de ventas',
  ultima_venta: 'Última venta',
  stock_actual: 'Stock actual',
  dias_sin_movimiento: 'Días sin movimiento',
  ultimo_movimiento: 'Último movimiento',
  dia: 'Día',
  sucursal: 'Sucursal',
  unidades: 'Unidades',
  ubicacion: 'Ubicación',
  tipo: 'Tipo',
  cantidad: 'Cantidad',
  reservada: 'Reservada',
  disponible: 'Disponible',
  tabla: 'Tabla',
  registro_id: 'Registro',
  accion: 'Acción',
  usuario: 'Usuario',
  fecha: 'Fecha',
  cambios: 'Cambios',
}

function sinAcentos(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizarEncabezado(valor: unknown) {
  return sinAcentos(String(valor ?? ''))
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function texto(valor: unknown) {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

function numeroNoNegativo(valor: unknown) {
  if (typeof valor === 'number') return valor
  const convertido = Number(texto(valor).replace(',', '.'))
  return convertido
}

function booleano(valor: unknown) {
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'number') return valor !== 0
  const v = normalizarEncabezado(valor)
  if (['si', 'true', '1', 'activo', 'activa'].includes(v)) return true
  if (['no', 'false', '0', 'inactivo', 'inactiva'].includes(v)) return false
  return null
}

/**
 * Interpreta filas ya extraídas de una hoja. Está separada del lector de
 * archivos para poder probar todas las reglas sin depender del navegador.
 */
export function interpretarFilasProductos(filas: unknown[][]): ResultadoImportacion {
  const errores: ErrorImportacion[] = []
  if (!filas.length) {
    return { productos: [], errores: [{ fila: 1, mensaje: 'El archivo está vacío.' }], totalFilas: 0 }
  }

  const encabezados = filas[0].map(normalizarEncabezado)
  const indices = {} as Record<keyof ProductoExcel, number>

  for (const [campo, alias] of Object.entries(COLUMNAS_PRODUCTO) as [keyof ProductoExcel, string[]][]) {
    indices[campo] = encabezados.findIndex((e) => alias.includes(e))
  }

  if (indices.sku < 0 || indices.nombre < 0) {
    return {
      productos: [],
      errores: [{ fila: 1, mensaje: 'La primera fila debe incluir las columnas SKU y Nombre.' }],
      totalFilas: Math.max(0, filas.length - 1),
    }
  }

  const productos: ProductoExcel[] = []
  const vistos = new Set<string>()

  filas.slice(1).forEach((fila, indice) => {
    const numeroFila = indice + 2
    if (fila.every((v) => texto(v) === '')) return

    const sku = texto(fila[indices.sku]).toUpperCase()
    const nombre = texto(fila[indices.nombre])
    const unidad = (indices.unidad_medida < 0
      ? 'UNIDAD'
      : texto(fila[indices.unidad_medida]) || 'UNIDAD').toUpperCase()
    const stock = indices.stock_minimo < 0 ? 0 : numeroNoNegativo(fila[indices.stock_minimo])
    const activoLeido = indices.activo < 0 ? true : booleano(fila[indices.activo])

    if (!sku) errores.push({ fila: numeroFila, mensaje: 'Falta el SKU.' })
    if (!nombre) errores.push({ fila: numeroFila, mensaje: 'Falta el nombre.' })
    if (sku && vistos.has(sku)) errores.push({ fila: numeroFila, mensaje: `El SKU ${sku} está repetido.` })
    if (!Number.isFinite(stock) || stock < 0) {
      errores.push({ fila: numeroFila, mensaje: 'Stock mínimo debe ser un número mayor o igual a cero.' })
    }
    if (!UNIDADES_PRODUCTO.has(unidad)) {
      errores.push({
        fila: numeroFila,
        mensaje: `Unidad de medida inválida. Usa: ${[...UNIDADES_PRODUCTO].join(', ')}.`,
      })
    }
    if (activoLeido === null) {
      errores.push({ fila: numeroFila, mensaje: 'Activo debe ser Sí/No, Verdadero/Falso o 1/0.' })
    }

    vistos.add(sku)
    productos.push({
      sku,
      nombre,
      descripcion: indices.descripcion < 0 ? null : texto(fila[indices.descripcion]) || null,
      categoria: indices.categoria < 0 ? null : texto(fila[indices.categoria]) || null,
      marca: indices.marca < 0 ? null : texto(fila[indices.marca]) || null,
      unidad_medida: unidad,
      stock_minimo: Number.isFinite(stock) ? stock : 0,
      activo: activoLeido ?? true,
    })
  })

  return { productos, errores, totalFilas: productos.length }
}

export async function leerProductosExcel(archivo: File): Promise<ResultadoImportacion> {
  if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
    return {
      productos: [],
      errores: [{ fila: 1, mensaje: 'Selecciona un archivo de Excel con extensión .xlsx.' }],
      totalFilas: 0,
    }
  }
  if (archivo.size > 5 * 1024 * 1024) {
    return {
      productos: [],
      errores: [{ fila: 1, mensaje: 'El archivo supera el límite de 5 MB.' }],
      totalFilas: 0,
    }
  }

  const { readSheet } = await import('read-excel-file/browser')
  const filas = await readSheet(archivo)
  if (filas.length > 5_001) {
    return {
      productos: [],
      errores: [{ fila: 1, mensaje: 'El archivo puede contener como máximo 5.000 productos.' }],
      totalFilas: filas.length - 1,
    }
  }
  return interpretarFilasProductos(filas)
}

function valorCelda(valor: unknown): ValorExcel {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) return valor
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') return valor
  return JSON.stringify(valor)
}

function etiqueta(columna: string) {
  return ETIQUETAS[columna] ?? columna.replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase())
}

/** Genera un XLSX real; la librería se carga sólo al pulsar Descargar. */
export async function descargarExcel(
  nombre: string,
  filas: Record<string, unknown>[],
  hoja = 'Datos',
) {
  if (!filas.length) return
  const columnas = Object.keys(filas[0])
  const datos: SheetData = [
    columnas.map((c) => ({
      value: etiqueta(c),
      fontWeight: 'bold',
      backgroundColor: '#E2E8F0',
    })),
    ...filas.map((fila) => columnas.map((columna) => valorCelda(fila[columna]))),
  ]
  const anchos = columnas.map((columna) => ({
    width: Math.min(45, Math.max(
      etiqueta(columna).length + 2,
      ...filas.slice(0, 200).map((fila) => String(fila[columna] ?? '').length + 2),
    )),
  }))
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(datos, {
    sheet: hoja.slice(0, 31),
    columns: anchos,
    stickyRowsCount: 1,
  }).toFile(`${nombre}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export async function descargarPlantillaProductos() {
  await descargarExcel('plantilla-productos', [{
    sku: 'EJEMPLO-001',
    nombre: 'Producto de ejemplo',
    descripcion: 'Descripción opcional',
    categoria: '',
    marca: '',
    unidad_medida: 'UNIDAD',
    stock_minimo: 0,
    activo: true,
  }], 'Productos')
}

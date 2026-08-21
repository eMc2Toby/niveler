/**
 * Exportación a CSV, que Excel abre directo.
 *
 * Dos detalles que parecen manías y no lo son: el BOM al inicio, sin el cual
 * Excel en Windows muestra "Iluminacin" en vez de "Iluminación", y el punto
 * y coma como separador, que es lo que espera un Excel configurado en
 * español. Con coma, todo termina apelotonado en la columna A.
 */
export function descargarCSV(nombre: string, filas: Record<string, any>[]) {
  if (!filas.length) return

  const columnas = Object.keys(filas[0])
  const escapar = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const csv = [
    columnas.join(';'),
    ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(';')),
  ].join('\r\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombre}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

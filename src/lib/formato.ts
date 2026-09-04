/** Cantidades: sin decimales si es entero, con dos si no. */
export const numero = (v: number | null | undefined) => {
  const n = Number(v ?? 0)
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n)
}

export const fecha = (iso: string) => {
  // PostgreSQL devuelve las columnas `date` como YYYY-MM-DD. JavaScript las
  // interpreta como medianoche UTC y en Bolivia eso cae en el día anterior.
  // Al no haber hora real, se fija el mediodía local para conservar el día.
  const valor = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso
  return new Date(valor).toLocaleDateString('es-BO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-BO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

/** Formato boliviano: Bs 1.234,50 · miles con punto, decimales con coma. */
export const bs = (v: number | null | undefined) =>
  'Bs ' + new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(v ?? 0))

/** Cantidades: sin decimales si es entero, con dos si no. */
export const numero = (v: number | null | undefined) => {
  const n = Number(v ?? 0)
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n)
}

export const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-BO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

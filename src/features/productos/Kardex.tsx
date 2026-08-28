import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Cargando, ErrorCarga, Selector } from '@/components/ui'
import { api } from '@/lib/supabase'
import { descargarExcel } from '@/lib/excel'
import { fechaHora, numero } from '@/lib/formato'
import { useMisUbicaciones } from '@/hooks/useCatalogos'

/**
 * Kardex: por qué el saldo de un producto es el que es.
 *
 * El saldo de `inventario` es una consecuencia de los movimientos, así que
 * esta pantalla es la que permite auditarlo: se recorren los movimientos y
 * la cuenta tiene que terminar dando el saldo que muestra Inventario. Si no
 * da, hay un descuadre y aquí se ve exactamente en qué línea aparece.
 *
 * Sin ubicación elegida se lista el historial completo, que sirve para
 * seguir un producto entre ciudades. Con una ubicación, cada línea se vuelve
 * entrada o salida respecto de esa bodega y aparece el saldo acumulado, que
 * es lo que se compara contra un conteo físico.
 */
export default function Kardex({ productoId, sku }: { productoId: string; sku?: string }) {
  const { propias } = useMisUbicaciones()
  const [ubicacionId, setUbicacionId] = useState('')
  const [exportando, setExportando] = useState(false)

  const kardex = useQuery({
    queryKey: ['kardex', productoId],
    queryFn: () => api.kardex(productoId),
  })

  const fisicas = propias.filter((u) => u.tipo === 'SUCURSAL' || u.tipo === 'DELIVERY')

  const filas = useMemo(() => {
    // El orden se recalcula aquí en vez de confiar en el que llegó: dos
    // movimientos del mismo segundo empatan en `fecha`, y con el saldo
    // acumulado un empate mal resuelto da cifras que no cuadran. El código
    // de documento es secuencial y desempata sin ambigüedad.
    const cronologico = ((kardex.data ?? []) as any[]).slice().sort((a, b) => {
      const t = new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      return t !== 0 ? t : String(a.documento).localeCompare(String(b.documento))
    })
    const todos = cronologico.slice().reverse() // lo más reciente arriba

    if (!ubicacionId) {
      return todos.map((m) => ({ ...m, signo: 0 as const, saldo: null as number | null }))
    }

    // Solo los movimientos que tocan esta ubicación, de más viejo a más
    // nuevo, que es el único orden en el que el saldo se puede ir sumando.
    const propios = cronologico.filter(
      (m) => m.ubicacion_origen_id === ubicacionId || m.ubicacion_destino_id === ubicacionId,
    )

    let saldo = 0
    const conSaldo = propios.map((m) => {
      const signo = m.ubicacion_destino_id === ubicacionId ? 1 : -1
      saldo += signo * Number(m.cantidad)
      return { ...m, signo, saldo }
    })

    return conSaldo.reverse() // de vuelta al orden de siempre: lo último arriba
  }, [kardex.data, ubicacionId])

  if (kardex.isLoading) return <Cargando className="py-10" />
  if (kardex.isError) return <ErrorCarga onReintentar={() => kardex.refetch()} />

  const exportar = async () => {
    setExportando(true)
    try {
      await descargarExcel(`kardex-${sku ?? productoId}`, filas.map((m: any) => ({
        fecha: fechaHora(m.fecha),
        documento: m.documento,
        tipo: m.tipo,
        origen: m.origen,
        destino: m.destino,
        cantidad: m.cantidad,
        ...(ubicacionId ? { entrada_salida: m.signo > 0 ? 'entrada' : 'salida', saldo: m.saldo } : {}),
        usuario: m.usuario ?? '',
        observaciones: m.observaciones ?? '',
      })), 'Kardex')
    } catch {
      toast.error('No se pudo generar el archivo de Excel.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Selector
          etiqueta="Ver desde"
          value={ubicacionId}
          onChange={(e) => setUbicacionId(e.target.value)}
          className="flex-1"
        >
          <option value="">Todas las ubicaciones</option>
          {fisicas.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </Selector>
        <Boton
          variante="secundario"
          disabled={!filas.length}
          cargando={exportando}
          onClick={() => void exportar()}
        >
          <Download className="h-4 w-4" />
          Excel
        </Boton>
      </div>

      {!filas.length ? (
        <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {ubicacionId
            ? 'Este producto nunca pasó por esa ubicación.'
            : 'Este producto todavía no tiene movimientos confirmados.'}
        </p>
      ) : (
        <>
          {ubicacionId && (
            <p className="text-sm text-slate-500">
              Saldo actual según los movimientos:{' '}
              <strong className="text-slate-900">{numero(filas[0].saldo ?? 0)}</strong>
            </p>
          )}

          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {filas.map((m: any) => (
              <li key={m.id} className="flex items-start gap-3 px-3 py-2.5">
                {ubicacionId ? (
                  <div
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                      m.signo > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {m.signo > 0
                      ? <ArrowDownLeft className="h-4 w-4" />
                      : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900">
                    {m.tipo.replace(/_/g, ' ').toLowerCase()}
                    <span className="text-slate-400"> · {m.documento}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {m.origen} → {m.destino}
                  </p>
                  <p className="text-xs text-slate-400">
                    {fechaHora(m.fecha)}
                    {m.usuario ? ` · ${m.usuario}` : ''}
                  </p>
                  {m.observaciones && (
                    <p className="mt-1 text-xs italic text-slate-500">{m.observaciones}</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-medium ${
                      !ubicacionId ? 'text-slate-900'
                      : m.signo > 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {ubicacionId ? (m.signo > 0 ? '+' : '−') : ''}
                    {numero(m.cantidad)}
                  </p>
                  {ubicacionId && (
                    <p className="text-xs text-slate-500">saldo {numero(m.saldo)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

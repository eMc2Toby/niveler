import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ClipboardCheck, Search } from 'lucide-react'
import {
  Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal, Selector,
} from '@/components/ui'
import DetalleProducto, { Imagen } from '@/features/productos/Detalle'
import { useMisUbicaciones } from '@/hooks/useCatalogos'
import { usePermisos } from '@/hooks/useAuth'
import { api, suscribirInventario } from '@/lib/supabase'
import { numero, fechaHora } from '@/lib/formato'
import { mensajeError, normalizar } from '@/lib/utils'

export default function Inventario() {
  const { ajustarStock } = usePermisos()
  const qc = useQueryClient()
  const { propias } = useMisUbicaciones()

  const [ubicacionId, setUbicacionId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [contando, setContando] = useState<any | null>(null)
  const [eligiendoUbicacion, setEligiendoUbicacion] = useState<any | null>(null)
  const [detalle, setDetalle] = useState<string | null>(null)

  const fisicas = propias.filter((u) => u.tipo === 'SUCURSAL' || u.tipo === 'DELIVERY')

  // Sin ubicación elegida se muestra todo lo que el usuario puede ver, que
  // para un encargado ya viene filtrado por RLS.
  const stock = useQuery({
    queryKey: ['stock', ubicacionId],
    queryFn: () => (ubicacionId ? api.stockDeUbicacion(ubicacionId) : api.stock()),
  })

  useEffect(
    () => suscribirInventario(() => qc.invalidateQueries({ queryKey: ['stock'] })),
    [qc],
  )

  const filas = useMemo(() => {
    const porProducto = new Map<string, any>()
    for (const saldo of stock.data ?? []) {
      if (!saldo.producto_id) continue
      const actual = porProducto.get(saldo.producto_id) ?? {
        ...saldo,
        id: saldo.producto_id,
        cantidad: 0,
        cantidad_reservada: 0,
        cantidad_disponible: 0,
        ubicaciones: [],
      }
      actual.cantidad += Number(saldo.cantidad)
      actual.cantidad_reservada += Number(saldo.cantidad_reservada)
      actual.cantidad_disponible += Number(saldo.cantidad_disponible)
      actual.ubicaciones.push(saldo)
      if (String(saldo.actualizado_en) > String(actual.actualizado_en)) {
        actual.actualizado_en = saldo.actualizado_en
      }
      porProducto.set(saldo.producto_id, actual)
    }

    const q = normalizar(busqueda.trim())
    return [...porProducto.values()]
      .map((fila) => ({
        ...fila,
        ubicaciones: fila.ubicaciones.sort((a: any, b: any) =>
          String(a.ubicacion).localeCompare(String(b.ubicacion), 'es')),
      }))
      .filter((f: any) => !q || normalizar(
        `${f.producto} ${f.sku} ${f.ubicaciones.map((u: any) => u.ubicacion).join(' ')}`,
      ).includes(q))
  }, [stock.data, busqueda])

  const totalUnidades = filas.reduce((s: number, f: any) => s + Number(f.cantidad), 0)

  if (stock.isLoading) return <Cargando />
  if (stock.isError) return <ErrorCarga onReintentar={() => stock.refetch()} />

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Inventario</h1>
        <p className="text-sm text-slate-500">
          {numero(filas.length)} productos · {numero(totalUnidades)} unidades
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <Campo
            className="pl-10"
            placeholder="Buscar producto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar en el inventario"
          />
        </div>
        <Selector
          value={ubicacionId}
          onChange={(e) => setUbicacionId(e.target.value)}
          aria-label="Filtrar por ubicación"
          className="sm:w-56"
        >
          <option value="">Todas mis ubicaciones</option>
          {fisicas.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </Selector>
      </div>

      <p className="text-sm text-slate-500 lg:hidden">
        {numero(filas.length)} productos · {numero(totalUnidades)} unidades
      </p>

      {!filas.length ? (
        <EstadoVacio
          titulo="Sin existencias"
          detalle={
            busqueda
              ? 'Ningún producto coincide con la búsqueda.'
              : 'Registra una entrada en Movimientos para cargar el stock inicial.'
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filas.map((f: any) => {
            const bajo = Number(f.cantidad) <= Number(f.stock_minimo) && Number(f.stock_minimo) > 0
            return (
              <li key={f.producto_id} className="flex items-start gap-3 px-4 py-3">
                <button
                  onClick={() => setDetalle(f.producto_id)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <Imagen ruta={f.imagen_url} nombre={f.producto} className="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{f.producto}</p>
                    <p className="text-xs text-slate-500">SKU {f.sku}</p>
                    <ul className="mt-1 space-y-0.5">
                      {f.ubicaciones.map((ubicacion: any) => (
                        <li key={ubicacion.ubicacion_id} className="text-xs text-slate-500">
                          <span className="font-medium text-slate-600">{ubicacion.ubicacion}</span>
                          {' · '}{numero(ubicacion.cantidad_disponible)} disponibles / {numero(ubicacion.cantidad)} total
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">
                      {numero(f.cantidad_disponible)} / {numero(f.cantidad)}
                    </p>
                    <p className="text-[11px] text-slate-400">disponible / total</p>
                    {Number(f.cantidad_reservada) > 0 && (
                      <p className="text-xs text-amber-600">
                        {numero(f.cantidad_reservada)} reservadas
                      </p>
                    )}
                  </div>
                </button>

                {bajo && <Etiqueta tono="ambar">bajo</Etiqueta>}

                {ajustarStock && (
                  <Boton
                    variante="fantasma"
                    className="px-3"
                    onClick={() => {
                      if (f.ubicaciones.length === 1) setContando(f.ubicaciones[0])
                      else setEligiendoUbicacion(f)
                    }}
                    aria-label={`Ajustar ${f.producto}`}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                  </Boton>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {contando && (
        <ModalConteo fila={contando} onCerrar={() => setContando(null)} />
      )}
      {eligiendoUbicacion && (
        <ModalElegirUbicacion
          producto={eligiendoUbicacion}
          onCerrar={() => setEligiendoUbicacion(null)}
          onElegir={(fila) => {
            setEligiendoUbicacion(null)
            setContando(fila)
          }}
        />
      )}
      <DetalleProducto productoId={detalle} onCerrar={() => setDetalle(null)} />
    </div>
  )
}

function ModalElegirUbicacion({
  producto,
  onCerrar,
  onElegir,
}: {
  producto: any
  onCerrar: () => void
  onElegir: (fila: any) => void
}) {
  return (
    <Modal abierto titulo={`Contar ${producto.producto}`} onCerrar={onCerrar}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          El producto está en varias ubicaciones. Elige cuál vas a contar físicamente.
        </p>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {producto.ubicaciones.map((fila: any) => (
            <li key={fila.ubicacion_id} className="flex items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{fila.ubicacion}</p>
                <p className="text-xs text-slate-500">
                  {numero(fila.cantidad_disponible)} disponibles / {numero(fila.cantidad)} total
                </p>
              </div>
              <Boton variante="secundario" onClick={() => onElegir(fila)}>Contar</Boton>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}

/**
 * Conteo físico. No escribe el saldo: manda la cantidad contada y la base
 * genera el movimiento de ajuste contra MERMA o PROVEEDOR según sobre o
 * falte. Así hasta un descuadre queda con su rastro en el kardex.
 */
function ModalConteo({ fila, onCerrar }: { fila: any; onCerrar: () => void }) {
  const qc = useQueryClient()
  const [contada, setContada] = useState(String(fila.cantidad))
  const [motivo, setMotivo] = useState('')

  const ajustar = useMutation({
    mutationFn: () =>
      api.ajustarStock(fila.producto_id, fila.ubicacion_id, Number(contada), motivo.trim()),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['stock-ubicacion'] })
      qc.invalidateQueries({ queryKey: ['producto-stock'] })
      qc.invalidateQueries({ queryKey: ['movimientos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(
        r?.ajuste
          ? `Ajustado: ${r.diferencia > 0 ? '+' : ''}${numero(r.diferencia)}`
          : 'El conteo coincide con el sistema.',
      )
      onCerrar()
    },
    onError: (e) => toast.error(mensajeError(e, 'No se pudo ajustar el stock.')),
  })

  const diferencia = Number(contada || 0) - Number(fila.cantidad)
  const motivoLimpio = motivo.trim()
  const conteoValido = contada !== '' && Number.isFinite(Number(contada))
    && Number(contada) >= 0 && Number(contada) <= 999999999
  const errorConteo = contada !== '' && !conteoValido ? 'Escribe una cantidad válida entre 0 y 999.999.999' : undefined
  const errorMotivo = motivoLimpio.length > 0 && motivoLimpio.length < 3
    ? 'Escribe al menos 3 caracteres'
    : motivoLimpio.length > 300 ? 'Máximo 300 caracteres' : undefined

  return (
    <Modal abierto titulo="Conteo físico" onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="flex gap-3">
          <Imagen ruta={fila.imagen_url} nombre={fila.producto} className="h-14 w-14" />
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{fila.producto}</p>
            <p className="text-sm text-slate-500">{fila.sku} · {fila.ubicacion}</p>
            <p className="mt-1 text-sm text-slate-500">
              Actualizado {fechaHora(fila.actualizado_en)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Según el sistema</p>
            <p className="mt-0.5 font-medium text-slate-900">{numero(fila.cantidad)}</p>
          </div>
          <Campo
            etiqueta="Contado"
            type="number"
            inputMode="numeric"
            min="0"
            max="999999999"
            step="0.01"
            error={errorConteo}
            value={contada}
            onChange={(e) => setContada(e.target.value)}
          />
        </div>

        {diferencia !== 0 && (
          <p
            className={`rounded-lg px-3.5 py-2.5 text-sm ${
              diferencia < 0 ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {diferencia < 0
              ? `Faltan ${numero(Math.abs(diferencia))}: saldrán a merma.`
              : `Sobran ${numero(diferencia)}: entrarán como ajuste positivo.`}
          </p>
        )}

        <Campo
          etiqueta="Motivo"
          placeholder="Conteo mensual, rotura, faltante…"
          maxLength={300}
          error={errorMotivo}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          ayuda="Queda registrado en el movimiento de ajuste"
        />

        <div className="flex gap-3 pt-1">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            className="flex-1"
            cargando={ajustar.isPending}
            disabled={motivoLimpio.length < 3 || !!errorMotivo || !conteoValido}
            onClick={() => ajustar.mutate()}
          >
            Registrar conteo
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

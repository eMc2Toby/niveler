import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts'
import { Boxes, Truck, TriangleAlert, ArrowRightLeft, Loader2 } from 'lucide-react'
import { api, suscribirInventario } from '@/lib/supabase'
import { usePermisos, useAuth } from '@/hooks/useAuth'
import { bs, numero } from '@/lib/formato'

export default function Dashboard() {
  const { perfil } = useAuth()
  const { verTodasLasSucursales, verCostos } = usePermisos()
  const qc = useQueryClient()

  const totales = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })
  const sucursales = useQuery({ queryKey: ['stock-sucursales'], queryFn: api.stockPorSucursal })
  const bajos = useQuery({ queryKey: ['bajo-stock'], queryFn: api.bajoStock })

  // Cuando cualquier ciudad registra un movimiento, esto se refresca solo.
  useEffect(() => {
    return suscribirInventario(() => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['stock-sucursales'] })
      qc.invalidateQueries({ queryKey: ['bajo-stock'] })
    })
  }, [qc])

  if (totales.isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (totales.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center">
        <p className="font-medium text-red-900">No se pudieron cargar los datos</p>
        <p className="mt-1 text-sm text-red-700">Revisa tu conexión.</p>
        <button
          onClick={() => totales.refetch()}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const t = totales.data!

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Hola, {perfil?.nombre_completo?.split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-500">
          {verTodasLasSucursales ? 'Las 7 ciudades' : perfil?.sucursal?.nombre}
        </p>
      </div>

      {/* Tarjetas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta
          Icono={Boxes}
          etiqueta="Stock en sucursales"
          valor={numero(t.stock_sucursales)}
          nota="unidades"
        />
        <Tarjeta
          Icono={Truck}
          etiqueta="En poder de deliveries"
          valor={numero(t.stock_deliveries)}
          nota="unidades"
        />
        <Tarjeta
          Icono={TriangleAlert}
          etiqueta="Bajo el mínimo"
          valor={numero(t.productos_bajo_stock)}
          nota="productos"
          alerta={t.productos_bajo_stock > 0}
        />
        <Tarjeta
          Icono={ArrowRightLeft}
          etiqueta="Transferencias en camino"
          valor={numero(t.transferencias_pendientes)}
          nota="pendientes de recibir"
        />
      </div>

      {/* Ventas del día */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">Ventas de hoy</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
          {bs(t.ventas_hoy_monto)}
        </p>
        <p className="text-sm text-slate-500">
          {numero(t.ventas_hoy_cantidad)} {t.ventas_hoy_cantidad === 1 ? 'venta' : 'ventas'}
        </p>
        {verCostos && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
            Valor del inventario a costo: <strong className="text-slate-900">{bs(t.valor_inventario)}</strong>
          </p>
        )}
      </div>

      {/* Stock por ciudad */}
      {verTodasLasSucursales && sucursales.data && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-medium text-slate-900">Stock por ciudad</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sucursales.data} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="ciudad"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [numero(v), 'unidades']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <Bar dataKey="unidades" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Alertas de reposición */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-medium text-slate-900">Necesitan reposición</h2>
          {bajos.data && bajos.data.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              {bajos.data.length}
            </span>
          )}
        </div>

        {bajos.isLoading ? (
          <div className="px-5 py-10 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : !bajos.data?.length ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Todos los productos están por encima de su mínimo.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {bajos.data.slice(0, 8).map((p: any) => (
              <li key={p.producto_id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{p.producto}</p>
                  <p className="text-xs text-slate-500">{p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{numero(p.stock_total)}</p>
                  <p className="text-xs text-slate-500">mín. {numero(p.stock_minimo)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Tarjeta({
  Icono, etiqueta, valor, nota, alerta = false,
}: {
  Icono: typeof Boxes
  etiqueta: string
  valor: string
  nota: string
  alerta?: boolean
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${alerta ? 'border-amber-300' : 'border-slate-200'}`}>
      <Icono className={`mb-3 h-[18px] w-[18px] ${alerta ? 'text-amber-600' : 'text-slate-400'}`} />
      <p className="text-2xl font-semibold tracking-tight text-slate-900">{valor}</p>
      <p className="mt-0.5 text-xs leading-tight text-slate-500">{etiqueta}</p>
      <p className="text-xs text-slate-400">{nota}</p>
    </div>
  )
}

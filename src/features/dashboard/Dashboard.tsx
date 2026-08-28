import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Boxes, Truck, TriangleAlert, ArrowRightLeft, Loader2,
  CalendarDays, MapPin, ShoppingBag, CircleCheck,
} from 'lucide-react'
import { api, suscribirInventario } from '@/lib/supabase'
import { usePermisos, useAuth } from '@/hooks/useAuth'
import { numero } from '@/lib/formato'

export default function Dashboard() {
  const { perfil } = useAuth()
  const { verTodasLasSucursales } = usePermisos()
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
  const fecha = new Intl.DateTimeFormat('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <div className="space-y-5 lg:space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[#10251e] px-5 py-6 text-white shadow-xl shadow-emerald-950/10 sm:px-7 sm:py-7 lg:px-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/3 h-56 w-56 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Panel operativo
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Hola, {perfil?.nombre_completo?.split(' ')[0]}
            </h1>
            <div className="mt-3 flex items-center gap-2 text-sm text-emerald-50/65">
              <MapPin className="h-4 w-4 text-emerald-300" />
              {verTodasLasSucursales ? 'Vista consolidada · 7 ciudades' : perfil?.sucursal?.nombre}
            </div>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2.5 text-xs font-medium text-emerald-50/75 backdrop-blur-sm">
            <CalendarDays className="h-4 w-4 text-emerald-300" />
            <span className="capitalize">{fecha}</span>
          </div>
        </div>
      </section>

      {/* Tarjetas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta
          Icono={Boxes}
          etiqueta="Stock en sucursales"
          valor={numero(t.stock_sucursales)}
          nota="unidades"
          tono="verde"
        />
        <Tarjeta
          Icono={Truck}
          etiqueta="En poder de deliveries"
          valor={numero(t.stock_deliveries)}
          nota="unidades"
          tono="azul"
        />
        <Tarjeta
          Icono={TriangleAlert}
          etiqueta="Bajo el mínimo"
          valor={numero(t.productos_bajo_stock)}
          nota="productos"
          alerta={(t.productos_bajo_stock ?? 0) > 0}
          tono="ambar"
        />
        <Tarjeta
          Icono={ArrowRightLeft}
          etiqueta="Transferencias en camino"
          valor={numero(t.transferencias_pendientes)}
          nota="pendientes de recibir"
          tono="violeta"
        />
      </div>

      {/* Salidas del día */}
      <section className="nv-panel overflow-hidden">
        <div className="flex items-center gap-4 p-5 sm:p-6">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="nv-kicker">Actividad de hoy</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <p className="text-3xl font-bold tracking-tight text-slate-950">{numero(t.unidades_hoy)}</p>
              <p className="text-sm text-slate-500">unidades vendidas</p>
            </div>
          </div>
          <div className="hidden rounded-xl bg-slate-50 px-4 py-3 text-right sm:block">
            <p className="text-lg font-bold text-slate-900">{numero(t.ventas_hoy_cantidad)}</p>
            <p className="text-xs text-slate-500">
              {t.ventas_hoy_cantidad === 1 ? 'registro' : 'registros'}
            </p>
          </div>
        </div>
      </section>

      {/* Stock por ciudad */}
      {verTodasLasSucursales && sucursales.data && (
        <div className="nv-panel p-5 sm:p-6">
          <div className="mb-5">
            <p className="nv-kicker">Distribución</p>
            <h2 className="mt-1 font-semibold tracking-tight text-slate-950">Stock por ciudad</h2>
          </div>
          <GraficoSucursales datos={sucursales.data as any[]} />
        </div>
      )}

      {/* Alertas de reposición */}
      <div className="nv-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="nv-kicker">Alertas</p>
            <h2 className="mt-1 font-semibold tracking-tight text-slate-950">Necesitan reposición</h2>
          </div>
          {bajos.data && bajos.data.length > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {bajos.data.length}
            </span>
          )}
        </div>

        {bajos.isLoading ? (
          <div className="px-5 py-10 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : !bajos.data?.length ? (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CircleCheck className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">El inventario está al día</p>
            <p className="mt-1 text-xs text-slate-500">Todos los productos están por encima de su mínimo.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {bajos.data.slice(0, 8).map((p: any) => (
              <li key={p.producto_id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50/80 sm:px-6">
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

function GraficoSucursales({ datos }: { datos: any[] }) {
  const maximo = Math.max(1, ...datos.map((dato) => Number(dato.unidades) || 0))
  return (
    <div className="space-y-4" role="img" aria-label="Gráfico de stock por ciudad">
      {datos.map((dato) => {
        const cantidad = Number(dato.unidades) || 0
        return (
          <div key={dato.sucursal_id ?? dato.ciudad} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 text-sm sm:grid-cols-[7rem_1fr_4rem]">
            <span className="truncate font-medium text-slate-600" title={dato.ciudad}>{dato.ciudad}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                style={{ width: `${Math.max(cantidad > 0 ? 2 : 0, (cantidad / maximo) * 100)}%` }}
                title={`${dato.ciudad}: ${numero(cantidad)} unidades`}
              />
            </div>
            <span className="text-right font-medium text-slate-700">{numero(cantidad)}</span>
          </div>
        )
      })}
    </div>
  )
}

function Tarjeta({
  Icono, etiqueta, valor, nota, alerta = false, tono = 'verde',
}: {
  Icono: typeof Boxes
  etiqueta: string
  valor: string
  nota: string
  alerta?: boolean
  tono?: 'verde' | 'azul' | 'ambar' | 'violeta'
}) {
  const tonos = {
    verde: 'bg-emerald-100 text-emerald-700',
    azul: 'bg-sky-100 text-sky-700',
    ambar: 'bg-amber-100 text-amber-700',
    violeta: 'bg-violet-100 text-violet-700',
  }

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.03),0_8px_24px_rgb(15_23_42/0.035)] sm:p-5 ${alerta ? 'border-amber-300' : 'border-slate-200/80'}`}>
      <div className={`mb-4 grid h-9 w-9 place-items-center rounded-xl ${tonos[tono]}`}>
        <Icono className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{valor}</p>
      <p className="mt-1 text-xs font-medium leading-snug text-slate-600 sm:text-sm">{etiqueta}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-slate-400 sm:text-xs">{nota}</p>
    </div>
  )
}

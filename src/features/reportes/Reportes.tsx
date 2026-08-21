import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Download } from 'lucide-react'
import { Boton, Cargando, ErrorCarga, EstadoVacio } from '@/components/ui'
import { api } from '@/lib/supabase'
import { descargarCSV } from '@/lib/exportar'
import { fecha, numero } from '@/lib/formato'

const PESTANAS = [
  { id: 'vendidos', texto: 'Más vendidos' },
  { id: 'quietos',  texto: 'Sin movimiento' },
  { id: 'diario',   texto: 'Salidas por día' },
  { id: 'stock',    texto: 'Stock completo' },
] as const

type Pestana = (typeof PESTANAS)[number]['id']

export default function Reportes() {
  const [pestana, setPestana] = useState<Pestana>('vendidos')

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reportes</h1>
        <p className="text-sm text-slate-500">Todo se puede bajar a Excel</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            aria-pressed={pestana === p.id}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
              pestana === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {pestana === 'vendidos' && <MasVendidos />}
      {pestana === 'quietos' && <SinMovimiento />}
      {pestana === 'diario' && <SalidasDiarias />}
      {pestana === 'stock' && <StockCompleto />}
    </div>
  )
}

function Encabezado({
  titulo, detalle, filas, archivo,
}: {
  titulo: string
  detalle: string
  filas: any[]
  archivo: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-medium text-slate-900">{titulo}</h2>
        <p className="text-sm text-slate-500">{detalle}</p>
      </div>
      <Boton
        variante="secundario"
        disabled={!filas.length}
        onClick={() => descargarCSV(archivo, filas)}
      >
        <Download className="h-4 w-4" />
        Excel
      </Boton>
    </div>
  )
}

function MasVendidos() {
  const q = useQuery({ queryKey: ['rep-vendidos'], queryFn: api.masVendidos })
  if (q.isLoading) return <Cargando />
  if (q.isError) return <ErrorCarga onReintentar={() => q.refetch()} />

  const filas = (q.data ?? []).map((r: any) => ({
    sku: r.sku,
    producto: r.producto,
    categoria: r.categoria ?? '',
    unidades_vendidas: r.unidades_vendidas,
    numero_ventas: r.numero_ventas,
    ultima_venta: r.ultima_venta ? fecha(r.ultima_venta) : '',
  }))

  if (!filas.length) {
    return <EstadoVacio titulo="Todavía no hay ventas registradas" />
  }

  return (
    <div className="space-y-4">
      <Encabezado
        titulo="Más vendidos"
        detalle="Por unidades que salieron"
        filas={filas}
        archivo="mas-vendidos"
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={(q.data ?? []).slice(0, 10)} margin={{ left: -20, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="sku"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={55}
            />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => [numero(v), 'unidades']}
              labelFormatter={(sku: string) =>
                (q.data ?? []).find((r: any) => r.sku === sku)?.producto ?? sku
              }
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
            <Bar dataKey="unidades_vendidas" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Tabla
        columnas={['Producto', 'Unidades', 'Registros', 'Última']}
        filas={(q.data ?? []).map((r: any) => [
          <div key="p">
            <p className="text-slate-900">{r.producto}</p>
            <p className="text-xs text-slate-500">{r.sku}</p>
          </div>,
          numero(r.unidades_vendidas),
          numero(r.numero_ventas),
          r.ultima_venta ? fecha(r.ultima_venta) : '—',
        ])}
      />
    </div>
  )
}

function SinMovimiento() {
  const q = useQuery({ queryKey: ['rep-quietos'], queryFn: api.sinMovimiento })
  if (q.isLoading) return <Cargando />
  if (q.isError) return <ErrorCarga onReintentar={() => q.refetch()} />

  const filas = (q.data ?? []).map((r: any) => ({
    sku: r.sku,
    producto: r.producto,
    stock_actual: r.stock_actual,
    dias_sin_movimiento: r.dias_sin_movimiento ?? '',
    ultimo_movimiento: r.ultimo_movimiento ? fecha(r.ultimo_movimiento) : 'nunca',
  }))

  if (!filas.length) return <EstadoVacio titulo="Todo el catálogo tuvo movimiento reciente" />

  return (
    <div className="space-y-4">
      <Encabezado
        titulo="Sin movimiento"
        detalle="Más de 60 días quietos, o nunca movidos"
        filas={filas}
        archivo="sin-movimiento"
      />
      <Tabla
        columnas={['Producto', 'Stock', 'Días quieto']}
        filas={(q.data ?? []).map((r: any) => [
          <div key="p">
            <p className="text-slate-900">{r.producto}</p>
            <p className="text-xs text-slate-500">{r.sku}</p>
          </div>,
          numero(r.stock_actual),
          r.dias_sin_movimiento ? numero(r.dias_sin_movimiento) : 'nunca movido',
        ])}
      />
    </div>
  )
}

function SalidasDiarias() {
  const q = useQuery({ queryKey: ['rep-diario'], queryFn: api.ventasDiarias })
  if (q.isLoading) return <Cargando />
  if (q.isError) return <ErrorCarga onReintentar={() => q.refetch()} />

  const filas = (q.data ?? []).map((r: any) => ({
    dia: r.dia,
    sucursal: r.sucursal ?? 'sin sucursal',
    numero_ventas: r.numero_ventas,
    unidades: r.unidades ?? 0,
  }))

  if (!filas.length) return <EstadoVacio titulo="Todavía no hay ventas registradas" />

  return (
    <div className="space-y-4">
      <Encabezado
        titulo="Salidas por día"
        detalle="Últimos registros, por ciudad"
        filas={filas}
        archivo="salidas-por-dia"
      />
      <Tabla
        columnas={['Día', 'Ciudad', 'Registros', 'Unidades']}
        filas={(q.data ?? []).map((r: any) => [
          fecha(r.dia),
          r.sucursal ?? '—',
          numero(r.numero_ventas),
          numero(r.unidades ?? 0),
        ])}
      />
    </div>
  )
}

function StockCompleto() {
  const q = useQuery({ queryKey: ['rep-stock'], queryFn: api.stock })
  if (q.isLoading) return <Cargando />
  if (q.isError) return <ErrorCarga onReintentar={() => q.refetch()} />

  const filas = (q.data ?? []).map((r: any) => ({
    sku: r.sku,
    producto: r.producto,
    ubicacion: r.ubicacion,
    tipo: r.tipo_ubicacion,
    cantidad: r.cantidad,
    reservada: r.cantidad_reservada,
    disponible: r.cantidad_disponible,
  }))

  if (!filas.length) return <EstadoVacio titulo="Sin existencias registradas" />

  return (
    <div className="space-y-4">
      <Encabezado
        titulo="Stock completo"
        detalle={`${numero(filas.length)} líneas, producto por ubicación`}
        filas={filas}
        archivo="stock"
      />
      <Tabla
        columnas={['Producto', 'Ubicación', 'Cantidad']}
        filas={(q.data ?? []).map((r: any) => [
          <div key="p">
            <p className="text-slate-900">{r.producto}</p>
            <p className="text-xs text-slate-500">{r.sku}</p>
          </div>,
          r.ubicacion,
          numero(r.cantidad),
        ])}
      />
    </div>
  )
}

function Tabla({ columnas, filas }: { columnas: string[]; filas: any[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            {columnas.map((c, i) => (
              <th key={c} className={`px-4 py-2.5 font-medium ${i ? 'text-right' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((f, i) => (
            <tr key={i}>
              {f.map((celda, j) => (
                <td
                  key={j}
                  className={`px-4 py-2.5 ${j ? 'text-right text-slate-600' : 'text-slate-900'}`}
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

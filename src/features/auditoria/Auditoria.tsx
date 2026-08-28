import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Eye, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { Boton, Campo, Cargando, ErrorCarga, EstadoVacio, Etiqueta, Modal, Selector } from '@/components/ui'
import { descargarExcel } from '@/lib/excel'
import { fechaHora, numero } from '@/lib/formato'
import { api } from '@/lib/supabase'

const TABLAS = [
  'productos', 'inventario', 'ventas', 'ventas_detalle', 'movimientos',
  'transferencias', 'transferencias_detalle', 'clientes', 'deliveries',
  'sucursales', 'usuarios',
]

type Filtros = {
  tabla: string
  accion: '' | 'INSERT' | 'UPDATE' | 'DELETE'
  desde: string
  hasta: string
}

const VACIOS: Filtros = { tabla: '', accion: '', desde: '', hasta: '' }

function isoInicio(dia: string) {
  return dia ? new Date(`${dia}T00:00:00`).toISOString() : undefined
}

function isoFin(dia: string) {
  return dia ? new Date(`${dia}T23:59:59.999`).toISOString() : undefined
}

function cambios(fila: any) {
  if (fila.accion === 'INSERT') return 'Registro creado'
  if (fila.accion === 'DELETE') return 'Registro eliminado'
  const anterior = fila.datos_anteriores ?? {}
  const nuevo = fila.datos_nuevos ?? {}
  const llaves = Object.keys({ ...anterior, ...nuevo }).filter(
    (llave) => JSON.stringify(anterior[llave]) !== JSON.stringify(nuevo[llave]),
  )
  return llaves.length ? llaves.join(', ') : 'Sin cambios de valores'
}

function tono(accion: string): 'verde' | 'ambar' | 'rojo' | 'neutro' {
  if (accion === 'INSERT') return 'verde'
  if (accion === 'UPDATE') return 'ambar'
  if (accion === 'DELETE') return 'rojo'
  return 'neutro'
}

export default function Auditoria() {
  const [filtros, setFiltros] = useState<Filtros>(VACIOS)
  const [detalle, setDetalle] = useState<any | null>(null)
  const [exportando, setExportando] = useState(false)

  const parametros = useMemo(() => ({
    tabla: filtros.tabla,
    accion: filtros.accion,
    desde: isoInicio(filtros.desde),
    hasta: isoFin(filtros.hasta),
    limite: 500,
  }), [filtros])

  const consulta = useQuery({
    queryKey: ['auditoria', parametros],
    queryFn: () => api.auditoria(parametros),
  })

  async function exportar() {
    const filas = consulta.data?.filas ?? []
    setExportando(true)
    try {
      await descargarExcel('auditoria', filas.map((fila: any) => ({
        fecha: fechaHora(fila.fecha),
        tabla: fila.tabla,
        registro_id: fila.registro_id,
        accion: fila.accion,
        usuario: fila.usuario_nombre ?? fila.usuario_email ?? fila.usuario_id ?? 'sistema',
        cambios: cambios(fila),
        datos_anteriores: fila.datos_anteriores ? JSON.stringify(fila.datos_anteriores) : '',
        datos_nuevos: fila.datos_nuevos ? JSON.stringify(fila.datos_nuevos) : '',
      })), 'Auditoría')
    } catch {
      toast.error('No se pudo generar el archivo de auditoría.')
    } finally {
      setExportando(false)
    }
  }

  const filas = consulta.data?.filas ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Auditoría</h1>
          <p className="text-sm text-slate-500">Historial inalterable de cambios importantes</p>
        </div>
        <Boton
          variante="secundario"
          cargando={exportando}
          disabled={!filas.length}
          className="ml-auto"
          onClick={() => void exportar()}
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </Boton>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
        <Selector
          etiqueta="Tabla"
          value={filtros.tabla}
          onChange={(e) => setFiltros((f) => ({ ...f, tabla: e.target.value }))}
        >
          <option value="">Todas</option>
          {TABLAS.map((tabla) => <option key={tabla} value={tabla}>{tabla}</option>)}
        </Selector>
        <Selector
          etiqueta="Acción"
          value={filtros.accion}
          onChange={(e) => setFiltros((f) => ({ ...f, accion: e.target.value as Filtros['accion'] }))}
        >
          <option value="">Todas</option>
          <option value="INSERT">Creación</option>
          <option value="UPDATE">Actualización</option>
          <option value="DELETE">Eliminación</option>
        </Selector>
        <Campo
          etiqueta="Desde"
          type="date"
          value={filtros.desde}
          onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
        />
        <Campo
          etiqueta="Hasta"
          type="date"
          value={filtros.hasta}
          onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))}
        />
        <div className="flex items-end">
          <Boton
            variante="fantasma"
            className="w-full"
            disabled={!Object.values(filtros).some(Boolean)}
            onClick={() => setFiltros(VACIOS)}
          >
            <RotateCcw className="h-4 w-4" />
            Limpiar
          </Boton>
        </div>
      </div>

      {consulta.isLoading ? <Cargando /> : consulta.isError ? (
        <ErrorCarga onReintentar={() => consulta.refetch()} />
      ) : !filas.length ? (
        <EstadoVacio titulo="No hay cambios con estos filtros" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
            Mostrando {numero(filas.length)} de {numero(consulta.data?.total ?? filas.length)} registros
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Tabla / registro</th>
                <th className="px-4 py-2.5 font-medium">Acción</th>
                <th className="px-4 py-2.5 font-medium">Usuario</th>
                <th className="px-4 py-2.5 font-medium">Cambios</th>
                <th className="px-4 py-2.5"><span className="sr-only">Detalle</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((fila: any) => (
                <tr key={fila.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fechaHora(fila.fecha)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{fila.tabla}</p>
                    <p className="max-w-44 truncate font-mono text-xs text-slate-400">{fila.registro_id}</p>
                  </td>
                  <td className="px-4 py-3"><Etiqueta tono={tono(fila.accion)}>{fila.accion}</Etiqueta></td>
                  <td className="px-4 py-3 text-slate-600">
                    {fila.usuario_nombre ?? fila.usuario_email ?? 'Sistema'}
                  </td>
                  <td className="max-w-72 truncate px-4 py-3 text-slate-600" title={cambios(fila)}>
                    {cambios(fila)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Boton variante="fantasma" className="min-h-9 px-3" onClick={() => setDetalle(fila)}>
                      <Eye className="h-4 w-4" />
                      Ver
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal abierto={!!detalle} titulo="Detalle del cambio" onCerrar={() => setDetalle(null)} ancho="max-w-4xl">
        {detalle && (
          <div className="grid gap-4 md:grid-cols-2">
            <BloqueJson titulo="Antes" valor={detalle.datos_anteriores} />
            <BloqueJson titulo="Después" valor={detalle.datos_nuevos} />
          </div>
        )}
      </Modal>
    </div>
  )
}

function BloqueJson({ titulo, valor }: { titulo: string; valor: unknown }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-700">{titulo}</h3>
      <pre className="max-h-[55dvh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
        {valor === null || valor === undefined ? '—' : JSON.stringify(valor, null, 2)}
      </pre>
    </div>
  )
}

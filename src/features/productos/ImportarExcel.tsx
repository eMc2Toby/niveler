import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Boton, Cargando, Modal } from '@/components/ui'
import {
  descargarExcel,
  descargarPlantillaProductos,
  leerProductosExcel,
  type ResultadoImportacion,
} from '@/lib/excel'
import { api } from '@/lib/supabase'

export default function ImportarExcel({ productos }: { productos: any[] }) {
  const input = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [analizando, setAnalizando] = useState(false)
  const [exportando, setExportando] = useState(false)

  const importar = useMutation({
    mutationFn: () => api.importarProductos(resultado?.productos ?? []),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['productos'] })
      toast.success(`${res.total} productos procesados: ${res.creados} nuevos y ${res.actualizados} actualizados.`)
      cerrar()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function cerrar() {
    setResultado(null)
    if (input.current) input.current.value = ''
  }

  async function seleccionar(archivo?: File) {
    if (!archivo) return
    setAnalizando(true)
    try {
      setResultado(await leerProductosExcel(archivo))
    } catch {
      setResultado({
        productos: [],
        errores: [{ fila: 1, mensaje: 'No se pudo leer el archivo. Comprueba que sea un Excel válido.' }],
        totalFilas: 0,
      })
    } finally {
      setAnalizando(false)
    }
  }

  async function exportar() {
    setExportando(true)
    try {
      await descargarExcel('catalogo-productos', productos.map((p) => ({
        sku: p.sku,
        nombre: p.nombre,
        descripcion: p.descripcion ?? '',
        categoria: p.categoria?.nombre ?? '',
        marca: p.marca?.nombre ?? '',
        unidad_medida: p.unidad_medida,
        stock_minimo: p.stock_minimo,
        activo: p.activo,
      })), 'Productos')
    } catch {
      toast.error('No se pudo generar el archivo de Excel.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => void seleccionar(e.target.files?.[0])}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="secundario" cargando={exportando} onClick={() => void exportar()}>
          <Download className="h-4 w-4" />
          Exportar Excel
        </Boton>
        <Boton variante="secundario" cargando={analizando} onClick={() => input.current?.click()}>
          <Upload className="h-4 w-4" />
          Importar Excel
        </Boton>
      </div>

      <Modal abierto={!!resultado} titulo="Revisar importación de productos" onCerrar={cerrar} ancho="max-w-3xl">
        {!resultado ? <Cargando /> : (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4">
              <FileSpreadsheet className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {resultado.totalFilas} filas leídas
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Los SKU existentes se actualizan; las imágenes y el inventario no se modifican.
                  Toda la importación se confirma en una sola transacción.
                </p>
              </div>
            </div>

            {!!resultado.errores.length && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 font-medium text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  Corrige {resultado.errores.length} errores antes de importar
                </div>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-amber-800">
                  {resultado.errores.slice(0, 100).map((error, i) => (
                    <li key={`${error.fila}-${i}`}>Fila {error.fila}: {error.mensaje}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!resultado.productos.length && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">SKU</th>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 font-medium">Categoría</th>
                      <th className="px-3 py-2 text-right font-medium">Mínimo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultado.productos.slice(0, 10).map((producto) => (
                      <tr key={producto.sku}>
                        <td className="px-3 py-2 font-mono text-xs">{producto.sku}</td>
                        <td className="px-3 py-2">{producto.nombre}</td>
                        <td className="px-3 py-2 text-slate-600">{producto.categoria ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{producto.stock_minimo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {resultado.productos.length > 10 && (
                  <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                    Vista previa de 10 de {resultado.productos.length} productos.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
              <Boton variante="fantasma" onClick={() => void descargarPlantillaProductos()}>
                Descargar plantilla
              </Boton>
              <div className="flex gap-2">
                <Boton variante="secundario" onClick={cerrar}>Cancelar</Boton>
                <Boton
                  cargando={importar.isPending}
                  disabled={!resultado.productos.length || !!resultado.errores.length}
                  onClick={() => importar.mutate()}
                >
                  Importar {resultado.productos.length || ''}
                </Boton>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

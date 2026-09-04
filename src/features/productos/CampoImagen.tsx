import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { Imagen } from './Detalle'
import { comprimirAWebp } from '@/lib/imagenes'
import { mensajeError } from '@/lib/utils'

/**
 * Foto del producto.
 *
 * El `accept="image/*"` sin `capture` es deliberado: en el celular abre un
 * menú donde se puede elegir entre tomar la foto o buscarla en la galería,
 * mientras que con `capture` se fuerza la cámara y no se podría subir una
 * foto que ya existe. En PC abre el explorador de archivos, como siempre.
 *
 * La compresión ocurre aquí, antes de subir: lo que viaja son ~20 KB en
 * vez de los 4 MB que pesa la foto de un teléfono.
 */
export function CampoImagen({
  rutaActual, nombre, onElegir,
}: {
  rutaActual: string | null
  nombre: string
  /** Recibe el blob ya comprimido, o null al quitar. */
  onElegir: (blob: Blob | null) => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [peso, setPeso] = useState<{ antes: number; despues: number } | null>(null)
  const [quitada, setQuitada] = useState(false)

  async function elegir(archivo: File | undefined) {
    if (!archivo) return
    setError(''); setProcesando(true)
    try {
      const blob = await comprimirAWebp(archivo)
      setVistaPrevia(URL.createObjectURL(blob))
      setPeso({ antes: archivo.size, despues: blob.size })
      setQuitada(false)
      onElegir(blob)
    } catch (e) {
      setError(mensajeError(e, 'No se pudo procesar la imagen.'))
    } finally {
      setProcesando(false)
    }
  }

  function quitar() {
    setVistaPrevia(null)
    setPeso(null)
    setQuitada(true)
    setError('')
    onElegir(null)
    if (entrada.current) entrada.current.value = ''
  }

  const hayFoto = !!vistaPrevia || (!!rutaActual && !quitada)

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">Foto</span>

      <div className="flex items-center gap-3">
        {vistaPrevia ? (
          <img
            src={vistaPrevia}
            alt="Vista previa"
            className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-cover"
          />
        ) : (
          <Imagen ruta={quitada ? null : rutaActual} nombre={nombre || 'Producto'} />
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              disabled={procesando}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300
                         px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {procesando ? 'Procesando' : hayFoto ? 'Cambiar' : 'Agregar foto'}
            </button>

            {hayFoto && !procesando && (
              <button
                type="button"
                onClick={quitar}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm
                           text-slate-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                Quitar
              </button>
            )}
          </div>

          {peso ? (
            <p className="text-xs text-emerald-700">
              {(peso.antes / 1024 / 1024).toFixed(1)} MB → {(peso.despues / 1024).toFixed(0)} KB
              {' '}· se sube comprimida
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Se reduce sola antes de subir, para que cargue rápido con datos móviles.
            </p>
          )}

          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        </div>
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => elegir(e.target.files?.[0])}
      />
    </div>
  )
}

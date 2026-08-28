import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ Botón */

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma'

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'bg-emerald-700 text-white shadow-sm shadow-emerald-950/15 hover:bg-emerald-800',
  secundario: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50',
  peligro: 'bg-red-600 text-white shadow-sm shadow-red-950/15 hover:bg-red-700',
  fantasma: 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
}

export function Boton({
  variante = 'primario',
  cargando = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton; cargando?: boolean }) {
  return (
    <button
      // 44px de alto: el mínimo cómodo para tocar en el celular con guantes
      // de bodega, que es donde se usa esto la mitad del tiempo.
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm',
        'font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-40',
        VARIANTES[variante],
        className,
      )}
      disabled={disabled || cargando}
      {...props}
    >
      {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ Campo */

export const Campo = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { etiqueta?: string; error?: string; ayuda?: string }
>(function Campo({ etiqueta, error, ayuda, className, id, ...props }, ref) {
  const idCampo = id ?? props.name
  return (
    <div>
      {etiqueta && (
        <label htmlFor={idCampo} className="mb-1.5 block text-sm font-medium text-slate-700">
          {etiqueta}
        </label>
      )}
      <input
        ref={ref}
        id={idCampo}
        aria-invalid={!!error}
        className={cn(
          'w-full rounded-xl border bg-white px-3.5 py-2.5 text-slate-900 shadow-sm shadow-slate-900/[0.025]',
          'placeholder:text-slate-400 transition focus:outline-none focus:ring-2',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/25'
            : 'border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20',
          className,
        )}
        {...props}
      />
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-red-600">{error}</p>
      ) : ayuda ? (
        <p className="mt-1.5 text-sm text-slate-500">{ayuda}</p>
      ) : null}
    </div>
  )
})

/* ----------------------------------------------------------------- Select */

export function Selector({
  etiqueta, error, className, children, id, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { etiqueta?: string; error?: string }) {
  const idCampo = id ?? props.name
  return (
    <div>
      {etiqueta && (
        <label htmlFor={idCampo} className="mb-1.5 block text-sm font-medium text-slate-700">
          {etiqueta}
        </label>
      )}
      <select
        id={idCampo}
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm shadow-slate-900/[0.025]',
          'transition hover:border-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
          error && 'border-red-400',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p role="alert" className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ Badge */

export function Etiqueta({
  tono = 'neutro', children,
}: { tono?: 'neutro' | 'verde' | 'ambar' | 'rojo'; children: ReactNode }) {
  const tonos = {
    neutro: 'bg-slate-100 text-slate-700',
    verde: 'bg-emerald-100 text-emerald-800',
    ambar: 'bg-amber-100 text-amber-800',
    rojo: 'bg-red-100 text-red-800',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', tonos[tono])}>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ Modal */

export function Modal({
  abierto, titulo, onCerrar, children, ancho = 'max-w-lg',
}: {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
  ancho?: string
}) {
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-6">
      {/* En móvil sube desde abajo como una hoja; en PC es un diálogo centrado. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          'flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl',
          ancho,
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="font-semibold tracking-tight text-slate-950">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- Estados vacíos */

export function EstadoVacio({
  titulo, detalle, accion,
}: { titulo: string; detalle?: string; accion?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center shadow-sm">
      <p className="font-medium text-slate-900">{titulo}</p>
      {detalle && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{detalle}</p>}
      {accion && <div className="mt-5 flex justify-center">{accion}</div>}
    </div>
  )
}

export function Cargando({ className }: { className?: string }) {
  return (
    <div className={cn('grid place-items-center py-16', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200', className)} />
}

export function ErrorCarga({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center shadow-sm">
      <p className="font-medium text-red-900">No se pudieron cargar los datos</p>
      <p className="mt-1 text-sm text-red-700">Revisa tu conexión.</p>
      <Boton variante="peligro" className="mt-4" onClick={onReintentar}>
        Reintentar
      </Boton>
    </div>
  )
}

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Une clases de Tailwind resolviendo las que se contradicen. */
export const cn = (...clases: ClassValue[]) => twMerge(clsx(clases))

/** Quita tildes y pasa a minúsculas: buscar "camion" encuentra "camión". */
export const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Mensaje legible a partir de cualquier cosa que se haya lanzado. */
export const mensajeError = (e: unknown, respaldo = 'Algo salió mal. Inténtalo de nuevo.') =>
  e instanceof Error && e.message ? e.message : respaldo

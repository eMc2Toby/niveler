import { toast } from 'sonner'
import { esResultadoPendiente } from './outbox'

/** Evita presentar como confirmada una operación que todavía vive en la cola local. */
export function avisarSiPendiente(resultado: unknown) {
  if (!esResultadoPendiente(resultado)) return false
  toast.info('Guardado en este dispositivo. Se confirmará al recuperar conexión.')
  return true
}

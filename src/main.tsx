import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/globals.css'

/** Retira solamente los datos locales de la sincronización anterior. */
function retirarSincronizacionAnterior() {
  if ('caches' in window) {
    void Promise.all([
      window.caches.delete('datos-api'),
      window.caches.delete('imagenes-productos'),
    ])
      .catch(() => undefined)
  }

  if ('indexedDB' in window) window.indexedDB.deleteDatabase('niveler-local')
}

retirarSincronizacionAnterior()
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

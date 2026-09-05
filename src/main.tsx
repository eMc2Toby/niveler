import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

/** Retira datos y workers que pudieron dejar instalados versiones anteriores. */
function retirarModoSinConexionAnterior() {
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registros) => Promise.all(registros.map((registro) => registro.unregister())))
      .catch(() => undefined)
  }

  if ('caches' in window) {
    void window.caches
      .keys()
      .then((nombres) => Promise.all(nombres.map((nombre) => window.caches.delete(nombre))))
      .catch(() => undefined)
  }

  if ('indexedDB' in window) window.indexedDB.deleteDatabase('niveler-local')
}

retirarModoSinConexionAnterior()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

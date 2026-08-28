import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/globals.css'

async function iniciar() {
  // Versiones anteriores guardaban respuestas autenticadas de Supabase en
  // Cache Storage. Se eliminan antes de montar React para que ninguna
  // consulta inicial pueda reutilizar datos de una sesion anterior.
  if ('caches' in window) await window.caches.delete('datos-api')

  // Cuando se publica una version nueva, se aplica sin intervencion manual.
  registerSW({ immediate: true })

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void iniciar()

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Boxes, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { entrar, recuperar } = useAuth()
  const navegar = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setError(''); setAviso(''); setEnviando(true)
    try {
      await entrar(email.trim(), password)
      navegar('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.')
    } finally {
      setEnviando(false)
    }
  }

  async function olvide() {
    if (!email.trim()) { setError('Escribe tu correo y vuelve a tocar el enlace.'); return }
    setError('')
    try {
      await recuperar(email.trim())
      setAviso('Te enviamos un enlace para crear una contraseña nueva.')
    } catch {
      setError('No se pudo enviar el correo. Inténtalo en un momento.')
    }
  }

  return (
    <div className="min-h-dvh bg-slate-900 flex flex-col justify-center px-6 py-12">
      <div className="w-full max-w-sm mx-auto">

        <div className="flex items-center gap-3 mb-10">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500">
            <Boxes className="h-6 w-6 text-slate-900" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Niveler</h1>
            <p className="text-sm text-slate-400">Control de inventario</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-3 text-white
                         placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none
                         focus:ring-2 focus:ring-emerald-500/30"
              placeholder="nombre@niveler.bo"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviar()}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-3 pr-11 text-white
                           focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                type="button"
                onClick={() => setVerPassword(!verPassword)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {verPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}
          {aviso && (
            <p className="rounded-lg bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300">
              {aviso}
            </p>
          )}

          <button
            onClick={enviar}
            disabled={enviando || !email || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3
                       font-semibold text-slate-900 transition hover:bg-emerald-400
                       disabled:opacity-40 disabled:hover:bg-emerald-500"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? 'Entrando' : 'Entrar'}
          </button>

          <button
            onClick={olvide}
            className="w-full py-1 text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
          >
            Olvidé mi contraseña
          </button>
        </div>

        <p className="mt-10 text-center text-sm text-slate-400">
          ¿No tienes cuenta?{' '}
          <Link to="/crear-cuenta" className="font-medium text-emerald-400 hover:underline">
            Crear una
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          Un administrador tiene que activarla antes de que puedas ver datos.
        </p>
      </div>
    </div>
  )
}

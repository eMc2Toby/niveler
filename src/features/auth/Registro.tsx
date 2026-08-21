import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Boxes, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { mensajeError } from '@/lib/utils'

/**
 * Alta de cuenta, hecha por la propia persona.
 *
 * No es un formulario de administrador por una razón concreta: crear
 * usuarios con la API de admin de Supabase exige la service_role key, que
 * se salta todas las políticas RLS y por eso no puede estar en el
 * navegador. El camino seguro es al revés: cada uno se registra, la cuenta
 * nace inactiva y sin permisos, y un administrador la habilita desde
 * Usuarios. Mientras tanto puede entrar, pero no ve ni un dato.
 */
export default function Registro() {
  const { registrar } = useAuth()
  const navegar = useNavigate()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setError(''); setEnviando(true)
    try {
      setListo(await registrar(email.trim(), password, nombre.trim()))
    } catch (e) {
      setError(mensajeError(e, 'No se pudo crear la cuenta.'))
    } finally {
      setEnviando(false)
    }
  }

  if (listo) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-900 px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 grid h-11 w-11 place-items-center rounded-xl bg-emerald-500">
            <Boxes className="h-6 w-6 text-slate-900" strokeWidth={2.5} />
          </div>
          <h1 className="mb-2 text-lg font-semibold text-white">Cuenta creada</h1>
          <p className="mb-6 text-sm text-slate-400">{listo}</p>
          <button
            onClick={() => navegar('/entrar', { replace: true })}
            className="text-sm font-medium text-emerald-400 hover:underline"
          >
            Ir a entrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-slate-900 px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500">
            <Boxes className="h-6 w-6 text-slate-900" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Crear cuenta</h1>
            <p className="text-sm text-slate-400">Un administrador la activará</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="nombre" className="mb-1.5 block text-sm font-medium text-slate-300">
              Nombre completo
            </label>
            <input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-3 text-white
                         placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none
                         focus:ring-2 focus:ring-emerald-500/30"
              placeholder="María Quispe"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
              Correo
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-3 text-white
                         placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none
                         focus:ring-2 focus:ring-emerald-500/30"
              placeholder="nombre@niveler.bo"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={verPassword ? 'text' : 'password'}
                autoComplete="new-password"
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
            <p className="mt-1.5 text-xs text-slate-500">Al menos 6 caracteres</p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            onClick={enviar}
            disabled={enviando || !email || !password || nombre.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3
                       font-semibold text-slate-900 transition hover:bg-emerald-400
                       disabled:opacity-40 disabled:hover:bg-emerald-500"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? 'Creando' : 'Crear cuenta'}
          </button>

          <Link
            to="/entrar"
            className="block py-1 text-center text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">
          La cuenta nace sin permisos: hasta que un administrador le asigne rol y
          sucursal, no se ve ningún dato.
        </p>
      </div>
    </div>
  )
}

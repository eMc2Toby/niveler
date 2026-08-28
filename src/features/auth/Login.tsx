import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Boxes, Eye, EyeOff, Loader2, ArrowRight,
  BarChart3, ShieldCheck, Warehouse,
} from 'lucide-react'
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
    <div className="grid min-h-dvh bg-[#eef3f0] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#10251e] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="pointer-events-none absolute -right-28 -top-28 h-[34rem] w-[34rem] rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[30rem] w-[30rem] rounded-full bg-teal-300/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-emerald-950 shadow-lg shadow-black/20">
            <Boxes className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Niveler</h1>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-100/50">
              Control de inventario
            </p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Operación centralizada</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.15] tracking-tight xl:text-5xl">
            Toda tu operación,<br />bajo control.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-emerald-50/60 xl:text-lg">
            Inventario, ventas y transferencias conectados en tiempo real para todas las sucursales de Niveler.
          </p>

          <div className="mt-10 grid max-w-lg gap-3 sm:grid-cols-3">
            {[
              { Icono: Warehouse, texto: 'Stock por ciudad' },
              { Icono: BarChart3, texto: 'Reportes claros' },
              { Icono: ShieldCheck, texto: 'Acceso seguro' },
            ].map(({ Icono, texto }) => (
              <div key={texto} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <Icono className="h-5 w-5 text-emerald-300" />
                <p className="mt-3 text-sm font-medium text-emerald-50/80">{texto}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-emerald-100/35">Niveler · Plataforma interna de operaciones</p>
      </section>

      <section className="relative flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#10251e] text-emerald-300 shadow-lg shadow-emerald-950/15">
              <Boxes className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-950">Niveler</p>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-emerald-700">Inventario</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white p-6 shadow-[0_24px_80px_rgb(15_23_42/0.10)] sm:p-8">
            <div className="mb-7">
              <p className="nv-kicker">Acceso al sistema</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Bienvenido de nuevo</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Ingresa con la cuenta asignada por el administrador.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                enviar()
              }}
            >
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Correo
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-slate-950 shadow-sm
                             placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none
                             focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="nombre@niveler.bo"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={olvide}
                    className="text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline"
                  >
                    ¿La olvidaste?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={verPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 pr-11 text-slate-950 shadow-sm
                               focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword(!verPassword)}
                    aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    {verPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              {aviso && (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
                  {aviso}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando || !email || !password}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#147a58] px-4 py-3.5
                           font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-[#106849]
                           disabled:opacity-40 disabled:hover:bg-[#147a58]"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
                {enviando ? 'Entrando' : 'Entrar al sistema'}
              </button>
            </form>

            <div className="mt-7 border-t border-slate-100 pt-6 text-center">
              <p className="text-sm text-slate-500">
                ¿No tienes cuenta?{' '}
                <Link to="/crear-cuenta" className="font-semibold text-emerald-700 hover:underline">
                  Crear una
                </Link>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Un administrador debe activar la cuenta antes de mostrar datos.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

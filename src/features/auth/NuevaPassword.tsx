import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * Pantalla a la que lleva el correo de "olvidé mi contraseña".
 *
 * Supabase abre este enlace con una sesión de recuperación ya establecida
 * (viene en el fragmento de la URL y el cliente la levanta solo). Por eso
 * aquí no se pide la contraseña vieja: basta con escribir la nueva.
 *
 * Si alguien entra directo, sin venir del correo, no hay sesión y se le
 * dice que pida el enlace de nuevo, en vez de dejarlo escribiendo en un
 * formulario que iba a fallar.
 */
export default function NuevaPassword() {
  const navegar = useNavigate()
  const [hayEnlace, setHayEnlace] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHayEnlace(!!data.session))
  }, [])

  async function guardar() {
    setError(''); setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setGuardando(false)
    if (error) {
      setError(
        error.message.includes('at least')
          ? 'La contraseña debe tener al menos 6 caracteres.'
          : 'No se pudo cambiar la contraseña. Pide el enlace de nuevo.',
      )
      return
    }
    navegar('/', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-slate-900 px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500">
            <Boxes className="h-6 w-6 text-slate-900" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Nueva contraseña</h1>
            <p className="text-sm text-slate-400">Elige una y entras directo</p>
          </div>
        </div>

        {hayEnlace === false ? (
          <div className="space-y-5">
            <p className="rounded-lg bg-amber-500/10 px-3.5 py-3 text-sm text-amber-200">
              Este enlace ya no es válido o entraste sin pasar por el correo. Pide
              uno nuevo desde "Olvidé mi contraseña".
            </p>
            <button
              onClick={() => navegar('/entrar', { replace: true })}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-900 hover:bg-emerald-400"
            >
              Volver a entrar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
                Contraseña nueva
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={ver ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && password.length >= 6 && guardar()}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-3 pr-11 text-white
                             focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <button
                  type="button"
                  onClick={() => setVer(!ver)}
                  aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
              onClick={guardar}
              disabled={guardando || password.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3
                         font-semibold text-slate-900 transition hover:bg-emerald-400
                         disabled:opacity-40 disabled:hover:bg-emerald-500"
            >
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              {guardando ? 'Guardando' : 'Guardar y entrar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

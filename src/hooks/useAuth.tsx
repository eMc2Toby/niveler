import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type Perfil = {
  id: string
  nombre_completo: string
  email: string
  activo: boolean
  sucursal_id: string | null
  rol: { codigo: string; nombre: string; nivel: number }
  sucursal: { id: string; nombre: string; ciudad: string } | null
  delivery_id: string | null
  ubicacion_id: string | null   // la bodega o el stock que le corresponde
}

type ContextoAuth = {
  sesion: Session | null
  perfil: Perfil | null
  cargando: boolean
  entrar: (email: string, password: string) => Promise<void>
  registrar: (email: string, password: string, nombre: string) => Promise<string>
  salir: () => Promise<void>
  recuperar: (email: string) => Promise<void>
}

const Auth = createContext<ContextoAuth | null>(null)

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)

  async function cargarPerfil(userId: string) {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id, nombre_completo, email, activo, sucursal_id,
        rol:roles ( codigo, nombre, nivel ),
        sucursal:sucursales ( id, nombre, ciudad )
      `)
      .eq('id', userId)
      .single()

    if (error || !data) { setPerfil(null); return }

    // ¿Es repartidor? Entonces su stock vive en su propia ubicación.
    const { data: delivery } = await supabase
      .from('deliveries')
      .select('id')
      .eq('usuario_id', userId)
      .maybeSingle()

    const { data: ubicacion } = await supabase
      .from('ubicaciones')
      .select('id')
      .or(
        delivery?.id
          ? `delivery_id.eq.${delivery.id}`
          : `sucursal_id.eq.${data.sucursal_id ?? '00000000-0000-0000-0000-000000000000'}`
      )
      .maybeSingle()

    setPerfil({
      ...(data as any),
      delivery_id: delivery?.id ?? null,
      ubicacion_id: ubicacion?.id ?? null,
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSesion(data.session)
      if (data.session) await cargarPerfil(data.session.user.id)
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, nuevaSesion) => {
      setSesion(nuevaSesion)
      if (nuevaSesion) await cargarPerfil(nuevaSesion.user.id)
      else setPerfil(null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const valor: ContextoAuth = {
    sesion,
    perfil,
    cargando,
    async entrar(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // Traducimos los mensajes de Supabase, que vienen en inglés.
        if (error.message.includes('Invalid login')) throw new Error('Correo o contraseña incorrectos.')
        if (error.message.includes('Email not confirmed')) throw new Error('Falta confirmar el correo. Revisa tu bandeja de entrada.')
        throw new Error('No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.')
      }
    },
    /**
     * Alta de cuenta. La hace la propia persona desde el login, no un
     * administrador: crear un usuario con la API de admin exigiría la
     * service_role key, y esa clave no puede vivir en el navegador.
     *
     * El trigger `fn_nuevo_usuario` de la base recibe el alta y crea el
     * perfil INACTIVO y con el rol más bajo. Hasta que un admin lo apruebe
     * en Usuarios, la cuenta entra pero no ve nada.
     */
    async registrar(email, password, nombre) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre_completo: nombre } },
      })
      if (error) {
        if (error.message.includes('already registered'))
          throw new Error('Ese correo ya tiene una cuenta. Intenta entrar.')
        if (error.message.includes('at least'))
          throw new Error('La contraseña debe tener al menos 6 caracteres.')
        throw new Error('No se pudo crear la cuenta. Revisa el correo e inténtalo de nuevo.')
      }
      // Con confirmación de correo activada, la sesión llega vacía y hay
      // que confirmar antes de poder entrar.
      return data.session
        ? 'Cuenta creada. Un administrador debe activarla antes de que puedas usarla.'
        : 'Cuenta creada. Revisa tu correo para confirmarla, y pídele a un administrador que la active.'
    },

    async salir() {
      await supabase.auth.signOut()
      setPerfil(null)
    },
    async recuperar(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/nueva-password`,
      })
      if (error) throw new Error('No se pudo enviar el correo de recuperación.')
    },
  }

  return <Auth.Provider value={valor}>{children}</Auth.Provider>
}

export function useAuth() {
  const ctx = useContext(Auth)
  if (!ctx) throw new Error('useAuth debe usarse dentro de ProveedorAuth')
  return ctx
}

/** Nivel mínimo requerido para una acción. Refleja las políticas RLS. */
export function usePermisos() {
  const { perfil } = useAuth()
  const nivel = perfil?.rol?.nivel ?? 0
  return {
    nivel,
    esAdmin: nivel >= 100,
    verTodasLasSucursales: nivel >= 80,
    editarProductos: nivel >= 60,
    ajustarStock: nivel >= 60,
    anularVentas: nivel >= 60,
    moverStock: nivel >= 40,
    editarClientes: nivel >= 30,
    vender: nivel >= 10,
    esDelivery: perfil?.rol?.codigo === 'DELIVERY',
  }
}

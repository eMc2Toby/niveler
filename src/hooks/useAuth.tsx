import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { activarSincronizacionOutbox } from '@/lib/offline/outbox'
import { esErrorConexion, guardarCacheUsuario, leerCacheUsuario } from '@/lib/offline/cache'
import { limpiarDatosLocales } from '@/lib/offline/db'

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

/** Elimina la cache REST creada por versiones anteriores de la PWA. */
async function limpiarCacheDatos() {
  if ('caches' in window) await window.caches.delete('datos-api')
}

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [sesion, setSesion] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)
  const ultimoUsuario = useRef<string | null>(null)

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

    if (error || !data) {
      const local = error && esErrorConexion(error)
        ? await leerCacheUsuario<Perfil>(userId, 'perfil')
        : undefined
      setPerfil(local ?? null)
      return
    }

    // ¿Es repartidor? Entonces su stock vive en su propia ubicación.
    const { data: delivery } = await supabase
      .from('deliveries')
      .select('id')
      .eq('usuario_id', userId)
      .maybeSingle()

    const esDelivery = (data as any).rol?.codigo === 'DELIVERY'

    // Un repartidor sin ficha de delivery vinculada NO hereda la bodega de
    // su sucursal: si lo hiciera podría vender del stock de la sucursal
    // como si fuera suyo. Se queda sin ubicación hasta que un admin lo
    // vincule desde Deliveries, y la app se lo dice al entrar.
    const filtro = delivery?.id
      ? `delivery_id.eq.${delivery.id}`
      : esDelivery
        ? null
        : `sucursal_id.eq.${data.sucursal_id ?? '00000000-0000-0000-0000-000000000000'}`

    const { data: ubicacion } = filtro
      ? await supabase.from('ubicaciones').select('id').or(filtro).maybeSingle()
      : { data: null }

    const perfilCargado: Perfil = {
      ...(data as any),
      delivery_id: delivery?.id ?? null,
      ubicacion_id: ubicacion?.id ?? null,
    }
    setPerfil(perfilCargado)
    await guardarCacheUsuario(userId, 'perfil', perfilCargado)
  }

  useEffect(() => {
    // Las respuestas REST autenticadas no deben sobrevivir a un cambio de
    // usuario. La version actual ya no las guarda, pero limpiamos la cache
    // que pudo dejar instalada una version anterior del service worker.
    void limpiarCacheDatos()

    supabase.auth.getSession().then(async ({ data }) => {
      setSesion(data.session)
      if (data.session) {
        ultimoUsuario.current = data.session.user.id
        await cargarPerfil(data.session.user.id)
      }
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (evento, nuevaSesion) => {
      const anterior = ultimoUsuario.current
      setSesion(nuevaSesion)
      if (nuevaSesion) {
        if (anterior && anterior !== nuevaSesion.user.id) await limpiarDatosLocales(anterior)
        ultimoUsuario.current = nuevaSesion.user.id
        await cargarPerfil(nuevaSesion.user.id)
      }
      else {
        setPerfil(null)
        if (evento === 'SIGNED_OUT') {
          queryClient.clear()
          if (anterior) await limpiarDatosLocales(anterior)
          ultimoUsuario.current = null
          void limpiarCacheDatos()
        }
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [queryClient])

  useEffect(() => {
    if (!sesion?.user.id) return
    return activarSincronizacionOutbox(sesion.user.id)
  }, [sesion?.user.id])

  const valor: ContextoAuth = {
    sesion,
    perfil,
    cargando,
    async entrar(email, password) {
      setCargando(true)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setCargando(false)
        // Traducimos los mensajes de Supabase, que vienen en inglés.
        if (error.message.includes('Invalid login')) throw new Error('Correo o contraseña incorrectos.')
        if (error.message.includes('Email not confirmed')) throw new Error('Falta confirmar el correo. Revisa tu bandeja de entrada.')
        throw new Error('No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.')
      }
      setSesion(data.session)
      if (data.user) await cargarPerfil(data.user.id)
      setCargando(false)
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
      const usuarioId = sesion?.user.id
      await supabase.auth.signOut()
      setPerfil(null)
      queryClient.clear()
      if (usuarioId) await limpiarDatosLocales(usuarioId)
      await limpiarCacheDatos()
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
    anularMovimientos: nivel >= 60,
    anularVentas: nivel >= 60,
    moverStock: nivel >= 40,
    editarClientes: nivel >= 30,
    vender: nivel >= 10,
    esDelivery: perfil?.rol?.codigo === 'DELIVERY',
  }
}

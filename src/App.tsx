import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Toaster } from 'sonner'

import { ProveedorAuth, useAuth, usePermisos } from '@/hooks/useAuth'
import Layout from '@/components/layout/Layout'
import Login from '@/features/auth/Login'
import Registro from '@/features/auth/Registro'
import NuevaPassword from '@/features/auth/NuevaPassword'
import Dashboard from '@/features/dashboard/Dashboard'
import ListaProductos from '@/features/productos/Lista'
import Inventario from '@/features/inventario/Inventario'
import Movimientos from '@/features/movimientos/Movimientos'
import Transferencias from '@/features/transferencias/Transferencias'
import Ventas from '@/features/ventas/Ventas'
import Clientes from '@/features/clientes/Clientes'
import Deliveries from '@/features/deliveries/Deliveries'
import Sucursales from '@/features/sucursales/Sucursales'
import Usuarios from '@/features/usuarios/Usuarios'
import Reportes from '@/features/reportes/Reportes'
import Auditoria from '@/features/auditoria/Auditoria'

const Encomiendas = lazy(() => import('@/features/encomiendas/Encomiendas'))
const Sincronizacion = lazy(() => import('@/features/offline/Sincronizacion'))

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true, // al volver a la app, datos frescos
    },
  },
})

/** Bloquea las rutas hasta que haya sesión, perfil y cuenta activa. */
function RutaProtegida({ children, nivel = 10 }: { children: React.ReactNode; nivel?: number }) {
  const { sesion, perfil, cargando, salir } = useAuth()
  const { nivel: nivelActual } = usePermisos()

  if (cargando) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!sesion) return <Navigate to="/entrar" replace />

  // Evita un bucle de redireccion a "/" cuando hay sesion pero el perfil
  // no pudo cargarse (RLS incompleta, migracion pendiente o corte de red).
  if (!perfil) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 px-6">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <h2 className="mb-2 text-lg font-semibold text-slate-900">No se pudo cargar tu perfil</h2>
          <p className="mb-6 text-sm text-slate-600">
            Revisa la conexión e intenta entrar otra vez. Si continúa, falta aplicar una migración
            o vincular tu cuenta con el perfil de usuarios.
          </p>
          <button onClick={salir} className="text-sm font-medium text-emerald-600 hover:underline">
            Volver a entrar
          </button>
        </div>
      </div>
    )
  }

  // Los usuarios nuevos nacen inactivos hasta que un admin los aprueba.
  if (!perfil.activo) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 px-6">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-500" />
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Cuenta pendiente de activación</h2>
          <p className="mb-6 text-sm text-slate-600">
            Tu cuenta existe pero todavía no tiene permisos asignados. Pídele al administrador
            que la active y vuelve a entrar.
          </p>
          <button onClick={salir} className="text-sm font-medium text-emerald-600 hover:underline">
            Salir
          </button>
        </div>
      </div>
    )
  }

  if (nivelActual < nivel) return <Navigate to="/" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <ProveedorAuth>
          <Toaster position="top-center" richColors />
          <Routes>
            <Route path="/entrar" element={<Login />} />
            <Route path="/crear-cuenta" element={<Registro />} />
            <Route path="/nueva-password" element={<NuevaPassword />} />

            <Route
              element={
                <RutaProtegida>
                  <Layout />
                </RutaProtegida>
              }
            >
              <Route index element={<Dashboard />} />

              <Route path="productos" element={<ListaProductos />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="ventas" element={<Ventas />} />
              <Route
                path="sincronizacion"
                element={<Suspense fallback={<Loader2 className="m-auto h-6 w-6 animate-spin" />}><Sincronizacion /></Suspense>}
              />
              <Route
                path="encomiendas"
                element={
                  <Suspense fallback={<div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}>
                    <Encomiendas />
                  </Suspense>
                }
              />

              <Route
                path="movimientos"
                element={<RutaProtegida nivel={40}><Movimientos /></RutaProtegida>}
              />
              <Route
                path="transferencias"
                element={<RutaProtegida nivel={40}><Transferencias /></RutaProtegida>}
              />
              <Route
                path="deliveries"
                element={<RutaProtegida nivel={40}><Deliveries /></RutaProtegida>}
              />
              <Route
                path="clientes"
                element={<RutaProtegida nivel={30}><Clientes /></RutaProtegida>}
              />
              <Route
                path="reportes"
                element={<RutaProtegida nivel={60}><Reportes /></RutaProtegida>}
              />
              <Route
                path="auditoria"
                element={<RutaProtegida nivel={80}><Auditoria /></RutaProtegida>}
              />
              <Route
                path="sucursales"
                element={<RutaProtegida nivel={100}><Sucursales /></RutaProtegida>}
              />
              <Route
                path="usuarios"
                element={<RutaProtegida nivel={100}><Usuarios /></RutaProtegida>}
              />

            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProveedorAuth>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

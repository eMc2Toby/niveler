import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Toaster } from 'sonner'

import { ProveedorAuth, useAuth, usePermisos } from '@/hooks/useAuth'
import Layout from '@/components/layout/Layout'
import Login from '@/features/auth/Login'
import Dashboard from '@/features/dashboard/Dashboard'
import ListaProductos from '@/features/productos/Lista'

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

  // Los usuarios nuevos nacen inactivos hasta que un admin los aprueba.
  if (perfil && !perfil.activo) {
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

/** Marcador temporal para las pantallas de las fases siguientes. */
function EnConstruccion({ modulo }: { modulo: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <p className="font-medium text-slate-900">{modulo}</p>
      <p className="mt-1 text-sm text-slate-500">Este módulo se construye en la siguiente fase.</p>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <ProveedorAuth>
          <Toaster position="top-center" richColors />
          <Routes>
            <Route path="/entrar" element={<Login />} />

            <Route
              element={
                <RutaProtegida>
                  <Layout />
                </RutaProtegida>
              }
            >
              <Route index element={<Dashboard />} />

              {/* Fase 1 */}
              <Route path="productos" element={<ListaProductos />} />

              {/* Fase 2 */}
              <Route path="inventario" element={<EnConstruccion modulo="Inventario" />} />
              <Route
                path="movimientos"
                element={<RutaProtegida nivel={40}><EnConstruccion modulo="Movimientos" /></RutaProtegida>}
              />

              {/* Fase 3 */}
              <Route
                path="transferencias"
                element={<RutaProtegida nivel={40}><EnConstruccion modulo="Transferencias" /></RutaProtegida>}
              />

              {/* Fase 4 */}
              <Route path="ventas" element={<EnConstruccion modulo="Ventas" />} />
              <Route
                path="clientes"
                element={<RutaProtegida nivel={30}><EnConstruccion modulo="Clientes" /></RutaProtegida>}
              />

              {/* Fase 5 */}
              <Route
                path="deliveries"
                element={<RutaProtegida nivel={40}><EnConstruccion modulo="Deliveries" /></RutaProtegida>}
              />

              {/* Fase 6 y 7 */}
              <Route
                path="reportes"
                element={<RutaProtegida nivel={60}><EnConstruccion modulo="Reportes" /></RutaProtegida>}
              />
              <Route
                path="sucursales"
                element={<RutaProtegida nivel={100}><EnConstruccion modulo="Sucursales" /></RutaProtegida>}
              />
              <Route
                path="usuarios"
                element={<RutaProtegida nivel={100}><EnConstruccion modulo="Usuarios" /></RutaProtegida>}
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProveedorAuth>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Warehouse, ArrowLeftRight, Truck,
  ShoppingCart, Users, FileBarChart, Building2, ArrowRightLeft,
  LogOut, WifiOff, Boxes, History,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth, usePermisos } from '@/hooks/useAuth'

type Item = {
  a: string
  texto: string
  Icono: typeof LayoutDashboard
  nivel: number       // nivel mínimo para verlo
  enMovil?: boolean   // aparece en la barra inferior del celular
}

// El menú se arma según el rol. Un repartidor ve cuatro opciones;
// el gerente ve todo. La restricción real está en RLS: esto solo
// evita mostrar pantallas que igual devolverían vacío.
const MENU: Item[] = [
  { a: '/',                texto: 'Inicio',        Icono: LayoutDashboard, nivel: 10, enMovil: true },
  { a: '/inventario',      texto: 'Inventario',    Icono: Warehouse,       nivel: 10, enMovil: true },
  { a: '/productos',       texto: 'Productos',     Icono: Package,         nivel: 10, enMovil: true },
  { a: '/ventas',          texto: 'Ventas',        Icono: ShoppingCart,    nivel: 10, enMovil: true },
  { a: '/movimientos',     texto: 'Movimientos',   Icono: ArrowLeftRight,  nivel: 40 },
  { a: '/transferencias',  texto: 'Transferencias',Icono: ArrowRightLeft,  nivel: 40 },
  { a: '/deliveries',      texto: 'Deliveries',    Icono: Truck,           nivel: 40 },
  { a: '/clientes',        texto: 'Clientes',      Icono: Users,           nivel: 30 },
  { a: '/reportes',        texto: 'Reportes',      Icono: FileBarChart,    nivel: 60 },
  { a: '/auditoria',       texto: 'Auditoría',     Icono: History,         nivel: 80 },
  { a: '/sucursales',      texto: 'Sucursales',    Icono: Building2,       nivel: 100 },
  { a: '/usuarios',        texto: 'Usuarios',      Icono: Users,           nivel: 100 },
]

export default function Layout() {
  const { perfil, salir } = useAuth()
  const { nivel } = usePermisos()
  const { pathname } = useLocation()
  const [enLinea, setEnLinea] = useState(navigator.onLine)

  useEffect(() => {
    const sube = () => setEnLinea(true)
    const baja = () => setEnLinea(false)
    window.addEventListener('online', sube)
    window.addEventListener('offline', baja)
    return () => {
      window.removeEventListener('online', sube)
      window.removeEventListener('offline', baja)
    }
  }, [])

  const visibles = MENU.filter((i) => nivel >= i.nivel)
  const enMovil = visibles.filter((i) => i.enMovil).slice(0, 4)
  const titulo = visibles.find((i) => i.a === pathname)?.texto ?? 'Niveler'

  return (
    <div className="min-h-dvh bg-slate-50">

      {/* ---------- Sidebar: solo PC ---------- */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500">
            <Boxes className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold tracking-tight text-slate-900">Niveler</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {visibles.map(({ a, texto, Icono }) => (
            <NavLink
              key={a}
              to={a}
              end={a === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-emerald-50 font-medium text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icono className="h-[18px] w-[18px]" />
              {texto}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium text-slate-900">{perfil?.nombre_completo}</p>
            <p className="truncate text-xs text-slate-500">
              {perfil?.rol?.nombre}
              {perfil?.sucursal ? ` · ${perfil.sucursal.ciudad}` : ''}
            </p>
          </div>
          <button
            onClick={salir}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Salir
          </button>
        </div>
      </aside>

      {/* ---------- Header: solo móvil ---------- */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 lg:hidden">
        <h1 className="font-semibold tracking-tight text-slate-900">{titulo}</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{perfil?.sucursal?.ciudad}</span>
          <button onClick={salir} aria-label="Salir" className="text-slate-400 hover:text-slate-700">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ---------- Aviso de conexión ---------- */}
      {!enLinea && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
          <WifiOff className="h-4 w-4" />
          Sin conexión. Puedes consultar, pero no registrar movimientos.
        </div>
      )}

      {/* ---------- Contenido ---------- */}
      <main className="px-4 pb-24 pt-4 lg:ml-60 lg:px-8 lg:pb-8 lg:pt-8">
        <Outlet />
      </main>

      {/* ---------- Barra inferior: solo móvil ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white
                      pb-[env(safe-area-inset-bottom)] lg:hidden">
        {enMovil.map(({ a, texto, Icono }) => (
          <NavLink
            key={a}
            to={a}
            end={a === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
                isActive ? 'text-emerald-600' : 'text-slate-500'
              }`
            }
          >
            <Icono className="h-[22px] w-[22px]" />
            {texto}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

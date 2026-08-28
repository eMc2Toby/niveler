import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Warehouse, ArrowLeftRight, Truck,
  ShoppingCart, Users, FileBarChart, Building2, ArrowRightLeft,
  LogOut, WifiOff, Boxes, History, Menu, X, MapPin, ShieldCheck, PackageOpen,
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
  { a: '/encomiendas',     texto: 'Encomiendas',   Icono: PackageOpen,     nivel: 10 },
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
  const [menuAbierto, setMenuAbierto] = useState(false)

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

  useEffect(() => setMenuAbierto(false), [pathname])

  const visibles = MENU.filter((i) => nivel >= i.nivel)
  const enMovil = visibles.filter((i) => i.enMovil).slice(0, 4)
  const titulo = visibles.find((i) => i.a === pathname)?.texto ?? 'Niveler'
  const inicial = perfil?.nombre_completo?.trim().charAt(0).toUpperCase() || 'N'

  return (
    <div className="min-h-dvh bg-[#f3f6f4]">

      {/* ---------- Sidebar: solo PC ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col overflow-hidden bg-[#10251e] text-white lg:flex">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3 px-6 py-6">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-950/20">
            <Boxes className="h-6 w-6" strokeWidth={2.4} />
          </div>
          <div>
            <span className="block text-lg font-bold tracking-tight">Niveler</span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-100/55">
              Control de inventario
            </span>
          </div>
        </div>

        <div className="relative mx-5 mb-5 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-100/65">
            <MapPin className="h-3.5 w-3.5" />
            Ámbito de trabajo
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-white">
            {perfil?.sucursal?.nombre ?? 'Todas las sucursales'}
          </p>
        </div>

        <p className="relative px-6 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/40">
          Navegación
        </p>
        <nav className="relative flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {visibles.map(({ a, texto, Icono }) => (
            <NavLink
              key={a}
              to={a}
              end={a === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-white/[0.12] font-semibold text-white shadow-sm ring-1 ring-inset ring-white/10'
                    : 'text-emerald-50/65 hover:bg-white/[0.07] hover:text-white'
                }`
              }
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] transition group-hover:bg-white/10">
                <Icono className="h-[17px] w-[17px]" />
              </span>
              {texto}
            </NavLink>
          ))}
        </nav>

        <div className="relative border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-black/10 p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400 font-bold text-emerald-950">
              {inicial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{perfil?.nombre_completo}</p>
              <p className="truncate text-xs text-emerald-100/55">{perfil?.rol?.nombre}</p>
            </div>
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300/70" />
          </div>
          <button
            onClick={salir}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-emerald-50/60 transition hover:bg-white/[0.07] hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ---------- Header: solo móvil ---------- */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir menú"
              aria-expanded={menuAbierto}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#10251e] text-white shadow-sm"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Niveler</p>
              <h1 className="truncate font-semibold tracking-tight text-slate-950">{titulo}</h1>
            </div>
          </div>
          <button
            onClick={salir}
            aria-label="Cerrar sesión"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-900"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      {/* ---------- Menú completo: móvil ---------- */}
      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => setMenuAbierto(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navegación principal"
            className="relative flex h-full w-[min(88vw,22rem)] flex-col bg-[#10251e] text-white shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400 text-emerald-950">
                  <Boxes className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-bold tracking-tight">Niveler</p>
                  <p className="text-xs text-emerald-100/55">Control de inventario</p>
                </div>
              </div>
              <button
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar menú"
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-emerald-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mx-5 mb-4 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <p className="truncate text-sm font-semibold">{perfil?.nombre_completo}</p>
              <p className="mt-0.5 truncate text-xs text-emerald-100/55">
                {perfil?.rol?.nombre}{perfil?.sucursal ? ` · ${perfil.sucursal.ciudad}` : ''}
              </p>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-6">
              {visibles.map(({ a, texto, Icono }) => (
                <NavLink
                  key={a}
                  to={a}
                  end={a === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition ${
                      isActive
                        ? 'bg-white/[0.13] font-semibold text-white ring-1 ring-inset ring-white/10'
                        : 'text-emerald-50/70 hover:bg-white/[0.07] hover:text-white'
                    }`
                  }
                >
                  <Icono className="h-[18px] w-[18px]" />
                  {texto}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ---------- Aviso de conexión ---------- */}
      {!enLinea && (
        <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950 lg:ml-72">
          <WifiOff className="h-4 w-4" />
          Sin conexión. Puedes consultar, pero no registrar movimientos.
        </div>
      )}

      {/* ---------- Contenido ---------- */}
      <main className="px-4 pb-28 pt-5 sm:px-6 lg:ml-72 lg:px-8 lg:pb-10 lg:pt-8 xl:px-10">
        <div className="mx-auto w-full max-w-[1480px]">
          <Outlet />
        </div>
      </main>

      {/* ---------- Barra inferior: solo móvil ---------- */}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex rounded-2xl border border-slate-200/80 bg-white/95 px-1
                      pb-[env(safe-area-inset-bottom)] shadow-[0_16px_45px_rgb(15_23_42/0.16)] backdrop-blur-xl lg:hidden">
        {enMovil.map(({ a, texto, Icono }) => (
          <NavLink
            key={a}
            to={a}
            end={a === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
                isActive ? 'font-semibold text-emerald-700' : 'text-slate-500'
              }`
            }
          >
            <Icono className="h-5 w-5" strokeWidth={2.1} />
            {texto}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

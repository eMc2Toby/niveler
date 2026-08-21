import { Check, Minus } from 'lucide-react'

/**
 * Qué puede hacer cada rol, en un solo lugar.
 *
 * Esta tabla no es documentación decorativa: refleja los niveles que
 * verifican las políticas RLS de `04_rls.sql` y las funciones de
 * `09_permisos_rpc.sql`. Si algún día cambia un nivel allá, cambia acá.
 */
export const CAPACIDADES = [
  { que: 'Ver stock y catálogo',           nivel: 10 },
  { que: 'Registrar ventas',               nivel: 10 },
  { que: 'Crear y editar clientes',        nivel: 30 },
  { que: 'Movimientos y transferencias',   nivel: 40 },
  { que: 'Crear y editar productos',       nivel: 60 },
  { que: 'Ajustar stock por conteo',       nivel: 60 },
  { que: 'Anular movimientos y ventas',    nivel: 60 },
  { que: 'Ver las 7 ciudades',             nivel: 80 },
  { que: 'Reportes',                       nivel: 60 },
  { que: 'Sucursales y usuarios',          nivel: 100 },
] as const

export const ROLES = [
  { codigo: 'ADMIN',     nombre: 'Administrador', nivel: 100, alcance: 'Todo' },
  { codigo: 'GERENTE',   nombre: 'Gerente',       nivel: 80,  alcance: 'Las 7 ciudades' },
  { codigo: 'ENCARGADO', nombre: 'Encargado',     nivel: 60,  alcance: 'Su ciudad' },
  { codigo: 'BODEGA',    nombre: 'Bodega',        nivel: 40,  alcance: 'Su ciudad' },
  { codigo: 'VENTAS',    nombre: 'Ventas',        nivel: 30,  alcance: 'Su ciudad' },
  { codigo: 'DELIVERY',  nombre: 'Delivery',      nivel: 10,  alcance: 'Solo su stock' },
] as const

export function TablaRoles() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        El rol decide qué puede hacer; la sucursal decide sobre qué datos. Las dos
        cosas se verifican en la base, no en el menú: un repartidor que consulte la
        API directamente sigue recibiendo solo lo suyo.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase text-slate-500">
                Puede
              </th>
              {ROLES.map((r) => (
                <th
                  key={r.codigo}
                  className="px-2 py-2.5 text-center text-xs font-medium text-slate-600"
                  title={`${r.nombre} · nivel ${r.nivel}`}
                >
                  {r.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {CAPACIDADES.map((c) => (
              <tr key={c.que}>
                <td className="px-3 py-2 text-slate-700">{c.que}</td>
                {ROLES.map((r) => (
                  <td key={r.codigo} className="px-2 py-2 text-center">
                    {r.nivel >= c.nivel ? (
                      <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="sí" />
                    ) : (
                      <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="no" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-slate-50">
              <td className="px-3 py-2 text-xs uppercase text-slate-500">Alcance</td>
              {ROLES.map((r) => (
                <td key={r.codigo} className="px-2 py-2 text-center text-xs text-slate-600">
                  {r.alcance}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Delivery y Ventas solo miran: ninguno puede tocar el stock salvo vendiendo,
        y una venta descuenta de su propia ubicación. Para cargar mercadería o
        moverla entre ciudades hace falta Bodega; para corregir un saldo, Encargado.
      </p>
    </div>
  )
}

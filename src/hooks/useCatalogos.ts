import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/supabase'
import { useAuth, usePermisos } from '@/hooks/useAuth'

/** Catálogos que casi nunca cambian: vale la pena cachearlos largo. */
const LARGO = { staleTime: 10 * 60_000 }

export function useUbicaciones() {
  return useQuery({ queryKey: ['ubicaciones'], queryFn: api.ubicaciones, ...LARGO })
}

export function useSucursales() {
  return useQuery({ queryKey: ['sucursales'], queryFn: api.sucursales, ...LARGO })
}

export function useDeliveries() {
  return useQuery({ queryKey: ['deliveries'], queryFn: api.deliveries, ...LARGO })
}

export function useClientes() {
  return useQuery({ queryKey: ['clientes'], queryFn: api.clientes, staleTime: 60_000 })
}

export type Ubicacion = {
  id: string
  codigo: string
  nombre: string
  tipo: 'SUCURSAL' | 'DELIVERY' | 'TRANSITO' | 'MERMA' | 'PROVEEDOR' | 'CLIENTE'
  sucursal_id: string | null
  delivery_id: string | null
}

/**
 * Las ubicaciones que este usuario puede tocar.
 *
 * RLS ya impide leer o mover stock ajeno; esto solo evita ofrecer en un
 * selector una bodega que el servidor va a rechazar después. Gerencia ve
 * todas; un encargado, las de su ciudad; un repartidor, la suya.
 */
export function useMisUbicaciones() {
  const { perfil } = useAuth()
  const { verTodasLasSucursales, esDelivery } = usePermisos()
  const ubicaciones = useUbicaciones()
  const deliveries = useDeliveries()

  const propias = useMemo(() => {
    const todas = (ubicaciones.data ?? []) as Ubicacion[]
    if (verTodasLasSucursales) return todas
    if (esDelivery) return todas.filter((u) => u.id === perfil?.ubicacion_id)

    const deliveriesDeSucursal = new Set(
      (deliveries.data ?? [])
        .filter((d: any) => d.sucursal_base_id === perfil?.sucursal_id)
        .map((d: any) => d.id),
    )

    return todas.filter(
      (u) =>
        !['SUCURSAL', 'DELIVERY'].includes(u.tipo)
        || (u.tipo === 'SUCURSAL' && u.sucursal_id === perfil?.sucursal_id)
        || (u.tipo === 'DELIVERY' && !!u.delivery_id && deliveriesDeSucursal.has(u.delivery_id)),
    )
  }, [
    ubicaciones.data,
    deliveries.data,
    verTodasLasSucursales,
    esDelivery,
    perfil?.ubicacion_id,
    perfil?.sucursal_id,
  ])

  return {
    ...ubicaciones,
    isLoading: ubicaciones.isLoading || deliveries.isLoading,
    propias,
  }
}

/** Las virtuales (proveedor, merma, cliente, tránsito) por tipo. */
export function useUbicacionPorTipo(tipo: Ubicacion['tipo']) {
  const { data } = useUbicaciones()
  return ((data ?? []) as Ubicacion[]).find((u) => u.tipo === tipo)
}

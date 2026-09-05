import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(import.meta.dirname, '../..')
const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8')

describe('PWA sin sincronización offline', () => {
  it('no incluye el módulo ni la ruta de sincronización', () => {
    expect(existsSync(join(raiz, 'src/features/offline'))).toBe(false)
    expect(leer('src/App.tsx')).not.toContain('sincronizacion')
    expect(leer('src/components/layout/Layout.tsx')).not.toContain('Sincronización')
  })

  it('mantiene la instalación PWA sin restaurar IndexedDB', () => {
    const paquete = JSON.parse(leer('package.json'))
    const dependencias = { ...paquete.dependencies, ...paquete.devDependencies }
    expect(dependencias).not.toHaveProperty('dexie')
    expect(dependencias).not.toHaveProperty('fake-indexeddb')
    expect(dependencias).toHaveProperty('vite-plugin-pwa')
    expect(dependencias).toHaveProperty('workbox-window')
    expect(leer('vite.config.ts')).toContain('VitePWA')
    expect(leer('src/main.tsx')).toContain('registerSW({ immediate: true })')
  })

  it('retira de Supabase el despachador y la tabla heredados', () => {
    const sql = leer('supabase/migrations/20260905000125_retirar_modo_offline.sql')
    expect(sql).toContain('drop function if exists public.rpc_ejecutar_operacion_offline')
    expect(sql).toContain('drop table if exists public.operaciones_idempotentes')
  })
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  build: {
    rollupOptions: {
      output: {
        // Separar la capa de datos del código propio: en Bolivia, con datos
        // móviles, una corrección visual no obliga a bajar Supabase otra vez.
        manualChunks(id) {
          if (id.includes('@supabase/supabase-js') || id.includes('@tanstack/react-query')) {
            return 'datos'
          }
          if (
            id.includes('react-dom') || id.includes('react-router')
            || id.includes('react-hook-form') || id.includes('/react/')
            || id.includes('lucide-react') || id.includes('sonner')
            || id.includes('zod') || id.includes('zustand')
          ) return 'interfaz'
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Niveler Inventario',
        short_name: 'Niveler',
        description: 'Control de inventario multi-sucursal',
        lang: 'es-BO',
        theme_color: '#10251E',
        background_color: '#10251E',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Solo conserva el shell necesario para instalar y actualizar la PWA.
        // Los datos, imágenes y operaciones de Supabase no se cachean aquí.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
})

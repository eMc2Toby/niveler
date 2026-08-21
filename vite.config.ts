import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  build: {
    rollupOptions: {
      output: {
        // Separar las librerías pesadas del código propio: en Bolivia, con
        // datos móviles, conviene que una corrección de la app no obligue a
        // volver a bajar recharts entero.
        manualChunks: {
          graficos: ['recharts'],
          datos: ['@supabase/supabase-js', '@tanstack/react-query'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],

      // Esto es lo que hace que la app se instale en el celular del
      // gerente con ícono propio y sin barra de navegador.
      manifest: {
        name: 'Niveler Inventario',
        short_name: 'Niveler',
        description: 'Control de inventario multi-sucursal',
        lang: 'es-BO',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Imágenes de productos: caché larga, se ven sin datos.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'imagenes-productos',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Catálogo y consultas: red primero, caché como respaldo
            // cuando el delivery se queda sin señal.
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'datos-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },

      devOptions: { enabled: true },
    }),
  ],
})

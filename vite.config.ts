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
          // Las respuestas de /rest/v1 llevan datos filtrados por el JWT.
          // Workbox usa la URL como clave y no separa esa cache por usuario;
          // guardarlas podria mostrar datos de la sesion anterior sin red.
          // React Query conserva la respuesta solo en memoria durante la
          // sesion y se limpia al salir.
        ],
      },
    }),
  ],
})

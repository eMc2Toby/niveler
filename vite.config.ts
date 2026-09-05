import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
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
  plugins: [react()],
})

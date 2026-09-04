import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'backend/dist/**',
      'backend/node_modules/**',
      'dev-dist/**',
      'node_modules/**',
      'imagenes_productos/**',
      'imagenes_productos_webp/**',
      'public/**',
      'worker-configuration.d.ts',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // database.ts es un puente manual y varias vistas de PostgREST aun
      // devuelven formas dinamicas. TypeScript estricto sigue validando el
      // resto mientras se generan los tipos definitivos desde Supabase.
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
)

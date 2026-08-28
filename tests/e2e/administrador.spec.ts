import { expect, test } from '@playwright/test'

const correo = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

test.describe('administrador autenticado', () => {
  test.skip(!correo || !password, 'Define E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para estas pruebas.')

  test.beforeEach(async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('Correo').fill(correo!)
    await page.getByLabel('Contraseña').fill(password!)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 })
  })

  test('puede abrir los módulos administrativos y la auditoría', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Usuarios' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Encomiendas' })).toBeVisible()
    await page.getByRole('link', { name: 'Auditoría' }).click()
    await expect(page).toHaveURL(/\/auditoria$/)
    await expect(page.getByRole('heading', { name: 'Auditoría' })).toBeVisible()
    await expect(page.getByLabel('Tabla')).toBeVisible()
  })

  test('carga ventas y transferencias sin errores de endpoints', async ({ page }) => {
    await page.goto('/ventas')
    await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible()
    await expect(page.getByText('No se pudieron cargar los datos')).toHaveCount(0)

    await page.goto('/transferencias')
    await expect(page.getByRole('heading', { name: 'Transferencias' })).toBeVisible()
    await expect(page.getByText('No se pudieron cargar los datos')).toHaveCount(0)

    await page.goto('/encomiendas')
    await expect(page.getByRole('heading', { name: 'Encomiendas' })).toBeVisible()
    await expect(page.getByText('No se pudieron cargar los datos')).toHaveCount(0)
  })
})

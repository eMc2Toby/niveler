import { expect, test } from '@playwright/test'

test('muestra el acceso y permite navegar al registro', async ({ page }) => {
  await page.goto('/entrar')
  await expect(page.getByRole('heading', { name: 'Niveler' })).toBeVisible()
  await expect(page.getByLabel('Correo')).toBeVisible()
  await page.getByRole('link', { name: 'Crear una' }).click()
  await expect(page).toHaveURL(/\/crear-cuenta$/)
})

test('redirige una ruta privada cuando no hay sesión', async ({ page }) => {
  await page.goto('/ventas')
  await expect(page).toHaveURL(/\/entrar$/)
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
})

test('la recuperación rechaza enlaces incompletos sin romper la aplicación', async ({ page }) => {
  await page.goto('/nueva-password')
  await expect(page.getByText(/enlace.*inválido|no es válido/i)).toBeVisible()
})

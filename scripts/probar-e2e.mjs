/**
 * Ejecuta las pruebas E2E contra E2E_BASE_URL o levanta temporalmente `dist`.
 * El servidor se controla directamente para que también se cierre en Windows.
 */
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setTimeout as esperar } from 'node:timers/promises'

const raiz = fileURLToPath(new URL('..', import.meta.url))

const envE2e = fileURLToPath(new URL('../.env.e2e', import.meta.url))
if (existsSync(envE2e)) {
  for (const linea of readFileSync(envE2e, 'utf8').split(/\r?\n/)) {
    const coincidencia = linea.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!coincidencia || process.env[coincidencia[1]]) continue
    process.env[coincidencia[1]] = coincidencia[2].trim().replace(/^['"]|['"]$/g, '')
  }
}

const urlLocal = 'http://127.0.0.1:4173'
const urlPrueba = process.env.E2E_BASE_URL?.trim() || urlLocal
let servidor

async function esperarServidor(url) {
  for (let intento = 0; intento < 60; intento += 1) {
    if (servidor?.exitCode !== null) {
      throw new Error(`El servidor de previsualizacion termino con codigo ${servidor.exitCode}.`)
    }

    try {
      const respuesta = await fetch(url)
      if (respuesta.ok) return
    } catch {
      // Vite todavia esta iniciando.
    }
    await esperar(250)
  }
  throw new Error(`El servidor no respondio en ${url}.`)
}

function detenerServidor() {
  if (!servidor || servidor.exitCode !== null) return

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    servidor.kill('SIGTERM')
  }
  servidor.unref()
}

if (!process.env.E2E_BASE_URL) {
  const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
  servidor = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: raiz,
    stdio: 'inherit',
    windowsHide: true,
  })
  await esperarServidor(urlLocal)
}

const playwright = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url))
const pruebas = spawn(process.execPath, [playwright, 'test', ...process.argv.slice(2)], {
  cwd: raiz,
  env: { ...process.env, E2E_BASE_URL: urlPrueba },
  stdio: 'inherit',
  windowsHide: true,
})

const [codigo] = await once(pruebas, 'exit')
detenerServidor()
process.exitCode = typeof codigo === 'number' ? codigo : 1

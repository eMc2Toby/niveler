// Genera los íconos PNG de la PWA (192, 512 y maskable) sin dependencias.
// Son provisionales: cuando exista el logo definitivo, se reemplazan los
// archivos de public/icons/ y este script deja de hacer falta.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const FONDO = [15, 23, 42]      // slate-900, igual que el theme_color
const MARCA = [16, 185, 129]    // emerald-500

function png(tam, margen) {
  const filas = []
  for (let y = 0; y < tam; y++) {
    const fila = [0] // filtro "none" al inicio de cada scanline
    for (let x = 0; x < tam; x++) {
      const dentro = x >= margen && x < tam - margen && y >= margen && y < tam - margen
      const borde = margen + Math.round(tam * 0.11)
      const hueco = x >= borde && x < tam - borde && y >= borde && y < tam - borde
      const c = dentro && !hueco ? MARCA : FONDO
      fila.push(c[0], c[1], c[2])
    }
    filas.push(Buffer.from(fila))
  }

  const crc = (buf) => {
    let c = ~0
    for (const b of buf) {
      c ^= b
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
    return ~c >>> 0
  }
  const trozo = (tipo, datos) => {
    const largo = Buffer.alloc(4)
    largo.writeUInt32BE(datos.length)
    const cuerpo = Buffer.concat([Buffer.from(tipo), datos])
    const suma = Buffer.alloc(4)
    suma.writeUInt32BE(crc(cuerpo))
    return Buffer.concat([largo, cuerpo, suma])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tam, 0)
  ihdr.writeUInt32BE(tam, 4)
  ihdr[8] = 8   // bits por canal
  ihdr[9] = 2   // color RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(Buffer.concat(filas))),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', png(192, 34))
writeFileSync('public/icons/icon-512.png', png(512, 92))
// El maskable necesita zona segura: el dibujo ocupa solo el 60% central.
writeFileSync('public/icons/icon-512-maskable.png', png(512, 150))
writeFileSync('public/favicon.ico', png(64, 11))
console.log('Íconos generados en public/icons/')

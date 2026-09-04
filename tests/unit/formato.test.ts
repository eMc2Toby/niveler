import { describe, expect, it } from 'vitest'

import { fecha } from '../../src/lib/formato'

describe('formato de fechas', () => {
  it('conserva el día de una fecha SQL sin hora', () => {
    expect(fecha('2026-08-30')).toContain('30')
  })

  it('sigue aceptando marcas de tiempo ISO', () => {
    expect(fecha('2026-08-30T12:00:00.000Z')).toContain('30')
  })
})

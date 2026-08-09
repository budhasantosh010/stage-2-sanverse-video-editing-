import { describe, expect, it } from 'vitest'
import { MOTION_COMPONENT_CATALOG, MOTION_COMPONENT_MODULES } from './catalog.ts'
import { INITIAL_MOTION_STYLE_PACKS, motionStylePackById } from './style-packs.ts'

describe('Plan A public catalog acceptance', () => {
  it('publishes 69 unique complete component definitions and modules', () => {
    expect(MOTION_COMPONENT_CATALOG).toHaveLength(69)
    const ids = MOTION_COMPONENT_CATALOG.map((definition) => definition.id)
    expect(new Set(ids).size).toBe(69)
    expect(Object.keys(MOTION_COMPONENT_MODULES)).toHaveLength(69)
    for (const definition of MOTION_COMPONENT_CATALOG) expect(MOTION_COMPONENT_MODULES[definition.id]?.definition.id).toBe(definition.id)
  })

  it('meets the planned category quantities without style-pack duplication', () => {
    const byCategory = MOTION_COMPONENT_CATALOG.reduce<Record<string, number>>((counts, definition) => ({ ...counts, [definition.category]: (counts[definition.category] ?? 0) + 1 }), {})
    expect((byCategory.typography ?? 0) + (byCategory.headline ?? 0)).toBeGreaterThanOrEqual(10)
    expect(byCategory.comparison ?? 0).toBeGreaterThanOrEqual(8)
    expect(byCategory.card ?? 0).toBeGreaterThanOrEqual(8)
    expect((byCategory.ui ?? 0) + (byCategory.timer ?? 0)).toBeGreaterThanOrEqual(6)
    expect(byCategory.diagram ?? 0).toBeGreaterThanOrEqual(6)
    expect(byCategory.callout ?? 0).toBeGreaterThanOrEqual(4)
    expect(byCategory.cta ?? 0).toBeGreaterThanOrEqual(6)
  })

  it('publishes exactly eight shared style packs with stable unique IDs', () => {
    expect(INITIAL_MOTION_STYLE_PACKS).toHaveLength(8)
    const ids = INITIAL_MOTION_STYLE_PACKS.map((pack) => pack.id)
    expect(new Set(ids).size).toBe(8)
    for (const pack of INITIAL_MOTION_STYLE_PACKS) expect(motionStylePackById(pack.id)).toBe(pack)
    expect(INITIAL_MOTION_STYLE_PACKS.map((pack) => pack.name)).toEqual([
      'Sanverse Clean', 'Creator Energetic', 'Dark Minimal', 'Editorial', 'Tech UI', 'Sketch', 'Glass', 'Retro / Neon',
    ])
  })
})

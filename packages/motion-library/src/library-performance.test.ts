import { describe, expect, it } from 'vitest'
import { performance } from 'node:perf_hooks'
import { MOTION_LIBRARY_CATALOG, filterMotionLibraryCatalog } from './library-catalog.ts'
import type { MotionLibraryCatalogEntryV1 } from './library-catalog.ts'

const synthetic = (count: number): readonly MotionLibraryCatalogEntryV1[] => Object.freeze(Array.from({ length: count }, (_, index) => {
  const base = MOTION_LIBRARY_CATALOG[index % MOTION_LIBRARY_CATALOG.length]!
  return Object.freeze({ ...base, componentId: `sanverse.synthetic-${index}` as `sanverse.${string}`, displayName: `${base.displayName} ${index}`, aliases: Object.freeze([...base.aliases, `synthetic ${index}`]) })
}))

describe('L1 Creative Library measured catalog performance', () => {
  it('measures deterministic filtering and sorting at 89/150/300/500 entries', () => {
    for (const count of [89, 150, 300, 500]) {
      const entries = count === 89 ? MOTION_LIBRARY_CATALOG : synthetic(count)
      const started = performance.now()
      const result = filterMotionLibraryCatalog(entries, { context: 'youtube-long-form', sort: 'recent' })
      const elapsed = performance.now() - started
      console.log(`L1_GRID_INDEX_PERF entries=${count} result=${result.length} filterSortMs=${elapsed.toFixed(3)}`)
      expect(result.length).toBeGreaterThan(0)
    }
  })

  it('measures local metadata search at 100/500/1000 entries', () => {
    for (const count of [100, 500, 1000]) {
      const entries = synthetic(count)
      const started = performance.now()
      const result = filterMotionLibraryCatalog(entries, { query: 'percentage', sort: 'recommended' })
      const elapsed = performance.now() - started
      console.log(`L1_SEARCH_PERF entries=${count} result=${result.length} searchMs=${elapsed.toFixed(3)}`)
      expect(result.length).toBeGreaterThan(0)
    }
  })
})

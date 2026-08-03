import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import {
  STUDIO_BREAKPOINTS,
  STUDIO_MEDIA_QUERIES,
  readStudioResponsiveMode,
  studioHidesSideDocks,
  studioResponsiveMode,
  subscribeStudioResponsiveMode,
} from './studio-responsive-authority'

/**
 * Read a stylesheet from disk.
 *
 * The whole point of these assertions is that a stylesheet and a comparison
 * operator cannot drift apart, and the only way to hold that is to read the
 * real file. The two candidate paths cover being run from `apps/web` and from
 * the repository root.
 */
const readCss = (relative: string): string => {
  const path = [`src/${relative}`, `apps/web/src/${relative}`]
    .map((candidate) => resolve(process.cwd(), candidate))
    .find(existsSync)
  if (!path) throw new Error(`could not find ${relative}`)
  return readFileSync(path, 'utf8')
}

const at = (width: number) => studioResponsiveMode(Object.freeze({ width, height: 900 }))

describe('one shared responsive authority', () => {
  it('agrees with the stylesheet at the exact boundary pixel — FAIL-047', () => {
    // `@media (max-width: 1100px)` MATCHES at 1100 and hides the side docks.
    // The code used `< 1100`, so at exactly 1100 it stayed in laptop mode and
    // never rendered the replacement controls: no Media panel, no Tool panel,
    // and no way to open either short of reloading the page.
    expect(at(STUDIO_BREAKPOINTS.compact)).toBe('tablet')
    expect(studioHidesSideDocks(at(STUDIO_BREAKPOINTS.compact))).toBe(true)
    expect(studioHidesSideDocks(at(STUDIO_BREAKPOINTS.compact + 1))).toBe(false)
  })

  it('offers the compact controls at every width where the stylesheet hides the docks', () => {
    for (let width = 320; width <= STUDIO_BREAKPOINTS.compact; width += 1) {
      expect(studioHidesSideDocks(at(width))).toBe(true)
    }
  })

  it('never hides the docks at a width where the stylesheet keeps them', () => {
    for (const width of [1101, 1200, 1359, 1360, 1440, 1920, 2560]) {
      expect(studioHidesSideDocks(at(width))).toBe(false)
    }
  })

  it('names every width band', () => {
    expect(at(390)).toBe('mobile')
    expect(at(STUDIO_BREAKPOINTS.mobile)).toBe('mobile')
    expect(at(STUDIO_BREAKPOINTS.mobile + 1)).toBe('tablet')
    expect(at(1024)).toBe('tablet')
    expect(at(1280)).toBe('laptop')
    expect(at(STUDIO_BREAKPOINTS.laptop)).toBe('laptop')
    expect(at(STUDIO_BREAKPOINTS.laptop + 1)).toBe('desktop')
    expect(at(1440)).toBe('desktop')
  })

  it('uses the same query strings the stylesheet actually contains', () => {
    // A comment saying "keep these in sync" is not a mechanism. This is.
    const css = readCss('screens/studio/StudioScreen.css')
    expect(css).toContain(`@media ${STUDIO_MEDIA_QUERIES.compact}`)
    expect(css).toContain(`@media ${STUDIO_MEDIA_QUERIES.mobile}`)
  })

  it('has no second stylesheet rule that can hide a dock at a width the code calls roomy', () => {
    // Any `max-width` above the compact breakpoint in the Studio stylesheets
    // would be a rule the code cannot see, which is how FAIL-047 happened.
    const css = readCss('screens/studio/StudioScreen.css') + readCss('editor/layout-v2/StudioLayoutV2.css')
    // Only `@media`/`@container` CONDITIONS count. A plain `max-width` property
    // is how wide an element may grow, which hides nothing from anybody.
    const widths = [...css.matchAll(/@(?:media|container)[^{]*?max-width:\s*(\d+)px/g)]
      .map((match) => Number(match[1]))
    expect(widths.length).toBeGreaterThan(0)
    for (const width of widths) {
      expect(width).toBeLessThanOrEqual(STUDIO_BREAKPOINTS.compact)
    }
  })

  it('reads the live width rather than a remembered copy', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    expect(readStudioResponsiveMode()).toBe('desktop')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    expect(readStudioResponsiveMode()).toBe('tablet')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
    expect(readStudioResponsiveMode()).toBe('laptop')
    if (original) Object.defineProperty(window, 'innerWidth', original)
  })

  it('subscribes to resize and orientation changes, and unsubscribes cleanly', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeStudioResponsiveMode(onChange)

    window.dispatchEvent(new Event('resize'))
    expect(onChange).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('orientationchange'))
    expect(onChange).toHaveBeenCalledTimes(2)

    unsubscribe()
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('orientationchange'))
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('also listens on media-query boundaries, where a harness may suppress resize', () => {
    const listeners: Array<{ query: string; handler: () => void }> = []
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: (_type: string, handler: () => void) => listeners.push({ query, handler }),
        removeEventListener: () => {},
      }),
    })

    const onChange = vi.fn()
    const unsubscribe = subscribeStudioResponsiveMode(onChange)
    expect(listeners.map((entry) => entry.query).sort()).toEqual(Object.values(STUDIO_MEDIA_QUERIES).sort())
    listeners[0]?.handler()
    expect(onChange).toHaveBeenCalledTimes(1)

    unsubscribe()
    if (original) Object.defineProperty(window, 'matchMedia', original)
  })

  it('survives a browser with no matchMedia at all', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined })
    const onChange = vi.fn()
    expect(() => subscribeStudioResponsiveMode(onChange)()).not.toThrow()
    if (original) Object.defineProperty(window, 'matchMedia', original)
  })
})

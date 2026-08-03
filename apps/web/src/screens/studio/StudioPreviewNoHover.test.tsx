import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * THE BASE PICTURE MAY NOT DEPEND ON WHERE THE POINTER IS.
 *
 * The owner recorded a preview that showed real footage while the mouse was on
 * it and went black the moment the mouse moved away. The cause was one rule:
 *
 * ```css
 *   .studio-screen__video:hover + .studio-screen__footage-motion-canvas,
 *   .studio-screen__video:focus + .studio-screen__footage-motion-canvas {
 *     opacity: 0 !important;
 *   }
 * ```
 *
 * That rule was itself a workaround for a canvas that could not be switched off
 * (`hidden` was being overridden by `display: block`), so deleting one without
 * the other would have made the preview permanently black instead of
 * intermittently black.
 *
 * jsdom does not evaluate real cascade or hover, so the only honest way to hold
 * this is to read the stylesheet as text. Monitor CONTROLS may respond to hover
 * — buttons should. The base footage may not.
 */

const readCss = (relative: string): string => {
  const path = [`src/${relative}`, `apps/web/src/${relative}`]
    .map((candidate) => resolve(process.cwd(), candidate))
    .find(existsSync)
  if (!path) throw new Error(`could not find ${relative}`)
  return readFileSync(path, 'utf8')
}

/** Selectors naming the base picture layers, in any combination. */
const BASE_LAYER_SELECTOR = /studio-screen__(video|footage-motion-canvas|video-surface|video-frame)\b/

const POINTER_STATE = /:hover|:focus\b|:focus-visible|:focus-within|:active\b/

/** Split a stylesheet into `selector { body }` pairs, ignoring at-rule headers. */
const rules = (css: string): ReadonlyArray<{ selector: string; body: string }> => {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const found: Array<{ selector: string; body: string }> = []
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim()
    if (selector.startsWith('@')) continue
    found.push({ selector, body: match[2] })
  }
  return found
}

describe('the preview does not depend on the pointer', () => {
  const css = readCss('screens/studio/StudioScreen.css')

  it('has no pointer-state selector targeting a base picture layer', () => {
    const offenders = rules(css)
      .filter((rule) => POINTER_STATE.test(rule.selector) && BASE_LAYER_SELECTOR.test(rule.selector))
      .map((rule) => rule.selector)
    expect(offenders).toEqual([])
  })

  it('never changes visibility, opacity, or display from a pointer state anywhere in Studio', () => {
    const offenders = rules(css)
      .filter((rule) => POINTER_STATE.test(rule.selector))
      .filter((rule) => /(^|[;{\s])(opacity|visibility|display)\s*:/.test(rule.body))
      .map((rule) => rule.selector)
    expect(offenders).toEqual([])
  })

  it('has deleted the specific hover workaround, by name', () => {
    expect(css).not.toContain('.studio-screen__video:hover')
    expect(css).not.toContain('.studio-screen__video:focus')
  })

  it('uses no !important on the motion canvas', () => {
    // `!important` on a picture layer is a sign that two things are fighting
    // over visibility, which is exactly the defect this gate removed.
    const canvasRules = rules(css).filter((rule) => rule.selector.includes('footage-motion-canvas'))
    expect(canvasRules.length).toBeGreaterThan(0)
    for (const rule of canvasRules) expect(rule.body).not.toContain('!important')
  })

  it('can actually switch the motion canvas off', () => {
    // `display: block` on the class beats the browser's own
    // `[hidden] { display: none }`, so the `hidden` attribute silently did
    // nothing and a never-drawn black canvas covered healthy video. Visibility
    // now comes from `data-visible`, which the resolver alone writes.
    expect(css).toContain('.studio-screen__footage-motion-canvas[data-visible="false"]')
    const offRule = rules(css).find((rule) => rule.selector.includes('[data-visible="false"]'))
    expect(offRule?.body).toMatch(/display:\s*none/)
  })

  it('leaves monitor controls free to respond to hover', () => {
    // Stated as a test so a future reader does not "fix" this by banning hover
    // outright. Buttons that do not react to the pointer feel broken.
    const controlHovers = rules(css).filter((rule) =>
      POINTER_STATE.test(rule.selector) && !BASE_LAYER_SELECTOR.test(rule.selector))
    expect(controlHovers.length).toBeGreaterThan(0)
  })
})

/**
 * ONE ANSWER TO "HOW WIDE ARE WE", SHARED BY THE STYLESHEET AND THE CODE.
 *
 * ## The defect this exists to make impossible (FAIL-047)
 *
 * Two different things decided how wide the window was, and they were allowed
 * to disagree:
 *
 * ```
 *   the stylesheet   @media (max-width: 1100px)  -> hide the Media and Tool docks
 *   the code         width < 1100  -> 'tablet'   -> render the replacement
 *                                                   "Show Media" / "Show Tool"
 *                                                   buttons
 * ```
 *
 * Read those two lines at a window exactly **1100px** wide:
 *
 * ```
 *   stylesheet:  max-width: 1100px  matches at 1100   -> DOCKS HIDDEN
 *   code:        1100 < 1100        is false          -> mode is 'laptop'
 *                                                     -> NO replacement buttons
 *   result:      no Media panel, no Tool panel, and no way to open either.
 * ```
 *
 * The user is stranded with a working app they cannot reach half of, and the
 * only escape is reloading the page. One pixel of disagreement between a
 * stylesheet and a comparison operator is enough to lose two whole panels.
 *
 * ## The rule that replaces it
 *
 * The breakpoints are declared **once**, here, as numbers. The stylesheet's
 * query strings are generated from those same numbers and a test reads the real
 * `.css` files and fails if they ever drift apart. The comparison is `<=`, so
 * the code agrees with `max-width` at the boundary pixel rather than one pixel
 * later.
 *
 * The width is re-read on `resize`, on `orientationchange`, and on `matchMedia`
 * boundary crossings — three sources, one answer — so a stale mode cannot
 * survive a window drag.
 */

import { useSyncExternalStore } from 'react'
import type { WorkspaceViewport } from '../workspace'

export type StudioResponsiveMode = 'desktop' | 'laptop' | 'tablet' | 'mobile'

/**
 * The only breakpoint numbers in the product.
 *
 * `compact` is the load-bearing one: at or below it the stylesheet hides the
 * side docks, so at or below it the code MUST offer the replacement controls.
 */
export const STUDIO_BREAKPOINTS = Object.freeze({
  /** At or below this, one column and no side docks at all. */
  mobile: 620,
  /** At or below this, the stylesheet hides the Media and Tool docks. */
  compact: 1100,
  /** At or below this, desktop luxuries (a docked AI panel) are given up. */
  laptop: 1359,
})

/**
 * The exact strings the stylesheet must contain.
 *
 * Asserted against the real `.css` files by `studio-responsive-authority.test`,
 * because a comment saying "keep these in sync" is not a mechanism.
 */
export const STUDIO_MEDIA_QUERIES = Object.freeze({
  mobile: `(max-width: ${STUDIO_BREAKPOINTS.mobile}px)`,
  compact: `(max-width: ${STUDIO_BREAKPOINTS.compact}px)`,
  laptop: `(max-width: ${STUDIO_BREAKPOINTS.laptop}px)`,
})

/**
 * `<=` on purpose. `max-width: 1100px` matches AT 1100, so this must too.
 * Using `<` here is the whole of FAIL-047.
 */
export const studioResponsiveMode = (viewport: WorkspaceViewport): StudioResponsiveMode => {
  if (viewport.width <= STUDIO_BREAKPOINTS.mobile) return 'mobile'
  if (viewport.width <= STUDIO_BREAKPOINTS.compact) return 'tablet'
  if (viewport.width <= STUDIO_BREAKPOINTS.laptop) return 'laptop'
  return 'desktop'
}

/**
 * Does the stylesheet currently hide the side docks?
 *
 * Anything true here MUST render the compact replacement controls, or the
 * panels become unreachable. This is the single predicate both sides answer.
 */
export const studioHidesSideDocks = (mode: StudioResponsiveMode): boolean =>
  mode === 'tablet' || mode === 'mobile'

const SERVER_VIEWPORT: WorkspaceViewport = Object.freeze({ width: 1440, height: 900 })

export const currentStudioViewport = (): WorkspaceViewport =>
  typeof window === 'undefined'
    ? SERVER_VIEWPORT
    : Object.freeze({ width: window.innerWidth, height: window.innerHeight })

/**
 * Read the mode as one primitive string.
 *
 * `useSyncExternalStore` compares snapshots with `Object.is`, so this must
 * return a primitive. Returning a fresh `{ width, height }` object would make
 * every read look like a change and re-render the whole Studio on every frame
 * of a window drag.
 */
export const readStudioResponsiveMode = (): StudioResponsiveMode =>
  studioResponsiveMode(currentStudioViewport())

/** The server has no window, so it gets the one documented default. */
const readServerStudioResponsiveMode = (): StudioResponsiveMode =>
  studioResponsiveMode(SERVER_VIEWPORT)

/**
 * Subscribe to every way a width can change.
 *
 * `resize` is the general case. `orientationchange` covers phones and tablets,
 * where a rotation can settle without a resize the listener sees. The
 * `matchMedia` listeners fire exactly on a boundary crossing and keep working
 * where a browser or an automation harness throttles or suppresses `resize` —
 * which is precisely the situation that makes a stale mode hard to reproduce.
 */
export const subscribeStudioResponsiveMode = (onChange: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('resize', onChange, { passive: true })
  window.addEventListener('orientationchange', onChange, { passive: true })

  const lists: MediaQueryList[] = []
  if (typeof window.matchMedia === 'function') {
    for (const query of Object.values(STUDIO_MEDIA_QUERIES)) {
      const list = window.matchMedia(query)
      // Safari below 14 has no addEventListener on MediaQueryList. Skipping it
      // there is safe: `resize` still covers the case.
      if (typeof list?.addEventListener === 'function') {
        list.addEventListener('change', onChange)
        lists.push(list)
      }
    }
  }

  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
    for (const list of lists) list.removeEventListener('change', onChange)
  }
}

/**
 * The hook every Studio surface uses. One subscription for the whole screen,
 * not one resize listener per panel — five listeners would be five chances to
 * leak one and five different answers during a drag.
 */
export const useStudioResponsiveMode = (): StudioResponsiveMode =>
  useSyncExternalStore(
    subscribeStudioResponsiveMode,
    readStudioResponsiveMode,
    readServerStudioResponsiveMode,
  )

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOTION_LIBRARY_CATALOG } from '@sanverse/motion-library'
import { CreativeLibraryApp } from './CreativeLibraryApp.tsx'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

class ResizeObserverStub { observe(){} disconnect(){} unobserve(){} }
class IntersectionObserverStub { constructor(_callback: IntersectionObserverCallback){} observe(){} disconnect(){} unobserve(){} takeRecords(){ return [] } root=null; rootMargin='0px'; thresholds=[] as number[] }
const emptyReviews = JSON.stringify({ schemaVersion: 'sanverse.motion-library-reviews/v1', reviews: [] })
const donut = MOTION_LIBRARY_CATALOG.find((entry) => entry.componentId === 'sanverse.donut-breakdown')!
const persistedReviewDocument = JSON.stringify({
  schemaVersion: 'sanverse.motion-library-reviews/v1',
  reviews: [{
    componentId: donut.componentId,
    fixtureId: donut.preview.fixtureId,
    status: 'passed',
    qualityTier: 'S',
    scores: { entrance: 5, pacing: 5, easing: 5, rhythm: 5, readability: 5, hold: 4, payoff: 5, exit: 5, competingMotion: 4, footageCompatibility: 4, professionalFeel: 5, overall: 5 },
    notes: ['Persisted review note'],
    reviewedAt: '2026-08-11T10:00:00.000Z',
    reviewer: 'test reviewer',
    fullPlaybackVerified: true,
    playbackSpeed: 1,
    canonicalDurationTicks: donut.preview.durationTicks,
  }],
})
const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }
const setInput = (input: HTMLInputElement, value: string) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; setter?.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) }

describe('L1 Creative Library browser', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(emptyReviews, { status: 200 })))
    window.history.replaceState({}, '', '/library')
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
    await act(async () => { root.render(<CreativeLibraryApp />); await Promise.resolve() }); await settle()
  })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })

  it('derives the visible grid count from the canonical public registry without mounting 89 players', () => {
    expect(container.textContent).toContain(`${MOTION_LIBRARY_CATALOG.length} COMPONENTS`)
    expect(container.querySelectorAll('[data-library-card]')).toHaveLength(MOTION_LIBRARY_CATALOG.length)
    expect(container.querySelectorAll('[data-library-player]')).toHaveLength(0)
  })

  it('keeps exactly one inline real preview active when a second card starts', async () => {
    const playButtons = [...container.querySelectorAll<HTMLButtonElement>('.creative-library__play-card')]
    expect(playButtons.length).toBeGreaterThan(2)
    await act(async () => { playButtons[0]!.click(); await Promise.resolve() }); await settle()
    expect(container.querySelectorAll('[data-library-player]')).toHaveLength(1)
    const secondCardId = playButtons[1]!.closest('[data-library-card]')?.getAttribute('data-library-card')
    await act(async () => { playButtons[1]!.click(); await Promise.resolve() }); await settle()
    expect(container.querySelectorAll('[data-library-player]')).toHaveLength(1)
    expect(container.querySelector('[data-library-player]')?.getAttribute('data-library-player')).toBe(secondCardId)
  })

  it('searches locally using discovery metadata and updates URL state', async () => {
    const input = container.querySelector<HTMLInputElement>('[aria-label="Search components"]')!
    await act(async () => { setInput(input, 'toast'); await Promise.resolve() }); await settle()
    expect(window.location.search).toContain('q=toast')
    const cards = [...container.querySelectorAll<HTMLElement>('[data-library-card]')]
    expect(cards.some((card) => card.getAttribute('data-library-card') === 'sanverse.conversation-toast-stack')).toBe(true)
    expect(cards.length).toBeLessThan(MOTION_LIBRARY_CATALOG.length)
  })

  it('deep-links to a known detail page and shows not-found for an unknown component', async () => {
    await act(async () => { window.history.pushState({}, '', '/library/component/sanverse.donut-breakdown'); window.dispatchEvent(new PopStateEvent('popstate')); await Promise.resolve() }); await settle()
    expect(container.textContent).toContain('Donut Breakdown')
    expect(container.querySelector('[data-library-player="sanverse.donut-breakdown"]')).not.toBeNull()
    await act(async () => { window.history.pushState({}, '', '/library/component/sanverse.nope'); window.dispatchEvent(new PopStateEvent('popstate')); await Promise.resolve() }); await settle()
    expect(container.textContent).toContain('Component not found')
  })

  it('keeps Pass disabled before a complete canonical 1x playback', async () => {
    await act(async () => { window.history.pushState({}, '', '/library/component/sanverse.donut-breakdown'); window.dispatchEvent(new PopStateEvent('popstate')); await Promise.resolve() }); await settle()
    const pass = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Pass')
    expect(pass?.disabled).toBe(true)
    expect(container.textContent).toContain('Play from 0 → end at 1× before Pass')
  })

  it('hydrates editable review fields when persisted review data arrives', async () => {
    act(() => root.unmount())
    container.replaceChildren()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(persistedReviewDocument, { status: 200 })))
    window.history.replaceState({}, '', '/library/component/sanverse.donut-breakdown')
    root = createRoot(container)
    await act(async () => { root.render(<CreativeLibraryApp />); await Promise.resolve() }); await settle()
    const selects = [...container.querySelectorAll<HTMLSelectElement>('.creative-library__review-editor select')]
    expect(selects[0]?.value).toBe('passed')
    expect(selects[1]?.value).toBe('S')
    expect(container.querySelector<HTMLTextAreaElement>('.creative-library__review-editor textarea')?.value).toContain('Persisted review note')
    expect(container.textContent).toContain('Stored canonical 1× playback verification')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { transitionView } from './view-transition'

const originalMatchMedia = window.matchMedia

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  })
  Reflect.deleteProperty(document, 'startViewTransition')
})

function setReducedMotion(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches })) as unknown as typeof window.matchMedia,
  })
}

describe('transitionView', () => {
  it('uses the browser view transition when motion is allowed', () => {
    setReducedMotion(false)
    const update = vi.fn()
    const startViewTransition = vi.fn((callback: () => void) => callback())
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    })

    transitionView(update)

    expect(startViewTransition).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
  })

  it('updates directly when reduced motion is requested', () => {
    setReducedMotion(true)
    const update = vi.fn()
    const startViewTransition = vi.fn()
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    })

    transitionView(update)

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledOnce()
  })

  it('updates directly when the browser has no view-transition support', () => {
    setReducedMotion(false)
    const update = vi.fn()

    transitionView(update)

    expect(update).toHaveBeenCalledOnce()
  })

  it('updates directly when the browser rejects transition startup', () => {
    setReducedMotion(false)
    const update = vi.fn()
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('transition unavailable')
      }),
    })

    expect(() => transitionView(update)).not.toThrow()
    expect(update).toHaveBeenCalledOnce()
  })

  it('does not swallow an error thrown by the screen update', () => {
    setReducedMotion(false)
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn((update: () => void) => update()),
    })

    expect(() =>
      transitionView(() => {
        throw new Error('screen update failed')
      }),
    ).toThrow('screen update failed')
  })
})

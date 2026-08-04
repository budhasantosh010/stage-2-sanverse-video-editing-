import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

/**
 * Take the previous test's screen down before the next one puts its own up.
 *
 * Without this, everything rendered by every test in a file stays in the page.
 * A query like "find the thing with the status role" then finds three of them
 * and fails — and it fails in whichever test happens to run last, which is not
 * the test that is broken. That makes the suite depend on the order it runs in,
 * which is how a real failure gets dismissed as flakiness.
 */
afterEach(cleanup)

/**
 * A drawing surface that records what was drawn on it.
 *
 * jsdom has no real canvas: `getContext('2d')` returns null unless a native
 * drawing library is installed. The filmstrip and the waveform both draw on a
 * canvas, so without this there would be no way to assert that a real picture
 * was put on screen — only that an empty element existed, which proves nothing.
 *
 * This is deliberately the smallest possible stand-in: it answers the calls the
 * two components make and remembers them. It draws no pixels, and no test may
 * claim it does.
 */
export type RecordedDraw = Readonly<{ kind: 'image' | 'rect'; args: readonly number[] }>

/**
 * The record is kept ON the canvas element, not in a map inside this file.
 *
 * The whole suite runs in one process, and a test file that resets the module
 * registry gets a fresh copy of this module — with a fresh, empty map — while
 * the stub already installed on the canvas prototype keeps writing to the old
 * one. The reader would then always see nothing, and every drawing test would
 * fail depending on which file ran before it.
 */
const DRAWS = '__sanverseDraws'

export const drawsOn = (canvas: HTMLCanvasElement): readonly RecordedDraw[] =>
  (canvas as unknown as Record<string, RecordedDraw[] | undefined>)[DRAWS] ?? []

function ensureCanvasContext() {
  const prototype = globalThis.HTMLCanvasElement?.prototype
  if (!prototype || (prototype as { __sanverseStub?: boolean }).__sanverseStub) return
  Object.defineProperty(prototype, '__sanverseStub', { value: true, configurable: true })
  prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string) {
    if (kind !== '2d') return null
    const holder = this as unknown as Record<string, RecordedDraw[] | undefined>
    const draws = holder[DRAWS] ?? []
    holder[DRAWS] = draws
    return {
      canvas: this,
      fillStyle: '',
      setTransform: () => undefined,
      clearRect: () => { draws.length = 0 },
      drawImage: (_image: unknown, ...args: number[]) => { draws.push({ kind: 'image', args }) },
      fillRect: (...args: number[]) => { draws.push({ kind: 'rect', args }) },
    } as unknown as CanvasRenderingContext2D
  } as HTMLCanvasElement['getContext']
}

class TestResizeObserver implements ResizeObserver {
  readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

function ensureResizeObserver() {
  if (typeof globalThis.ResizeObserver !== 'function') {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: TestResizeObserver,
    })
  }
}

beforeEach(() => { ensureResizeObserver(); ensureCanvasContext() })
afterEach(() => { ensureResizeObserver(); ensureCanvasContext() })

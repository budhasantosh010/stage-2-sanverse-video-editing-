import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'

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

beforeEach(ensureResizeObserver)
afterEach(ensureResizeObserver)

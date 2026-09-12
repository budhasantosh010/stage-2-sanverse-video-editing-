import { describe, expect, it, vi } from 'vitest'
import { createCompositionIntervalClock } from './composition-interval-clock'

function setup() {
  let now = 0
  let id = 0
  const frames = new Map<number, FrameRequestCallback>()
  const cancel = vi.fn((key: number) => frames.delete(key))
  const clock = createCompositionIntervalClock({ timescale: 1000, now: () => now,
    requestFrame: (callback) => { frames.set(++id, callback); return id }, cancelFrame: cancel,
  })
  const advance = (time: number) => { now = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)) }
  return { clock, advance, frames, cancel }
}

describe('single composition interval clock', () => {
  it('uses elapsed composition time, not frame count or media decoder time', () => {
    const { clock, advance } = setup()
    const tick = vi.fn(); const end = vi.fn()
    clock.start({ fromTicks: 2000, untilTicks: 5000, onTick: tick, onEnd: end })
    advance(10); advance(250); advance(1499)
    expect(tick.mock.calls.map(call => call[0])).toEqual([2010, 2250, 3499])
    expect(end).not.toHaveBeenCalled()
  })
  it('clamps a delayed frame to the exact boundary and ends only once', () => {
    const { clock, advance, frames } = setup()
    const tick = vi.fn(); const end = vi.fn()
    clock.start({ fromTicks: 2000, untilTicks: 5000, onTick: tick, onEnd: end })
    advance(9000); advance(10000)
    expect(tick).toHaveBeenCalledExactlyOnceWith(5000)
    expect(end).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
  })
  it('ignores a stale frame after pause or a new seek/play intent', () => {
    const { clock, advance, frames } = setup()
    const oldTick = vi.fn(); const newTick = vi.fn()
    clock.start({ fromTicks: 0, untilTicks: 5000, onTick: oldTick, onEnd: vi.fn() })
    const stale = [...frames.values()][0]
    clock.stop()
    clock.start({ fromTicks: 3000, untilTicks: 5000, onTick: newTick, onEnd: vi.fn() })
    stale(1000); advance(100)
    expect(oldTick).not.toHaveBeenCalled()
    expect(newTick).toHaveBeenCalledExactlyOnceWith(3100)
    expect(frames.size).toBe(1)
  })
  it('can enter the next interval from onEnd without two running frame loops', () => {
    const { clock, advance, frames } = setup()
    const nextTick = vi.fn()
    clock.start({ fromTicks: 0, untilTicks: 1000, onTick: vi.fn(), onEnd: () => {
      clock.start({ fromTicks: 1000, untilTicks: 2000, onTick: nextTick, onEnd: vi.fn() })
    } })
    advance(1000); advance(1250)
    expect(nextTick).toHaveBeenCalledExactlyOnceWith(1250)
    expect(frames.size).toBe(1)
  })
  it('stops safely if an update callback cancels playback at the boundary', () => {
    const { clock, advance } = setup()
    const end = vi.fn()
    clock.start({ fromTicks: 0, untilTicks: 1000, onTick: () => clock.stop(), onEnd: end })
    advance(1000)
    expect(end).not.toHaveBeenCalled()
  })
})

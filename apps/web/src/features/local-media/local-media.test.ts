import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLocalMediaHandle, validateLocalVideo } from './local-media'

const MP4_ERROR = 'Choose an MP4 video'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('validateLocalVideo', () => {
  it('accepts a file with the MP4 MIME type', () => {
    const file = new File(['video'], 'cleaned-video.bin', { type: 'video/mp4' })

    expect(() => validateLocalVideo(file)).not.toThrow()
  })

  it.each(['cleaned-video.mp4', 'CLEANED-VIDEO.MP4'])(
    'accepts %s when the browser provides no MIME type',
    (name) => {
      const file = new File(['video'], name, { type: '' })

      expect(() => validateLocalVideo(file)).not.toThrow()
    },
  )

  it.each([
    ['cleaned-video.mov', ''],
    ['cleaned-video', ''],
    ['notes.txt', 'text/plain'],
    ['cleaned-video.mp4', 'application/octet-stream'],
    ['cleaned-video.webm', 'video/webm'],
  ])('rejects %s with MIME type %s', (name, type) => {
    const file = new File(['not-mp4'], name, { type })

    expect(() => validateLocalVideo(file)).toThrow(MP4_ERROR)
  })
})

describe('createLocalMediaHandle', () => {
  it('creates one object URL and returns it with the original file', () => {
    const file = new File(['video'], 'cleaned-video.mp4', { type: 'video/mp4' })
    const createObjectURL = vi.fn(() => 'blob:cleaned-video')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const handle = createLocalMediaHandle(file)

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledWith(file)
    expect(handle.file).toBe(file)
    expect(handle.url).toBe('blob:cleaned-video')
  })

  it('revokes the exact object URL when disposed', () => {
    const file = new File(['video'], 'cleaned-video.mp4', { type: 'video/mp4' })
    const createObjectURL = vi.fn(() => 'blob:exact-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    createLocalMediaHandle(file).dispose()

    expect(revokeObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:exact-url')
  })

  it('disposes safely more than once', () => {
    const file = new File(['video'], 'cleaned-video.mp4', { type: 'video/mp4' })
    const createObjectURL = vi.fn(() => 'blob:dispose-once')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const handle = createLocalMediaHandle(file)

    handle.dispose()
    handle.dispose()

    expect(revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('validates before creating an object URL', () => {
    const file = new File(['not-video'], 'notes.txt', { type: 'text/plain' })
    const createObjectURL = vi.fn(() => 'blob:must-not-exist')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    expect(() => createLocalMediaHandle(file)).toThrow(MP4_ERROR)
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})

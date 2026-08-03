import { describe, expect, it } from 'vitest'
import {
  checkImportFile,
  MEDIA_IMPORT_CHOICES,
  mediaImportChoice,
  splitImportFiles,
} from './media-import-kinds'

const file = (name: string, type: string): File => new File(['x'], name, { type })

describe('media import choices', () => {
  it('offers exactly Video, Image, Audio and All supported media', () => {
    expect(MEDIA_IMPORT_CHOICES.map((choice) => choice.id)).toEqual(['video', 'image', 'audio', 'all'])
    expect(MEDIA_IMPORT_CHOICES.map((choice) => choice.label))
      .toEqual(['Video', 'Image', 'Audio', 'All supported media'])
  })

  it('gives each choice a filter that matches what the product can really take', () => {
    expect(mediaImportChoice('video').accept).toContain('video/mp4')
    expect(mediaImportChoice('video').accept).not.toContain('image/')
    expect(mediaImportChoice('image').accept).toContain('image/png')
    expect(mediaImportChoice('image').accept).not.toContain('audio/')
    expect(mediaImportChoice('audio').accept).toContain('audio/mpeg')
    expect(mediaImportChoice('audio').accept).not.toContain('video/')
    // "All supported" is the union, never a wildcard: `*` would let a person
    // pick a spreadsheet and be refused a second later.
    const all = mediaImportChoice('all').accept
    expect(all).not.toContain('*')
    for (const kind of ['video', 'image', 'audio'] as const) {
      for (const part of mediaImportChoice(kind).accept.split(',')) expect(all).toContain(part)
    }
  })
})

describe('checking one file before uploading it', () => {
  it('accepts anything the browser calls video, image or audio', () => {
    for (const candidate of [
      file('a.mp4', 'video/mp4'),
      file('b.mov', 'video/quicktime'),
      file('c.png', 'image/png'),
      file('d.wav', 'audio/wav'),
      file('e.MP4', 'VIDEO/MP4'),
    ]) {
      expect(checkImportFile(candidate).supported).toBe(true)
    }
  })

  it('falls back to the file name when the browser has no opinion', () => {
    expect(checkImportFile(file('holiday.mkv', '')).supported).toBe(true)
    expect(checkImportFile(file('song.flac', 'application/octet-stream')).supported).toBe(true)
    expect(checkImportFile(file('notes', '')).supported).toBe(false)
  })

  it('refuses a file that is plainly not media, and names it in the refusal', () => {
    const refused = checkImportFile(file('budget.pdf', 'application/pdf'))
    expect(refused.supported).toBe(false)
    if (refused.supported) throw new Error('expected a refusal')
    expect(refused.reason).toContain('budget.pdf')
    expect(refused.reason).toMatch(/video, a picture, or a piece of music/)
  })
})

describe('splitting a mixed drop', () => {
  it('sends what it can and reports every refusal individually', () => {
    const good = file('clip.mp4', 'video/mp4')
    const alsoGood = file('cover.png', 'image/png')
    const split = splitImportFiles([good, file('budget.pdf', 'application/pdf'), alsoGood, file('archive.zip', 'application/zip')])
    expect(split.accepted).toEqual([good, alsoGood])
    // One sentence per file. "Some files were not supported" leaves the user to
    // work out which, and with ten files that is not a reasonable thing to ask.
    expect(split.refusals).toHaveLength(2)
    expect(split.refusals[0]).toContain('budget.pdf')
    expect(split.refusals[1]).toContain('archive.zip')
  })

  it('accepts everything or nothing without inventing a partial answer', () => {
    expect(splitImportFiles([]).accepted).toEqual([])
    expect(splitImportFiles([]).refusals).toEqual([])
    const allBad = splitImportFiles([file('a.txt', 'text/plain')])
    expect(allBad.accepted).toEqual([])
    expect(allBad.refusals).toHaveLength(1)
  })
})

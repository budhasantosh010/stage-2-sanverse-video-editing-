import { describe, expect, it } from 'vitest'
import { estimateTokenWidth, fitWordLines } from './text-fit.ts'

describe('deterministic text fitting', () => {
  it('returns identical line plans for repeated inputs', () => {
    const tokens = ['Build', 'videos', '10×', 'faster']
    const options = { maxWidth: 900, maxLines: 2, preferredFontSize: 126, minimumFontSize: 56 }
    expect(fitWordLines(tokens, options)).toEqual(fitWordLines(tokens, options))
  })

  it('reduces font size only as far as necessary', () => {
    const fit = fitWordLines(['A', 'clear', 'headline', 'that', 'needs', 'two', 'lines'], {
      maxWidth: 520,
      maxLines: 2,
      preferredFontSize: 110,
      minimumFontSize: 50,
      fontSizeStep: 2,
    })
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    expect(fit.fontSize).toBeGreaterThanOrEqual(50)
    expect(fit.fontSize).toBeLessThanOrEqual(110)
    expect(fit.lines.length).toBeLessThanOrEqual(2)
    expect(fit.lines.every((line) => line.estimatedWidth <= 520)).toBe(true)
  })

  it('refuses one impossible unbreakable token instead of clipping it', () => {
    const fit = fitWordLines(['X'.repeat(80)], { maxWidth: 400, maxLines: 3, preferredFontSize: 100, minimumFontSize: 52 })
    expect(fit).toMatchObject({ ok: false, reason: 'TOKEN_TOO_WIDE', tokenIndex: 0, minimumFontSize: 52 })
  })

  it('refuses copy that needs more lines than allowed at the minimum size', () => {
    const fit = fitWordLines(['one','two','three','four','five','six','seven','eight','nine','ten'], {
      maxWidth: 240,
      maxLines: 1,
      preferredFontSize: 80,
      minimumFontSize: 60,
    })
    expect(fit.ok).toBe(false)
    if (fit.ok) return
    expect(fit.reason).toBe('TOO_MANY_LINES')
  })

  it('measures Unicode/CJK/emoji as finite positive width', () => {
    for (const token of ['创作', 'أسرع', '10×', '🚀']) {
      const width = estimateTokenWidth(token, 72)
      expect(Number.isFinite(width)).toBe(true)
      expect(width).toBeGreaterThan(0)
    }
  })

  it('handles large but finite dimensions without overflow', () => {
    const fit = fitWordLines(['large', 'composition', 'headline'], {
      maxWidth: 1_000_000,
      maxLines: 3,
      preferredFontSize: 50_000,
      minimumFontSize: 10_000,
      fontSizeStep: 100,
    })
    expect(fit.ok).toBe(true)
  })
})

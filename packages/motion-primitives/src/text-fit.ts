import { assertFiniteNumber } from './math.ts'

export interface TextFitLine {
  readonly startTokenIndex: number
  readonly endTokenIndexExclusive: number
  readonly estimatedWidth: number
}

export interface TextFitSuccess {
  readonly ok: true
  readonly fontSize: number
  readonly lines: readonly TextFitLine[]
}

export interface TextFitFailure {
  readonly ok: false
  readonly reason: 'TOKEN_TOO_WIDE' | 'TOO_MANY_LINES'
  readonly minimumFontSize: number
  readonly requiredLineCount?: number
  readonly tokenIndex?: number
}

export type TextFitResult = TextFitSuccess | TextFitFailure

export interface FitWordLinesOptions {
  readonly maxWidth: number
  readonly maxLines: number
  readonly preferredFontSize: number
  readonly minimumFontSize: number
  readonly fontSizeStep?: number
  readonly letterSpacingEm?: number
  readonly spaceWidthEm?: number
}

const isWideUnicode = (codePoint: number): boolean =>
  (codePoint >= 0x1100 && codePoint <= 0x11ff) ||
  (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
  (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
  (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
  (codePoint >= 0x1f000 && codePoint <= 0x1faff)

const glyphWidthEm = (character: string): number => {
  const codePoint = character.codePointAt(0) ?? 0
  if (isWideUnicode(codePoint)) return 1
  if (/^[ilIjtfr1|!]$/u.test(character)) return 0.34
  if (/^[mwMW@%&#QO0]$/u.test(character)) return 0.9
  if (/^[.,:;'`·]$/u.test(character)) return 0.28
  if (/^[()\[\]{}]$/u.test(character)) return 0.38
  if (/^[\-–—_/\\+]$/u.test(character)) return 0.45
  if (/^[A-Z]$/u.test(character)) return 0.68
  if (/^[0-9]$/u.test(character)) return 0.61
  if (/^[a-z]$/u.test(character)) return 0.56
  return 0.68
}

export const estimateTokenWidth = (
  token: string,
  fontSize: number,
  letterSpacingEm = -0.045,
): number => {
  if (typeof token !== 'string' || token.length === 0) throw new RangeError('token must be a non-empty string.')
  assertFiniteNumber(fontSize, 'fontSize')
  assertFiniteNumber(letterSpacingEm, 'letterSpacingEm')
  if (fontSize <= 0) throw new RangeError('fontSize must be greater than zero.')

  const glyphs = Array.from(token)
  const glyphWidth = glyphs.reduce((total, glyph) => total + glyphWidthEm(glyph), 0)
  const spacingWidth = Math.max(0, glyphs.length - 1) * letterSpacingEm
  return Math.max(fontSize * 0.2, (glyphWidth + spacingWidth) * fontSize)
}

interface LayoutAttemptSuccess {
  readonly ok: true
  readonly lines: readonly TextFitLine[]
}

interface LayoutAttemptFailure {
  readonly ok: false
  readonly reason: TextFitFailure['reason']
  readonly requiredLineCount?: number
  readonly tokenIndex?: number
}

const layoutAtFontSize = (
  tokens: readonly string[],
  fontSize: number,
  maxWidth: number,
  maxLines: number,
  letterSpacingEm: number,
  spaceWidthEm: number,
): LayoutAttemptSuccess | LayoutAttemptFailure => {
  const tokenWidths = tokens.map((token) => estimateTokenWidth(token, fontSize, letterSpacingEm))
  const spaceWidth = fontSize * spaceWidthEm
  const tooWideIndex = tokenWidths.findIndex((width) => width > maxWidth)
  if (tooWideIndex >= 0) return { ok: false, reason: 'TOKEN_TOO_WIDE', tokenIndex: tooWideIndex }

  const lines: TextFitLine[] = []
  let start = 0
  let width = 0
  for (let index = 0; index < tokens.length; index += 1) {
    const nextWidth = width === 0 ? tokenWidths[index]! : width + spaceWidth + tokenWidths[index]!
    if (nextWidth <= maxWidth || width === 0) {
      width = nextWidth
      continue
    }
    lines.push(Object.freeze({ startTokenIndex: start, endTokenIndexExclusive: index, estimatedWidth: width }))
    start = index
    width = tokenWidths[index]!
  }
  if (tokens.length > 0) lines.push(Object.freeze({ startTokenIndex: start, endTokenIndexExclusive: tokens.length, estimatedWidth: width }))

  if (lines.length > maxLines) return { ok: false, reason: 'TOO_MANY_LINES', requiredLineCount: lines.length }
  return { ok: true, lines: Object.freeze(lines) }
}

export const fitWordLines = (tokens: readonly string[], options: FitWordLinesOptions): TextFitResult => {
  if (!Array.isArray(tokens) || tokens.length === 0 || tokens.some((token) => typeof token !== 'string' || !token.length)) throw new RangeError('tokens must contain at least one non-empty string.')
  const { maxWidth, maxLines, preferredFontSize, minimumFontSize, letterSpacingEm = -0.045, spaceWidthEm = 0.34 } = options
  const fontSizeStep = options.fontSizeStep ?? 2
  for (const [value, label] of [[maxWidth, 'maxWidth'], [preferredFontSize, 'preferredFontSize'], [minimumFontSize, 'minimumFontSize'], [fontSizeStep, 'fontSizeStep'], [letterSpacingEm, 'letterSpacingEm'], [spaceWidthEm, 'spaceWidthEm']] as const) assertFiniteNumber(value, label)
  if (maxWidth <= 0) throw new RangeError('maxWidth must be greater than zero.')
  if (!Number.isSafeInteger(maxLines) || maxLines <= 0) throw new RangeError('maxLines must be a positive safe integer.')
  if (minimumFontSize <= 0 || preferredFontSize < minimumFontSize) throw new RangeError('Font bounds must satisfy preferredFontSize >= minimumFontSize > 0.')
  if (fontSizeStep <= 0) throw new RangeError('fontSizeStep must be greater than zero.')
  if (spaceWidthEm <= 0) throw new RangeError('spaceWidthEm must be greater than zero.')

  let lastFailure: LayoutAttemptFailure = { ok: false, reason: 'TOO_MANY_LINES' }
  for (let fontSize = preferredFontSize; fontSize >= minimumFontSize; fontSize = Math.max(minimumFontSize, fontSize - fontSizeStep)) {
    const attempt = layoutAtFontSize(tokens, fontSize, maxWidth, maxLines, letterSpacingEm, spaceWidthEm)
    if (attempt.ok) return Object.freeze({ ok: true, fontSize, lines: attempt.lines })
    lastFailure = attempt
    if (fontSize === minimumFontSize) break
  }

  return Object.freeze({
    ok: false,
    reason: lastFailure.reason,
    minimumFontSize,
    requiredLineCount: lastFailure.requiredLineCount,
    tokenIndex: lastFailure.tokenIndex,
  })
}

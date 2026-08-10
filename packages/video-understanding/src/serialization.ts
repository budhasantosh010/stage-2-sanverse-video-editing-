import { validateVideoUnderstanding } from './validation.ts'
import type { VideoUnderstandingDocumentV1 } from './document.ts'

export const serializeVideoUnderstanding = (document: VideoUnderstandingDocumentV1): string => JSON.stringify(document)
export const parseVideoUnderstanding = (json: string): VideoUnderstandingDocumentV1 => {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new TypeError('Video Understanding JSON is invalid.') }
  const result = validateVideoUnderstanding(parsed)
  if (!result.ok) throw new TypeError(result.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'))
  return result.value
}

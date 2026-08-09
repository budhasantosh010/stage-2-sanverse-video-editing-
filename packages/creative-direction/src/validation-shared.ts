export type CreativeValidationIssueCodeV1 =
  | 'TYPE_INVALID'
  | 'FIELD_REQUIRED'
  | 'VALUE_INVALID'
  | 'TIME_INVALID'
  | 'DUPLICATE_ID'
  | 'REFERENCE_INVALID'
  | 'CONFLICT'
  | 'SCHEMA_UNSUPPORTED'

export interface CreativeValidationIssueV1 {
  readonly path: string
  readonly code: CreativeValidationIssueCodeV1
  readonly message: string
}

export type CreativeValidationResultV1<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly CreativeValidationIssueV1[] }>

export const validationOk = <T,>(value: T): CreativeValidationResultV1<T> => Object.freeze({ ok: true, value })
export const validationFail = <T = never>(issues: readonly CreativeValidationIssueV1[]): CreativeValidationResultV1<T> => Object.freeze({ ok: false, issues: Object.freeze(issues) })
export const creativeValidationIssue = (path: string, code: CreativeValidationIssueCodeV1, message: string): CreativeValidationIssueV1 => Object.freeze({ path, code, message })

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
export const boundedString = (value: unknown, max = 240): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max
export const stableCreativeId = (value: unknown): value is string => boundedString(value, 240) && /^[A-Za-z][A-Za-z0-9_.:-]*$/u.test(value)
export const finite01 = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
export const safeNonNegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
export const creativeRegionValid = (startTicks: unknown, endTicks: unknown, durationTicks: number): boolean => safeNonNegativeInteger(startTicks) && safeNonNegativeInteger(endTicks) && startTicks < endTicks && endTicks <= durationTicks
export const creativeRegionsOverlap = (a: Readonly<{ startTicks: number; endTicks: number }>, b: Readonly<{ startTicks: number; endTicks: number }>): boolean => a.startTicks < b.endTicks && b.startTicks < a.endTicks

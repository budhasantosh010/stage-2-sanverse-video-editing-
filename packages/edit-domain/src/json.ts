import { err, isRecord, ok, type Result } from './result.ts'

/**
 * Bounded, preserved project extensions.
 *
 * Extensions are the non-executable half of the project file. They may carry
 * notes, labels, and UI preferences that a future version understands and this
 * version does not. Unknown extensions are preserved on read and written back
 * unchanged, because silently dropping them destroys another version's data.
 *
 * Extensions may never alter render output, timing, authorization, or revision.
 * Anything that changes the exported video is an operation, not an extension,
 * and unknown operations are rejected loudly instead of preserved.
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | Readonly<{ [key: string]: JsonValue }>

export type Extensions = Readonly<Record<string, JsonValue>>

export const EXTENSION_LIMITS = {
  maxDepth: 8,
  maxNodes: 256,
  maxSerializedBytes: 8192,
  maxKeyLength: 128,
  maxStringLength: 4096,
} as const

/** `namespace/name`, for example `sanverse.ui/note`. */
export const EXTENSION_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*\/[a-z][a-z0-9-]*$/

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export type ExtensionsIssueCode =
  | 'TYPE_INVALID'
  | 'KEY_NOT_NAMESPACED'
  | 'KEY_FORBIDDEN'
  | 'KEY_TOO_LONG'
  | 'NUMBER_UNSAFE'
  | 'STRING_TOO_LONG'
  | 'DEPTH_EXCEEDED'
  | 'SIZE_EXCEEDED'

export type ExtensionsIssue = {
  readonly path: string
  readonly code: ExtensionsIssueCode
}

export type ExtensionsError = {
  readonly code: 'EXTENSIONS_INVALID'
  readonly issues: readonly ExtensionsIssue[]
}

export const emptyExtensions = (): Extensions => Object.freeze({})

type CopyState = { nodes: number; issues: ExtensionsIssue[] }

const copyValue = (value: unknown, path: string, depth: number, state: CopyState): JsonValue => {
  state.nodes += 1
  if (state.nodes > EXTENSION_LIMITS.maxNodes) {
    state.issues.push({ path, code: 'SIZE_EXCEEDED' })
    return null
  }
  if (depth > EXTENSION_LIMITS.maxDepth) {
    state.issues.push({ path, code: 'DEPTH_EXCEEDED' })
    return null
  }

  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      state.issues.push({ path, code: 'NUMBER_UNSAFE' })
      return null
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      state.issues.push({ path, code: 'NUMBER_UNSAFE' })
      return null
    }
    return value
  }
  if (typeof value === 'string') {
    if (value.length > EXTENSION_LIMITS.maxStringLength) {
      state.issues.push({ path, code: 'STRING_TOO_LONG' })
      return null
    }
    return value
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item, index) => copyValue(item, `${path}[${index}]`, depth + 1, state)))
  }
  if (isRecord(value)) {
    const copy: Record<string, JsonValue> = {}
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        state.issues.push({ path: `${path}.${key}`, code: 'KEY_FORBIDDEN' })
        continue
      }
      if (key.length > EXTENSION_LIMITS.maxKeyLength) {
        state.issues.push({ path: `${path}.${key.slice(0, 32)}`, code: 'KEY_TOO_LONG' })
        continue
      }
      copy[key] = copyValue(value[key], `${path}.${key}`, depth + 1, state)
    }
    return Object.freeze(copy)
  }

  state.issues.push({ path, code: 'TYPE_INVALID' })
  return null
}

/**
 * Validate, deep-copy, and freeze an extensions bag. The returned value shares
 * no mutable structure with the input, so a later mutation of the caller's
 * object cannot reach validated project state.
 */
export const validateExtensions = (input: unknown): Result<Extensions, ExtensionsError> => {
  if (input === undefined) return ok(emptyExtensions())
  if (!isRecord(input)) {
    return err({ code: 'EXTENSIONS_INVALID', issues: [{ path: '$', code: 'TYPE_INVALID' }] })
  }

  const state: CopyState = { nodes: 0, issues: [] }
  const copy: Record<string, JsonValue> = {}
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_KEYS.has(key)) {
      state.issues.push({ path: key, code: 'KEY_FORBIDDEN' })
      continue
    }
    if (!EXTENSION_KEY_PATTERN.test(key)) {
      state.issues.push({ path: key, code: 'KEY_NOT_NAMESPACED' })
      continue
    }
    copy[key] = copyValue(input[key], key, 1, state)
  }

  if (state.issues.length === 0) {
    let serialized: string
    try {
      serialized = JSON.stringify(copy)
    } catch {
      return err({ code: 'EXTENSIONS_INVALID', issues: [{ path: '$', code: 'TYPE_INVALID' }] })
    }
    const bytes = new TextEncoder().encode(serialized).byteLength
    if (bytes > EXTENSION_LIMITS.maxSerializedBytes) {
      state.issues.push({ path: '$', code: 'SIZE_EXCEEDED' })
    }
  }

  if (state.issues.length > 0) {
    return err({ code: 'EXTENSIONS_INVALID', issues: state.issues })
  }
  return ok(Object.freeze(copy))
}

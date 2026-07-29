import { PROJECT_SCHEMA_VERSION } from '@sanverse/edit-domain'
import { RENDER_PLAN_SCHEMA_VERSION } from '@sanverse/render-contract'

export type LocalDiagnostics = Readonly<{
  schemaVersion: 'sanverse.local-diagnostics/v1'
  appVersion: string
  projectSchemaVersion: string
  renderPlanSchemaVersion: string
  renderer: Readonly<{ configured: boolean; kind: 'ffmpeg' }>
  intentProvider: string
  jobs: Readonly<{ queued: number; running: number; failed: number }>
  lastError: Readonly<{ code: string; recovery: string }> | null
}>

const safeText = (value: string, fallback: string): string =>
  /^[a-zA-Z0-9 ._:/-]{1,160}$/.test(value) &&
  !value.startsWith('/') &&
  !value.includes('../') &&
  !/[\\]|[A-Za-z]:\//.test(value)
    ? value
    : fallback

export const buildLocalDiagnostics = (input: {
  readonly rendererConfigured: boolean
  readonly intentProviderName: string
  readonly jobs?: Readonly<{ queued: number; running: number; failed: number }>
  readonly lastError?: Readonly<{ code: string; recovery: string }> | null
}): LocalDiagnostics => Object.freeze({
  schemaVersion: 'sanverse.local-diagnostics/v1',
  appVersion: '0.0.0-local-alpha',
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
  renderPlanSchemaVersion: RENDER_PLAN_SCHEMA_VERSION,
  renderer: Object.freeze({ configured: input.rendererConfigured, kind: 'ffmpeg' as const }),
  intentProvider: safeText(input.intentProviderName, 'unavailable'),
  jobs: Object.freeze(input.jobs ?? { queued: 0, running: 0, failed: 0 }),
  lastError: input.lastError
    ? Object.freeze({
        code: safeText(input.lastError.code, 'UNKNOWN'),
        recovery: safeText(input.lastError.recovery, 'Restart the local app and retry.'),
      })
    : null,
})

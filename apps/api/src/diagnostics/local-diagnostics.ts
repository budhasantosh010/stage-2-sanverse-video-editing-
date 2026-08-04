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
  /**
   * How much preview-picture work is happening right now.
   *
   * Here so that "processes are bounded" can be OBSERVED rather than argued
   * for. If these numbers ever climb past the configured ceilings, the bound is
   * broken and it is visible without attaching a debugger.
   */
  mediaAnalysis: Readonly<{
    activeFrames: number
    activeWaveforms: number
    queued: number
    sharedJobs: number
  }>
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
  readonly mediaAnalysis?: Readonly<{
    activeFrames: number
    activeWaveforms: number
    queued: number
    sharedJobs: number
  }>
  readonly lastError?: Readonly<{ code: string; recovery: string }> | null
}): LocalDiagnostics => Object.freeze({
  schemaVersion: 'sanverse.local-diagnostics/v1',
  appVersion: '0.0.0-local-alpha',
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
  renderPlanSchemaVersion: RENDER_PLAN_SCHEMA_VERSION,
  renderer: Object.freeze({ configured: input.rendererConfigured, kind: 'ffmpeg' as const }),
  intentProvider: safeText(input.intentProviderName, 'unavailable'),
  jobs: Object.freeze(input.jobs ?? { queued: 0, running: 0, failed: 0 }),
  mediaAnalysis: Object.freeze(input.mediaAnalysis ?? {
    activeFrames: 0, activeWaveforms: 0, queued: 0, sharedJobs: 0,
  }),
  lastError: input.lastError
    ? Object.freeze({
        code: safeText(input.lastError.code, 'UNKNOWN'),
        recovery: safeText(input.lastError.recovery, 'Restart the local app and retry.'),
      })
    : null,
})

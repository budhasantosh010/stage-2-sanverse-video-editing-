import { describe, expect, it } from 'vitest'

import { buildLocalDiagnostics } from './local-diagnostics.ts'

describe('safe local diagnostics', () => {
  it('exposes versions, availability, safe codes, and recovery without paths or secrets', () => {
    const diagnostics = buildLocalDiagnostics({
      rendererConfigured: true,
      intentProviderName: 'fake-local',
      jobs: { queued: 1, running: 0, failed: 1 },
      lastError: { code: 'RENDER_FAILED', recovery: 'Retry the export.' },
    })
    expect(diagnostics).toMatchObject({
      schemaVersion: 'sanverse.local-diagnostics/v1',
      projectSchemaVersion: 'sanverse.project/v4',
      renderPlanSchemaVersion: 'sanverse.render-plan/v5',
      renderer: { configured: true, kind: 'ffmpeg' },
      intentProvider: 'fake-local',
      jobs: { queued: 1, running: 0, failed: 1 },
      lastError: { code: 'RENDER_FAILED', recovery: 'Retry the export.' },
    })
    expect(JSON.stringify(diagnostics)).not.toMatch(/[A-Z]:\\|api[_-]?key|token/i)
  })
})

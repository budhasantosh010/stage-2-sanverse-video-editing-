import { describe, expect, it, vi } from 'vitest'

import { accept, createHistory } from '@sanverse/edit-domain/history'
import type { AddNameplateAction } from '@sanverse/edit-domain/actions'
import { createRenderService } from './render-service.ts'
import type { RenderPort } from './render-port.ts'

const action = (actionId = 'action-1'): AddNameplateAction => ({
  schemaVersion: 'sanverse.action/v1',
  actionId,
  kind: 'add-nameplate',
  target: { x: 0.25, y: 0.5, sourceTimeMs: 1_000 },
  primaryText: 'Santosh',
  secondaryText: 'Founder',
  startMs: 1_000,
  durationMs: 5_000,
})

describe('render service', () => {
  it('validates history and delegates immutable accepted actions only', async () => {
    const accepted = accept(createHistory(), action())
    if (!accepted.ok) throw new Error('fixture failed')
    const renderer: RenderPort = {
      render: vi.fn(async (request) => ({
        outputPath: request.outputPath,
        width: 1280,
        height: 720,
        durationMs: 8_000,
        hasAudio: true,
        sha256: 'abc',
      })),
    }
    const service = createRenderService({ renderer })

    const result = await service.exportAccepted({
      history: accepted.value,
      sourcePath: 'source.mp4',
      outputPath: 'export.mp4',
      trustedWorkDir: 'trusted',
    })

    expect(result.outputPath).toBe('export.mp4')
    expect(renderer.render).toHaveBeenCalledWith(expect.objectContaining({
      actions: [expect.objectContaining({ actionId: 'action-1' })],
    }))
    expect((renderer.render as ReturnType<typeof vi.fn>).mock.calls[0][0].actions)
      .not.toBe(accepted.value.accepted)
  })

  it('fails before invoking the renderer for invalid or empty accepted history', async () => {
    const renderer: RenderPort = { render: vi.fn() }
    const service = createRenderService({ renderer })
    const base = { sourcePath: 'source.mp4', outputPath: 'export.mp4', trustedWorkDir: 'trusted' }

    await expect(service.exportAccepted({ ...base, history: createHistory() }))
      .rejects.toMatchObject({ code: 'NOTHING_TO_RENDER' })
    await expect(service.exportAccepted({
      ...base,
      history: { accepted: [action()], redoStack: [], issuedActionIds: [] },
    })).rejects.toMatchObject({ code: 'RENDER_HISTORY_INVALID' })
    expect(renderer.render).not.toHaveBeenCalled()
  })
})

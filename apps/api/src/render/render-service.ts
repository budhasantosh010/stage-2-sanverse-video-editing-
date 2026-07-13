import { copyAddNameplateAction } from '@sanverse/edit-domain/actions'
import { validateHistory } from '@sanverse/edit-domain/history'
import type { RenderPort, RenderResult } from './render-port.ts'

export type RenderServiceErrorCode = 'RENDER_HISTORY_INVALID' | 'NOTHING_TO_RENDER'

export class RenderServiceError extends Error {
  readonly code: RenderServiceErrorCode

  constructor(code: RenderServiceErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'RenderServiceError'
  }
}

type ExportAcceptedInput = {
  readonly history: unknown
  readonly sourcePath: string
  readonly outputPath: string
  readonly trustedWorkDir: string
  readonly signal?: AbortSignal
}

export function createRenderService({ renderer }: { renderer: RenderPort }) {
  return {
    async exportAccepted(input: ExportAcceptedInput): Promise<RenderResult> {
      const history = validateHistory(input.history)
      if (!history.ok) {
        throw new RenderServiceError('RENDER_HISTORY_INVALID', 'Accepted edit history is invalid.')
      }
      if (history.value.accepted.length === 0) {
        throw new RenderServiceError('NOTHING_TO_RENDER', 'Accept at least one edit before exporting.')
      }
      return renderer.render({
        sourcePath: input.sourcePath,
        outputPath: input.outputPath,
        trustedWorkDir: input.trustedWorkDir,
        actions: Object.freeze(history.value.accepted.map(copyAddNameplateAction)),
        signal: input.signal,
      })
    },
  }
}

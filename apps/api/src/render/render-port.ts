import type { AddNameplateAction } from '@sanverse/edit-domain/actions'

export type RenderRequest = {
  readonly sourcePath: string
  readonly outputPath: string
  readonly trustedWorkDir: string
  readonly actions: readonly AddNameplateAction[]
  readonly signal?: AbortSignal
}

export type RenderResult = {
  readonly outputPath: string
  readonly width: number
  readonly height: number
  readonly durationMs: number
  readonly hasAudio: boolean
  readonly sha256: string
}

export interface RenderPort {
  render(request: RenderRequest): Promise<RenderResult>
}

export type RenderErrorCode =
  | 'RENDER_CANCELLED'
  | 'RENDER_PATH_INVALID'
  | 'RENDER_INPUT_INVALID'
  | 'RENDER_TOOL_UNAVAILABLE'
  | 'RENDER_PROCESS_BLOCKED'
  | 'RENDER_FAILED'
  | 'RENDER_OUTPUT_MISSING'
  | 'RENDER_OUTPUT_INVALID'

export class RenderError extends Error {
  readonly code: RenderErrorCode

  constructor(code: RenderErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'RenderError'
  }
}

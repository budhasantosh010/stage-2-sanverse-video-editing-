import type { RenderPlan } from '@sanverse/render-contract'

export type RenderRequest = {
  readonly sourcePath: string
  readonly outputPath: string
  readonly trustedWorkDir: string
  /**
   * The renderer is handed a finished plan, not a project and not a list of
   * user actions. It makes no editing decisions of its own.
   */
  readonly plan: RenderPlan
  readonly signal?: AbortSignal
}

export type RenderResult = {
  readonly outputPath: string
  readonly width: number
  readonly height: number
  readonly durationMs: number
  readonly hasAudio: boolean
  readonly sha256: string
  /** Ties the exported file back to the exact project state that produced it. */
  readonly projectRevision: number
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

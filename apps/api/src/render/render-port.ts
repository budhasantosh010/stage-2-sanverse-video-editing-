import type { RenderPlan } from '@sanverse/render-contract'

export type RenderRequest = {
  /** The main footage. Its dimensions and frame rate govern the whole export. */
  readonly sourcePath: string
  /**
   * Where every OTHER file the plan names lives, keyed by asset id: B-roll
   * clips, pictures, and music.
   *
   * Kept separate from the plan itself because a plan is renderer-neutral and
   * must never contain a filesystem path — that is what lets the same plan be
   * rendered on this machine today and in a container tomorrow.
   */
  readonly extraSourcePaths?: Readonly<Record<string, string>>
  readonly outputPath: string
  readonly trustedWorkDir: string
  /**
   * The renderer is handed a finished plan, not a project and not a list of
   * user actions. It makes no editing decisions of its own.
   */
  readonly plan: RenderPlan
  readonly signal?: AbortSignal
  /**
   * Report crossing a real boundary inside the export.
   *
   * Not a progress percentage. A percentage the renderer cannot actually
   * measure would be an invented number, and the user would read a moving bar
   * as evidence of progress that may not exist. These are two moments the
   * renderer genuinely knows it has reached, so a stalled export can be
   * attributed to encoding or to verification rather than to "somewhere".
   */
  readonly onMilestone?: (milestone: RenderMilestone) => void
}

/** 'rendering' — FFmpeg started. 'verifying' — FFmpeg exited 0; checking the file. */
export type RenderMilestone = 'rendering' | 'verifying'

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

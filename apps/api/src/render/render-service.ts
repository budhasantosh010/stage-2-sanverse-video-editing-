import { activeOperations, type EditProject } from '@sanverse/edit-domain'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'

import type { RenderMilestone, RenderPort, RenderResult } from './render-port.ts'

export type RenderServiceErrorCode = 'RENDER_PROJECT_INVALID' | 'NOTHING_TO_RENDER'

export class RenderServiceError extends Error {
  readonly code: RenderServiceErrorCode

  constructor(code: RenderServiceErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'RenderServiceError'
  }
}

type ExportProjectInput = {
  readonly project: EditProject
  readonly sourcePath: string
  /**
   * Where every extra file lives, keyed by asset id. The caller owns storage,
   * so it is the caller that turns an opaque storageRef into a real path.
   */
  readonly extraSourcePaths?: Readonly<Record<string, string>>
  readonly outputPath: string
  readonly trustedWorkDir: string
  readonly signal?: AbortSignal
  readonly onMilestone?: (milestone: RenderMilestone) => void
}

export function createRenderService({ renderer }: { renderer: RenderPort }) {
  return {
    /**
     * Export what the project actually says, compiled here on the server.
     *
     * The browser no longer sends a list of edits to render. It cannot, which
     * means a tampered or stale client can never cause an export that differs
     * from the saved project the user approved.
     */
    async exportProject(input: ExportProjectInput): Promise<RenderResult> {
      const plan = compileProjectToRenderPlan(input.project)
      if (!plan.ok) {
        throw new RenderServiceError('RENDER_PROJECT_INVALID', 'The project could not be compiled for rendering.')
      }
      // A project whose only edits are cuts has an empty overlay list and is
      // still perfectly exportable, so the question is whether the user has
      // accepted anything at all — not whether anything is drawn on top.
      if (activeOperations(input.project).length === 0) {
        throw new RenderServiceError('NOTHING_TO_RENDER', 'Accept at least one edit before exporting.')
      }
      return renderer.render({
        sourcePath: input.sourcePath,
        extraSourcePaths: input.extraSourcePaths,
        outputPath: input.outputPath,
        trustedWorkDir: input.trustedWorkDir,
        plan: plan.value,
        signal: input.signal,
        onMilestone: input.onMilestone,
      })
    },
  }
}

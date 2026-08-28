import { describe, expect, it } from 'vitest'
import { acceptChangeSet } from '@sanverse/edit-domain'
import { testProject } from '@sanverse/edit-domain/test-fixtures'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import { buildCreativeProductionApplyBundleV16, buildKineticHeadlineCandidateV16 } from '@sanverse/creative-production-adapter'
import { compilePreviewPlan, visibleTitles, visualCssStyleAt } from '../render-plan/render-plan-preview'

describe('V1.6 Creative production preview/export parity', () => {
  it('uses the same canonical render plan and resolved title/visual state at exact checkpoints', () => {
    const project = testProject()
    const candidate = buildKineticHeadlineCandidateV16({
      project,
      compositionTicks: 1_440_000,
      headline: 'Preview equals export',
      subhead: 'Same authority',
    })
    expect(candidate.ok).toBe(true)
    if (!candidate.ok) return
    const bundle = buildCreativeProductionApplyBundleV16(candidate.value)
    expect(bundle.ok).toBe(true)
    if (!bundle.ok) return
    const accepted = acceptChangeSet(project, {
      schemaVersion: 'sanverse.change-set/v1',
      changeSetId: bundle.value.changeSetId,
      baseRevision: project.revision,
      operations: bundle.value.operations,
      provenance: bundle.value.provenance,
      extensions: bundle.value.extensions,
    })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return

    const preview = compilePreviewPlan(accepted.value)
    const compiled = compileProjectToRenderPlan(accepted.value)
    expect(preview).not.toBeNull()
    expect(compiled.ok).toBe(true)
    if (!preview || !compiled.ok) return
    expect(preview).toEqual(compiled.value)

    const title = compiled.value.overlays.find((node) => node.kind === 'title-overlay')
    expect(title).toBeDefined()
    if (!title || title.kind !== 'title-overlay') return
    const start = title.interval.start.ticks
    const end = start + title.interval.duration.ticks
    const checkpoints = [start, start + 240_000, start + 720_000, Math.max(start, end - 1)]
    for (const tick of checkpoints) {
      const previewTitle = visibleTitles(preview, tick)[0]
      const exportTitle = visibleTitles(compiled.value, tick)[0]
      expect(previewTitle).toEqual(exportTitle)
      expect(previewTitle).toMatchObject({ headline: 'Preview equals export', subhead: 'Same authority' })
      if (!previewTitle || !exportTitle) continue
      expect(visualCssStyleAt(preview, previewTitle, tick, preview.width, preview.height, false)).toEqual(
        visualCssStyleAt(compiled.value, exportTitle, tick, compiled.value.width, compiled.value.height, false),
      )
    }
  })
})

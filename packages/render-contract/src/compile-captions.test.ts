import { describe, expect, it } from 'vitest'
import { acceptChangeSet, toSeconds, type EditProject } from '@sanverse/edit-domain'
import {
  changeSetOf,
  ms,
  testCaptions,
  testProject,
  testRemove,
  testSetEnabled,
  testSplit,
} from '@sanverse/edit-domain/test-fixtures'

import { CAPTION_STYLE_PLAIN_ID } from './caption-style.ts'
import { compileProjectToRenderPlan } from './compile-project.ts'
import type { CaptionOverlayNode } from './render-plan.ts'

const accept = (project: EditProject, changeSet: ReturnType<typeof changeSetOf>): EditProject => {
  const result = acceptChangeSet(project, changeSet)
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const captions = (overrides: Parameters<typeof testCaptions>[0] = {}): EditProject =>
  accept(testProject(), changeSetOf('changeset_cap00001', 0, [testCaptions(overrides)]))

const captionNodes = (project: EditProject): CaptionOverlayNode[] => {
  const compiled = compileProjectToRenderPlan(project)
  if (!compiled.ok) throw new Error(`compile failed: ${JSON.stringify(compiled.error)}`)
  return compiled.value.overlays.filter(
    (node): node is CaptionOverlayNode => node.kind === 'caption-overlay',
  )
}

describe('compiling captions into a render plan', () => {
  it('emits one node per cue, in time order', () => {
    const nodes = captionNodes(captions())
    expect(nodes.map((node) => node.lines[0])).toEqual(['first line', 'second line', 'third line'])
    expect(nodes.map((node) => toSeconds(node.interval.start))).toEqual([1, 3, 5])
  })

  it('carries the set style onto every node', () => {
    const nodes = captionNodes(captions({ styleId: CAPTION_STYLE_PLAIN_ID }))
    for (const node of nodes) expect(node.styleId).toBe(CAPTION_STYLE_PLAIN_ID)
  })

  it('gives every node a distinct id, including the two halves of a split cue', () => {
    let project = captions({
      cues: [{ cueId: 'cue_0001', sourceInterval: { start: ms(1_000), duration: ms(2_000) }, lines: ['spanning'] }],
    })
    project = accept(project, changeSetOf('changeset_split001', project.revision, [
      testSplit({ atClipTime: ms(2_000), newClipId: 'clip_bbbbbbbb' }),
    ]))

    const nodes = captionNodes(project)
    expect(nodes).toHaveLength(2)
    expect(new Set(nodes.map((node) => node.nodeId)).size).toBe(2)
    expect(nodes[0].lines).toEqual(nodes[1].lines)
    // The two halves touch exactly, so the caption looks unbroken on screen.
    expect(toSeconds(nodes[0].interval.start) + toSeconds(nodes[0].interval.duration))
      .toBe(toSeconds(nodes[1].interval.start))
  })

  it('drops only the cue whose footage was removed', () => {
    let project = captions()
    project = accept(project, changeSetOf('changeset_split001', project.revision, [
      testSplit({ atClipTime: ms(2_000), newClipId: 'clip_bbbbbbbb' }),
    ]))
    project = accept(project, changeSetOf('changeset_remove01', project.revision, [
      testRemove({ clipId: 'clip_aaaaaaaa', ripple: true }),
    ]))

    const nodes = captionNodes(project)
    expect(nodes.map((node) => node.lines[0])).toEqual(['second line', 'third line'])
    expect(nodes.map((node) => toSeconds(node.interval.start))).toEqual([1, 3])
  })

  it('draws nothing for a cue sitting on hidden footage, but leaves the hole', () => {
    let project = captions()
    project = accept(project, changeSetOf('changeset_split001', project.revision, [
      testSplit({ atClipTime: ms(2_000), newClipId: 'clip_bbbbbbbb' }),
    ]))
    // Hide the opening piece. Cue 1 lives there; the others must not move,
    // because hiding leaves a hole rather than closing the gap.
    project = accept(project, changeSetOf('changeset_hide00001', project.revision, [
      testSetEnabled({ clipId: 'clip_aaaaaaaa', enabled: false }),
    ]))

    const nodes = captionNodes(project)
    expect(nodes.map((node) => node.lines[0])).toEqual(['second line', 'third line'])
    expect(nodes.map((node) => toSeconds(node.interval.start))).toEqual([3, 5])
  })

  it('keeps nameplates and captions as separate node kinds in one plan', () => {
    const project = accept(
      accept(testProject(), changeSetOf('changeset_cap00001', 0, [testCaptions()])),
      changeSetOf('changeset_nameplt1', 1, [
        {
          schemaVersion: 'sanverse.operation/v3',
          operationId: 'operation_nameplt1',
          kind: 'add-nameplate',
          capabilityId: 'sanverse.nameplate.component/v1',
          assetId: 'asset_aaaaaaaa',
          sourceInterval: { start: ms(8_000), duration: ms(2_000) },
          target: { coordinateSpace: 'composition-normalized', point: { x: 0.5, y: 0.5 }, anchor: 'center' },
          primaryText: 'Ada Lovelace',
          secondaryText: 'Mathematician',
          extensions: {},
        } as never,
      ]),
    )

    const compiled = compileProjectToRenderPlan(project)
    if (!compiled.ok) throw new Error('compile failed')
    const kinds = compiled.value.overlays.map((node) => node.kind)
    expect(kinds.filter((kind) => kind === 'caption-overlay')).toHaveLength(3)
    expect(kinds.filter((kind) => kind === 'text-overlay')).toHaveLength(1)
  })

  it('produces a plan the plan validator accepts', () => {
    // The compiler is not allowed to be the one component that may emit
    // something a renderer would choke on.
    expect(compileProjectToRenderPlan(captions()).ok).toBe(true)
  })
})

import { createHash } from 'node:crypto'

import type { EditProject } from '@sanverse/edit-domain'
import { RENDER_PLAN_SCHEMA_VERSION } from '@sanverse/render-contract'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'

/**
 * What makes two export requests "the same export".
 *
 * ## What was wrong before
 *
 * The answer used to be the project's revision number:
 *
 *      key = projectId : revision : schemaVersion
 *
 * A revision goes up on EVERY accepted edit. So an edit that cannot change one
 * frame of the video — writing a note to yourself, grouping three clips so they
 * move together, switching a track off and straight back on — produced a new
 * key, threw away a finished export, and made the user wait again for a file
 * that would come out byte-for-byte identical.
 *
 * That is the product punishing somebody for making a note.
 *
 * ## What it is now
 *
 * An export is identified by WHAT IT WILL PRODUCE:
 *
 *      key = projectId : schemaVersion : the compiled render plan
 *
 * The render plan is the complete, exact instruction for building the video —
 * every clip, every moment, every caption, every overlay, the canvas size, the
 * framing. Two projects whose plans are identical will produce identical files,
 * so they share one export. Two projects whose plans differ get different keys.
 *
 * ```
 *      user writes a note        user trims a clip
 *            |                          |
 *      revision goes up           revision goes up
 *      plan UNCHANGED             plan CHANGED
 *            |                          |
 *      same key                   new key
 *      finished export kept       new export built
 * ```
 *
 * ## The one case that cannot use the plan
 *
 * A project that will not compile has no plan to hash. That is not an error to
 * chase here: the export is going to be refused a moment later anyway, by the
 * code that actually builds the video and can say WHY in words the user can act
 * on. So the key falls back to the revision, which is what it always was.
 *
 * Falling back to the revision is the safe direction. It can only ever produce
 * MORE distinct keys than necessary — a wasted rebuild at worst. It can never
 * hand somebody a cached file made from a different project.
 *
 * ## Why plain JSON is enough to compare two plans
 *
 * `compileProjectToRenderPlan` builds the plan the same way every time: the same
 * fields, written in the same order, from the same inputs. JavaScript keeps the
 * order an object's fields were written in, so the same project always produces
 * character-for-character the same text here.
 *
 * The failure this could have — two identical plans hashing differently because
 * some field order wobbled — is the SAFE direction again: an extra export, never
 * a wrong one. A test drives a real project through it twice and asserts the two
 * keys match.
 */
export const exportIdempotencyKey = (project: EditProject): string => {
  const compiled = compileProjectToRenderPlan(project)
  if (!compiled.ok) {
    // No plan to compare. Fall back to the old behaviour rather than guess.
    return createHash('sha256')
      .update(`${project.projectId}:${RENDER_PLAN_SCHEMA_VERSION}:revision:${project.revision}`)
      .digest('hex')
  }

  /*
   * `projectRevision` is dropped before comparing, and it is the ONLY field
   * dropped.
   *
   * A plan carries the revision it was made from so that a finished file can be
   * traced back to the exact state of the project that produced it. That is
   * worth having and it stays in the plan. But it is a LABEL on the instruction,
   * not part of the instruction: FFmpeg never reads it, and two plans that
   * differ only in that number produce byte-identical video.
   *
   * Leaving it in would undo the whole point of this file — every edit moves the
   * revision, so every edit would move the key, and the old waste would be back.
   *
   * Everything else stays in, including the fields it is tempting to think are
   * cosmetic. `compositionId` and `projectId` are identity: two different pieces
   * of work must never share a cached file. `width`, `height` and `framing`
   * change the picture. `sources`, `segments`, `overlays`, `visuals` and `music`
   * ARE the video.
   */
  const { projectRevision: _traceability, ...producesTheVideo } = compiled.value

  return createHash('sha256')
    .update(`${project.projectId}:${RENDER_PLAN_SCHEMA_VERSION}:plan:${JSON.stringify(producesTheVideo)}`)
    .digest('hex')
}

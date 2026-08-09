import { MAX_PROJECT_TICKS } from '@sanverse/edit-domain/time'
import {
  CREATIVE_CONSTRAINT_TYPES,
  CREATIVE_DIRECTIVE_KINDS,
  CREATIVE_DIRECTIVE_PRIORITIES,
  CREATIVE_DIRECTIVE_SOURCES,
  CREATIVE_DIRECTIVE_STATUSES,
  CREATIVE_EMPHASIS_INTENTS,
  CREATIVE_FOOTAGE_TREATMENTS,
  CREATIVE_MOTION_CHARACTERS,
  CREATIVE_MOTION_ENTRANCES,
  CREATIVE_MOTION_EXITS,
  CREATIVE_PLACEMENT_INTENTS,
  CREATIVE_TRANSITION_INTENTS,
  directiveTrackForKind,
} from './directives.ts'
import type { CreativeDirectiveV1 } from './directives.ts'
import { CREATIVE_DIRECTION_TRACK_TYPES } from './tracks.ts'
import type { CreativeDirectionVersionV1 } from './versions.ts'
import type { CreativeDirectionDocumentV1 } from './document.ts'
import type { CreativeCommentTargetV1 } from './comments.ts'
import {
  boundedString,
  creativeRegionValid,
  creativeRegionsOverlap,
  creativeValidationIssue as issue,
  finite01,
  isRecord,
  safeNonNegativeInteger,
  stableCreativeId,
  validationFail,
  validationOk,
} from './validation-shared.ts'
import type { CreativeValidationIssueV1, CreativeValidationResultV1 } from './validation-shared.ts'

export const validateCreativeTracks = (tracks: unknown, path = '$.tracks'): readonly CreativeValidationIssueV1[] => {
  if (!Array.isArray(tracks)) return Object.freeze([issue(path, 'TYPE_INVALID', 'tracks must be an array.')])
  const issues: CreativeValidationIssueV1[] = []
  const ids = new Set<string>(), types = new Set<string>(), orders = new Set<number>()
  tracks.forEach((value, index) => {
    const itemPath = `${path}[${index}]`
    if (!isRecord(value)) { issues.push(issue(itemPath, 'TYPE_INVALID', 'track must be an object.')); return }
    if (!stableCreativeId(value.id)) issues.push(issue(`${itemPath}.id`, 'VALUE_INVALID', 'track id must be a stable bounded ID.'))
    else if (ids.has(value.id)) issues.push(issue(`${itemPath}.id`, 'DUPLICATE_ID', `duplicate track id: ${value.id}`)); else ids.add(value.id)
    if (typeof value.type !== 'string' || !CREATIVE_DIRECTION_TRACK_TYPES.includes(value.type as never)) issues.push(issue(`${itemPath}.type`, 'VALUE_INVALID', `unknown Creative Direction track: ${String(value.type)}`))
    else if (types.has(value.type)) issues.push(issue(`${itemPath}.type`, 'DUPLICATE_ID', `duplicate track type: ${value.type}`)); else types.add(value.type)
    if (!boundedString(value.label, 80)) issues.push(issue(`${itemPath}.label`, 'VALUE_INVALID', 'track label must be 1–80 characters.'))
    if (!safeNonNegativeInteger(value.order)) issues.push(issue(`${itemPath}.order`, 'VALUE_INVALID', 'track order must be non-negative.'))
    else if (orders.has(value.order)) issues.push(issue(`${itemPath}.order`, 'VALUE_INVALID', `duplicate track order: ${value.order}`)); else orders.add(value.order)
    if (typeof value.enabled !== 'boolean') issues.push(issue(`${itemPath}.enabled`, 'TYPE_INVALID', 'track enabled must be boolean.'))
  })
  for (const type of CREATIVE_DIRECTION_TRACK_TYPES) if (!types.has(type)) issues.push(issue(path, 'FIELD_REQUIRED', `Creative Direction V1 requires the ${type} track.`))
  return Object.freeze(issues)
}

export const validateCreativeGraphicContent = (value: unknown, path: string): readonly CreativeValidationIssueV1[] => {
  if (!isRecord(value)) return Object.freeze([issue(path, 'TYPE_INVALID', 'graphic content must be an object.')])
  const issues: CreativeValidationIssueV1[] = []
  if (value.primaryText !== undefined && (typeof value.primaryText !== 'string' || value.primaryText.length > 400)) issues.push(issue(`${path}.primaryText`, 'VALUE_INVALID', 'primaryText must be at most 400 characters.'))
  if (value.secondaryText !== undefined && (typeof value.secondaryText !== 'string' || value.secondaryText.length > 800)) issues.push(issue(`${path}.secondaryText`, 'VALUE_INVALID', 'secondaryText must be at most 800 characters.'))
  if (value.items !== undefined && (!Array.isArray(value.items) || value.items.length > 12 || !value.items.every((item) => typeof item === 'string' && item.length <= 240))) issues.push(issue(`${path}.items`, 'VALUE_INVALID', 'items must contain at most 12 bounded strings.'))
  if (value.fields !== undefined && (!isRecord(value.fields) || Object.keys(value.fields).length > 24 || Object.values(value.fields).some((entry) => !['string', 'number', 'boolean'].includes(typeof entry) || (typeof entry === 'number' && !Number.isFinite(entry))))) issues.push(issue(`${path}.fields`, 'VALUE_INVALID', 'fields must contain at most 24 finite primitive values.'))
  return Object.freeze(issues)
}

export const validateCreativeDirective = (input: unknown, durationTicks: number, path = '$.directive'): CreativeValidationResultV1<CreativeDirectiveV1> => {
  if (!isRecord(input)) return validationFail([issue(path, 'TYPE_INVALID', 'directive must be an object.')])
  const issues: CreativeValidationIssueV1[] = []
  if (!stableCreativeId(input.id)) issues.push(issue(`${path}.id`, 'VALUE_INVALID', 'directive id must be stable.'))
  const kindValid = typeof input.kind === 'string' && CREATIVE_DIRECTIVE_KINDS.includes(input.kind as never)
  if (!kindValid) issues.push(issue(`${path}.kind`, 'VALUE_INVALID', `unknown directive type: ${String(input.kind)}`))
  if (typeof input.track !== 'string' || !CREATIVE_DIRECTION_TRACK_TYPES.includes(input.track as never)) issues.push(issue(`${path}.track`, 'VALUE_INVALID', `unknown directive track: ${String(input.track)}`))
  if (!creativeRegionValid(input.startTicks, input.endTicks, durationTicks)) issues.push(issue(path, 'TIME_INVALID', `directive region must use exact ticks with 0 <= start < end <= ${durationTicks}.`))
  if (typeof input.source !== 'string' || !CREATIVE_DIRECTIVE_SOURCES.includes(input.source as never)) issues.push(issue(`${path}.source`, 'VALUE_INVALID', 'directive source must be human, ai or system.'))
  if (typeof input.priority !== 'string' || !CREATIVE_DIRECTIVE_PRIORITIES.includes(input.priority as never)) issues.push(issue(`${path}.priority`, 'VALUE_INVALID', 'directive priority is unsupported.'))
  if (typeof input.status !== 'string' || !CREATIVE_DIRECTIVE_STATUSES.includes(input.status as never)) issues.push(issue(`${path}.status`, 'VALUE_INVALID', 'directive status is unsupported.'))
  if (kindValid) {
    const kind = input.kind as CreativeDirectiveV1['kind']
    const expectedTrack = directiveTrackForKind(kind)
    if (input.track !== expectedTrack) issues.push(issue(`${path}.track`, 'VALUE_INVALID', `${kind} directives belong on ${expectedTrack}.`))
    if (kind === 'style') {
      if (!boundedString(input.styleIntent, 120)) issues.push(issue(`${path}.styleIntent`, 'VALUE_INVALID', 'styleIntent must be 1–120 characters.'))
      if (input.motionCharacter !== undefined && !CREATIVE_MOTION_CHARACTERS.includes(input.motionCharacter as never)) issues.push(issue(`${path}.motionCharacter`, 'VALUE_INVALID', 'style motionCharacter is unsupported.'))
      if (input.density !== undefined && !['low', 'medium', 'high'].includes(String(input.density))) issues.push(issue(`${path}.density`, 'VALUE_INVALID', 'density must be low, medium or high.'))
    } else if (kind === 'graphic') {
      if (!boundedString(input.communicationIntent, 160)) issues.push(issue(`${path}.communicationIntent`, 'VALUE_INVALID', 'communicationIntent must be 1–160 characters.'))
      issues.push(...validateCreativeGraphicContent(input.content, `${path}.content`))
      if (input.preferredFamily !== undefined && !boundedString(input.preferredFamily, 120)) issues.push(issue(`${path}.preferredFamily`, 'VALUE_INVALID', 'preferredFamily must be bounded.'))
      if (input.styleIntent !== undefined && !boundedString(input.styleIntent, 120)) issues.push(issue(`${path}.styleIntent`, 'VALUE_INVALID', 'styleIntent must be bounded.'))
      if (input.placementIntent !== undefined && !CREATIVE_PLACEMENT_INTENTS.includes(input.placementIntent as never)) issues.push(issue(`${path}.placementIntent`, 'VALUE_INVALID', 'placementIntent is unsupported.'))
      if (input.motionIntent !== undefined && !CREATIVE_MOTION_CHARACTERS.includes(input.motionIntent as never)) issues.push(issue(`${path}.motionIntent`, 'VALUE_INVALID', 'motionIntent is unsupported.'))
    } else if (kind === 'motion') {
      if (!CREATIVE_MOTION_CHARACTERS.includes(input.character as never)) issues.push(issue(`${path}.character`, 'VALUE_INVALID', 'motion character is unsupported.'))
      if (input.entranceCharacter !== undefined && !CREATIVE_MOTION_ENTRANCES.includes(input.entranceCharacter as never)) issues.push(issue(`${path}.entranceCharacter`, 'VALUE_INVALID', 'entrance character is unsupported.'))
      if (input.exitCharacter !== undefined && !CREATIVE_MOTION_EXITS.includes(input.exitCharacter as never)) issues.push(issue(`${path}.exitCharacter`, 'VALUE_INVALID', 'exit character is unsupported.'))
      if (input.intensity !== undefined && !finite01(input.intensity)) issues.push(issue(`${path}.intensity`, 'VALUE_INVALID', 'motion intensity must be inside [0,1].'))
    } else if (kind === 'footage') {
      if (!CREATIVE_FOOTAGE_TREATMENTS.includes(input.treatment as never)) issues.push(issue(`${path}.treatment`, 'VALUE_INVALID', 'footage treatment is unsupported.'))
      if (input.placementIntent !== undefined && !CREATIVE_PLACEMENT_INTENTS.includes(input.placementIntent as never)) issues.push(issue(`${path}.placementIntent`, 'VALUE_INVALID', 'placementIntent is unsupported.'))
      if (input.intensity !== undefined && !finite01(input.intensity)) issues.push(issue(`${path}.intensity`, 'VALUE_INVALID', 'footage intensity must be inside [0,1].'))
    } else if (kind === 'transition') {
      if (!CREATIVE_TRANSITION_INTENTS.includes(input.transitionIntent as never)) issues.push(issue(`${path}.transitionIntent`, 'VALUE_INVALID', 'transition intent is unsupported.'))
      if (input.intensity !== undefined && !finite01(input.intensity)) issues.push(issue(`${path}.intensity`, 'VALUE_INVALID', 'transition intensity must be inside [0,1].'))
    } else if (kind === 'emphasis') {
      if (!CREATIVE_EMPHASIS_INTENTS.includes(input.emphasisIntent as never)) issues.push(issue(`${path}.emphasisIntent`, 'VALUE_INVALID', 'emphasis intent is unsupported.'))
      if (input.targetText !== undefined && (typeof input.targetText !== 'string' || input.targetText.length > 400)) issues.push(issue(`${path}.targetText`, 'VALUE_INVALID', 'targetText must be at most 400 characters.'))
      if (input.intensity !== undefined && !finite01(input.intensity)) issues.push(issue(`${path}.intensity`, 'VALUE_INVALID', 'emphasis intensity must be inside [0,1].'))
    } else if (kind === 'note') {
      if (!boundedString(input.text, 2000)) issues.push(issue(`${path}.text`, 'VALUE_INVALID', 'note text must be 1–2000 characters.'))
    } else if (kind === 'constraint') {
      if (!CREATIVE_CONSTRAINT_TYPES.includes(input.constraint as never)) issues.push(issue(`${path}.constraint`, 'VALUE_INVALID', 'constraint is unsupported.'))
      if (input.constraint === 'maximum-graphics' && (!safeNonNegativeInteger(input.maximumGraphics) || Number(input.maximumGraphics) > 10)) issues.push(issue(`${path}.maximumGraphics`, 'VALUE_INVALID', 'maximum-graphics requires an integer inside [0,10].'))
      if (input.constraint === 'custom' && !boundedString(input.customText, 1000)) issues.push(issue(`${path}.customText`, 'FIELD_REQUIRED', 'custom constraint requires customText.'))
    }
  }
  return issues.length ? validationFail(issues) : validationOk(input as unknown as CreativeDirectiveV1)
}

export const validateCreativeDirectiveSet = (directives: unknown, durationTicks: number, trackTypes: ReadonlySet<string>, path = '$.directives'): readonly CreativeValidationIssueV1[] => {
  if (!Array.isArray(directives)) return Object.freeze([issue(path, 'TYPE_INVALID', 'directives must be an array.')])
  const issues: CreativeValidationIssueV1[] = [], valid: CreativeDirectiveV1[] = []
  const ids = new Set<string>()
  directives.forEach((directive, index) => {
    const result = validateCreativeDirective(directive, durationTicks, `${path}[${index}]`)
    if (!result.ok) { issues.push(...result.issues); return }
    if (ids.has(result.value.id)) issues.push(issue(`${path}[${index}].id`, 'DUPLICATE_ID', `duplicate directive id: ${result.value.id}`)); else ids.add(result.value.id)
    if (!trackTypes.has(result.value.track)) issues.push(issue(`${path}[${index}].track`, 'REFERENCE_INVALID', `directive references missing ${result.value.track} track.`))
    valid.push(result.value)
  })
  const required = valid.filter((directive) => directive.priority === 'required' && directive.status !== 'rejected')
  for (let aIndex = 0; aIndex < required.length; aIndex += 1) for (let bIndex = aIndex + 1; bIndex < required.length; bIndex += 1) {
    const a = required[aIndex]!, b = required[bIndex]!
    if (!creativeRegionsOverlap(a, b)) continue
    if (a.kind === 'style' && b.kind === 'style' && a.styleIntent !== b.styleIntent) issues.push(issue(path, 'CONFLICT', `required style directives ${a.id} and ${b.id} overlap with incompatible intents.`))
    if (a.kind === 'motion' && b.kind === 'motion' && a.character !== b.character) issues.push(issue(path, 'CONFLICT', `required motion directives ${a.id} and ${b.id} overlap with incompatible characters.`))
    if (a.kind === 'constraint' && b.kind === 'constraint' && a.constraint === 'maximum-graphics' && b.constraint === 'maximum-graphics' && a.maximumGraphics !== b.maximumGraphics) issues.push(issue(path, 'CONFLICT', `required maximum-graphics directives ${a.id} and ${b.id} disagree.`))
  }
  return Object.freeze(issues)
}

const validateCommentTarget = (target: CreativeCommentTargetV1, durationTicks: number, directiveIds: ReadonlySet<string>, versionIds: ReadonlySet<string>, path: string): readonly CreativeValidationIssueV1[] => {
  if (target.kind === 'region') return creativeRegionValid(target.startTicks, target.endTicks, durationTicks) ? Object.freeze([]) : Object.freeze([issue(path, 'TIME_INVALID', 'comment region must sit inside document duration.')])
  if (target.kind === 'directive' && !directiveIds.has(target.directiveId)) return Object.freeze([issue(path, 'REFERENCE_INVALID', `comment references missing directive ${target.directiveId}.`)])
  if (target.kind === 'version' && !versionIds.has(target.versionId)) return Object.freeze([issue(path, 'REFERENCE_INVALID', `comment references missing version ${target.versionId}.`)])
  if (target.kind === 'proposal' && !stableCreativeId(target.proposalId)) return Object.freeze([issue(path, 'REFERENCE_INVALID', 'proposal target needs a stable ID.')])
  return Object.freeze([])
}

const validateVersions = (versions: unknown, durationTicks: number): readonly CreativeValidationIssueV1[] => {
  if (!Array.isArray(versions)) return Object.freeze([issue('$.versions', 'TYPE_INVALID', 'versions must be an array.')])
  const issues: CreativeValidationIssueV1[] = [], values: CreativeDirectionVersionV1[] = []
  const ids = new Set<string>(), sequences = new Set<number>()
  versions.forEach((value, index) => {
    const path = `$.versions[${index}]`
    if (!isRecord(value)) { issues.push(issue(path, 'TYPE_INVALID', 'version must be an object.')); return }
    if (!stableCreativeId(value.id)) issues.push(issue(`${path}.id`, 'VALUE_INVALID', 'version id must be stable.')); else if (ids.has(value.id)) issues.push(issue(`${path}.id`, 'DUPLICATE_ID', `duplicate version id: ${value.id}`)); else ids.add(value.id)
    if (!boundedString(value.label, 120)) issues.push(issue(`${path}.label`, 'VALUE_INVALID', 'version label must be bounded.'))
    if (!safeNonNegativeInteger(value.sequence)) issues.push(issue(`${path}.sequence`, 'VALUE_INVALID', 'version sequence must be non-negative.')); else if (sequences.has(value.sequence)) issues.push(issue(`${path}.sequence`, 'VALUE_INVALID', `duplicate version sequence ${value.sequence}.`)); else sequences.add(value.sequence)
    if (value.parentVersionId !== null && !stableCreativeId(value.parentVersionId)) issues.push(issue(`${path}.parentVersionId`, 'VALUE_INVALID', 'parentVersionId must be null or stable.'))
    if (!['initial', 'graphics-revision', 'style-revision', 'motion-revision', 'feedback-revision', 'manual-save'].includes(String(value.reason))) issues.push(issue(`${path}.reason`, 'VALUE_INVALID', 'version reason is unsupported.'))
    if (typeof value.summary !== 'string' || value.summary.length > 1000) issues.push(issue(`${path}.summary`, 'VALUE_INVALID', 'version summary must be at most 1000 characters.'))
    issues.push(...validateCreativeTracks(value.tracksSnapshot, `${path}.tracksSnapshot`))
    const types = new Set(Array.isArray(value.tracksSnapshot) ? value.tracksSnapshot.filter(isRecord).map((track) => String(track.type)) : [])
    issues.push(...validateCreativeDirectiveSet(value.directivesSnapshot, durationTicks, types, `${path}.directivesSnapshot`))
    values.push(value as unknown as CreativeDirectionVersionV1)
  })
  for (const [index, value] of values.entries()) if (value.parentVersionId !== null && !ids.has(value.parentVersionId)) issues.push(issue(`$.versions[${index}].parentVersionId`, 'REFERENCE_INVALID', `missing parent version ${value.parentVersionId}.`))
  const byId = new Map(values.map((value) => [value.id, value] as const))
  for (const [index, value] of values.entries()) {
    const seen = new Set<string>([value.id]); let parent = value.parentVersionId
    while (parent) { if (seen.has(parent)) { issues.push(issue(`$.versions[${index}].parentVersionId`, 'CONFLICT', `version lineage cycle at ${parent}.`)); break }; seen.add(parent); parent = byId.get(parent)?.parentVersionId ?? null }
  }
  return Object.freeze(issues)
}

const validateComments = (comments: unknown, durationTicks: number, directiveIds: ReadonlySet<string>, versionIds: ReadonlySet<string>): readonly CreativeValidationIssueV1[] => {
  if (!Array.isArray(comments)) return Object.freeze([issue('$.comments', 'TYPE_INVALID', 'comments must be an array.')])
  const issues: CreativeValidationIssueV1[] = [], ids = new Set<string>(), sequences = new Set<number>()
  comments.forEach((value, index) => {
    const path = `$.comments[${index}]`
    if (!isRecord(value)) { issues.push(issue(path, 'TYPE_INVALID', 'comment must be an object.')); return }
    if (!stableCreativeId(value.id)) issues.push(issue(`${path}.id`, 'VALUE_INVALID', 'comment id must be stable.')); else if (ids.has(value.id)) issues.push(issue(`${path}.id`, 'DUPLICATE_ID', `duplicate comment id: ${value.id}`)); else ids.add(value.id)
    if (!['human', 'ai', 'system'].includes(String(value.source))) issues.push(issue(`${path}.source`, 'VALUE_INVALID', 'comment source is unsupported.'))
    if (!boundedString(value.text, 2000)) issues.push(issue(`${path}.text`, 'VALUE_INVALID', 'comment text must be bounded.'))
    if (!safeNonNegativeInteger(value.sequence)) issues.push(issue(`${path}.sequence`, 'VALUE_INVALID', 'comment sequence must be non-negative.')); else if (sequences.has(value.sequence)) issues.push(issue(`${path}.sequence`, 'VALUE_INVALID', `duplicate comment sequence ${value.sequence}.`)); else sequences.add(value.sequence)
    if (typeof value.resolved !== 'boolean') issues.push(issue(`${path}.resolved`, 'TYPE_INVALID', 'comment resolved must be boolean.'))
    if (!isRecord(value.target) || !['region', 'directive', 'proposal', 'version'].includes(String(value.target.kind))) issues.push(issue(`${path}.target`, 'VALUE_INVALID', 'comment target is unsupported.'))
    else issues.push(...validateCommentTarget(value.target as unknown as CreativeCommentTargetV1, durationTicks, directiveIds, versionIds, `${path}.target`))
  })
  return Object.freeze(issues)
}

export const validateCreativeDirectionDocument = (input: unknown): CreativeValidationResultV1<CreativeDirectionDocumentV1> => {
  if (!isRecord(input)) return validationFail([issue('$', 'TYPE_INVALID', 'Creative Direction document must be an object.')])
  const issues: CreativeValidationIssueV1[] = []
  if (input.schemaVersion !== 'sanverse.creative-direction/v1') issues.push(issue('$.schemaVersion', 'SCHEMA_UNSUPPORTED', 'Creative Direction schema must be sanverse.creative-direction/v1.'))
  if (!safeNonNegativeInteger(input.durationTicks) || Number(input.durationTicks) <= 0 || Number(input.durationTicks) > MAX_PROJECT_TICKS) issues.push(issue('$.durationTicks', 'TIME_INVALID', `durationTicks must be an exact positive project tick count <= ${MAX_PROJECT_TICKS}.`))
  const durationTicks = safeNonNegativeInteger(input.durationTicks) ? input.durationTicks : 0
  issues.push(...validateCreativeTracks(input.tracks))
  const trackTypes = new Set(Array.isArray(input.tracks) ? input.tracks.filter(isRecord).map((track) => String(track.type)) : [])
  issues.push(...validateCreativeDirectiveSet(input.directives, durationTicks, trackTypes))
  const directiveIds = new Set(Array.isArray(input.directives) ? input.directives.filter(isRecord).map((directive) => String(directive.id)) : [])
  issues.push(...validateVersions(input.versions, durationTicks))
  const versionIds = new Set(Array.isArray(input.versions) ? input.versions.filter(isRecord).map((version) => String(version.id)) : [])
  issues.push(...validateComments(input.comments, durationTicks, directiveIds, versionIds))
  return issues.length ? validationFail(issues) : validationOk(input as unknown as CreativeDirectionDocumentV1)
}

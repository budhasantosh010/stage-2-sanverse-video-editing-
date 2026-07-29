import {
  CALLOUT_COMPONENT_ID,
  CALLOUT_PRIMITIVE_ID,
  CAPTIONS_COMPONENT_ID,
  CAPTIONS_PRIMITIVE_ID,
  CAPTION_CUE_PRIMITIVE_ID,
  CAPTION_STYLE_PRIMITIVE_ID,
  NAMEPLATE_COMPONENT_ID,
  NAMEPLATE_PRIMITIVE_ID,
  TITLE_COMPONENT_ID,
  TITLE_PRIMITIVE_ID,
  VISUAL_PROPERTIES_PRIMITIVE_ID,
} from './capabilities.ts'
import { validateChangeSet, type ChangeSet } from './change-set.ts'
import { isRecord } from './result.ts'
import type { EditOperation } from './operations.ts'

export const COMPONENT_SELECTION_SCHEMA_VERSION = 'sanverse.component-selection/v1'

export const NAMEPLATE_RECIPE_ID = 'sanverse.recipe.nameplate.clean/v1'
export const CAPTIONS_RECIPE_ID = 'sanverse.recipe.captions.readable/v1'
export const CALLOUT_RECIPE_ID = 'sanverse.recipe.callout.outline/v1'
export const TITLE_RECIPE_ID = 'sanverse.recipe.title.boxed/v1'
export const BOUNCY_TITLE_RECIPE_ID = 'sanverse.recipe.title.bouncy/v1'

export type ComponentRecipe = Readonly<{
  recipeId: string
  version: number
  componentId: string
  componentVersion: number
  /** Exact operation schemas this recipe was authored and checked against. */
  compatibleOperationSchemaVersions: readonly string[]
  /** Capabilities an expanded action may name. No arbitrary primitive escape. */
  requiredCapabilities: readonly string[]
  operationKinds: readonly EditOperation['kind'][]
  /** Versioned visual semantics; changing this requires a new recipe version. */
  appearanceContract: string
}>

const recipe = (
  recipeId: string,
  componentId: string,
  requiredCapabilities: readonly string[],
  operationKinds: readonly EditOperation['kind'][],
  appearanceContract: string,
): ComponentRecipe => Object.freeze({
  recipeId,
  version: 1,
  componentId,
  componentVersion: 1,
  compatibleOperationSchemaVersions: Object.freeze(['sanverse.operation/v3']),
  requiredCapabilities: Object.freeze([...requiredCapabilities]),
  operationKinds: Object.freeze([...operationKinds]),
  appearanceContract,
})

/**
 * The initial recipe set contains only workflows the current editor can
 * actually execute. Each ID and appearance contract is immutable.
 */
export const COMPONENT_RECIPES: readonly ComponentRecipe[] = Object.freeze([
  recipe(
    NAMEPLATE_RECIPE_ID,
    NAMEPLATE_COMPONENT_ID,
    [NAMEPLATE_COMPONENT_ID, NAMEPLATE_PRIMITIVE_ID],
    ['add-nameplate'],
    'sanverse.nameplate.default/v1',
  ),
  recipe(
    CAPTIONS_RECIPE_ID,
    CAPTIONS_COMPONENT_ID,
    [CAPTIONS_COMPONENT_ID, CAPTIONS_PRIMITIVE_ID, CAPTION_CUE_PRIMITIVE_ID, CAPTION_STYLE_PRIMITIVE_ID],
    ['add-captions', 'set-caption-cue', 'remove-caption-cue', 'set-caption-style'],
    'sanverse.caption.clean/v1',
  ),
  recipe(
    CALLOUT_RECIPE_ID,
    CALLOUT_COMPONENT_ID,
    [CALLOUT_COMPONENT_ID, CALLOUT_PRIMITIVE_ID],
    ['add-callout', 'set-callout'],
    'sanverse.callout.outline/v1',
  ),
  recipe(
    TITLE_RECIPE_ID,
    TITLE_COMPONENT_ID,
    [TITLE_COMPONENT_ID, TITLE_PRIMITIVE_ID],
    ['add-title', 'set-title'],
    'sanverse.title.boxed/v1',
  ),
  recipe(
    BOUNCY_TITLE_RECIPE_ID,
    TITLE_COMPONENT_ID,
    [TITLE_COMPONENT_ID, TITLE_PRIMITIVE_ID, VISUAL_PROPERTIES_PRIMITIVE_ID],
    ['add-title', 'set-title', 'set-visual-properties'],
    'sanverse.title.bouncy/v1',
  ),
])

export const findComponentRecipe = (
  recipeId: string,
  version: number,
): ComponentRecipe | undefined =>
  COMPONENT_RECIPES.find((candidate) => candidate.recipeId === recipeId && candidate.version === version)

export const recipeSupportsOperation = (
  recipeId: string,
  version: number,
  operationKind: string,
): boolean =>
  findComponentRecipe(recipeId, version)?.operationKinds.includes(operationKind as EditOperation['kind']) ?? false

export type ComponentSelection = Readonly<{
  schemaVersion: typeof COMPONENT_SELECTION_SCHEMA_VERSION
  recipeId: string
  recipeVersion: number
}>

export type ComponentSelectionMigrationError = Readonly<{
  code: 'COMPONENT_SELECTION_INVALID'
  reason: 'TYPE_INVALID' | 'VERSION_REQUIRED' | 'RECIPE_UNKNOWN' | 'FIELD_UNKNOWN'
}>

/**
 * Migration pins old metadata to the exact version it already named. It never
 * substitutes today's default recipe for an unversioned old selection.
 */
export const migrateComponentSelection = (
  input: unknown,
):
  | Readonly<{ ok: true; value: ComponentSelection }>
  | Readonly<{ ok: false; error: ComponentSelectionMigrationError }> => {
  if (!isRecord(input)) {
    return { ok: false, error: { code: 'COMPONENT_SELECTION_INVALID', reason: 'TYPE_INVALID' } }
  }
  const allowed = new Set(['schemaVersion', 'recipeId', 'recipeVersion'])
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    return { ok: false, error: { code: 'COMPONENT_SELECTION_INVALID', reason: 'FIELD_UNKNOWN' } }
  }
  if (
    input.schemaVersion !== 'sanverse.component-selection/v0' &&
    input.schemaVersion !== COMPONENT_SELECTION_SCHEMA_VERSION
  ) {
    return { ok: false, error: { code: 'COMPONENT_SELECTION_INVALID', reason: 'TYPE_INVALID' } }
  }
  if (!Number.isSafeInteger(input.recipeVersion) || (input.recipeVersion as number) <= 0) {
    return { ok: false, error: { code: 'COMPONENT_SELECTION_INVALID', reason: 'VERSION_REQUIRED' } }
  }
  if (
    typeof input.recipeId !== 'string' ||
    !findComponentRecipe(input.recipeId, input.recipeVersion as number)
  ) {
    return { ok: false, error: { code: 'COMPONENT_SELECTION_INVALID', reason: 'RECIPE_UNKNOWN' } }
  }
  return {
    ok: true,
    value: Object.freeze({
      schemaVersion: COMPONENT_SELECTION_SCHEMA_VERSION,
      recipeId: input.recipeId,
      recipeVersion: input.recipeVersion as number,
    }),
  }
}

export const INTRO_WORKFLOW_ID = 'sanverse.workflow.intro/v1'
export const READABLE_VIDEO_WORKFLOW_ID = 'sanverse.workflow.readable-video/v1'
export const HIGHLIGHT_MOMENT_WORKFLOW_ID = 'sanverse.workflow.highlight-moment/v1'
export const POLISH_TALKING_HEAD_WORKFLOW_ID = 'sanverse.workflow.polish-talking-head/v1'

export type OutcomeWorkflow = Readonly<{
  workflowId: string
  version: number
  accepts: string
  allowedRecipeIds: readonly string[]
  minimumActions: number
  maximumActions: number
}>

export const OUTCOME_WORKFLOW_REGISTRY: readonly OutcomeWorkflow[] = Object.freeze([
  Object.freeze({
    workflowId: INTRO_WORKFLOW_ID,
    version: 1,
    accepts: 'Introduce a person or topic without requiring manual primitive selection.',
    allowedRecipeIds: Object.freeze([NAMEPLATE_RECIPE_ID, TITLE_RECIPE_ID, BOUNCY_TITLE_RECIPE_ID]),
    minimumActions: 1,
    maximumActions: 8,
  }),
  Object.freeze({
    workflowId: READABLE_VIDEO_WORKFLOW_ID,
    version: 1,
    accepts: 'Make spoken content easier to follow with readable captions.',
    allowedRecipeIds: Object.freeze([CAPTIONS_RECIPE_ID]),
    minimumActions: 1,
    maximumActions: 16,
  }),
  Object.freeze({
    workflowId: HIGHLIGHT_MOMENT_WORKFLOW_ID,
    version: 1,
    accepts: 'Emphasize one moment with a title, callout, or bounded motion.',
    allowedRecipeIds: Object.freeze([TITLE_RECIPE_ID, BOUNCY_TITLE_RECIPE_ID, CALLOUT_RECIPE_ID]),
    minimumActions: 1,
    maximumActions: 12,
  }),
  Object.freeze({
    workflowId: POLISH_TALKING_HEAD_WORKFLOW_ID,
    version: 1,
    accepts: 'Combine existing title, nameplate, caption, and callout recipes in one reviewed proposal.',
    allowedRecipeIds: Object.freeze([
      NAMEPLATE_RECIPE_ID,
      CAPTIONS_RECIPE_ID,
      CALLOUT_RECIPE_ID,
      TITLE_RECIPE_ID,
      BOUNCY_TITLE_RECIPE_ID,
    ]),
    minimumActions: 1,
    maximumActions: 32,
  }),
])

export const findOutcomeWorkflow = (
  workflowId: string,
  version: number,
): OutcomeWorkflow | undefined =>
  OUTCOME_WORKFLOW_REGISTRY.find(
    (workflow) => workflow.workflowId === workflowId && workflow.version === version,
  )

export type WorkflowAction = Readonly<{
  actionId: string
  /** Action IDs that must validate and appear before this action. */
  dependsOn: readonly string[]
  recipeId: string
  recipeVersion: number
  operation: EditOperation
}>

export type AtomicWorkflowPlanInput = Readonly<{
  workflowId: string
  workflowVersion: number
  changeSetId: string
  baseRevision: number
  requestId: string
  actions: readonly WorkflowAction[]
}>

export type AtomicWorkflowPlanError = Readonly<{
  code: 'WORKFLOW_PLAN_INVALID'
  issues: readonly Readonly<{
    path: string
    reason:
      | 'WORKFLOW_UNKNOWN'
      | 'ACTION_COUNT_INVALID'
      | 'RECIPE_NOT_ALLOWED'
      | 'RECIPE_UNKNOWN'
      | 'OPERATION_NOT_SUPPORTED'
      | 'CAPABILITY_NOT_ALLOWED'
      | 'ACTION_ID_INVALID'
      | 'DEPENDENCY_UNKNOWN'
      | 'DEPENDENCY_CYCLE'
      | 'CHANGE_SET_INVALID'
  }>[]
}>

const ACTION_ID_PATTERN = /^action_[a-z0-9]{4,64}$/

const orderWorkflowActions = (
  actions: readonly WorkflowAction[],
  issues: AtomicWorkflowPlanError['issues'][number][],
): readonly WorkflowAction[] => {
  const byId = new Map<string, WorkflowAction>()
  actions.forEach((action, index) => {
    if (!ACTION_ID_PATTERN.test(action.actionId) || byId.has(action.actionId)) {
      issues.push({ path: `actions[${index}].actionId`, reason: 'ACTION_ID_INVALID' })
      return
    }
    byId.set(action.actionId, action)
  })
  actions.forEach((action, actionIndex) => {
    action.dependsOn.forEach((dependency, dependencyIndex) => {
      if (!byId.has(dependency)) {
        issues.push({
          path: `actions[${actionIndex}].dependsOn[${dependencyIndex}]`,
          reason: 'DEPENDENCY_UNKNOWN',
        })
      }
    })
  })
  if (issues.length > 0) return Object.freeze([])

  const ordered: WorkflowAction[] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (action: WorkflowAction): boolean => {
    if (visited.has(action.actionId)) return true
    if (visiting.has(action.actionId)) return false
    visiting.add(action.actionId)
    for (const dependencyId of action.dependsOn) {
      const dependency = byId.get(dependencyId)
      if (!dependency || !visit(dependency)) return false
    }
    visiting.delete(action.actionId)
    visited.add(action.actionId)
    ordered.push(action)
    return true
  }
  for (const action of actions) {
    if (!visit(action)) {
      issues.push({ path: 'actions', reason: 'DEPENDENCY_CYCLE' })
      return Object.freeze([])
    }
  }
  return Object.freeze(ordered)
}

/**
 * Expand already-structured component actions into one pending change set.
 *
 * Every action is checked before the ordinary change-set validator runs.
 * Nothing is returned when one action fails, so callers cannot accidentally
 * apply the valid prefix of a compound request.
 */
export const planAtomicWorkflow = (
  input: AtomicWorkflowPlanInput,
):
  | Readonly<{ ok: true; value: ChangeSet }>
  | Readonly<{ ok: false; error: AtomicWorkflowPlanError }> => {
  type Issue = AtomicWorkflowPlanError['issues'][number]
  const issues: Issue[] = []
  const workflow = findOutcomeWorkflow(input.workflowId, input.workflowVersion)
  if (!workflow) {
    return {
      ok: false,
      error: { code: 'WORKFLOW_PLAN_INVALID', issues: [{ path: 'workflowId', reason: 'WORKFLOW_UNKNOWN' }] },
    }
  }
  if (input.actions.length < workflow.minimumActions || input.actions.length > workflow.maximumActions) {
    issues.push({ path: 'actions', reason: 'ACTION_COUNT_INVALID' })
  }
  const orderedActions = orderWorkflowActions(input.actions, issues)
  input.actions.forEach((action, index) => {
    if (!workflow.allowedRecipeIds.includes(action.recipeId)) {
      issues.push({ path: `actions[${index}].recipeId`, reason: 'RECIPE_NOT_ALLOWED' })
      return
    }
    const found = findComponentRecipe(action.recipeId, action.recipeVersion)
    if (!found) {
      issues.push({ path: `actions[${index}].recipeId`, reason: 'RECIPE_UNKNOWN' })
      return
    }
    if (!found.operationKinds.includes(action.operation.kind)) {
      issues.push({ path: `actions[${index}].operation.kind`, reason: 'OPERATION_NOT_SUPPORTED' })
    }
    if (!found.requiredCapabilities.includes(action.operation.capabilityId)) {
      issues.push({ path: `actions[${index}].operation.capabilityId`, reason: 'CAPABILITY_NOT_ALLOWED' })
    }
    if (!found.compatibleOperationSchemaVersions.includes(action.operation.schemaVersion)) {
      issues.push({ path: `actions[${index}].operation`, reason: 'OPERATION_NOT_SUPPORTED' })
    }
  })
  if (issues.length > 0) return { ok: false, error: { code: 'WORKFLOW_PLAN_INVALID', issues } }

  const changeSet = validateChangeSet({
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: input.changeSetId,
    baseRevision: input.baseRevision,
    operations: orderedActions.map((action) => action.operation),
    provenance: { source: 'ai', requestId: input.requestId },
    extensions: {},
  })
  if (!changeSet.ok) {
    return {
      ok: false,
      error: {
        code: 'WORKFLOW_PLAN_INVALID',
        issues: [{ path: 'actions', reason: 'CHANGE_SET_INVALID' }],
      },
    }
  }
  return { ok: true, value: changeSet.value }
}

export type WorkflowRepairResult = Readonly<{
  input: AtomicWorkflowPlanInput
  changeSet: ChangeSet
}>

/**
 * Replace one interpreted action and revalidate the whole dependency graph.
 * Unchanged actions retain their original object identity, making it impossible
 * for repair code to silently reinterpret the parts the user already accepted.
 */
export const repairWorkflowAction = (
  input: AtomicWorkflowPlanInput,
  actionId: string,
  replacement: WorkflowAction,
):
  | Readonly<{ ok: true; value: WorkflowRepairResult }>
  | Readonly<{ ok: false; error: AtomicWorkflowPlanError }> => {
  const index = input.actions.findIndex((action) => action.actionId === actionId)
  if (index === -1 || replacement.actionId !== actionId) {
    return {
      ok: false,
      error: {
        code: 'WORKFLOW_PLAN_INVALID',
        issues: [{ path: 'actionId', reason: 'ACTION_ID_INVALID' }],
      },
    }
  }
  const actions = input.actions.map((action, position) => position === index ? replacement : action)
  const nextInput = Object.freeze({ ...input, actions: Object.freeze(actions) })
  const planned = planAtomicWorkflow(nextInput)
  if (!planned.ok) return planned
  return {
    ok: true,
    value: Object.freeze({ input: nextInput, changeSet: planned.value }),
  }
}

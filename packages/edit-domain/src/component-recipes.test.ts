import { describe, expect, it } from 'vitest'

import { testCallout, testTitle } from './test-fixtures.ts'
import { testProject } from './test-fixtures.ts'
import { acceptChangeSet, undoChangeSet } from './project.ts'
import {
  BOUNCY_TITLE_RECIPE_ID,
  CALLOUT_RECIPE_ID,
  COMPONENT_RECIPES,
  HIGHLIGHT_MOMENT_WORKFLOW_ID,
  TITLE_RECIPE_ID,
  findComponentRecipe,
  migrateComponentSelection,
  planAtomicWorkflow,
  recipeSupportsOperation,
  repairWorkflowAction,
} from './component-recipes.ts'

describe('versioned components and recipes', () => {
  it('pins every recipe to explicit compatible versions', () => {
    expect(COMPONENT_RECIPES).toHaveLength(5)
    for (const recipe of COMPONENT_RECIPES) {
      expect(recipe.recipeId).toMatch(/\/v1$/)
      expect(recipe.version).toBe(1)
      expect(recipe.compatibleOperationSchemaVersions).toEqual(['sanverse.operation/v3'])
      expect(findComponentRecipe(recipe.recipeId, recipe.version)).toBe(recipe)
    }
    expect(recipeSupportsOperation(BOUNCY_TITLE_RECIPE_ID, 1, 'set-visual-properties')).toBe(true)
    expect(recipeSupportsOperation(TITLE_RECIPE_ID, 1, 'remove-clip')).toBe(false)
  })

  it('migrates metadata idempotently without changing the pinned appearance', () => {
    const legacy = {
      schemaVersion: 'sanverse.component-selection/v0',
      recipeId: TITLE_RECIPE_ID,
      recipeVersion: 1,
    }
    const once = migrateComponentSelection(legacy)
    expect(once.ok).toBe(true)
    if (!once.ok) return
    const twice = migrateComponentSelection(once.value)
    expect(twice).toEqual(once)
    expect(once.value.recipeId).toBe(TITLE_RECIPE_ID)
    expect(once.value.recipeVersion).toBe(1)
  })

  it('fails closed when legacy metadata did not pin a recipe version', () => {
    expect(migrateComponentSelection({
      schemaVersion: 'sanverse.component-selection/v0',
      recipeId: TITLE_RECIPE_ID,
    }).ok).toBe(false)
  })
})

describe('outcome workflow planning', () => {
  it('turns multiple component actions into one atomic change set', () => {
    const result = planAtomicWorkflow({
      workflowId: HIGHLIGHT_MOMENT_WORKFLOW_ID,
      workflowVersion: 1,
      changeSetId: 'changeset_compound01',
      baseRevision: 4,
      requestId: 'request-compound-01',
      actions: [
        {
          actionId: 'action_title01',
          dependsOn: [],
          recipeId: TITLE_RECIPE_ID,
          recipeVersion: 1,
          operation: testTitle(),
        },
        {
          actionId: 'action_callout01',
          dependsOn: ['action_title01'],
          recipeId: CALLOUT_RECIPE_ID,
          recipeVersion: 1,
          operation: testCallout({ operationId: 'operation_call0002' }),
        },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.operations).toHaveLength(2)
    expect(result.value.provenance).toEqual({ source: 'ai', requestId: 'request-compound-01' })
  })

  it('rejects the whole plan when any action is incompatible', () => {
    const result = planAtomicWorkflow({
      workflowId: HIGHLIGHT_MOMENT_WORKFLOW_ID,
      workflowVersion: 1,
      changeSetId: 'changeset_compound02',
      baseRevision: 4,
      requestId: 'request-compound-02',
      actions: [
        {
          actionId: 'action_title02',
          dependsOn: [],
          recipeId: TITLE_RECIPE_ID,
          recipeVersion: 1,
          operation: testTitle(),
        },
        {
          actionId: 'action_callout02',
          dependsOn: ['action_title02'],
          recipeId: TITLE_RECIPE_ID,
          recipeVersion: 1,
          operation: testCallout(),
        },
      ],
    })
    expect(result.ok).toBe(false)
  })

  it('reports dependency errors instead of guessing an order', () => {
    const result = planAtomicWorkflow({
      workflowId: HIGHLIGHT_MOMENT_WORKFLOW_ID,
      workflowVersion: 1,
      changeSetId: 'changeset_compound03',
      baseRevision: 0,
      requestId: 'request-compound-03',
      actions: [{
        actionId: 'action_title03',
        dependsOn: ['action_missing0'],
        recipeId: TITLE_RECIPE_ID,
        recipeVersion: 1,
        operation: testTitle(),
      }],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues).toContainEqual({
      path: 'actions[0].dependsOn[0]',
      reason: 'DEPENDENCY_UNKNOWN',
    })
  })

  it('repairs one compound action while preserving the other accepted interpretation', () => {
    const input = {
      workflowId: HIGHLIGHT_MOMENT_WORKFLOW_ID,
      workflowVersion: 1,
      changeSetId: 'changeset_compound04',
      baseRevision: 0,
      requestId: 'request-compound-04',
      actions: [
        {
          actionId: 'action_title04',
          dependsOn: [],
          recipeId: TITLE_RECIPE_ID,
          recipeVersion: 1,
          operation: testTitle(),
        },
        {
          actionId: 'action_callout04',
          dependsOn: ['action_title04'],
          recipeId: CALLOUT_RECIPE_ID,
          recipeVersion: 1,
          operation: testCallout(),
        },
      ],
    } as const
    const repaired = repairWorkflowAction(input, 'action_callout04', {
      ...input.actions[1],
      operation: testCallout({ label: 'repaired only' }),
    })
    expect(repaired.ok).toBe(true)
    if (!repaired.ok) return
    expect(repaired.value.input.actions[0]).toBe(input.actions[0])
    expect(repaired.value.changeSet.operations[1]).toMatchObject({ label: 'repaired only' })
  })

  it('accepts a compound request once and removes every action with one undo', () => {
    const project = testProject()
    const planned = planAtomicWorkflow({
      workflowId: HIGHLIGHT_MOMENT_WORKFLOW_ID,
      workflowVersion: 1,
      changeSetId: 'changeset_compound05',
      baseRevision: project.revision,
      requestId: 'request-compound-05',
      actions: [
        {
          actionId: 'action_title05',
          dependsOn: [],
          recipeId: TITLE_RECIPE_ID,
          recipeVersion: 1,
          operation: testTitle(),
        },
        {
          actionId: 'action_callout05',
          dependsOn: ['action_title05'],
          recipeId: CALLOUT_RECIPE_ID,
          recipeVersion: 1,
          operation: testCallout(),
        },
      ],
    })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    const accepted = acceptChangeSet(project, planned.value)
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.value.changeSets).toHaveLength(1)
    expect(accepted.value.changeSets[0].changeSet.operations).toHaveLength(2)
    const undone = undoChangeSet(accepted.value)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(undone.value.changeSets).toHaveLength(0)
  })
})

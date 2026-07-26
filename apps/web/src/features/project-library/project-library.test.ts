import { describe, expect, it, vi } from 'vitest'

import {
  acceptChangeSet,
  listRecentProjects,
  loadProject,
  redoProject,
  undoProject,
} from './project-library'
import {
  TEST_PROJECT_ID,
  testChangeSet,
  testOpenedProject,
  testProject,
  testProjectWithNameplate,
} from '../../test-fixtures'

const manifest = (() => {
  const { project: _project, ...rest } = testOpenedProject()
  return rest
})()

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status })

describe('project library client', () => {
  it('lists and loads only controlled local project contracts', async () => {
    const project = testProject()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ projects: [manifest] }))
      .mockResolvedValueOnce(jsonResponse({ ...manifest, project }))

    await expect(listRecentProjects(fetcher)).resolves.toEqual([manifest])
    const opened = await loadProject(TEST_PROJECT_ID, fetcher)
    expect(opened.project.revision).toBe(0)
    expect(opened.project.composition.width).toBe(1920)
  })

  it('refuses a project the domain validator rejects, even from its own API', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ ...manifest, project: { schemaVersion: 'nonsense' } }))
    await expect(loadProject(TEST_PROJECT_ID, fetcher)).rejects.toThrow(/could not load/i)
  })

  it('refuses a project whose ID does not match the one requested', async () => {
    const foreign = { ...testProject(), projectId: 'project_ffffffffffffffff' }
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ ...manifest, project: foreign }))
    await expect(loadProject(TEST_PROJECT_ID, fetcher)).rejects.toThrow(/could not load/i)
  })
})

describe('asking the server to apply an edit', () => {
  it('sends one change set and adopts the project the server reports', async () => {
    const served = testProjectWithNameplate()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ project: served }, 201))

    const result = await acceptChangeSet(TEST_PROJECT_ID, testChangeSet(0), fetcher)

    expect(result.revision).toBe(served.revision)
    expect(fetcher).toHaveBeenCalledWith(
      `/api/projects/${TEST_PROJECT_ID}/change-sets`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('reports a stale edit as a conflict the user can act on', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ code: 'REVISION_CONFLICT' }, 409))

    await expect(acceptChangeSet(TEST_PROJECT_ID, testChangeSet(0), fetcher))
      .rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
  })

  it('reports a rejected edit without claiming anything was saved', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ code: 'CHANGE_SET_REJECTED' }, 400))

    await expect(acceptChangeSet(TEST_PROJECT_ID, testChangeSet(0), fetcher))
      .rejects.toMatchObject({ code: 'EDIT_REJECTED' })
  })

  it('undoes and redoes through the server', async () => {
    const served = testProject()
    // A fresh Response per call: a body can only be read once.
    const fetcher = vi.fn(async () => jsonResponse({ project: served }))

    await expect(undoProject(TEST_PROJECT_ID, fetcher)).resolves.toMatchObject({ revision: 0 })
    await expect(redoProject(TEST_PROJECT_ID, fetcher)).resolves.toMatchObject({ revision: 0 })
    expect(fetcher).toHaveBeenCalledWith(`/api/projects/${TEST_PROJECT_ID}/undo`, expect.objectContaining({ method: 'POST' }))
    expect(fetcher).toHaveBeenCalledWith(`/api/projects/${TEST_PROJECT_ID}/redo`, expect.objectContaining({ method: 'POST' }))
  })

  it('refuses a forged project in an otherwise successful response', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ project: { schemaVersion: 'nonsense' } }, 201))

    await expect(acceptChangeSet(TEST_PROJECT_ID, testChangeSet(0), fetcher))
      .rejects.toMatchObject({ code: 'EDIT_REJECTED' })
  })
})

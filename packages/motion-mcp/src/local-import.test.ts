import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  LocalImportErrorV1,
  listPermittedWorkspaceInputsV1,
  parseImportRootsV1,
  readPermittedWorkspaceTextFileV1,
  resolveLocalWorkspaceRootV1,
  resolvePermittedImportFileV1,
} from './local-import.ts'

const roots: string[] = []
afterEach(async () => { while (roots.length) await rm(roots.pop()!, { recursive: true, force: true }) })
const temp = async (name: string) => { const root = resolve(tmpdir(), `sanverse-mcp-${name}-${process.pid}-${Date.now()}`); roots.push(root); await mkdir(root, { recursive: true }); return root }

const codeOf = async (promise: Promise<unknown>) => {
  try { await promise; return null } catch (error) { return error instanceof LocalImportErrorV1 ? error.code : 'OTHER' }
}

describe('MCP local import confinement', () => {
  it('parses configured roots using the platform path delimiter', () => {
    const split = process.platform === 'win32' ? ';' : ':'
    expect(parseImportRootsV1({ SANVERSE_MCP_IMPORT_ROOTS: `C${split}D` } as NodeJS.ProcessEnv)).toHaveLength(2)
  })

  it('accepts only a regular file beneath a literal configured root and returns no root-prefixed public path', async () => {
    const root = await temp('inside')
    const file = resolve(root, 'raw.mp4')
    await writeFile(file, Buffer.from('bounded fixture'))
    const resolved = await resolvePermittedImportFileV1({ localPath: file, roots: [root] })
    expect(resolved.absolutePath).toBe(file)
    expect(resolved.safeRelativePath).toBe('raw.mp4')
    expect(resolved.basename).toBe('raw.mp4')
  })

  it('resolves relative inputs against a validated caller workspace, including paths with spaces', async () => {
    const root = await temp('workspace with spaces')
    const nested = resolve(root, 'assets')
    await mkdir(nested)
    await writeFile(resolve(root, 'raw video.mp4'), Buffer.from('bounded fixture'))
    await writeFile(resolve(root, 'transcript.srt'), '1\n00:00:00,000 --> 00:00:01,000\nHello.\n')
    await writeFile(resolve(root, 'brand.md'), '# Brand\nUse purple and restrained motion.\n')
    await writeFile(resolve(root, 'creative-guidelines.txt'), 'Use editorial typography.\n')
    await writeFile(resolve(root, 'notes.txt'), 'This remains ordinary transcript/plain text.\n')
    await writeFile(resolve(nested, 'logo.png'), Buffer.from('image'))

    expect(await resolveLocalWorkspaceRootV1(root)).toBe(root)
    const video = await resolvePermittedImportFileV1({ localPath: 'raw video.mp4', roots: [root], relativeTo: root })
    expect(video.safeRelativePath).toBe('raw video.mp4')
    const transcript = await readPermittedWorkspaceTextFileV1({ localPath: 'transcript.srt', workspaceRoot: root })
    expect(transcript).toMatchObject({ relativePath: 'transcript.srt', format: 'srt' })
    expect(await readPermittedWorkspaceTextFileV1({ localPath: 'brand.md', workspaceRoot: root })).toMatchObject({ relativePath: 'brand.md', format: 'brief' })
    expect(await readPermittedWorkspaceTextFileV1({ localPath: 'creative-guidelines.txt', workspaceRoot: root })).toMatchObject({ relativePath: 'creative-guidelines.txt', format: 'brief' })
    expect(await readPermittedWorkspaceTextFileV1({ localPath: 'notes.txt', workspaceRoot: root })).toMatchObject({ relativePath: 'notes.txt', format: 'plain' })

    const listed = await listPermittedWorkspaceInputsV1({ workspaceRoot: root })
    expect(listed).toEqual(expect.arrayContaining([
      expect.objectContaining({ relativePath: 'raw video.mp4', kind: 'video' }),
      expect.objectContaining({ relativePath: 'transcript.srt', kind: 'transcript' }),
      expect.objectContaining({ relativePath: 'brand.md', kind: 'brief' }),
      expect.objectContaining({ relativePath: 'creative-guidelines.txt', kind: 'brief' }),
      expect.objectContaining({ relativePath: 'notes.txt', kind: 'transcript' }),
      expect.objectContaining({ relativePath: `assets${process.platform === 'win32' ? '\\' : '/'}logo.png`, kind: 'image' }),
    ]))
    expect(JSON.stringify(listed)).not.toContain(root)
  })

  it('rejects outside-root traversal and missing root configuration', async () => {
    const root = await temp('root')
    const outside = await temp('outside')
    const file = resolve(outside, 'raw.mp4')
    await writeFile(file, Buffer.from('fixture'))
    expect(await codeOf(resolvePermittedImportFileV1({ localPath: file, roots: [root] }))).toBe('IMPORT_ROOT_NOT_ALLOWED')
    expect(await codeOf(resolvePermittedImportFileV1({ localPath: file, roots: [] }))).toBe('IMPORT_ROOT_NOT_ALLOWED')
  })

  it('refuses absolute sibling/parent paths even when a caller workspace is present', async () => {
    const root = await temp('workspace-boundary')
    const outside = await temp('workspace-sibling')
    const outsideFile = resolve(outside, 'outside.mp4')
    await writeFile(outsideFile, Buffer.from('fixture'))
    expect(await codeOf(resolvePermittedImportFileV1({ localPath: outsideFile, roots: [root], relativeTo: root }))).toBe('IMPORT_ROOT_NOT_ALLOWED')
    expect(await codeOf(resolvePermittedImportFileV1({ localPath: resolve(root, '..'), roots: [root], relativeTo: root }))).toBe('IMPORT_PATH_INVALID')
  })

  it('rejects directories and non-existent files', async () => {
    const root = await temp('regular')
    expect(await codeOf(resolvePermittedImportFileV1({ localPath: root, roots: [root] }))).toBe('IMPORT_PATH_INVALID')
    expect(await codeOf(resolvePermittedImportFileV1({ localPath: resolve(root, 'missing.mp4'), roots: [root] }))).toBe('IMPORT_FILE_NOT_FOUND')
  })

  it('rejects symlink/junction import paths when the platform permits creating them', async () => {
    const root = await temp('symlink')
    const target = resolve(root, 'target.mp4')
    const link = resolve(root, 'link.mp4')
    await writeFile(target, Buffer.from('fixture'))
    try {
      await symlink(target, link, 'file')
    } catch {
      return
    }
    expect(await codeOf(resolvePermittedImportFileV1({ localPath: link, roots: [root] }))).toBe('IMPORT_SYMLINK_ESCAPE')
  })

  it('rejects a symlink/junction workspace root when the platform permits creating it', async () => {
    const target = await temp('workspace-target')
    const parent = await temp('workspace-link-parent')
    const link = resolve(parent, 'workspace-link')
    try {
      await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir')
    } catch {
      return
    }
    expect(await codeOf(resolveLocalWorkspaceRootV1(link))).toBe('WORKSPACE_ROOT_INVALID')
  })
})

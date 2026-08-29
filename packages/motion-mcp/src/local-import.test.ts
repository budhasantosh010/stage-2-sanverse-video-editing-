import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { LocalImportErrorV1, parseImportRootsV1, resolvePermittedImportFileV1 } from './local-import.ts'

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

  it('rejects outside-root traversal and missing root configuration', async () => {
    const root = await temp('root')
    const outside = await temp('outside')
    const file = resolve(outside, 'raw.mp4')
    await writeFile(file, Buffer.from('fixture'))
    expect(await codeOf(resolvePermittedImportFileV1({ localPath: file, roots: [root] }))).toBe('IMPORT_ROOT_NOT_ALLOWED')
    expect(await codeOf(resolvePermittedImportFileV1({ localPath: file, roots: [] }))).toBe('IMPORT_ROOT_NOT_ALLOWED')
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
})

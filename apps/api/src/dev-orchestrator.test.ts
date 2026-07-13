import { EventEmitter } from 'node:events'
import { readFile, readdir } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

// The root runner is plain ESM so Node can execute it without a build step.
// @ts-expect-error no declaration file is needed for the local orchestration script
import { DEV_PROCESSES, resolveNpmInvocation, startDevelopment, terminateProcessTree } from '../../../scripts/dev.mjs'

class FakeChild extends EventEmitter {
  kill = vi.fn(() => true)
}

describe('root development lifecycle', () => {
  it('loads the API entry graph under the configured Node strip-only runtime', async () => {
    const sourceRoot = new URL('./', import.meta.url)
    const sourceFiles = (await readdir(sourceRoot, { recursive: true }))
      .filter((name) => name.endsWith('.ts'))

    for (const sourceFile of sourceFiles) {
      const sourceUrl = new URL(sourceFile.replaceAll('\\', '/'), sourceRoot)
      const source = await readFile(sourceUrl, 'utf8')
      expect(() => stripTypeScriptTypes(source, { mode: 'strip', sourceUrl: sourceUrl.href })).not.toThrow()
    }
  })

  it('starts exactly the internal API and user-facing web workspaces and stops the sibling on failure', () => {
    const children = [new FakeChild(), new FakeChild()]
    let childIndex = 0
    const spawn = vi.fn(() => children[childIndex++] as never)
    const exit = vi.fn()
    const terminate = vi.fn((child: FakeChild) => child.kill())

    const controller = startDevelopment({ spawn, exit, terminate, installSignalHandlers: false })
    expect(DEV_PROCESSES.map((process: { workspace: string }) => process.workspace)).toEqual(['apps/api', 'apps/web'])
    expect(spawn).toHaveBeenCalledTimes(2)

    children[0].emit('exit', 1)
    expect(children[1].kill).toHaveBeenCalled()
    expect(exit).toHaveBeenCalledWith(1)
    controller.stop()
  })

  it('launches npm through Node on Windows instead of spawning npm.cmd directly', () => {
    expect(resolveNpmInvocation({
      platform: 'win32',
      nodeExecPath: 'C:\\Program Files\\nodejs\\node.exe',
      npmExecPath: 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
    })).toEqual({
      command: 'C:\\Program Files\\nodejs\\node.exe',
      argsPrefix: ['C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js'],
    })
  })

  it('keeps private project media explicitly outside Git', async () => {
    const ignore = await readFile(new URL('../../../.gitignore', import.meta.url), 'utf8')
    expect(ignore.split(/\r?\n/)).toContain('.sanverse-data/')
  })

  it('terminates only the known Windows child process tree by PID', () => {
    const spawn = vi.fn(() => new FakeChild() as never)
    const child = Object.assign(new FakeChild(), { pid: 4242 })

    terminateProcessTree(child, { platform: 'win32', spawn })

    expect(spawn).toHaveBeenCalledWith('taskkill.exe', ['/pid', '4242', '/t', '/f'], expect.objectContaining({ shell: false, windowsHide: true }))
    expect(child.kill).not.toHaveBeenCalled()
  })

  it('uses the direct child handle outside Windows and rejects an unknown Windows PID', () => {
    const child = Object.assign(new FakeChild(), { pid: 4242 })
    terminateProcessTree(child, { platform: 'linux', spawn: vi.fn() })
    expect(child.kill).toHaveBeenCalledOnce()

    expect(() => terminateProcessTree(Object.assign(new FakeChild(), { pid: undefined }), { platform: 'win32', spawn: vi.fn() })).toThrow(/known spawned pid/i)
  })
})

import { spawn } from 'node:child_process'

import { RenderError, type RenderErrorCode } from '../render/render-port.ts'

const MAX_TOOL_OUTPUT_BYTES = 1024 * 1024

export type CommandInvocation = {
  readonly executable: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly signal?: AbortSignal
}

export type CommandResult = {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export type CommandRunner = (invocation: CommandInvocation) => Promise<CommandResult>

const commandError = (code: RenderErrorCode, message: string): RenderError => new RenderError(code, message)

/**
 * Run an external tool with no shell, bounded output, and cancellation.
 *
 * Shared by the renderer and the media probe so there is one place where
 * process safety is decided rather than two that can drift apart.
 */
export function createCommandRunner({
  spawnProcess = spawn,
}: {
  spawnProcess?: typeof spawn
} = {}): CommandRunner {
  return async (invocation: CommandInvocation): Promise<CommandResult> => {
    if (invocation.signal?.aborted) throw commandError('RENDER_CANCELLED', 'Export was cancelled.')
    return new Promise((resolvePromise, reject) => {
      let stdout = Buffer.alloc(0)
      let stderr = Buffer.alloc(0)
      let settled = false
      let terminalError: unknown
      const classifyLaunchError = (error: unknown): unknown => {
        const code = (error as NodeJS.ErrnoException)?.code
        if (code === 'ENOENT') return commandError('RENDER_TOOL_UNAVAILABLE', `${invocation.executable} is not available.`)
        if (code === 'EPERM' || code === 'EACCES') {
          return commandError('RENDER_PROCESS_BLOCKED', `${invocation.executable} was blocked from starting.`)
        }
        return commandError('RENDER_FAILED', 'The renderer process could not start.')
      }
      let child: ReturnType<typeof spawn>
      try {
        child = spawnProcess(invocation.executable, [...invocation.args], {
          cwd: invocation.cwd,
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch (error) {
        reject(classifyLaunchError(error))
        return
      }
      const childStdout = child.stdout!
      const childStderr = child.stderr!
      const requestTermination = (error: unknown) => {
        if (terminalError === undefined) terminalError = error
        try { child.kill() } catch { /* close/error remains the settlement boundary */ }
      }
      const append = (current: Buffer, chunk: Buffer): Buffer => {
        const next = Buffer.concat([current, chunk])
        if (next.byteLength > MAX_TOOL_OUTPUT_BYTES) {
          requestTermination(commandError('RENDER_FAILED', 'Renderer diagnostic output exceeded the safe limit.'))
          return current
        }
        return next
      }
      childStdout.on('data', (chunk: Buffer) => {
        stdout = append(stdout, chunk)
      })
      childStderr.on('data', (chunk: Buffer) => {
        stderr = append(stderr, chunk)
      })
      const onAbort = () => {
        requestTermination(commandError('RENDER_CANCELLED', 'Export was cancelled.'))
      }
      invocation.signal?.addEventListener('abort', onAbort, { once: true })
      if (invocation.signal?.aborted) onAbort()
      child.once('error', (error) => {
        if (terminalError === undefined) {
          terminalError = classifyLaunchError(error)
        }
      })
      child.once('close', (exitCode) => {
        invocation.signal?.removeEventListener('abort', onAbort)
        if (settled) return
        settled = true
        if (terminalError !== undefined) {
          reject(terminalError)
          return
        }
        resolvePromise({
          exitCode: exitCode ?? -1,
          stdout: stdout.toString('utf8'),
          stderr: stderr.toString('utf8'),
        })
      })
    })
  }
}

import { spawn as nodeSpawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const DEV_PROCESSES = Object.freeze([
  Object.freeze({ name: 'api', workspace: 'apps/api' }),
  Object.freeze({ name: 'web', workspace: 'apps/web' }),
])

export function resolveNpmInvocation({
  platform = process.platform,
  nodeExecPath = process.execPath,
  npmExecPath = process.env.npm_execpath,
} = {}) {
  if (platform !== 'win32') return { command: 'npm', argsPrefix: [] }
  if (!npmExecPath) {
    throw new Error('Cannot start Sanverse on Windows without npm_execpath. Run this app with `npm run dev`.')
  }
  return { command: nodeExecPath, argsPrefix: [npmExecPath] }
}

export function terminateProcessTree(child, {
  platform = process.platform,
  spawn = nodeSpawn,
} = {}) {
  if (platform === 'win32') {
    if (!Number.isSafeInteger(child.pid) || child.pid <= 0) {
      throw new Error('Cannot stop a Windows process tree without a known spawned PID.')
    }
    return spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    })
  }
  child.kill()
  return child
}

export function startDevelopment({
  spawn = nodeSpawn,
  exit = (code) => process.exit(code),
  terminate = terminateProcessTree,
  installSignalHandlers = true,
} = {}) {
  const { command: npmCommand, argsPrefix } = resolveNpmInvocation()
  let stopped = false
  const children = DEV_PROCESSES.map(({ workspace }) =>
    spawn(npmCommand, [...argsPrefix, 'run', 'dev', '--workspace', workspace], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    }),
  )

  function stop(exitCode) {
    if (stopped) return
    stopped = true
    for (const child of children) {
      if (child.exitCode === null || child.exitCode === undefined) terminate(child)
    }
    if (typeof exitCode === 'number') exit(exitCode)
  }

  children.forEach((child) => {
    child.once('error', () => stop(1))
    child.once('exit', (code, signal) => {
      if (!stopped) stop(code ?? (signal ? 1 : 0))
    })
  })

  if (installSignalHandlers) {
    process.once('SIGINT', () => stop(0))
    process.once('SIGTERM', () => stop(0))
  }

  return { stop: () => stop() }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (import.meta.url === invokedPath) startDevelopment()

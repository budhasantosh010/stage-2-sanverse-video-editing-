import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const viteNode = resolve(root, 'node_modules', 'vite-node', 'vite-node.mjs')
const entry = resolve(root, 'scripts', 'sanverse-mcp.ts')
const child = spawn(process.execPath, [viteNode, entry, 'stdio'], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  windowsHide: true,
})
child.once('error', (error) => { console.error(error.message); process.exitCode = 1 })
child.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0) })

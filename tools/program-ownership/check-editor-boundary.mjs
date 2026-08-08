#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const PROTECTED_MOTION_PREFIXES = Object.freeze([
  'apps/motion-lab/',
  'motion/',
  'DOCS/motion/',
])

const PRODUCTION_SOURCE_EXTENSIONS = Object.freeze(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

export function normalizeRepoPath(value) {
  return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '')
}

export function isProtectedMotionPath(value) {
  const path = normalizeRepoPath(value)
  if (PROTECTED_MOTION_PREFIXES.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix))) return true
  return /^packages\/motion-[^/]+(?:\/|$)/.test(path)
}

export function importedSpecifiers(text) {
  const source = String(text ?? '')
  const result = []
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) result.push(match[1])
  }
  return Object.freeze([...new Set(result)])
}

export function isForbiddenMotionSpecifier(specifier) {
  const value = normalizeRepoPath(specifier)
  return value.startsWith('@sanverse/motion-') || value.includes('apps/motion-lab')
}

export function findForbiddenMotionImportsInText(text) {
  return Object.freeze(importedSpecifiers(text).filter(isForbiddenMotionSpecifier))
}

export function isProductionWebSource(pathValue) {
  const path = normalizeRepoPath(pathValue)
  if (!path.startsWith('apps/web/')) return false
  if (!PRODUCTION_SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension))) return false
  if (/(?:^|\/)(?:test|tests|__tests__|fixtures)(?:\/|$)/.test(path)) return false
  if (/\.(?:test|spec|stories)\.[^.]+$/.test(path)) return false
  return true
}

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.status !== 0 && !allowFailure) {
    const detail = (result.stderr || result.stdout || '').trim()
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`)
  }
  return result.stdout ?? ''
}

export function parseNameStatusZ(output) {
  const tokens = String(output ?? '').split('\0')
  const paths = []
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++]
    if (!status) continue
    const first = tokens[index++]
    if (!first) continue
    paths.push(first)
    if (status.startsWith('R') || status.startsWith('C')) {
      const second = tokens[index++]
      if (second) paths.push(second)
    }
  }
  return Object.freeze(paths.map(normalizeRepoPath))
}

function diffPaths(args) {
  return parseNameStatusZ(runGit(['diff', '--name-status', '-z', '--find-renames', '--find-copies', ...args]))
}

export function collectChangedPaths(base) {
  const committed = diffPaths([`${base}..HEAD`])
  const staged = diffPaths(['--cached'])
  const unstagedTracked = diffPaths([])
  // Untracked files are checked too. They are not part of the minimum contract,
  // but catching an accidental protected write before staging is safer than
  // waiting until the final pre-commit check.
  const untracked = runGit(['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .map(normalizeRepoPath)
  return Object.freeze([...new Set([...committed, ...staged, ...unstagedTracked, ...untracked])].sort())
}

function trackedAndUntrackedWebFiles() {
  return runGit(['ls-files', '-co', '--exclude-standard', '-z', '--', 'apps/web'])
    .split('\0')
    .filter(Boolean)
    .map(normalizeRepoPath)
    .filter(isProductionWebSource)
    .sort()
}

export async function scanForbiddenProductionImports(paths = trackedAndUntrackedWebFiles()) {
  const findings = []
  for (const path of paths) {
    let text
    try {
      text = await readFile(path, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }
    for (const specifier of findForbiddenMotionImportsInText(text)) {
      findings.push(Object.freeze({ path, specifier }))
    }
  }
  return Object.freeze(findings)
}

function parseCli(argv) {
  let base = null
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--base') {
      base = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (argument === '--help' || argument === '-h') return Object.freeze({ help: true, base: null })
    throw new Error(`Unknown argument: ${argument}`)
  }
  if (!base || base.startsWith('-')) throw new Error('Usage: node tools/program-ownership/check-editor-boundary.mjs --base <milestone-commit>')
  return Object.freeze({ help: false, base })
}

export async function runBoundaryCheck({ base }) {
  runGit(['rev-parse', '--show-toplevel'])
  runGit(['rev-parse', '--verify', `${base}^{commit}`])
  const changedPaths = collectChangedPaths(base)
  const protectedPaths = changedPaths.filter(isProtectedMotionPath)
  const forbiddenImports = await scanForbiddenProductionImports()
  return Object.freeze({
    base,
    changedPaths,
    protectedPaths: Object.freeze(protectedPaths),
    forbiddenImports,
  })
}

function renderFailure(report) {
  console.error('EDITOR PROGRAM BOUNDARY: FAIL')
  if (report.protectedPaths.length > 0) {
    console.error('\nProtected Motion paths modified:')
    for (const path of report.protectedPaths) console.error(`- ${path}`)
  }
  if (report.forbiddenImports.length > 0) {
    console.error('\nForbidden Motion dependency introduced:')
    for (const finding of report.forbiddenImports) console.error(`- ${finding.path} -> ${finding.specifier}`)
  }
}

async function main() {
  const options = parseCli(process.argv.slice(2))
  if (options.help) {
    console.log('Usage: node tools/program-ownership/check-editor-boundary.mjs --base <milestone-commit>')
    return
  }
  const report = await runBoundaryCheck({ base: options.base })
  if (report.protectedPaths.length > 0 || report.forbiddenImports.length > 0) {
    renderFailure(report)
    process.exitCode = 1
    return
  }
  console.log('EDITOR PROGRAM BOUNDARY: PASS')
  console.log(`Milestone base: ${report.base}`)
  console.log(`Changed paths inspected: ${report.changedPaths.length}`)
  console.log('Protected Motion paths modified: NONE')
  console.log('Forbidden production apps/web Motion imports: NONE')
}

const invokedPath = process.argv[1] ? new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href : null
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error('EDITOR PROGRAM BOUNDARY: FAIL')
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

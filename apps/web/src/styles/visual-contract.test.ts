import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

const stylesDirectory = dirname(fileURLToPath(import.meta.url))
const sourceDirectory = resolve(stylesDirectory, '..')

function readSource(relativePath: string): string {
  const sourcePath = resolve(sourceDirectory, relativePath)
  return existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : ''
}

describe('shared visual and accessibility contract', () => {
  const tokens = readSource('styles/tokens.css')
  const globalStyles = readSource('styles/global.css')
  const main = readSource('main.tsx')
  const homeStyles = readSource('screens/home/HomeScreen.css')
  const studioStyles = readSource('screens/studio/StudioScreen.css')
  const allStyles = [tokens, globalStyles, homeStyles, studioStyles].join('\n')

  test('defines the shared monochrome foundation as versionable tokens', () => {
    expect(tokens).toMatch(/:root\s*{/)
    expect(tokens).toContain('--color-ink:')
    expect(tokens).toContain('--color-canvas:')
    expect(tokens).toContain('--color-surface:')
    expect(tokens).toContain('--font-body:')
    expect(tokens).toContain('--font-display:')
    expect(tokens).toContain('--border-subtle:')
    expect(tokens).toContain('--focus-ring:')
  })

  test('loads tokens and global rules before the application', () => {
    const tokenImport = main.indexOf("import './styles/tokens.css'")
    const globalImport = main.indexOf("import './styles/global.css'")
    const appImport = main.indexOf("import { App } from './app/App'")

    expect(tokenImport).toBeGreaterThanOrEqual(0)
    expect(globalImport).toBeGreaterThan(tokenImport)
    expect(appImport).toBeGreaterThan(globalImport)
  })

  test('provides a visible shared keyboard focus treatment', () => {
    expect(globalStyles).toMatch(/:focus-visible\s*{[^}]*outline:\s*var\(--focus-ring\)/s)
    expect(globalStyles).toMatch(/outline-offset:\s*var\(--focus-offset\)/)
  })

  test('removes non-essential motion for reduced-motion users', () => {
    expect(globalStyles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    expect(globalStyles).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(globalStyles).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
  })

  test('uses tokens in both screens and declares no gradients', () => {
    expect(homeStyles).toContain('var(--color-canvas)')
    expect(homeStyles).toContain('var(--font-display)')
    expect(studioStyles).toContain('var(--color-workspace)')
    expect(studioStyles).toContain('var(--border-subtle)')
    expect(allStyles).not.toMatch(/(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\s*\(/i)
  })
})

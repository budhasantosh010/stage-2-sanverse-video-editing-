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

function readHexToken(source: string, token: string): string {
  const match = source.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'))

  if (!match) {
    throw new Error(`Missing six-digit hexadecimal token: ${token}`)
  }

  return match[1]
}

function relativeLuminance(hex: string): number {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((channel) => {
    const srgb = Number.parseInt(channel, 16) / 255
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
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

  test('keeps placeholder and normal muted text at WCAG AA contrast', () => {
    const placeholder = readHexToken(tokens, '--color-placeholder')
    const mutedText = readHexToken(tokens, '--color-text-muted')
    const whiteSurface = readHexToken(tokens, '--color-surface')
    const homeCanvas = readHexToken(tokens, '--color-canvas')
    const studioSurface = readHexToken(tokens, '--color-surface-subtle')

    expect(contrastRatio(placeholder, whiteSurface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(mutedText, homeCanvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(mutedText, studioSurface)).toBeGreaterThanOrEqual(4.5)
  })

  test('uses a normal readable token for section indexes', () => {
    const homeSectionIndex = homeStyles.match(/\.home-screen__section-index\s*{[^}]*}/s)?.[0]
    const studioSectionIndex = studioStyles.match(/\.studio-screen__section-index\s*{[^}]*}/s)?.[0]

    expect(homeSectionIndex).toContain('color: var(--color-text-muted)')
    expect(studioSectionIndex).toContain('color: var(--color-text-muted)')
    expect(homeSectionIndex).not.toContain('var(--color-text-disabled)')
    expect(studioSectionIndex).not.toContain('var(--color-text-disabled)')
  })
})

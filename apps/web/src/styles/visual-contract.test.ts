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
  const inspectorStyles = readSource('editor/inspector/Inspector.css')
  const canvasStyles = readSource('editor/canvas/CanvasInteractionLayer.css')
  const allStyles = [tokens, globalStyles, homeStyles, studioStyles, inspectorStyles, canvasStyles].join('\n')

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
    expect(studioStyles).toMatch(
      /\.studio-screen__proposal-result:focus-visible\s*{[^}]*outline:\s*var\(--focus-ring\)/s,
    )
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

  test('keeps Inspector section actions unobstructed by the visual Apply footer', () => {
    const visualApplyRule = inspectorStyles.match(/\.inspector__visual-apply\s*{[^}]*}/s)?.[0] ?? ''

    expect(visualApplyRule).not.toContain('position: sticky')
    expect(visualApplyRule).not.toContain('position: fixed')
    expect(visualApplyRule).not.toContain('z-index:')
    expect(visualApplyRule).not.toMatch(/margin:\s*[^;]*-/)
  })

  test('keeps Studio video manipulation inside a bounded contained stage', () => {
    const stageRule = studioStyles.match(/\.studio-screen__video-frame\s*{[^}]*}/s)?.[0] ?? ''
    const videoRule = studioStyles.match(/\.studio-screen__video\s*{[^}]*}/s)?.[0] ?? ''
    const desktopGridRule = studioStyles.match(/\.editor-shell \.studio-screen--studio\s*{[^}]*}/s)?.[0] ?? ''

    expect(stageRule).toContain('min-height: clamp(')
    expect(stageRule).toContain('max-height:')
    expect(videoRule).toContain('height: 100%')
    expect(videoRule).toContain('object-fit: contain')
    expect(desktopGridRule).not.toContain('grid-template-rows: minmax(0, 1fr)')
  })

  test('leaves native video controls reachable outside real Canvas targets', () => {
    const layerRule = canvasStyles.match(/\.canvas-interaction-layer\s*{[^}]*}/s)?.[0] ?? ''
    const hitRule = canvasStyles.match(/\.canvas-hit-target\s*{[^}]*}/s)?.[0] ?? ''

    expect(layerRule).toContain('pointer-events: none')
    expect(hitRule).toContain('pointer-events: auto')
    expect(canvasStyles).not.toContain('.canvas-empty-selection-target')
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

  test('keeps the Home question subordinate to the editing task', () => {
    const headingRule = homeStyles.match(/\.home-screen h1\s*{[^}]*}/s)?.[0] ?? ''
    const maximumRem = headingRule.match(/font-size:\s*clamp\([^,]+,[^,]+,\s*([\d.]+)rem\)/)?.[1]

    expect(Number(maximumRem)).toBeLessThanOrEqual(3.75)
  })

  test('uses shared smooth navigation and purposeful spring feedback tokens', () => {
    expect(tokens).toContain('--motion-duration-fast:')
    expect(tokens).toContain('--motion-duration-screen:')
    expect(tokens).toContain('--motion-ease-standard:')
    expect(homeStyles).toMatch(/\.home-screen__choose-button\s*{[^}]*transition:/s)
    expect(studioStyles).toMatch(/\.studio-screen__back[^}]*transition:/s)
  })

  test('provides a visible screen-entry fallback and spring interaction feedback', () => {
    expect(tokens).toContain('--motion-ease-spring:')
    expect(main).toContain("dataset.viewTransition = supportsNativeViewTransitions() ? 'native' : 'fallback'")
    expect(globalStyles).toMatch(
      /\[data-view-transition='fallback'\]\s+\.home-screen,\s*\[data-view-transition='fallback'\]\s+\.studio-screen\s*{[^}]*animation:/s,
    )
    expect(globalStyles).toMatch(/@keyframes\s+sanverse-screen-enter/)
    expect(homeStyles).toMatch(/\.home-screen__composer:focus-within\s*{[^}]*transform:/s)
    expect(homeStyles).toMatch(/\.home-screen__choose-button:active\s*{[^}]*scale\(/s)
    expect(studioStyles).toMatch(/\.studio-screen button:active[^}]*scale\(/s)
    expect(studioStyles).toMatch(
      /\.studio-screen\s+button\.studio-screen__back:active:not\(:disabled\)\s*{[^}]*translateX\(0\)[^}]*scale\(/s,
    )
  })

  test('explicitly removes new transforms and entry animation for reduced motion', () => {
    const reducedMotion = globalStyles.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{[\s\S]*\n}/,
    )?.[0] ?? ''

    expect(reducedMotion).toMatch(/\.home-screen,\s*\.studio-screen\s*{[^}]*animation:\s*none\s*!important/s)
    expect(reducedMotion).toMatch(/\.home-screen__composer:focus-within[\s\S]*transform:\s*none\s*!important/)
  })
})

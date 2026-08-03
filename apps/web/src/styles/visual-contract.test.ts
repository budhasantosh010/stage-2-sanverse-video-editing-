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
  const mediaStyles = readSource('editor/media/MediaBin.css')
  const editorShellStyles = readSource('editor/EditorShell.css')
  const layoutStyles = readSource('editor/layout-v2/StudioLayoutV2.css')
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

  test('gives the desktop editor one explicit viewport-height and scroll authority', () => {
    const htmlRule = globalStyles.match(/html\s*{[^}]*}/s)?.[0] ?? ''
    const bodyRule = globalStyles.match(/body\s*{[^}]*}/s)?.[0] ?? ''
    const rootRule = globalStyles.match(/#root\s*{[^}]*}/s)?.[0] ?? ''
    const shellRule = editorShellStyles.match(/\.editor-shell\s*{[^}]*}/s)?.[0] ?? ''
    const workspaceRule = editorShellStyles.match(/\.editor-shell__workspace\s*{[^}]*}/s)?.[0] ?? ''
    const studioRule = studioStyles.match(/\.editor-shell \.studio-screen--studio\s*{[^}]*}/s)?.[0] ?? ''

    expect(htmlRule).toContain('height: 100%')
    expect(bodyRule).toContain('height: 100%')
    expect(rootRule).toContain('height: 100%')
    expect(shellRule).toContain('height: 100dvh')
    expect(shellRule).toContain('display: flex')
    expect(shellRule).toContain('overflow: hidden')
    expect(workspaceRule).toContain('min-height: 0')
    expect(workspaceRule).toContain('flex: 1 1 auto')
    expect(studioRule).toContain('height: 100%')
    expect(studioRule).toContain('min-height: 0')
    expect(studioRule).toContain('grid-template-rows: auto minmax(0, 1fr)')
    expect(studioRule).toContain('overflow: hidden')
    expect(layoutStyles).toMatch(/\.studio-layout-v2__root[^}]*height:\s*100%/s)
  })

  test('keeps only intentional panel bodies scrollable on desktop', () => {
    const mediaRule = studioStyles.match(/\.studio-screen__media\s*{[^}]*}/s)?.[0] ?? ''
    const mediaResultsRule = mediaStyles.match(/\.media-bin__results\s*{[^}]*}/s)?.[0] ?? ''
    const inspectorRule = studioStyles.match(/\.studio-screen__inspector\s*{\s*max-height:[^}]*}/s)?.[0] ?? ''
    const aiRule = studioStyles.match(/\.studio-screen__ai-panel-content\s*{[^}]*}/s)?.[0] ?? ''

    expect(mediaRule).toContain('overflow: hidden')
    expect(mediaResultsRule).toContain('overflow-y: auto')
    expect(inspectorRule).toContain('overflow: auto')
    expect(aiRule).toContain('overflow: auto')
    expect(layoutStyles).toMatch(/\.studio-layout-v2__frame--preview[^}]*overflow:\s*hidden/s)
    expect(layoutStyles).toMatch(/\.studio-layout-v2__frame--timeline[^}]*overflow:\s*hidden/s)
    expect(layoutStyles).not.toMatch(/\.studio-layout-v2__frame\s*{[^}]*overflow:\s*auto/s)
  })

  test('keeps shared screen-reader labels visually hidden', () => {
    expect(globalStyles).toMatch(/\.sr-only\s*{[^}]*clip-path:\s*inset\(50%\)/s)
  })

  test('names every panel container and protects visible resize affordances', () => {
    for (const name of ['studio-ai', 'studio-media', 'studio-preview', 'studio-tool', 'studio-timeline']) {
      expect(layoutStyles).toContain(`container-name: ${name}`)
    }
    expect(layoutStyles).toMatch(/\.studio-layout-v2__separator\s*{[^}]*flex:\s*0 0 (?:8|10|12)px/s)
    expect(layoutStyles).toContain('cursor: col-resize')
    expect(layoutStyles).toContain('cursor: row-resize')
  })

  test('hands narrow screens to an explicit natural-flow panel authority', () => {
    expect(globalStyles).toMatch(/@media \(max-width: 980px\)[\s\S]*html,[\s\S]*body,[\s\S]*#root\s*{[^}]*height: auto/s)
    expect(layoutStyles).toMatch(/@media \(max-width: 980px\)[\s\S]*\.studio-layout-v2__root,[\s\S]*display: block !important/s)
    expect(layoutStyles).toMatch(/#studio-preview-pane,[\s\S]*#studio-timeline-pane\s*{[^}]*height: auto !important[^}]*flex: none !important/s)
    expect(layoutStyles).toContain('#studio-media-pane:not(:has(.studio-screen__side-region--compact-open))')
    expect(layoutStyles).toContain('#studio-tool-pane:not(:has(.studio-screen__side-region--compact-open))')
    expect(layoutStyles).toContain(".studio-layout-v2[data-responsive='tablet'] #studio-media-pane:has(.studio-screen__side-region--compact-open)")
    expect(studioStyles).toMatch(/@media \(min-width: 981px\) and \(max-width: 1100px\)[\s\S]*\.editor-shell \.studio-screen--studio\s*{[^}]*height: 100%[^}]*overflow: hidden/s)
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

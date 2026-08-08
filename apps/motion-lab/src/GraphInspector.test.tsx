import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { evaluateScene } from '@sanverse/motion-graph'
import { KineticHeadlineModule, DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, MOTION_REFERENCE_COMPOSITIONS } from '@sanverse/motion-library'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { GraphInspector } from './GraphInspector.tsx'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const context = {
  localTicks: SANVERSE_TICKS_PER_SECOND,
  durationTicks: SANVERSE_TICKS_PER_SECOND * 3,
  ticksPerSecond: SANVERSE_TICKS_PER_SECOND,
  composition: MOTION_REFERENCE_COMPOSITIONS['16:9'],
  reducedMotion: false,
} as const

const scene = KineticHeadlineModule.createScene(DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, context)
const resolvedScene = evaluateScene(scene, context)

const clickButton = (label: string) => {
  const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('GraphInspector schema-driven editing levels', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('progressively discloses the same graph instead of component-specific inspector branches', () => {
    const common = {
      exposures: scene.exposures,
      scene,
      resolvedScene,
      readExposure: () => ({ value: null }),
      writeExposure: vi.fn(),
      selectedNodeId: 'kinetic-headline.background',
      onSelectNode: vi.fn(),
      onPatch: vi.fn(),
    } as const

    act(() => root.render(<GraphInspector {...common} level="creator" onLevelChange={vi.fn()} />))
    expect(container.textContent).toContain('Editing level')
    expect(container.textContent).toContain('Content')
    expect(container.textContent).not.toContain('Layer debug')
    expect(container.textContent).not.toContain('Masks')

    act(() => root.render(<GraphInspector {...common} level="advanced" onLevelChange={vi.fn()} />))
    expect(container.textContent).toContain('Parts')
    expect(container.textContent).toContain('Layer debug')
    expect(container.textContent).toContain('Effects')
    expect(container.textContent).toContain('Masks')
    expect(container.textContent).toContain('Node / effect debug')
  })

  it('emits typed graph patches for effect, mask and blend edits', () => {
    const onPatch = vi.fn()
    act(() => root.render(
      <GraphInspector
        level="advanced"
        onLevelChange={vi.fn()}
        exposures={scene.exposures}
        scene={scene}
        resolvedScene={resolvedScene}
        readExposure={() => ({ value: null })}
        writeExposure={vi.fn()}
        selectedNodeId="kinetic-headline.background"
        onSelectNode={vi.fn()}
        onPatch={onPatch}
      />,
    ))

    act(() => clickButton('+ Add'))
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ op: 'add-effect', nodeId: 'kinetic-headline.background' }))

    act(() => clickButton('+ Rectangle'))
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ op: 'add-mask', nodeId: 'kinetic-headline.background' }))

    const blend = [...container.querySelectorAll('select')].find((candidate) => [...candidate.options].some((option) => option.value === 'multiply'))
    if (!blend) throw new Error('Blend selector not found')
    act(() => {
      blend.value = 'multiply'
      blend.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onPatch).toHaveBeenCalledWith({ op: 'set-blend-mode', nodeId: 'kinetic-headline.background', blendMode: 'multiply' })
  })
})

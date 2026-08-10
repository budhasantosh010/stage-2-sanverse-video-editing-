import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CreativeDirectionLab } from './CreativeDirectionLab.tsx'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const clickByText = (container: HTMLElement, text: string): void => {
  const button = [...container.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === text)
  if (!button) throw new Error(`Missing button: ${text}`)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const setInput = (input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void => {
  const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (!setter) throw new Error('Missing value setter')
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }

describe('Plan B0 Creative Direction Lab', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => { root.render(<CreativeDirectionLab />); await Promise.resolve() })
    await settle()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('renders all eight semantic tracks with exact project-tick authority', () => {
    expect(container.querySelector('[data-creative-direction-lab="true"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-creative-track]')).toHaveLength(8)
    expect(container.textContent).toContain('1,440,000 ticks/second')
    expect(container.textContent).toContain('95.00s')
    expect(container.textContent).toContain('Document valid')
  })

  it('selects a graphic region and shows deterministic fixture component resolution', async () => {
    const region = container.querySelector<HTMLButtonElement>('[data-directive-id="graphic:floating-prompt"]')!
    await act(async () => { region.click(); await Promise.resolve() })
    await settle()
    expect(container.querySelector<HTMLInputElement>('[aria-label="Communication intent"]')?.value).toBe('floating-prompt-composer')
    expect(container.textContent).toContain('sanverse.floating-prompt-composer')
    const previewLink = [...container.querySelectorAll<HTMLAnchorElement>('a')].find((entry) => entry.getAttribute('href')?.includes('component=floating-prompt-composer'))
    expect(previewLink?.textContent).toContain('Preview in Motion Lab')
    expect(previewLink?.getAttribute('href')).toContain('level=compositor')
    expect(previewLink?.getAttribute('href')).toContain('creativePlacement=placement%3Agraphic%3Afloating-prompt')
    expect(previewLink?.getAttribute('href')).toContain('storyTitle=Summarize+the+launch+feedback+and+assign+next+steps')
  })

  it('moves and resizes the selected region using exact ticks', async () => {
    const originalStart = Number(container.querySelector<HTMLInputElement>('[aria-label="Selected start tick"]')!.value)
    await act(async () => { clickByText(container, '1 second →'); await Promise.resolve() })
    await settle()
    expect(Number(container.querySelector<HTMLInputElement>('[aria-label="Selected start tick"]')!.value)).toBe(originalStart + 1_440_000)

    const start = container.querySelector<HTMLInputElement>('[aria-label="Selected start tick"]')!
    await act(async () => { setInput(start, String(originalStart + 720_000)); await Promise.resolve() })
    await settle()
    expect(Number(container.querySelector<HTMLInputElement>('[aria-label="Selected start tick"]')!.value)).toBe(originalStart + 720_000)
    expect(container.textContent).toContain('Document valid')
  })

  it('duplicates, changes type and deletes a directive without mutating stable source identity', async () => {
    await act(async () => { clickByText(container, 'Duplicate +1s'); await Promise.resolve() })
    await settle()
    expect(container.textContent).toContain('16 directives')
    const type = container.querySelector<HTMLSelectElement>('[aria-label="Selected directive type"]')!
    await act(async () => { setInput(type, 'motion'); await Promise.resolve() })
    await settle()
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Motion character"]')?.value).toBe('restrained')
    expect(container.querySelector('.creative-direction__identity strong')?.textContent).toContain('graphic:semantic-highlight:copy-')
    await act(async () => { clickByText(container, 'Delete'); await Promise.resolve() })
    await settle()
    expect(container.textContent).toContain('15 directives')
  })

  it('adds a new exact-tick region from the inspector', async () => {
    const kind = container.querySelector<HTMLSelectElement>('[aria-label="New directive type"]')!
    const start = container.querySelector<HTMLInputElement>('[aria-label="New region start tick"]')!
    const end = container.querySelector<HTMLInputElement>('[aria-label="New region end tick"]')!
    act(() => { setInput(kind, 'note'); setInput(start, '14400000'); setInput(end, '15840000') })
    await act(async () => { clickByText(container, '+ Add exact-tick region'); await Promise.resolve() })
    await settle()
    expect(container.textContent).toContain('16 directives')
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Creative note"]')?.value).toBe('Creative note')
    expect(container.textContent).toContain('Document valid')
  })
})

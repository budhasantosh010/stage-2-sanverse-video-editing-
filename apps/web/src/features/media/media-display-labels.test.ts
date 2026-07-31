import { describe, expect, it } from 'vitest'
import { testBrollAsset, testImageAsset, testMultiAssetProject, testMusicAsset } from '@sanverse/edit-domain/test-fixtures'
import { addAsset, type EditProject } from '@sanverse/edit-domain'
import { deriveAssetDisplayLabels, safeAssetDisplayName } from './media-display-labels'

const add = (project: EditProject, asset: ReturnType<typeof testImageAsset>): EditProject => {
  const result = addAsset(project, asset)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('asset display-label authority', () => {
  it('prefers safe filenames and never exposes a raw path', () => {
    const project = testMultiAssetProject()
    const labels = deriveAssetDisplayLabels({
      project,
      primaryDisplayName: 'C:\\private\\owner.mp4',
      originalNames: {
        [testBrollAsset().assetId]: '/Users/me/cutaway.mp4',
        [testImageAsset().assetId]: 'hero.png',
      },
    })
    expect(labels[project.assets[0].assetId]).toBe('owner.mp4')
    expect(labels[testBrollAsset().assetId]).toBe('cutaway.mp4')
    expect(labels[testImageAsset().assetId]).toBe('hero.png')
    expect(Object.values(labels).join(' ')).not.toContain('private')
  })

  it('uses deterministic family numbering and adding audio does not rename an image', () => {
    const initial = testMultiAssetProject()
    const first = deriveAssetDisplayLabels({ project: initial, primaryDisplayName: null })
    const imageLabel = first[testImageAsset().assetId]
    const nextResult = addAsset(initial, testMusicAsset({ assetId: 'asset_audio2222' }))
    if (!nextResult.ok) throw new Error(JSON.stringify(nextResult.error))
    const second = deriveAssetDisplayLabels({ project: nextResult.value, primaryDisplayName: null })
    expect(imageLabel).toBe('Image 1')
    expect(second[testImageAsset().assetId]).toBe('Image 1')
    expect(second[testBrollAsset().assetId]).toBe('Video 2')
    expect(second[testMusicAsset().assetId]).toBe('Audio 1')
  })

  it('disambiguates duplicate safe filenames and is stable on repeated input', () => {
    const base = testMultiAssetProject()
    const secondImage = testImageAsset({ assetId: 'asset_image2222' })
    const project = add(base, secondImage)
    const input = {
      project,
      primaryDisplayName: 'owner.mp4',
      originalNames: {
        [testImageAsset().assetId]: 'logo.png',
        [secondImage.assetId]: 'logo.png',
      },
    }
    expect(deriveAssetDisplayLabels(input)).toEqual(deriveAssetDisplayLabels(input))
    expect(deriveAssetDisplayLabels(input)).toMatchObject({
      [testImageAsset().assetId]: 'logo.png (1)',
      [secondImage.assetId]: 'logo.png (2)',
    })
  })

  it('sanitizes controls and rejects empty path fragments', () => {
    expect(safeAssetDisplayName('  folder\\my\nclip.mp4  ')).toBe('myclip.mp4')
    expect(safeAssetDisplayName('..')).toBeNull()
    expect(safeAssetDisplayName('')).toBeNull()
  })
})

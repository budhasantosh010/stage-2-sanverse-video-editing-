import type { EditOperation, MediaAsset } from '@sanverse/edit-domain'

export type MediaKind = 'video' | 'image' | 'audio' | 'unknown'
export type MediaFilter = 'all' | 'video' | 'image' | 'audio' | 'missing'
export type MediaUsageKind = 'primary-video' | 'media-overlay' | 'music' | 'unused'
export type MediaStatus = 'available' | 'checking' | 'missing' | 'unsupported'

export type MediaAssetSource = Readonly<{
  url: string | null
  originalName: string | null
  status: MediaStatus
}>

export type MediaAssetUsage = Readonly<{
  count: number
  kinds: readonly MediaUsageKind[]
}>

export type MediaAssetView = Readonly<{
  assetId: string
  kind: MediaKind
  displayName: string
  originalName: string | null
  durationTicks: number | null
  width: number | null
  height: number | null
  status: MediaStatus
  usageCount: number
  usageKinds: readonly MediaUsageKind[]
  canAddAsOverlay: boolean
  canAddAsMusic: boolean
  canRemove: boolean
  removeBlockedReason: string | null
  previewSource: string | null
  thumbnailSource: string | null
}>

export type MediaBinViewModel = Readonly<{
  assets: readonly MediaAssetView[]
  counts: Readonly<{
    all: number
    video: number
    image: number
    audio: number
    missing: number
  }>
}>

export type MediaActionBuildResult =
  | Readonly<{ ok: true; operation: EditOperation; timelineItemId: string }>
  | Readonly<{ ok: false; message: string }>

export type MediaActionIds = Readonly<{
  operationId: string
  overlayId: string
  musicId: string
}>

export type MediaBinBuildInput = Readonly<{
  project: import('@sanverse/edit-domain').EditProject
  primaryDisplayName: string | null
  originalNames?: Readonly<Record<string, string>>
  assetSources: Readonly<Record<string, MediaAssetSource | undefined>>
  selectedAssetId?: string | null
}>

export type MediaImportResult = MediaAsset | string

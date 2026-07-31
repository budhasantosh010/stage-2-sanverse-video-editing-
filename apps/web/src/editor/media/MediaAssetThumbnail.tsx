import { useState } from 'react'
import type { MediaAssetView } from '../../features/media'

const placeholder = (asset: MediaAssetView): string => {
  if (asset.status === 'checking') return 'Checking'
  if (asset.status === 'missing') return 'Missing'
  if (asset.kind === 'video') return 'Video'
  if (asset.kind === 'image') return 'Image'
  if (asset.kind === 'audio') return 'Audio'
  return 'File'
}

export function MediaAssetThumbnail({ asset }: Readonly<{ asset: MediaAssetView }>) {
  const [failed, setFailed] = useState(false)
  if (asset.thumbnailSource && !failed) {
    return (
      <img
        className="media-bin__thumbnail-image"
        src={asset.thumbnailSource}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <span className="media-bin__thumbnail-placeholder" aria-hidden="true">
      {placeholder(asset)}
    </span>
  )
}

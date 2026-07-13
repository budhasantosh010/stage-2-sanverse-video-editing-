const MP4_ERROR = 'Choose an MP4 video.'

export function validateLocalVideo(file: File): void {
  const hasMp4Name = /\.mp4$/i.test(file.name)
  const hasAllowedMimeType = ['', 'video/mp4', 'application/octet-stream'].includes(file.type)

  if (!hasMp4Name || !hasAllowedMimeType) {
    throw new Error(MP4_ERROR)
  }
}

export function createLocalMediaHandle(file: File) {
  validateLocalVideo(file)

  const url = URL.createObjectURL(file)
  let disposed = false

  return {
    file,
    url,
    dispose(): void {
      if (disposed) {
        return
      }

      disposed = true
      URL.revokeObjectURL(url)
    },
  }
}

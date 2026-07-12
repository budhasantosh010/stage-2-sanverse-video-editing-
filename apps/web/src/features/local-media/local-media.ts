const MP4_ERROR = 'Choose an MP4 video.'

export function validateLocalVideo(file: File): void {
  const hasMp4MimeType = file.type === 'video/mp4'
  const hasMp4NameWithoutMimeType = file.type === '' && /\.mp4$/i.test(file.name)

  if (!hasMp4MimeType && !hasMp4NameWithoutMimeType) {
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

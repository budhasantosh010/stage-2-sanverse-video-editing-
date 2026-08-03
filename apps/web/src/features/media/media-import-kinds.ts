/**
 * What the Import button may offer, and what each choice honestly accepts.
 *
 * "Truthful accept filter" means the list shown in the operating system's file
 * dialog matches what this product can really take. The server decides what a
 * file is by LOOKING AT ITS BYTES with ffprobe — never by its name — and it can
 * only hand a file back to the browser as one of the content types in
 * `contentTypeFor` on the API side. So those types, and nothing wider, are what
 * the dialog offers.
 *
 * The alternative — `accept="*"` or a made-up longer list — was rejected. A
 * dialog that lets a user pick a .txt file and then refuses it a second later
 * has taught them the product is unreliable, when in fact it never could have
 * worked. Filtering in the dialog is the difference between "this cannot be
 * chosen" and "this was rejected".
 *
 * The server remains the authority. Anything that gets past this list is still
 * probed, and still refused with a plain sentence if it is not media.
 */

export const MEDIA_IMPORT_KINDS = Object.freeze(['video', 'image', 'audio', 'all'] as const)
export type MediaImportKind = (typeof MEDIA_IMPORT_KINDS)[number]

/** Video: the containers the local renderer and the preview both handle. */
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.m4v,.webm,.mkv'

/** Image: exactly the types the API can serve back with a real image content type. */
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/bmp,image/gif,image/tiff,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff'

/** Audio: exactly the codecs the API maps to a real audio content type. */
const AUDIO_ACCEPT = 'audio/mpeg,audio/aac,audio/flac,audio/ogg,audio/wav,.mp3,.m4a,.aac,.flac,.ogg,.opus,.wav'

export type MediaImportChoice = Readonly<{
  id: MediaImportKind
  label: string
  /** Value for the file input's `accept`. The union for 'all'. */
  accept: string
  /** What the person is choosing, said plainly. */
  hint: string
}>

export const MEDIA_IMPORT_CHOICES: readonly MediaImportChoice[] = Object.freeze([
  Object.freeze({ id: 'video' as const, label: 'Video', accept: VIDEO_ACCEPT, hint: 'MP4, MOV, WebM, MKV' }),
  Object.freeze({ id: 'image' as const, label: 'Image', accept: IMAGE_ACCEPT, hint: 'PNG, JPEG, WebP, GIF' }),
  Object.freeze({ id: 'audio' as const, label: 'Audio', accept: AUDIO_ACCEPT, hint: 'MP3, M4A, WAV, FLAC' }),
  Object.freeze({
    id: 'all' as const,
    label: 'All supported media',
    accept: `${VIDEO_ACCEPT},${IMAGE_ACCEPT},${AUDIO_ACCEPT}`,
    hint: 'Any video, picture, or sound this project can use',
  }),
])

export const mediaImportChoice = (kind: MediaImportKind): MediaImportChoice =>
  MEDIA_IMPORT_CHOICES.find((choice) => choice.id === kind) ?? MEDIA_IMPORT_CHOICES[3]

/** Extensions we recognise when the browser tells us nothing about the type. */
const KNOWN_EXTENSIONS = Object.freeze(new Set([
  'mp4', 'mov', 'm4v', 'webm', 'mkv',
  'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff',
  'mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wav',
]))

/** Types the browser reports that mean "no opinion", so we fall back to the name. */
const UNDECIDED_TYPES = Object.freeze(new Set(['', 'application/octet-stream']))

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLocaleLowerCase()
}

export type MediaImportCheck =
  | Readonly<{ supported: true }>
  | Readonly<{ supported: false; reason: string }>

/**
 * Can this file be sent at all?
 *
 * This is a FAST NO, not a decision. Three cases, in order:
 *
 *   the browser says video/ image/ audio/   ->  send it
 *   the browser has no opinion              ->  judge by the file extension
 *   the browser says something else         ->  refuse, and say what it was
 *
 * Refusing here rather than uploading saves the user watching a progress bar
 * fill up for a spreadsheet. It can never wrongly accept something, because the
 * server still probes every file; the only thing it risks is wrongly refusing a
 * media file with a misleading name, which is why the message says what was
 * seen instead of claiming the file is broken.
 */
export const checkImportFile = (file: Readonly<{ name: string; type: string }>): MediaImportCheck => {
  const type = file.type.split(';', 1)[0].trim().toLocaleLowerCase()
  if (type.startsWith('video/') || type.startsWith('image/') || type.startsWith('audio/')) {
    return Object.freeze({ supported: true as const })
  }
  if (UNDECIDED_TYPES.has(type)) {
    return KNOWN_EXTENSIONS.has(extensionOf(file.name))
      ? Object.freeze({ supported: true as const })
      : Object.freeze({
          supported: false as const,
          reason: `${file.name} is not a video, picture, or sound file this project can use.`,
        })
  }
  // Worded to avoid "a"/"an" in front of a type we did not choose: the type
  // goes in brackets so the sentence reads correctly whatever it turns out to
  // be, and the user still learns exactly what the computer thought it was.
  return Object.freeze({
    supported: false as const,
    reason: `${file.name} is not a video, a picture, or a piece of music (${type}).`,
  })
}

export type MediaImportSplit = Readonly<{
  accepted: readonly File[]
  /** One sentence per refused file, so a mixed drop reports each one. */
  refusals: readonly string[]
}>

/**
 * Split a dropped or chosen set of files into "send these" and "say no to these,
 * individually".
 *
 * Individually matters. Dropping five files and being told "some files were not
 * supported" leaves the user to work out which — so each refusal names its file.
 */
export const splitImportFiles = (files: readonly File[]): MediaImportSplit => {
  const accepted: File[] = []
  const refusals: string[] = []
  for (const file of files) {
    const check = checkImportFile(file)
    if (check.supported) accepted.push(file)
    else refusals.push(check.reason)
  }
  return Object.freeze({ accepted: Object.freeze(accepted), refusals: Object.freeze(refusals) })
}

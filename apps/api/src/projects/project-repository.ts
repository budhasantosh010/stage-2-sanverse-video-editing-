import { createHash, randomBytes } from 'node:crypto'

export const PROJECT_ID_PATTERN = /^project_[a-z0-9]{16,64}$/
export const EXPORT_ID_PATTERN = /^export_[a-z0-9]{16,64}$/

export type ProjectManifest = {
  id: string
  originalFilename: string
  createdAt: string
  sizeBytes: number
  sha256: string
  mediaUrl: string
}

export type StagedSource = {
  projectId: string
  token: string
  byteLength: number
}

export type MediaRange = { start: number; end: number }

export type OpenMediaResult = {
  body: AsyncIterable<Uint8Array>
  size: number
  start: number
  end: number
}

export type ProjectExportPaths = {
  sourcePath: string
  outputPath: string
  trustedWorkDir: string
}

export interface ProjectRepository {
  /** Implementations must detect collisions before consuming body and clean partial stages on error. */
  stageSource(input: { projectId: string; body: AsyncIterable<Uint8Array> }): Promise<StagedSource>
  publishProject(stage: StagedSource, manifest: ProjectManifest): Promise<void>
  abortStage(stage: StagedSource): Promise<void>
  inspectMedia(projectId: string): Promise<{ size: number }>
  openMedia(projectId: string, range?: MediaRange): Promise<OpenMediaResult>
  allocateExport(projectId: string, exportId: string): Promise<ProjectExportPaths>
  inspectExport(projectId: string, exportId: string): Promise<{ size: number }>
  openExport(projectId: string, exportId: string, range?: MediaRange): Promise<OpenMediaResult>
}

export type ProjectIntakeErrorCode =
      | 'INVALID_FILENAME'
      | 'INVALID_CONTENT_TYPE'
      | 'INVALID_CONTENT_LENGTH'
      | 'UPLOAD_TOO_LARGE'
      | 'SIZE_MISMATCH'
      | 'INVALID_MP4'
      | 'UPLOAD_ABORTED'
      | 'PROJECT_COLLISION'

export class ProjectIntakeError extends Error {
  readonly code: ProjectIntakeErrorCode

  constructor(code: ProjectIntakeErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'ProjectIntakeError'
  }
}

type CreateProjectInput = {
  filename: string
  contentType?: string
  contentLength?: number
  body: AsyncIterable<Uint8Array>
}

type IntakeOptions = {
  repository: ProjectRepository
  maxUploadBytes: number
  idGenerator?: () => string
  now?: () => Date
  collisionAttempts?: number
}

const ALLOWED_CONTENT_TYPES = new Set(['', 'video/mp4', 'application/octet-stream'])
const ALLOWED_MP4_BRANDS = new Set([
  'isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6',
  'mp41', 'mp42', 'avc1', 'M4V ', 'MSNV', 'dash',
])
const MAX_FTYP_BYTES = 4096

function decodeAndValidateFilename(encoded: string): string {
  let filename: string
  try {
    filename = decodeURIComponent(encoded)
  } catch {
    throw new ProjectIntakeError('INVALID_FILENAME', 'The filename header is not valid percent-encoded text.')
  }

  if (
    filename.length === 0 ||
    filename.length > 255 ||
    !/\.mp4$/i.test(filename) ||
    /[\x00-\x1f\x7f/\\]/.test(filename) ||
    filename === '.' ||
    filename === '..'
  ) {
    throw new ProjectIntakeError('INVALID_FILENAME', 'Choose a safe filename ending in .mp4.')
  }
  return filename
}

function validateMp4Signature(signature: Uint8Array): void {
  if (signature.length < 16) {
    throw new ProjectIntakeError('INVALID_MP4', 'The file is too short to contain an MP4 file type box.')
  }
  const view = new DataView(signature.buffer, signature.byteOffset, signature.byteLength)
  const boxSize = view.getUint32(0)
  const boxType = new TextDecoder('ascii', { fatal: true }).decode(signature.subarray(4, 8))
  if (boxType !== 'ftyp' || boxSize < 16 || boxSize > MAX_FTYP_BYTES || boxSize % 4 !== 0 || signature.length < boxSize) {
    throw new ProjectIntakeError('INVALID_MP4', 'The file does not contain a bounded MP4 file type box.')
  }

  const brands: string[] = []
  brands.push(new TextDecoder('ascii').decode(signature.subarray(8, 12)))
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
    brands.push(new TextDecoder('ascii').decode(signature.subarray(offset, offset + 4)))
  }
  if (!brands.some((brand) => ALLOWED_MP4_BRANDS.has(brand))) {
    throw new ProjectIntakeError('INVALID_MP4', 'The file type box does not declare a supported MP4 brand.')
  }
}

function isCollision(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'PROJECT_COLLISION'
}

export function createProjectIntakeService(options: IntakeOptions) {
  if (!Number.isSafeInteger(options.maxUploadBytes) || options.maxUploadBytes <= 0) {
    throw new TypeError('maxUploadBytes must be a positive safe integer.')
  }
  const generateId = options.idGenerator ?? (() => `project_${randomBytes(16).toString('hex')}`)
  const now = options.now ?? (() => new Date())
  const collisionAttempts = options.collisionAttempts ?? 5

  return {
    async create(input: CreateProjectInput): Promise<ProjectManifest> {
      const originalFilename = decodeAndValidateFilename(input.filename)
      const contentType = (input.contentType ?? '').split(';', 1)[0].trim().toLowerCase()
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        throw new ProjectIntakeError('INVALID_CONTENT_TYPE', 'The declared content type conflicts with MP4 intake.')
      }
      if (!Number.isSafeInteger(input.contentLength) || (input.contentLength ?? 0) <= 0) {
        throw new ProjectIntakeError('INVALID_CONTENT_LENGTH', 'A positive Content-Length is required.')
      }
      const declaredLength = input.contentLength as number
      if (declaredLength > options.maxUploadBytes) {
        throw new ProjectIntakeError('UPLOAD_TOO_LARGE', 'The selected video exceeds the configured local intake limit.')
      }

      let stage: StagedSource | undefined
      let byteLength = 0
      const hash = createHash('sha256')
      const signatureParts: Uint8Array[] = []
      let signatureLength = 0
      const monitoredBody = async function* (): AsyncGenerator<Uint8Array> {
        try {
          for await (const rawChunk of input.body) {
            const chunk = rawChunk instanceof Uint8Array ? rawChunk : new Uint8Array(rawChunk)
            if (chunk.byteLength === 0) continue
            byteLength += chunk.byteLength
            if (byteLength > declaredLength || byteLength > options.maxUploadBytes) {
              throw new ProjectIntakeError('SIZE_MISMATCH', 'The upload contains more bytes than declared or allowed.')
            }
            hash.update(chunk)
            if (signatureLength < MAX_FTYP_BYTES) {
              const part = chunk.subarray(0, MAX_FTYP_BYTES - signatureLength)
              signatureParts.push(part)
              signatureLength += part.byteLength
            }
            yield chunk
          }
        } catch (error) {
          if (error instanceof ProjectIntakeError) throw error
          throw new ProjectIntakeError('UPLOAD_ABORTED', 'The upload stream ended unexpectedly.')
        }
      }

      for (let attempt = 0; attempt < collisionAttempts; attempt += 1) {
        const projectId = generateId()
        if (!PROJECT_ID_PATTERN.test(projectId)) {
          throw new TypeError('idGenerator returned an invalid opaque project ID.')
        }
        try {
          stage = await options.repository.stageSource({ projectId, body: monitoredBody() })
          break
        } catch (error) {
          if (isCollision(error) && attempt + 1 < collisionAttempts && byteLength === 0) continue
          if (error instanceof ProjectIntakeError) throw error
          if (isCollision(error)) throw new ProjectIntakeError('PROJECT_COLLISION', 'A unique project ID could not be allocated.')
          throw error
        }
      }
      if (!stage) throw new ProjectIntakeError('PROJECT_COLLISION', 'A unique project ID could not be allocated.')

      try {
        if (byteLength !== declaredLength || stage.byteLength !== declaredLength) {
          throw new ProjectIntakeError('SIZE_MISMATCH', 'The uploaded byte count does not match Content-Length.')
        }
        const signature = new Uint8Array(signatureLength)
        let offset = 0
        for (const part of signatureParts) {
          signature.set(part, offset)
          offset += part.byteLength
        }
        validateMp4Signature(signature)

        const manifest: ProjectManifest = Object.freeze({
          id: stage.projectId,
          originalFilename,
          createdAt: now().toISOString(),
          sizeBytes: byteLength,
          sha256: hash.digest('hex'),
          mediaUrl: `/api/projects/${stage.projectId}/media`,
        })
        await options.repository.publishProject(stage, manifest)
        return manifest
      } catch (error) {
        await options.repository.abortStage(stage).catch(() => undefined)
        throw error
      }
    },
  }
}

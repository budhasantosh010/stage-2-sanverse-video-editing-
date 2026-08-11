import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(appDir, '../..')
const reviewPath = resolve(repoRoot, 'motion/library-reviews/reviews.v1.json')
const posterPublicDir = resolve(repoRoot, 'motion/library-previews')
const REVIEW_ENDPOINT = '/__sanverse/library-reviews'
const MAX_REVIEW_BYTES = 512 * 1024
const REVIEW_STATUSES = new Set(['unreviewed','in-review','needs-polish','passed','rejected'])
const QUALITY_TIERS = new Set(['S','A','B','C','Experimental'])
const SCORE_KEYS = ['entrance','pacing','easing','rhythm','readability','hold','payoff','exit','competingMotion','footageCompatibility','professionalFeel','overall'] as const
const emptyDocument = '{\n  "schemaVersion": "sanverse.motion-library-reviews/v1",\n  "reviews": []\n}\n'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const validReviewDocumentShape = (input: unknown): boolean => {
  if (!isRecord(input) || input.schemaVersion !== 'sanverse.motion-library-reviews/v1' || !Array.isArray(input.reviews)) return false
  const identities = new Set<string>()
  for (const review of input.reviews) {
    if (!isRecord(review) || typeof review.componentId !== 'string' || !/^sanverse\.[a-z0-9-]+$/u.test(review.componentId) || typeof review.fixtureId !== 'string' || !review.fixtureId.trim()) return false
    if (!REVIEW_STATUSES.has(String(review.status)) || !QUALITY_TIERS.has(String(review.qualityTier)) || typeof review.fullPlaybackVerified !== 'boolean' || review.playbackSpeed !== 1 || !Array.isArray(review.notes) || review.notes.some((note) => typeof note !== 'string')) return false
    if (review.status === 'passed' && review.fullPlaybackVerified !== true) return false
    if (review.scores !== undefined) {
      if (!isRecord(review.scores)) return false
      for (const key of SCORE_KEYS) { const value = review.scores[key]; if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5) return false }
    }
    const identity = `${review.componentId}::${review.fixtureId}`
    if (identities.has(identity)) return false
    identities.add(identity)
  }
  return true
}

const reviewPersistencePlugin = () => ({
  name: 'sanverse-library-review-persistence',
  configureServer(server: { middlewares: { use: (handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split('?')[0]
      if (path !== REVIEW_ENDPOINT) return next()
      res.setHeader('cache-control', 'no-store')
      res.setHeader('content-type', 'application/json; charset=utf-8')
      if (req.method === 'GET') { void readFile(reviewPath, 'utf8').catch(() => emptyDocument).then((source) => { res.statusCode = 200; res.end(source) }); return }
      if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'method-not-allowed' })); return }
      let size = 0
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => { size += chunk.length; if (size > MAX_REVIEW_BYTES) req.destroy(new Error('review payload too large')); else chunks.push(chunk) })
      req.on('error', () => { if (!res.headersSent) { res.statusCode = 413; res.end(JSON.stringify({ error: 'review-payload-too-large' })) } })
      req.on('end', () => {
        if (size > MAX_REVIEW_BYTES || res.writableEnded) return
        let parsed: unknown
        try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'malformed-json' })); return }
        if (!validReviewDocumentShape(parsed)) { res.statusCode = 422; res.end(JSON.stringify({ error: 'invalid-review-document' })); return }
        const source = `${JSON.stringify(parsed, null, 2)}\n`
        const temporaryPath = `${reviewPath}.tmp`
        void mkdir(dirname(reviewPath), { recursive: true }).then(() => writeFile(temporaryPath, source, 'utf8')).then(() => rename(temporaryPath, reviewPath)).then(() => { res.statusCode = 200; res.end(JSON.stringify({ ok: true })) }).catch((error: unknown) => { res.statusCode = 500; res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'write-failed' })) })
      })
    })
  },
})

export default defineConfig({
  plugins: [react(), reviewPersistencePlugin()],
  publicDir: posterPublicDir,
  server: { host: '127.0.0.1', port: 2010, strictPort: true },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], exclude: ['**/node_modules/**', '**/dist/**'] },
})

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { requestBrowserReviewDecisionV1 } from './sanverse-mcp-browser-review.ts'

const bytes = new TextEncoder().encode('fake-png-bytes-for-browser-review')
const digest = createHash('sha256').update(bytes).digest('hex')

const request = Object.freeze({
  projectId: 'project_1234567890abcdef',
  runId: 'run_browser01',
  reviewId: 'review_browser01',
  decision: 'approve' as const,
  evidenceHash: 'a'.repeat(64),
  subjectId: 'subject_browser01',
  subjectRevision: 3,
  scope: 'storyboard',
  sceneId: 'creative_scene_browser01',
  artifacts: Object.freeze([
    Object.freeze({ artifactId: 'storyboard-opening.png', label: 'Opening frame', mimeType: 'image/png', sha256: digest }),
  ]),
})

describe('trusted local-browser Creative review fallback', () => {
  it('shows the exact evidence and resolves true only after the browser posts the one-time confirmation nonce', async () => {
    let artifactReads = 0
    const confirmed = await requestBrowserReviewDecisionV1(request, {
      timeoutMs: 5_000,
      readArtifactBytes: async (input) => {
        artifactReads += 1
        expect(input).toEqual({ projectId: request.projectId, runId: request.runId, reviewId: request.reviewId, artifactId: 'storyboard-opening.png' })
        return bytes
      },
      openBrowser: async (url) => {
        expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/sanverse-review\/[a-f0-9]{64}$/u)
        const page = await fetch(url)
        expect(page.status).toBe(200)
        const html = await page.text()
        expect(html).toContain('Sanverse owner review')
        expect(html).toContain('Confirm Approve')
        expect(html).toContain(request.reviewId)
        expect(html).toContain(request.evidenceHash)
        const nonce = /name="nonce" value="([a-f0-9]+)"/u.exec(html)?.[1]
        expect(nonce).toMatch(/^[a-f0-9]{48}$/u)
        const image = await fetch(`${url}/artifact/storyboard-opening.png`)
        expect(image.status).toBe(200)
        expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes)
        const response = await fetch(`${url}/confirm`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', origin: new URL(url).origin },
          body: new URLSearchParams({ nonce: nonce! }).toString(),
        })
        expect(response.status).toBe(200)
      },
    })
    expect(confirmed).toBe(true)
    expect(artifactReads).toBe(1)
  })

  it('fails closed on cancellation', async () => {
    const confirmed = await requestBrowserReviewDecisionV1(request, {
      timeoutMs: 5_000,
      readArtifactBytes: async () => bytes,
      openBrowser: async (url) => {
        const html = await (await fetch(url)).text()
        const nonce = /name="nonce" value="([a-f0-9]+)"/u.exec(html)?.[1]
        const response = await fetch(`${url}/cancel`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', origin: new URL(url).origin },
          body: new URLSearchParams({ nonce: nonce! }).toString(),
        })
        expect(response.status).toBe(200)
      },
    })
    expect(confirmed).toBe(false)
  })
})

import { createHash, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { SanverseBrowserReviewDecisionRequestV1 } from '@sanverse/motion-mcp'
import { readCreativeReviewArtifactV1 } from './sanverse-mcp-creative-run-store.ts'

const MAX_FORM_BYTES = 4096
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
const htmlEscape = (value: string): string => value.replace(/[&<>"']/gu, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!))

const noStoreHeaders = Object.freeze({
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
})

const readForm = async (request: IncomingMessage): Promise<URLSearchParams> => {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.byteLength
    if (bytes > MAX_FORM_BYTES) throw new Error('Browser review form exceeds the bounded request size.')
    chunks.push(buffer)
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
}

const openDefaultBrowser = async (url: string): Promise<void> => await new Promise((resolve, reject) => {
  const executable = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const child = spawn(executable, [url], { detached: true, stdio: 'ignore', windowsHide: true })
  child.once('error', reject)
  child.once('spawn', () => { child.unref(); resolve() })
})

const decisionLabel = (decision: SanverseBrowserReviewDecisionRequestV1['decision']): string => decision === 'approve' ? 'Approve' : decision === 'revise' ? 'Request revision' : 'Reject'

export const requestBrowserReviewDecisionV1 = async (
  input: SanverseBrowserReviewDecisionRequestV1,
  options: Readonly<{
    timeoutMs?: number
    openBrowser?: (url: string) => Promise<void>
    readArtifactBytes?: typeof readCreativeReviewArtifactV1
  }> = {},
): Promise<boolean> => {
  const token = randomBytes(32).toString('hex')
  const formNonce = randomBytes(24).toString('hex')
  const rootPath = `/sanverse-review/${token}`
  const artifactById = new Map(input.artifacts.map((artifact) => [artifact.artifactId, artifact] as const))
  const readArtifact = options.readArtifactBytes ?? readCreativeReviewArtifactV1
  const timeoutMs = Math.max(1_000, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS))
  let settled = false
  let resolveDecision!: (value: boolean) => void
  const decisionPromise = new Promise<boolean>((resolve) => { resolveDecision = resolve })

  const settle = (value: boolean): void => {
    if (settled) return
    settled = true
    resolveDecision(value)
  }

  const server = createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? ''
      if (!/^127\.0\.0\.1:\d+$/u.test(host)) { response.writeHead(403, noStoreHeaders); response.end('Forbidden'); return }
      const requestUrl = new URL(request.url ?? '/', `http://${host}`)
      if (!requestUrl.pathname.startsWith(rootPath)) { response.writeHead(404, noStoreHeaders); response.end('Not found'); return }

      if (request.method === 'GET' && requestUrl.pathname === rootPath) {
        const frames = input.artifacts.filter((artifact) => artifact.mimeType?.startsWith('image/')).map((artifact) => {
          const src = `${rootPath}/artifact/${encodeURIComponent(artifact.artifactId)}`
          return `<figure><img src="${htmlEscape(src)}" alt="${htmlEscape(artifact.label ?? artifact.artifactId)}"><figcaption>${htmlEscape(artifact.label ?? artifact.artifactId)}</figcaption></figure>`
        }).join('')
        const note = input.revisionNote ? `<p><strong>Revision note:</strong> ${htmlEscape(input.revisionNote)}</p>` : ''
        const body = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sanverse review confirmation</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;background:#111;color:#eee}h1{margin-bottom:8px}.meta{color:#bbb;word-break:break-word}.frames{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:24px 0}figure{margin:0;background:#1b1b1b;padding:10px;border-radius:10px}img{display:block;width:100%;height:auto;border-radius:6px}figcaption{padding-top:8px;color:#ccc}form{display:inline-block;margin-right:10px}button{font:inherit;padding:10px 16px;border-radius:8px;border:1px solid #777;cursor:pointer}.confirm{font-weight:700}</style></head><body><h1>Sanverse owner review</h1><p>Review the exact evidence below before confirming <strong>${htmlEscape(decisionLabel(input.decision))}</strong>.</p><p class="meta">Review ${htmlEscape(input.reviewId)} · Evidence ${htmlEscape(input.evidenceHash)} · Subject revision ${input.subjectRevision}</p>${note}<div class="frames">${frames || '<p>No image evidence is available for this review.</p>'}</div><form method="post" action="${rootPath}/confirm"><input type="hidden" name="nonce" value="${formNonce}"><button class="confirm" type="submit">Confirm ${htmlEscape(decisionLabel(input.decision))}</button></form><form method="post" action="${rootPath}/cancel"><input type="hidden" name="nonce" value="${formNonce}"><button type="submit">Cancel</button></form></body></html>`
        response.writeHead(200, { ...noStoreHeaders, 'content-type':'text/html; charset=utf-8', 'content-security-policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" })
        response.end(body)
        return
      }

      const artifactPrefix = `${rootPath}/artifact/`
      if (request.method === 'GET' && requestUrl.pathname.startsWith(artifactPrefix)) {
        const artifactId = decodeURIComponent(requestUrl.pathname.slice(artifactPrefix.length))
        const artifact = artifactById.get(artifactId)
        if (!artifact || !artifact.mimeType?.startsWith('image/') || !artifact.sha256) { response.writeHead(404, noStoreHeaders); response.end('Not found'); return }
        const bytes = await readArtifact({ projectId: input.projectId, runId: input.runId, reviewId: input.reviewId, artifactId })
        if (sha256(bytes) !== artifact.sha256) { response.writeHead(409, noStoreHeaders); response.end('Review artifact hash mismatch'); return }
        response.writeHead(200, { ...noStoreHeaders, 'content-type': artifact.mimeType, 'content-length': String(bytes.byteLength) })
        response.end(Buffer.from(bytes))
        return
      }

      if (request.method === 'POST' && (requestUrl.pathname === `${rootPath}/confirm` || requestUrl.pathname === `${rootPath}/cancel`)) {
        const expectedOrigin = `http://${host}`
        if (request.headers.origin && request.headers.origin !== expectedOrigin) { response.writeHead(403, noStoreHeaders); response.end('Forbidden'); return }
        const form = await readForm(request)
        if (form.get('nonce') !== formNonce) { response.writeHead(403, noStoreHeaders); response.end('Forbidden'); return }
        const confirmed = requestUrl.pathname.endsWith('/confirm')
        response.writeHead(200, { ...noStoreHeaders, 'content-type':'text/html; charset=utf-8', 'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" })
        response.end(`<!doctype html><html><body style="font-family:system-ui;background:#111;color:#eee;padding:40px"><h1>${confirmed ? 'Decision confirmed' : 'Decision cancelled'}</h1><p>You can close this tab and return to your coding agent.</p></body></html>`)
        settle(confirmed)
        return
      }

      response.writeHead(405, noStoreHeaders); response.end('Method not allowed')
    } catch {
      response.writeHead(500, noStoreHeaders); response.end('Browser review failed safely')
    }
  })

  await new Promise<void>((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  const address = server.address()
  if (!address || typeof address === 'string') { await new Promise<void>((resolve) => server.close(() => resolve())); throw new Error('Could not bind trusted local browser review server.') }
  const reviewUrl = `http://127.0.0.1:${address.port}${rootPath}`
  const timeout = setTimeout(() => settle(false), timeoutMs)
  timeout.unref?.()
  try {
    await (options.openBrowser ?? openDefaultBrowser)(reviewUrl)
    return await decisionPromise
  } finally {
    clearTimeout(timeout)
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

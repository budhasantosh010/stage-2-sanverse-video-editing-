import { describe, expect, it, vi } from 'vitest'

import { TEST_PROJECT_ID, testChangeSet } from '../../test-fixtures'
import { CONVERSATION_ERROR, requestIntent } from './conversation-client'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const send = (fetcher: typeof fetch) =>
  requestIntent(
    TEST_PROJECT_ID,
    {
      message: 'add my name here',
      baseRevision: 0,
      context: {
        clipId: 'clip_aaaaaaaa',
        sampledClipTimeTicks: null,
        point: { x: 0.4, y: 0.7 },
        playheadTicks: 0,
        compositionDurationTicks: 30_000 * 1_440,
        compositionWidth: 1920,
        compositionHeight: 1080,
      },
    },
    fetcher,
  )

const aiChangeSet = () => ({
  ...testChangeSet(0),
  provenance: { source: 'ai' as const, requestId: 'request_aaaaaaaa' },
})

describe('requestIntent', () => {
  it('returns a validated proposal', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        outcome: {
          kind: 'proposal',
          requestId: 'request_aaaaaaaa',
          changeSet: aiChangeSet(),
          explanation: 'Shows “Santosh” from 0:01.0 for 5.0 seconds.',
          note: null,
        },
      }),
    ) as unknown as typeof fetch

    const outcome = await send(fetcher)
    expect(outcome.kind).toBe('proposal')
    if (outcome.kind === 'proposal') {
      expect(outcome.operation.primaryText).toBe('Santosh')
      expect(outcome.explanation).toContain('Santosh')
    }
  })

  it('refuses a proposal whose change set does not survive the domain validator', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        outcome: {
          kind: 'proposal',
          requestId: 'request_aaaaaaaa',
          changeSet: { ...aiChangeSet(), operations: [{ kind: 'run-shell', command: 'rm -rf /' }] },
          explanation: 'ok',
          note: null,
        },
      }),
    ) as unknown as typeof fetch

    await expect(send(fetcher)).rejects.toThrow(CONVERSATION_ERROR)
  })

  it('refuses a proposal that claims to be a hand-made edit', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        outcome: {
          kind: 'proposal',
          requestId: 'request_aaaaaaaa',
          changeSet: testChangeSet(0),
          explanation: 'ok',
          note: null,
        },
      }),
    ) as unknown as typeof fetch

    await expect(send(fetcher)).rejects.toThrow(CONVERSATION_ERROR)
  })

  it('passes a clarification through', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        outcome: {
          kind: 'clarification',
          requestId: 'request_aaaaaaaa',
          field: 'primary-text',
          question: 'What should the text say?',
        },
      }),
    ) as unknown as typeof fetch

    const outcome = await send(fetcher)
    expect(outcome).toMatchObject({ kind: 'clarification', field: 'primary-text' })
  })

  it('passes a rejection through with its plain-language message', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        outcome: {
          kind: 'rejected',
          requestId: 'request_aaaaaaaa',
          code: 'STALE_REVISION',
          message: 'Your video changed while that was being prepared.',
        },
      }),
    ) as unknown as typeof fetch

    const outcome = await send(fetcher)
    expect(outcome).toMatchObject({ kind: 'rejected', code: 'STALE_REVISION' })
  })

  it('reports a transport failure without inventing an outcome', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: 'boom' }, 500)) as unknown as typeof fetch
    await expect(send(fetcher)).rejects.toThrow(CONVERSATION_ERROR)
  })

  it('refuses an outcome kind it does not recognise', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ outcome: { kind: 'applied', requestId: 'request_aaaaaaaa' } }),
    ) as unknown as typeof fetch
    await expect(send(fetcher)).rejects.toThrow(CONVERSATION_ERROR)
  })
})

import { describe, expect, it } from 'vitest'

import {
  createIntentProvider,
  describeIntentProvider,
  ProviderConfigError,
  resolveChatCompletionsEndpoint,
  resolveIntentProviderConfig,
} from './intent-provider-config.ts'

const real = (overrides: Record<string, string | undefined> = {}) => ({
  SANVERSE_AI_PROVIDER: 'openai-compatible',
  SANVERSE_AI_BASE_URL: 'http://127.0.0.1:4000/v1',
  SANVERSE_AI_MODEL: 'meta/llama-3.1-70b-instruct',
  ...overrides,
})

describe('resolveIntentProviderConfig', () => {
  it('defaults to the fake when nothing is configured', () => {
    expect(resolveIntentProviderConfig({})).toEqual({ kind: 'fake' })
  })

  it('treats an empty provider name as unset rather than invalid', () => {
    expect(resolveIntentProviderConfig({ SANVERSE_AI_PROVIDER: '   ' })).toEqual({ kind: 'fake' })
  })

  it('refuses an unknown provider name instead of falling back to the fake', () => {
    expect(() => resolveIntentProviderConfig({ SANVERSE_AI_PROVIDER: 'nvidia' })).toThrow(ProviderConfigError)
  })

  it('resolves a complete configuration', () => {
    const config = resolveIntentProviderConfig(real({ SANVERSE_AI_API_KEY: 'sk-test', SANVERSE_AI_LABEL: 'nvidia-via-litellm' }))
    expect(config).toEqual({
      kind: 'openai-compatible',
      label: 'nvidia-via-litellm',
      endpoint: 'http://127.0.0.1:4000/v1/chat/completions',
      apiKey: 'sk-test',
      model: 'meta/llama-3.1-70b-instruct',
    })
  })

  it('labels with the host when no label is given', () => {
    const config = resolveIntentProviderConfig(real())
    expect(config.kind === 'openai-compatible' && config.label).toBe('127.0.0.1:4000')
  })

  it('treats a blank API key as absent, because LM Studio needs none', () => {
    const config = resolveIntentProviderConfig(real({ SANVERSE_AI_API_KEY: '  ' }))
    expect(config.kind === 'openai-compatible' && config.apiKey).toBeNull()
  })

  it('refuses a missing base URL', () => {
    expect(() => resolveIntentProviderConfig(real({ SANVERSE_AI_BASE_URL: undefined }))).toThrow(/BASE_URL is required/)
  })

  it('refuses a missing model', () => {
    expect(() => resolveIntentProviderConfig(real({ SANVERSE_AI_MODEL: undefined }))).toThrow(/MODEL is required/)
  })
})

describe('resolveChatCompletionsEndpoint', () => {
  it('appends the chat-completions path to a base URL', () => {
    expect(resolveChatCompletionsEndpoint('https://openrouter.ai/api/v1')).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('does not double the path when the full endpoint is pasted', () => {
    expect(resolveChatCompletionsEndpoint('https://openrouter.ai/api/v1/chat/completions')).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    )
  })

  it('tolerates a trailing slash', () => {
    expect(resolveChatCompletionsEndpoint('http://localhost:1234/v1/')).toBe('http://localhost:1234/v1/chat/completions')
  })

  it('allows plain http to this machine, where nothing crosses a network', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      expect(resolveChatCompletionsEndpoint(`http://${host}:4000/v1`)).toContain('/chat/completions')
    }
  })

  it('refuses plain http to anywhere else, which would send the typed sentence in the clear', () => {
    expect(() => resolveChatCompletionsEndpoint('http://openrouter.ai/api/v1')).toThrow(/plain http/)
  })

  it('refuses a non-http protocol', () => {
    expect(() => resolveChatCompletionsEndpoint('file:///etc/passwd')).toThrow(/http or https/)
  })

  it('refuses an unparseable URL', () => {
    expect(() => resolveChatCompletionsEndpoint('not a url')).toThrow(/not a valid URL/)
  })

  it('refuses a query string, which would smuggle configuration into the path', () => {
    expect(() => resolveChatCompletionsEndpoint('https://example.com/v1?key=leak')).toThrow(/query string/)
  })
})

describe('createIntentProvider', () => {
  it('builds the fake for the fake configuration', () => {
    expect(createIntentProvider({ kind: 'fake' }).name).toBe('fake')
  })

  it('builds one adapter for a real configuration, named for diagnostics', () => {
    const provider = createIntentProvider(resolveIntentProviderConfig(real({ SANVERSE_AI_LABEL: 'nvidia' })))
    expect(provider.name).toBe('openai-compatible:nvidia')
  })
})

describe('describeIntentProvider', () => {
  it('says plainly that the fake keeps everything local', () => {
    expect(describeIntentProvider({ kind: 'fake' })).toMatch(/Nothing leaves this machine/)
  })

  it('never prints the API key', () => {
    const config = resolveIntentProviderConfig(real({ SANVERSE_AI_API_KEY: 'sk-secret-value' }))
    const described = describeIntentProvider(config)
    expect(described).not.toContain('sk-secret-value')
    expect(described).toContain('meta/llama-3.1-70b-instruct')
  })
})

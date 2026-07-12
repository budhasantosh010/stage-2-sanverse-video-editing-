// @vitest-environment node

import { describe, expect, it } from 'vitest'

import config from './vite.config'

describe('development server contract', () => {
  it('binds to the reserved local address and fails when port 2000 is occupied', () => {
    expect(config).toMatchObject({
      server: {
        host: '127.0.0.1',
        port: 2000,
        strictPort: true,
      },
    })
  })
})

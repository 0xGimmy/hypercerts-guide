import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: { PUBLIC_API_URL: 'http://test-api' } } })

describe('api client', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('constructs correct URL for getTransactions with wallet param', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })

    // Import fresh each time to use mocked fetch
    const { api } = await import('../lib/api')
    await api.getTransactions('0xabc')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/transactions?wallet=0xabc'),
    )
  })

  it('constructs URL without params when none provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const { api } = await import('../lib/api')
    await api.getTransactions()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/transactions'),
    )
  })
})

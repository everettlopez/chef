import { describe, expect, it } from 'vitest'
import { authKeys } from './api/auth'
import { ApiError } from './api/client'
import { createQueryClient } from './queryClient'

const user = { id: 1, email: 'a@b.co', display_name: 'A' }

function failingQuery(status: number) {
  return {
    queryKey: ['x', status],
    queryFn: () => Promise.reject(new ApiError(status, null)),
    retry: false,
  }
}

describe('createQueryClient', () => {
  it('signs out when a query gets a 401', async () => {
    const client = createQueryClient()
    client.setQueryData(authKeys.me, user)

    await client.fetchQuery(failingQuery(401)).catch(() => {})

    expect(client.getQueryData(authKeys.me)).toBeNull()
  })

  it('signs out when a mutation gets a 401', async () => {
    const client = createQueryClient()
    client.setQueryData(authKeys.me, user)

    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(new ApiError(401, null)) })
      .execute(undefined)
      .catch(() => {})

    expect(client.getQueryData(authKeys.me)).toBeNull()
  })

  it('keeps the session on other errors', async () => {
    const client = createQueryClient()
    client.setQueryData(authKeys.me, user)

    await client.fetchQuery(failingQuery(404)).catch(() => {})

    expect(client.getQueryData(authKeys.me)).toEqual(user)
  })

  it('retries server and network errors once, never client errors', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as (
      failures: number,
      error: Error,
    ) => boolean

    expect(retry(0, new ApiError(500, null))).toBe(true)
    expect(retry(1, new ApiError(500, null))).toBe(false)
    expect(retry(0, new TypeError('Failed to fetch'))).toBe(true)
    expect(retry(0, new ApiError(404, null))).toBe(false)
    expect(retry(0, new ApiError(401, null))).toBe(false)
  })
})

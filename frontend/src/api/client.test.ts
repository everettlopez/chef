import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, server } from '../test/server'
import { ApiError, apiFetch, errorMessage } from './client'

describe('apiFetch', () => {
  it('prefixes the base URL and sends JSON with the session cookie', async () => {
    let seen: Request | undefined
    server.use(
      http.post(`${API}/echo`, async ({ request }) => {
        seen = request
        return HttpResponse.json(await request.json())
      }),
    )

    const result = await apiFetch<{ a: number }>('/echo', {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
      headers: { 'X-Extra': 'yes' },
    })

    expect(result).toEqual({ a: 1 })
    expect(seen?.headers.get('content-type')).toBe('application/json')
    expect(seen?.headers.get('x-extra')).toBe('yes')
    expect(seen?.credentials).toBe('same-origin')
  })

  it('returns null for 204 No Content', async () => {
    server.use(http.delete(`${API}/thing`, () => new HttpResponse(null, { status: 204 })))
    await expect(apiFetch('/thing', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('throws ApiError with the status and body on failure', async () => {
    server.use(
      http.get(`${API}/gone`, () => HttpResponse.json({ detail: 'Gone' }, { status: 404 })),
    )

    const error = await apiFetch('/gone').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, detail: { detail: 'Gone' } })
  })

  it('tolerates a non-JSON error body', async () => {
    server.use(http.get(`${API}/broken`, () => new HttpResponse('oops', { status: 502 })))
    await expect(apiFetch('/broken')).rejects.toMatchObject({ status: 502, detail: null })
  })
})

describe('errorMessage', () => {
  it('uses a string detail', () => {
    expect(errorMessage(new ApiError(409, { detail: 'Already exists' }))).toBe('Already exists')
  })

  it('uses the first validation message without the pydantic prefix', () => {
    const error = new ApiError(422, {
      detail: [{ msg: 'Value error, Provide ingredient_id or name' }, { msg: 'second' }],
    })
    expect(errorMessage(error)).toBe('Provide ingredient_id or name')
  })

  it.each([
    new ApiError(500, null),
    new ApiError(422, { detail: [] }),
    new TypeError('Failed to fetch'),
    'nope',
  ])('falls back for %o', (error) => {
    expect(errorMessage(error)).toBe('Something went wrong. Try again.')
    expect(errorMessage(error, 'Custom')).toBe('Custom')
  })
})

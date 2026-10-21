const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown) {
    super(`Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(response.status, body)
  }
  return body as T
}

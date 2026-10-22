import { ApiError, apiFetch } from './client'

// Mirrors backend/app/schemas/auth.py
export interface User {
  id: number
  email: string
  display_name: string
}

export interface SignupRequest {
  email: string
  password: string
  display_name: string
}

export interface LoginRequest {
  email: string
  password: string
}

export const authKeys = {
  me: ['auth', 'me'] as const,
}

/** The signed-in user, or null when there is no valid session. */
export async function getMe(): Promise<User | null> {
  try {
    return await apiFetch<User>('/auth/me')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export function signup(data: SignupRequest): Promise<User> {
  return apiFetch<User>('/auth/signup', { method: 'POST', body: JSON.stringify(data) })
}

export function login(data: LoginRequest): Promise<User> {
  return apiFetch<User>('/auth/login', { method: 'POST', body: JSON.stringify(data) })
}

export function logout(): Promise<null> {
  return apiFetch<null>('/auth/logout', { method: 'POST' })
}

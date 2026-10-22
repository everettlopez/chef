import { apiFetch } from './client'

// Mirrors backend/app/schemas/household.py
export interface Member {
  user_id: number
  display_name: string
  email: string
  role: string
}

export interface Household {
  id: number
  name: string
  invite_code: string
  members: Member[]
}

export const householdKeys = {
  all: ['household'] as const,
}

export function getHousehold(): Promise<Household> {
  return apiFetch<Household>('/household')
}

export function renameHousehold(name: string): Promise<Household> {
  return apiFetch<Household>('/household', { method: 'PATCH', body: JSON.stringify({ name }) })
}

export function regenerateInviteCode(): Promise<Household> {
  return apiFetch<Household>('/household/invite-code', { method: 'POST' })
}

export function joinHousehold(invite_code: string): Promise<Household> {
  return apiFetch<Household>('/household/join', {
    method: 'POST',
    body: JSON.stringify({ invite_code }),
  })
}

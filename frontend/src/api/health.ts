import { apiFetch } from './client'

export interface HealthStatus {
  status: string
  database: string
}

export const healthKeys = {
  all: ['health'] as const,
}

export function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health')
}

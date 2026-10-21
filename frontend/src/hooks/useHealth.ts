import { useQuery } from '@tanstack/react-query'
import { getHealth, healthKeys } from '../api/health'

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: getHealth,
    retry: false,
  })
}

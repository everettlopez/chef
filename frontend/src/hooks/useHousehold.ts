import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getHousehold,
  householdKeys,
  joinHousehold,
  regenerateInviteCode,
  renameHousehold,
} from '../api/household'

export function useHousehold() {
  return useQuery({
    queryKey: householdKeys.all,
    queryFn: getHousehold,
  })
}

export function useRenameHousehold() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: renameHousehold,
    onSuccess: (household) => queryClient.setQueryData(householdKeys.all, household),
  })
}

export function useRegenerateInviteCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: regenerateInviteCode,
    onSuccess: (household) => queryClient.setQueryData(householdKeys.all, household),
  })
}

export function useJoinHousehold() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: joinHousehold,
    // A different household means a different pantry, history and suggestions.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

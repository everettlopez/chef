import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cookLogKeys, listCookLogs, logCook, undoCookLog } from '../api/cookLogs'
import { pantryKeys } from '../api/pantry'
import { recipeKeys } from '../api/recipes'

export function useCookLogs() {
  return useQuery({
    queryKey: cookLogKeys.all,
    queryFn: listCookLogs,
  })
}

function useInvalidateAfterCooking() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: cookLogKeys.all }),
      queryClient.invalidateQueries({ queryKey: pantryKeys.all }),
      queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
    ])
}

export function useLogCook() {
  const invalidate = useInvalidateAfterCooking()

  return useMutation({
    mutationFn: logCook,
    onSuccess: invalidate,
  })
}

export function useUndoCookLog() {
  const invalidate = useInvalidateAfterCooking()

  return useMutation({
    mutationFn: undoCookLog,
    onSuccess: invalidate,
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPantryItem, listPantryItems, pantryItemKeys } from '../api/pantryItems'

export function usePantryItems() {
  return useQuery({
    queryKey: pantryItemKeys.all,
    queryFn: listPantryItems,
  })
}

export function useCreatePantryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPantryItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pantryItemKeys.all }),
  })
}

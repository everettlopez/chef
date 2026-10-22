import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPantryItem,
  discardPantryItem,
  ingredientKeys,
  listPantryItems,
  pantryKeys,
  searchIngredients,
  updatePantryItem,
  type PantryItemUpdate,
} from '../api/pantry'
import { recipeKeys } from '../api/recipes'

export function usePantryItems() {
  return useQuery({
    queryKey: pantryKeys.all,
    queryFn: listPantryItems,
  })
}

function useInvalidatePantry() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: pantryKeys.all }),
      // Coverage and "in pantry" marks depend on the pantry.
      queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
    ])
}

export function useCreatePantryItem() {
  const invalidate = useInvalidatePantry()

  return useMutation({
    mutationFn: createPantryItem,
    onSuccess: invalidate,
  })
}

export function useUpdatePantryItem() {
  const invalidate = useInvalidatePantry()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PantryItemUpdate }) =>
      updatePantryItem(id, data),
    onSuccess: invalidate,
  })
}

export function useDiscardPantryItem() {
  const invalidate = useInvalidatePantry()

  return useMutation({
    mutationFn: discardPantryItem,
    onSuccess: invalidate,
  })
}

export function useIngredientSearch(q: string) {
  const trimmed = q.trim()
  return useQuery({
    queryKey: ingredientKeys.search(trimmed.toLowerCase()),
    queryFn: () => searchIngredients(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })
}

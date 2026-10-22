import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  dietKeys,
  getDietPrefs,
  getRecipe,
  getRecommendations,
  listDietaryTags,
  listRecipes,
  recipeKeys,
  setDietPrefs,
  type DietPref,
  type RecipeFilters,
  type Tag,
} from '../api/recipes'

export function useRecipes(filters: RecipeFilters) {
  return useQuery({
    queryKey: recipeKeys.list(filters),
    queryFn: () => listRecipes(filters),
    placeholderData: keepPreviousData,
  })
}

export function useRecipe(id: number) {
  return useQuery({
    queryKey: recipeKeys.detail(id),
    queryFn: () => getRecipe(id),
    enabled: Number.isFinite(id),
  })
}

export function useRecommendations(maxMissing: number | null) {
  return useQuery({
    queryKey: recipeKeys.recommendations(maxMissing),
    queryFn: () => getRecommendations(maxMissing),
    placeholderData: keepPreviousData,
  })
}

export function useDietaryTags() {
  return useQuery({
    queryKey: dietKeys.tags,
    queryFn: listDietaryTags,
    staleTime: Infinity,
  })
}

export function useDietPrefs() {
  return useQuery({
    queryKey: dietKeys.prefs,
    queryFn: getDietPrefs,
  })
}

export function useSetDietPrefs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setDietPrefs,
    // Optimistic, so quick successive toggles each build on the one before.
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: dietKeys.prefs })
      const previous = queryClient.getQueryData<DietPref[]>(dietKeys.prefs)
      const tags = queryClient.getQueryData<Tag[]>(dietKeys.tags) ?? []
      queryClient.setQueryData<DietPref[]>(
        dietKeys.prefs,
        next.flatMap(({ tag_id, mode }) => {
          const tag = tags.find((t) => t.id === tag_id)
          return tag ? [{ tag, mode }] : []
        }),
      )
      return { previous }
    },
    onError: (_error, _next, context) => {
      queryClient.setQueryData(dietKeys.prefs, context?.previous)
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: dietKeys.prefs }),
        queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
      ]),
  })
}

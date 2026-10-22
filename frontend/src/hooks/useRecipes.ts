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

/** Diet tags are "require" (only show matches); allergen tags are "avoid" (hide matches). */
function modeFor(tag: Tag): DietPref['mode'] {
  return tag.kind === 'allergen' ? 'avoid' : 'require'
}

/**
 * Turn one preference on or off. Each toggle updates the cached list right away; the
 * PUTs run one at a time (scope) and each sends the cache as it is when the PUT starts,
 * so the last one always carries every toggle, however fast they come.
 */
export function useToggleDietPref() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: dietKeys.prefs,
    scope: { id: 'diet-prefs' },
    mutationFn: () =>
      setDietPrefs(
        (queryClient.getQueryData<DietPref[]>(dietKeys.prefs) ?? []).map((p) => ({
          tag_id: p.tag.id,
          mode: p.mode,
        })),
      ),
    onMutate: async ({ tag, on }: { tag: Tag; on: boolean }) => {
      await queryClient.cancelQueries({ queryKey: dietKeys.prefs })
      queryClient.setQueryData<DietPref[]>(dietKeys.prefs, (prefs = []) => {
        const others = prefs.filter((p) => p.tag.id !== tag.id)
        return on ? [...others, { tag, mode: modeFor(tag) }] : others
      })
    },
    // On failure, the refetch in onSettled restores what the server actually has.
    onSettled: () => {
      // Refetch once the last queued toggle lands, so an early refetch can't flip a
      // switch back while later saves are still pending. (This one still counts.)
      if (queryClient.isMutating({ mutationKey: dietKeys.prefs }) > 1) return
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: dietKeys.prefs }),
        queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
      ])
    },
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authKeys, getMe, login, logout, signup } from '../api/auth'

export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: getMe,
    staleTime: 5 * 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      // Start the new session from a clean cache.
      queryClient.clear()
      queryClient.setQueryData(authKeys.me, user)
    },
  })
}

export function useSignup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: signup,
    onSuccess: (user) => {
      queryClient.clear()
      queryClient.setQueryData(authKeys.me, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData(authKeys.me, null)
    },
  })
}

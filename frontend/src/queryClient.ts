import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { authKeys } from './api/auth'
import { ApiError } from './api/client'

export function createQueryClient(): QueryClient {
  /** A 401 anywhere means the session is gone; RequireAuth then sends the user to sign in. */
  function signOutOnUnauthorized(error: Error) {
    if (error instanceof ApiError && error.status === 401) {
      queryClient.setQueryData(authKeys.me, null)
    }
  }

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: signOutOnUnauthorized }),
    mutationCache: new MutationCache({ onError: signOutOnUnauthorized }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client errors (401, 404, ...) won't succeed on a retry.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 1,
      },
    },
  })
  return queryClient
}

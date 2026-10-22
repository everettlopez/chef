import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from 'react-router/dom'
import { authKeys } from './api/auth'
import { ApiError } from './api/client'
import { ToastProvider } from './components/ui/Toast'
import { router } from './router'
import './index.css'

/** A 401 anywhere means the session is gone; RequireAuth then sends the user to sign in. */
function signOutOnUnauthorized(error: Error) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(authKeys.me, null)
  }
}

const queryClient = new QueryClient({
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
      {/* Dev-only; kept off phone widths so it never covers the tab bar. */}
      {window.matchMedia('(min-width: 768px)').matches && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  </StrictMode>,
)

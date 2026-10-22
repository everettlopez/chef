import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '../components/ui/Toast'
import { createQueryClient } from '../queryClient'
import { routes } from '../router'

/** The app's real query client, minus retries so failures show up right away. */
export function testQueryClient(): QueryClient {
  const client = createQueryClient()
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retry: false },
  })
  return client
}

export function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}

/** Render the whole app (real routes, providers and query client) at `route`. */
export function renderApp(route = '/') {
  const client = testQueryClient()
  const router = createMemoryRouter(routes, { initialEntries: [route] })
  const user = userEvent.setup()
  const result = render(
    <Providers client={client}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return { ...result, user, router, client }
}

/** Render a single component with providers, inside a router (for Links). */
export function renderWithProviders(ui: ReactElement) {
  const client = testQueryClient()
  const router = createMemoryRouter([{ path: '*', element: ui }])
  const user = userEvent.setup()
  const result = render(
    <Providers client={client}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return { ...result, user, client }
}

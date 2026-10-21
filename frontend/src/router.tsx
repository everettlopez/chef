import { createBrowserRouter } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { HomePage } from './pages/HomePage'
import { PantryPage } from './pages/PantryPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'pantry', element: <PantryPage /> },
    ],
  },
])

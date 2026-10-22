import { createBrowserRouter } from 'react-router'
import { RequireAuth } from './components/AppLayout'
import { HistoryPage } from './pages/HistoryPage'
import { HouseholdPage } from './pages/HouseholdPage'
import { LoginPage, SignupPage } from './pages/AuthPages'
import { NotFoundPage } from './pages/NotFoundPage'
import { PantryPage } from './pages/PantryPage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { RecipesPage } from './pages/RecipesPage'
import { SettingsPage } from './pages/SettingsPage'
import { WhatCanIMakePage } from './pages/WhatCanIMakePage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      { index: true, element: <WhatCanIMakePage /> },
      { path: 'pantry', element: <PantryPage /> },
      { path: 'recipes', element: <RecipesPage /> },
      { path: 'recipes/:recipeId', element: <RecipeDetailPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'household', element: <HouseholdPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

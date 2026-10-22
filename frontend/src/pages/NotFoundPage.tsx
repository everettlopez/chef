import { Compass } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Feedback'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Page not found"
      message="That page doesn't exist. Let's get you back to the kitchen."
      action={<ButtonLink to="/">Go home</ButtonLink>}
    />
  )
}

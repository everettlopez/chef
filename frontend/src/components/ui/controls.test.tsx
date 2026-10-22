import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Badge } from './Badge'
import { Button, ButtonLink, IconButton } from './Button'
import { EmptyState, ErrorBanner, ListSkeleton, PageHeader } from './Feedback'
import { List, ListRow } from './List'
import { ProgressBar } from './ProgressBar'
import { SearchField } from './SearchField'
import { SegmentedControl } from './SegmentedControl'
import { Switch } from './Switch'
import { TextField } from './TextField'

function inRouter(ui: React.ReactElement) {
  return render(<RouterProvider router={createMemoryRouter([{ path: '*', element: ui }])} />)
}

describe('Button', () => {
  it('is a non-submitting button by default and fires onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    await userEvent.click(button)

    expect(button).toHaveAttribute('type', 'button')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does nothing when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('keeps the 44 pt hit target at every size', () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
      </>,
    )
    for (const name of ['Small', 'Medium'])
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-11')
  })

  it('IconButton exposes its label as the accessible name', () => {
    render(
      <IconButton label="Close">
        <svg aria-hidden />
      </IconButton>,
    )
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('size-11')
  })

  it('ButtonLink renders a link', () => {
    inRouter(<ButtonLink to="/pantry">Stock your pantry</ButtonLink>)
    expect(screen.getByRole('link', { name: 'Stock your pantry' })).toHaveAttribute(
      'href',
      '/pantry',
    )
  })
})

describe('SegmentedControl', () => {
  function Storage() {
    const [value, setValue] = useState<'pantry' | 'fridge' | 'freezer'>('pantry')
    return (
      <SegmentedControl
        label="Stored in"
        value={value}
        onChange={setValue}
        options={[
          { value: 'pantry', label: 'Pantry' },
          { value: 'fridge', label: 'Fridge' },
          { value: 'freezer', label: 'Freezer' },
        ]}
      />
    )
  }

  it('is a radio group with the selection checked', async () => {
    render(<Storage />)
    expect(screen.getByRole('radiogroup', { name: 'Stored in' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Pantry' })).toBeChecked()

    await userEvent.click(screen.getByRole('radio', { name: 'Freezer' }))

    expect(screen.getByRole('radio', { name: 'Freezer' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Pantry' })).not.toBeChecked()
  })

  it('moves with arrow keys, wraps around and keeps one tab stop', async () => {
    const user = userEvent.setup()
    render(<Storage />)
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Pantry' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Fridge' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Fridge' })).toHaveFocus()

    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Freezer' })).toBeChecked()

    const tabStops = screen.getAllByRole('radio').filter((r) => r.tabIndex === 0)
    expect(tabStops).toHaveLength(1)
  })
})

describe('Switch', () => {
  it('toggles and reports its state', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<Switch label="Vegan" checked={false} onChange={onChange} />)

    const toggle = screen.getByRole('switch', { name: 'Vegan' })
    expect(toggle).not.toBeChecked()
    await userEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)

    rerender(<Switch label="Vegan" checked onChange={onChange} />)
    expect(toggle).toBeChecked()
    await userEvent.click(toggle)
    expect(onChange).toHaveBeenLastCalledWith(false)
  })
})

describe('SearchField', () => {
  it('clears with the clear button, which only shows with text', async () => {
    function Search() {
      const [value, setValue] = useState('')
      return <SearchField label="Search recipes" value={value} onChange={setValue} />
    }
    render(<Search />)
    const input = screen.getByRole('searchbox', { name: 'Search recipes' })
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()

    await userEvent.type(input, 'taco')
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(input).toHaveValue('')
  })
})

describe('TextField', () => {
  it('links the label, hint and error to the input', () => {
    const { rerender } = render(<TextField label="Password" hint="At least 8 characters." />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAccessibleDescription('At least 8 characters.')
    expect(input).not.toHaveAttribute('aria-invalid')

    rerender(<TextField label="Password" hint="At least 8" error="Too short" />)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Too short')
  })

  it('can hide the label visually but keep it for screen readers', () => {
    render(<TextField label="Quantity" hideLabel />)
    expect(screen.getByText('Quantity')).toHaveClass('sr-only')
    expect(screen.getByLabelText('Quantity')).toBeInTheDocument()
  })
})

describe('ProgressBar', () => {
  it.each([
    [0.5, 50],
    [1.4, 100],
    [-1, 0],
    [0.666, 67],
  ])('value %s is %s%%', (value, percent) => {
    render(<ProgressBar value={value} label="Coverage" />)
    expect(screen.getByRole('progressbar', { name: 'Coverage' })).toHaveAttribute(
      'aria-valuenow',
      String(percent),
    )
  })
})

describe('feedback', () => {
  it('Badge shows its icon and text together', () => {
    render(<Badge icon={<svg data-testid="icon" aria-hidden />}>Expires today</Badge>)
    expect(screen.getByText('Expires today')).toContainElement(screen.getByTestId('icon'))
  })

  it('ErrorBanner is announced as an alert', () => {
    render(<ErrorBanner>Couldn't load.</ErrorBanner>)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load.")
  })

  it('EmptyState and PageHeader use headings', () => {
    render(
      <>
        <PageHeader title="Pantry" subtitle="3 items" actions={<button>Add</button>} />
        <EmptyState icon={<svg />} title="Nothing here yet" message="Add something." />
      </>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Pantry' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing here yet' })).toBeInTheDocument()
  })

  it('ListSkeleton is a labeled status', () => {
    render(<ListSkeleton rows={2} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })
})

describe('List', () => {
  it('renders link, button and static rows', async () => {
    const onClick = vi.fn()
    inRouter(
      <List header="Members" footer="Footer note">
        <ListRow title="Recipe" to="/recipes/1" />
        <ListRow title="Milk" onClick={onClick} />
        <ListRow title="Email" trailing="a@b.co" />
      </List>,
    )

    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Recipe/ })).toHaveAttribute('href', '/recipes/1')
    await userEvent.click(screen.getByRole('button', { name: /Milk/ }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Footer note')).toBeInTheDocument()
  })
})

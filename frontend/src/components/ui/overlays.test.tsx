import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sheet } from './Sheet'
import { ToastProvider } from './Toast'
import { useToast } from './toastContext'

describe('Sheet', () => {
  function Harness({ onClose = () => {} }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Sheet
          open={open}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          title="Add to pantry"
          description="Chef estimates expiry."
        >
          <input aria-label="Name" data-autofocus />
        </Sheet>
      </>
    )
  }

  it('opens as a labeled dialog and focuses the data-autofocus field', async () => {
    render(<Harness />)
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument() // children mount on open

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    const dialog = screen.getByRole('dialog', { name: 'Add to pantry' })
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })

  it('closes from the Close button', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('closes on a backdrop click but not on a click inside', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    await userEvent.click(screen.getByLabelText('Name'))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('Toast', () => {
  afterEach(() => vi.useRealTimers())

  function Trigger({ onUndo }: { onUndo?: () => void }) {
    const toast = useToast()
    return (
      <button
        onClick={() =>
          toast({ message: 'Logged!', ...(onUndo && { actionLabel: 'Undo', onAction: onUndo }) })
        }
      >
        Go
      </button>
    )
  }

  it('announces the message in a polite live region', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Go' }))

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Logged!')
    expect(status.parentElement).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('runs the action and dismisses', async () => {
    const onUndo = vi.fn()
    render(
      <ToastProvider>
        <Trigger onUndo={onUndo} />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(onUndo).toHaveBeenCalledOnce()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // user-event waits on real timers, so these use fireEvent under fake timers.
  it('dismisses itself after six seconds', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    act(() => vi.advanceTimersByTime(5_900))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(200))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('a new toast replaces the old one and restarts the timer', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    act(() => vi.advanceTimersByTime(4_000))
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    act(() => vi.advanceTimersByTime(4_000)) // 8 s after the first, 4 s after the second
    expect(screen.getAllByRole('status')).toHaveLength(1)
    act(() => vi.advanceTimersByTime(2_100))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

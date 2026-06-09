import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModalShell } from './ModalShell'

describe('ModalShell', () => {
  it('renders title and children and fires save/cancel', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(
      <ModalShell title="Edit" onSave={onSave} onCancel={onCancel}>
        <p>body</p>
      </ModalShell>,
    )
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onSave).toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddEntryMenu } from './AddEntryMenu'

describe('AddEntryMenu', () => {
  it('emits the chosen kind', async () => {
    const onAdd = vi.fn()
    render(<AddEntryMenu onAdd={onAdd} />)
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }))
    await userEvent.click(screen.getByRole('button', { name: /^user spec/i }))
    expect(onAdd).toHaveBeenCalledWith('userspec')
  })
})

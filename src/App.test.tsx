import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App integration', () => {
  beforeEach(() => localStorage.clear())

  it('parses initial example into the table after Load example', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /load example/i }))
    expect(await screen.findAllByText('User spec')).not.toHaveLength(0)
  })

  it('editing a row via modal updates the editor text', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }))
    await userEvent.click(screen.getByRole('button', { name: /^user spec$/i }))
    // modal opens automatically on add
    const users = await screen.findByLabelText(/users/i)
    await userEvent.clear(users)
    await userEvent.type(users, 'deploy')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByTestId('editor').textContent).toContain('deploy')
  })
})

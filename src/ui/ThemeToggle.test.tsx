import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('renders a toggle button', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'Toggle dark mode' })).toBeInTheDocument()
  })

  it('flips and persists the theme on click', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const before = document.documentElement.dataset.theme
    await user.click(screen.getByRole('button', { name: 'Toggle dark mode' }))
    const after = document.documentElement.dataset.theme
    expect(after).not.toBe(before)
    expect(after === 'light' || after === 'dark').toBe(true)
    expect(localStorage.getItem('online-sudoers-util-theme')).toBe(after)
  })
})

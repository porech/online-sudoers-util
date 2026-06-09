import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('copies text to clipboard', async () => {
    render(
      <Toolbar
        text="root ALL=(ALL) ALL"
        canUndo
        canRedo
        onUndo={() => {}}
        onRedo={() => {}}
        onClear={() => {}}
        onLoadExample={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /copy/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('root ALL=(ALL) ALL')
    expect(await screen.findByText(/copied/i)).toBeInTheDocument()
  })

  it('confirms before clearing', async () => {
    const onClear = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <Toolbar
        text=""
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        onClear={onClear}
        onLoadExample={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(onClear).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})

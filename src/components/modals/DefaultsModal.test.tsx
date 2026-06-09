import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DefaultsModal } from './DefaultsModal'
import type { DefaultsNode } from '../../model/types'

describe('DefaultsModal', () => {
  it('shows unknown params in the additional section and preserves them on save', async () => {
    const node: DefaultsNode = {
      kind: 'defaults',
      raw: '',
      dirty: false,
      params: [{ name: 'my_custom', op: '=', value: 'x', known: false }],
    }
    const onSave = vi.fn()
    render(<DefaultsModal node={node} onSave={onSave} onCancel={() => {}} />)
    expect(screen.getByText(/Additional parameters/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('my_custom')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.arrayContaining([
          expect.objectContaining({ name: 'my_custom', value: 'x', known: false }),
        ]),
      }),
    )
  })

  it('clears the inline comment to undefined on save', async () => {
    const node: DefaultsNode = {
      kind: 'defaults',
      raw: '',
      dirty: false,
      params: [],
      inlineComment: 'keep',
    }
    const onSave = vi.fn()
    render(<DefaultsModal node={node} onSave={onSave} onCancel={() => {}} />)
    const input = screen.getByLabelText(/inline comment/i)
    expect(input).toHaveValue('keep')
    await userEvent.clear(input)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    const saved = onSave.mock.calls[0][0] as DefaultsNode
    expect(saved.inlineComment).toBeUndefined()
  })

  it('toggles a known boolean default', async () => {
    const node: DefaultsNode = { kind: 'defaults', raw: '', dirty: false, params: [] }
    const onSave = vi.fn()
    render(<DefaultsModal node={node} onSave={onSave} onCancel={() => {}} />)
    await userEvent.click(screen.getByLabelText(/requiretty/i))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.arrayContaining([
          expect.objectContaining({ name: 'requiretty', op: 'bool', known: true }),
        ]),
      }),
    )
  })
})

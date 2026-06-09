import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AliasModal } from './AliasModal'
import type { AliasNode } from '../../model/types'

describe('AliasModal', () => {
  it('edits items (comma-separated) and saves', async () => {
    const node: AliasNode = {
      kind: 'alias',
      raw: '',
      dirty: false,
      aliasKind: 'User_Alias',
      defs: [{ name: 'ADMINS', items: ['alice'] }],
    }
    const onSave = vi.fn()
    render(<AliasModal node={node} onSave={onSave} onCancel={() => {}} />)
    const items = screen.getByLabelText(/items for ADMINS/i)
    await userEvent.clear(items)
    await userEvent.type(items, 'alice, bob')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        defs: [{ name: 'ADMINS', items: ['alice', 'bob'] }],
      }),
    )
  })

  it('renders and round-trips an inline comment on save', async () => {
    const node: AliasNode = {
      kind: 'alias',
      raw: '',
      dirty: false,
      aliasKind: 'User_Alias',
      defs: [{ name: 'ADMINS', items: ['alice'] }],
      inlineComment: 'note',
    }
    const onSave = vi.fn()
    render(<AliasModal node={node} onSave={onSave} onCancel={() => {}} />)
    const input = screen.getByLabelText(/inline comment/i)
    expect(input).toHaveValue('note')
    await userEvent.clear(input)
    await userEvent.type(input, 'updated')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    const saved = onSave.mock.calls[0][0] as AliasNode
    expect(saved.inlineComment).toBe('updated')
  })
})

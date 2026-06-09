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
})

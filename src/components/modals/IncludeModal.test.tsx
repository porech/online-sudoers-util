import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IncludeModal } from './IncludeModal'
import type { IncludeNode } from '../../model/types'

describe('IncludeModal', () => {
  it('renders and round-trips an inline comment on save', async () => {
    const node: IncludeNode = {
      kind: 'include',
      raw: '',
      dirty: false,
      includeKind: '@includedir',
      path: '/etc/sudoers.d',
      inlineComment: 'note',
    }
    const onSave = vi.fn()
    render(<IncludeModal node={node} onSave={onSave} onCancel={() => {}} />)
    const input = screen.getByLabelText(/inline comment/i)
    expect(input).toHaveValue('note')
    await userEvent.clear(input)
    await userEvent.type(input, 'updated')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    const saved = onSave.mock.calls[0][0] as IncludeNode
    expect(saved.inlineComment).toBe('updated')
  })
})

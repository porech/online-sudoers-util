import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommentModal } from './CommentModal'
import type { CommentNode } from '../../model/types'

describe('CommentModal', () => {
  it('edits comment text and saves a node', async () => {
    const initial: CommentNode = { kind: 'comment', raw: '# old', dirty: false, text: 'old' }
    const onSave = vi.fn()
    render(<CommentModal node={initial} onSave={onSave} onCancel={() => {}} />)
    const input = screen.getByLabelText(/comment text/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'new text')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'comment', text: 'new text' }),
    )
  })
})

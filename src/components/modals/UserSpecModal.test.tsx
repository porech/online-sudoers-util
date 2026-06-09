import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserSpecModal } from './UserSpecModal'
import { parseUserSpec } from '../../model/parseUserSpec'
import type { UserSpecNode } from '../../model/types'

describe('UserSpecModal', () => {
  it('edits users and toggles NOPASSWD, then saves', async () => {
    const node = parseUserSpec('alice ALL = /bin/ls', 1) as UserSpecNode
    const onSave = vi.fn()
    render(<UserSpecModal node={node} onSave={onSave} onCancel={() => {}} />)

    const users = screen.getByLabelText(/users/i)
    await userEvent.clear(users)
    await userEvent.type(users, 'alice, bob')

    await userEvent.click(screen.getByLabelText(/NOPASSWD/i))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    const saved = onSave.mock.calls[0][0] as UserSpecNode
    expect(saved.users).toEqual(['alice', 'bob'])
    expect(saved.specGroups[0].cmndSpecs[0].tags).toContain('NOPASSWD')
  })
})

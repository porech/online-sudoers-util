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

  it('edits the inline comment and saves it', async () => {
    const n = parseUserSpec('alice ALL = /bin/ls # old note', 1)
    if (n.kind !== 'userspec') throw new Error('expected userspec')
    const onSave = vi.fn()
    render(<UserSpecModal node={n} onSave={onSave} onCancel={() => {}} />)

    const input = screen.getByLabelText(/inline comment/i)
    expect(input).toHaveValue('old note')
    await userEvent.clear(input)
    await userEvent.type(input, 'new note')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    const saved = onSave.mock.calls[0][0] as UserSpecNode
    expect(saved.inlineComment).toBe('new note')
  })

  it('shows an existing per-command option and preserves it on save', async () => {
    const n = parseUserSpec('alice ALL = CWD=/tmp /bin/ls', 1)
    if (n.kind !== 'userspec') throw new Error('expected userspec')
    const onSave = vi.fn()
    render(<UserSpecModal node={n} onSave={onSave} onCancel={() => {}} />)

    expect(screen.getByLabelText(/option name 0-0-0/i)).toHaveValue('CWD')
    expect(screen.getByLabelText(/option value 0-0-0/i)).toHaveValue('/tmp')

    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    const saved = onSave.mock.calls[0][0] as UserSpecNode
    expect(saved.specGroups[0].cmndSpecs[0].options).toContainEqual({ name: 'CWD', value: '/tmp' })
  })

  it('adds a new per-command option', async () => {
    const n = parseUserSpec('alice ALL = /bin/ls', 1)
    if (n.kind !== 'userspec') throw new Error('expected userspec')
    const onSave = vi.fn()
    render(<UserSpecModal node={n} onSave={onSave} onCancel={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: /add option/i }))
    await userEvent.type(screen.getByLabelText(/option name 0-0-0/i), 'TIMEOUT')
    await userEvent.type(screen.getByLabelText(/option value 0-0-0/i), '30')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    const saved = onSave.mock.calls[0][0] as UserSpecNode
    expect(saved.specGroups[0].cmndSpecs[0].options).toContainEqual({
      name: 'TIMEOUT',
      value: '30',
    })
  })
})

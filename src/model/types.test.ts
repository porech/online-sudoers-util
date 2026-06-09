import { describe, it, expect } from 'vitest'
import { isUserSpec, makeBlank, type Line } from './types'

describe('model types', () => {
  it('type guard narrows a UserSpec node', () => {
    const line: Line = {
      kind: 'userspec',
      raw: 'root ALL=(ALL) ALL',
      dirty: false,
      users: ['root'],
      specGroups: [
        { hosts: ['ALL'], cmndSpecs: [{ runas: { users: ['ALL'], groups: [] }, tags: [], options: [], command: 'ALL' }] },
      ],
    }
    expect(isUserSpec(line)).toBe(true)
    if (isUserSpec(line)) expect(line.users).toEqual(['root'])
  })

  it('makeBlank builds a blank node', () => {
    expect(makeBlank()).toEqual({ kind: 'blank', raw: '', dirty: false })
  })
})

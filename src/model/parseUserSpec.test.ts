import { describe, it, expect } from 'vitest'
import { parseUserSpec } from './parseUserSpec'
import { isUserSpec } from './types'

describe('parseUserSpec: basics', () => {
  it('parses root ALL=(ALL:ALL) ALL', () => {
    const n = parseUserSpec('root ALL=(ALL:ALL) ALL', 1)
    expect(isUserSpec(n)).toBe(true)
    if (!isUserSpec(n)) return
    expect(n.users).toEqual(['root'])
    expect(n.specGroups).toHaveLength(1)
    const g = n.specGroups[0]
    expect(g.hosts).toEqual(['ALL'])
    expect(g.cmndSpecs).toEqual([
      { runas: { users: ['ALL'], groups: ['ALL'] }, tags: [], options: [], command: 'ALL' },
    ])
  })

  it('parses a command list and a single NOPASSWD tag', () => {
    const n = parseUserSpec('%admin ALL = NOPASSWD: /bin/ls, /bin/cat', 1)
    if (!isUserSpec(n)) throw new Error('expected userspec')
    expect(n.users).toEqual(['%admin'])
    const cs = n.specGroups[0].cmndSpecs
    expect(cs).toHaveLength(2)
    expect(cs[0]).toEqual({ tags: ['NOPASSWD'], options: [], command: '/bin/ls' })
    // inheritance: second command keeps NOPASSWD
    expect(cs[1]).toEqual({ tags: ['NOPASSWD'], options: [], command: '/bin/cat' })
  })
})

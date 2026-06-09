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

describe('parseUserSpec: structural disambiguation', () => {
  it('keeps a runas user list with a comma together (not split as commands)', () => {
    const n = parseUserSpec('eve ALL = (root, daemon) /bin/a', 1)
    if (!isUserSpec(n)) throw new Error('expected userspec')
    expect(n.specGroups).toHaveLength(1)
    const cs = n.specGroups[0].cmndSpecs
    expect(cs).toHaveLength(1)
    expect(cs[0].runas).toEqual({ users: ['root', 'daemon'], groups: [] })
    expect(cs[0].command).toBe('/bin/a')
  })

  it('handles runas users:groups (colon in parens) across two host groups', () => {
    const n = parseUserSpec('bob ALL = (root : wheel) /bin/x : DBSERVERS = NOPASSWD: /bin/y', 1)
    if (!isUserSpec(n)) throw new Error('expected userspec')
    expect(n.specGroups).toHaveLength(2)
    expect(n.specGroups[0].hosts).toEqual(['ALL'])
    expect(n.specGroups[0].cmndSpecs[0].runas).toEqual({ users: ['root'], groups: ['wheel'] })
    expect(n.specGroups[1].hosts).toEqual(['DBSERVERS'])
    expect(n.specGroups[1].cmndSpecs[0].tags).toEqual(['NOPASSWD'])
    expect(n.specGroups[1].cmndSpecs[0].command).toBe('/bin/y')
  })

  it('does not mistake an inline option = for a host-group separator', () => {
    const n = parseUserSpec('bob A = NOEXEC: CWD=/x /a : B = /b', 1)
    if (!isUserSpec(n)) throw new Error('expected userspec')
    expect(n.specGroups).toHaveLength(2)
    expect(n.specGroups[0].hosts).toEqual(['A'])
    const c0 = n.specGroups[0].cmndSpecs[0]
    expect(c0.tags).toEqual(['NOEXEC'])
    expect(c0.options).toEqual([{ name: 'CWD', value: '/x' }])
    expect(c0.command).toBe('/a')
    expect(n.specGroups[1].hosts).toEqual(['B'])
    expect(n.specGroups[1].cmndSpecs[0].command).toBe('/b')
  })

  it('handles two host groups each with its own runas', () => {
    const n = parseUserSpec('alice host1 = (root) /bin/a : host2 = (daemon) /bin/b', 1)
    if (!isUserSpec(n)) throw new Error('expected userspec')
    expect(n.specGroups).toHaveLength(2)
    expect(n.specGroups[0].cmndSpecs[0].runas).toEqual({ users: ['root'], groups: [] })
    expect(n.specGroups[1].cmndSpecs[0].runas).toEqual({ users: ['daemon'], groups: [] })
  })
})

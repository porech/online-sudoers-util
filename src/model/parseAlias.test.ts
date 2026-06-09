import { describe, it, expect } from 'vitest'
import { parseAlias } from './parseAlias'
import { isAlias } from './types'

describe('parseAlias', () => {
  it('parses a single user alias', () => {
    const n = parseAlias('User_Alias ADMINS = alice, bob, %wheel', 1)
    expect(isAlias(n)).toBe(true)
    if (!isAlias(n)) return
    expect(n.aliasKind).toBe('User_Alias')
    expect(n.defs).toEqual([{ name: 'ADMINS', items: ['alice', 'bob', '%wheel'] }])
  })

  it('parses multiple definitions on one line', () => {
    const n = parseAlias('Host_Alias WEB = web1, web2 : DB = db1', 1)
    if (!isAlias(n)) throw new Error('expected alias')
    expect(n.defs).toEqual([
      { name: 'WEB', items: ['web1', 'web2'] },
      { name: 'DB', items: ['db1'] },
    ])
  })

  it('captures an inline comment', () => {
    const n = parseAlias('Cmnd_Alias PKG = /usr/bin/apt # package mgmt', 1)
    if (!isAlias(n)) throw new Error('expected alias')
    expect(n.inlineComment).toBe('package mgmt')
  })
})

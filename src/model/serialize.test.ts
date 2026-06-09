import { describe, it, expect } from 'vitest'
import { serializeLine } from './serialize'
import { parseDefaults } from './parseDefaults'
import type { CommentNode } from './types'
import { parseAlias } from './parseAlias'
import { parseUserSpec } from './parseUserSpec'

describe('serializeLine: defaults', () => {
  it('round-trips a defaults line semantically', () => {
    const n = parseDefaults('Defaults:alice !insults, secure_path="/bin", foo=bar', 1)
    expect(serializeLine(n)).toBe('Defaults:alice !insults, secure_path="/bin", foo=bar')
  })

  it('appends an inline comment', () => {
    const n = parseDefaults('Defaults env_reset', 1)
    ;(n as any).inlineComment = 'baseline'
    expect(serializeLine(n)).toBe('Defaults env_reset # baseline')
  })

  it('renders a comment node', () => {
    const c: CommentNode = { kind: 'comment', raw: '', dirty: true, text: 'hi' }
    expect(serializeLine(c)).toBe('# hi')
  })
})

describe('serializeLine: alias', () => {
  it('round-trips a multi-def alias', () => {
    const n = parseAlias('Host_Alias WEB = web1, web2 : DB = db1', 1)
    expect(serializeLine(n)).toBe('Host_Alias WEB = web1, web2 : DB = db1')
  })
})

describe('serializeLine: userspec', () => {
  it('round-trips runas + command list with shared tag', () => {
    const n = parseUserSpec('%admin ALL = NOPASSWD: /bin/ls, /bin/cat', 1)
    expect(serializeLine(n)).toBe('%admin ALL = NOPASSWD: /bin/ls, /bin/cat')
  })

  it('round-trips runas group spec', () => {
    const n = parseUserSpec('root ALL=(ALL:ALL) ALL', 1)
    expect(serializeLine(n)).toBe('root ALL = (ALL:ALL) ALL')
  })

  it('round-trips multiple host groups', () => {
    const n = parseUserSpec('alice web=/bin/a : db=/bin/b', 1)
    expect(serializeLine(n)).toBe('alice web = /bin/a : db = /bin/b')
  })
})

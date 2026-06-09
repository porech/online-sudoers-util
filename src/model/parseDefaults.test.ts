import { describe, it, expect } from 'vitest'
import { parseDefaults } from './parseDefaults'
import { isDefaults } from './types'

describe('parseDefaults', () => {
  it('parses a simple boolean and a negated boolean', () => {
    const n = parseDefaults('Defaults !insults, requiretty', 1)
    expect(isDefaults(n)).toBe(true)
    if (!isDefaults(n)) return
    expect(n.binding).toBeUndefined()
    expect(n.params).toEqual([
      { name: 'insults', op: 'bool', negated: true, known: true },
      { name: 'requiretty', op: 'bool', known: true },
    ])
  })

  it('parses assignment, append, and unknown params', () => {
    const n = parseDefaults('Defaults secure_path="/bin", env_keep+="LANG", foo=bar', 1)
    if (!isDefaults(n)) throw new Error('expected defaults')
    expect(n.params).toEqual([
      { name: 'secure_path', op: '=', value: '"/bin"', known: true },
      { name: 'env_keep', op: '+=', value: '"LANG"', known: true },
      { name: 'foo', op: '=', value: 'bar', known: false },
    ])
  })

  it('parses a user binding', () => {
    const n = parseDefaults('Defaults:alice !requiretty', 1)
    if (!isDefaults(n)) throw new Error('expected defaults')
    expect(n.binding).toEqual({ type: ':', value: 'alice' })
  })

  it('captures an inline comment', () => {
    const n = parseDefaults('Defaults env_reset # baseline', 1)
    if (!isDefaults(n)) throw new Error('expected defaults')
    expect(n.inlineComment).toBe('baseline')
  })
})

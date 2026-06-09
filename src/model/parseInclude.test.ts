import { describe, it, expect } from 'vitest'
import { parseInclude } from './parseInclude'
import { isInclude } from './types'

describe('parseInclude', () => {
  it('parses @includedir', () => {
    const n = parseInclude('@includedir /etc/sudoers.d', 1)
    expect(isInclude(n)).toBe(true)
    if (!isInclude(n)) return
    expect(n.includeKind).toBe('@includedir')
    expect(n.path).toBe('/etc/sudoers.d')
  })

  it('parses legacy #include', () => {
    const n = parseInclude('#include /etc/sudoers.local', 1)
    if (!isInclude(n)) throw new Error('expected include')
    expect(n.includeKind).toBe('#include')
    expect(n.path).toBe('/etc/sudoers.local')
  })
})

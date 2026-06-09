import { describe, it, expect } from 'vitest'
import { serializeLine } from './serialize'
import { parseDefaults } from './parseDefaults'
import type { CommentNode } from './types'

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

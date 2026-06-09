import { describe, it, expect } from 'vitest'
import { parseLine } from './parseLine'

describe('parseLine: blank & comment', () => {
  it('parses a blank line', () => {
    expect(parseLine('', 1)).toEqual({ kind: 'blank', raw: '', dirty: false })
    expect(parseLine('   ', 2)).toEqual({ kind: 'blank', raw: '   ', dirty: false })
  })

  it('parses a standalone comment', () => {
    expect(parseLine('# hello world', 3)).toEqual({
      kind: 'comment',
      raw: '# hello world',
      dirty: false,
      text: 'hello world',
    })
  })

  it('does not treat #include as a comment', () => {
    expect(parseLine('#include /etc/x', 4).kind).toBe('include')
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseDocument } from './parseDocument'

describe('parseDocument', () => {
  it('joins line continuations into one logical line', () => {
    const doc = parseDocument('root ALL=(ALL) \\\n  /bin/ls')
    expect(doc.lines).toHaveLength(1)
    expect(doc.lines[0].kind).toBe('userspec')
    expect(doc.lines[0].raw).toBe('root ALL=(ALL) \\\n  /bin/ls')
  })

  it('parses the example corpus into the expected node kinds', () => {
    const text = readFileSync('tests/fixtures/example.sudoers', 'utf8')
    const doc = parseDocument(text)
    const kinds = doc.lines.map((l) => l.kind)
    expect(kinds).toEqual([
      'comment',
      'defaults',
      'defaults',
      'blank',
      'alias',
      'alias',
      'blank',
      'userspec',
      'userspec',
      'userspec',
      'include',
      'blank',
    ])
    expect(doc.lines.some((l) => l.kind === 'error')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseDocument } from './parseDocument'
import { serializeDocument } from './serialize'

const text = readFileSync('tests/fixtures/example.sudoers', 'utf8')

describe('round-trip', () => {
  it('returns the input byte-for-byte when nothing is dirty', () => {
    const doc = parseDocument(text)
    expect(serializeDocument(doc)).toBe(text)
  })

  it('re-serializes a node when it is marked dirty', () => {
    const doc = parseDocument(text)
    const dirtyDoc = { lines: doc.lines.map((l) => ({ ...l, dirty: true })) }
    const out = serializeDocument(dirtyDoc)
    const reparsed = parseDocument(out)
    expect(reparsed.lines.map((l) => l.kind)).toEqual(doc.lines.map((l) => l.kind))
    expect(reparsed.lines.some((l) => l.kind === 'error')).toBe(false)
  })
})

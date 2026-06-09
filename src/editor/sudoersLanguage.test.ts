import { describe, it, expect } from 'vitest'
import { sudoersStreamParser } from './sudoersLanguage'

// We test the StreamParser token function directly (no editor needed).
function tokensOf(line: string): Array<[string, string | null]> {
  const stream = makeStream(line)
  const state = sudoersStreamParser.startState!(0)
  const out: Array<[string, string | null]> = []
  while (!stream.eol()) {
    const start = stream.pos
    const tok = sudoersStreamParser.token(stream as never, state)
    out.push([line.slice(start, stream.pos), tok])
    if (stream.pos === start) stream.pos++ // guard against no-advance
  }
  return out
}

// Minimal StringStream-like shim sufficient for our token function.
function makeStream(line: string) {
  return {
    pos: 0,
    string: line,
    eol() {
      return this.pos >= line.length
    },
    sol() {
      return this.pos === 0
    },
    peek() {
      return line[this.pos]
    },
    next() {
      return line[this.pos++]
    },
    eat(re: RegExp) {
      const c = line[this.pos]
      if (c && re.test(c)) {
        this.pos++
        return c
      }
      return undefined
    },
    eatWhile(re: RegExp) {
      let ate = false
      while (this.pos < line.length && re.test(line[this.pos])) {
        this.pos++
        ate = true
      }
      return ate
    },
    eatSpace() {
      const s = this.pos
      while (this.pos < line.length && /\s/.test(line[this.pos])) this.pos++
      return this.pos > s
    },
    match(re: RegExp, consume = true) {
      const m = re.exec(line.slice(this.pos))
      if (m && m.index === 0) {
        if (consume) this.pos += m[0].length
        return m
      }
      return null
    },
    skipToEnd() {
      this.pos = line.length
    },
  }
}

describe('sudoers highlighter', () => {
  it('marks keywords and comments', () => {
    const toks = tokensOf('Defaults env_reset # note')
    expect(toks[0]).toEqual(['Defaults', 'keyword'])
    expect(toks.some(([t, k]) => k === 'comment' && t.includes('# note'))).toBe(true)
  })

  it('marks alias keywords', () => {
    const toks = tokensOf('User_Alias ADMINS = alice')
    expect(toks[0]).toEqual(['User_Alias', 'keyword'])
  })
})

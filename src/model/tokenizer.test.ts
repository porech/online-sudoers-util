import { describe, it, expect } from 'vitest'
import { tokenize } from './tokenizer'

describe('tokenize', () => {
  it('splits on whitespace and keeps structural punctuation', () => {
    const { tokens, inlineComment } = tokenize('root ALL=(ALL) ALL')
    expect(tokens).toEqual(['root', 'ALL', '=', '(', 'ALL', ')', 'ALL'])
    expect(inlineComment).toBeUndefined()
  })

  it('extracts a trailing inline comment', () => {
    const { tokens, inlineComment } = tokenize('%admin ALL=NOPASSWD: ALL # no password')
    expect(tokens).toEqual(['%admin', 'ALL', '=', 'NOPASSWD', ':', 'ALL'])
    expect(inlineComment).toBe('no password')
  })

  it('does not split #include into a comment', () => {
    const { tokens, inlineComment } = tokenize('#include /etc/sudoers.local')
    expect(tokens).toEqual(['#include', '/etc/sudoers.local'])
    expect(inlineComment).toBeUndefined()
  })

  it('keeps # inside double quotes', () => {
    const { tokens } = tokenize('Defaults badpass_message="bad #1"')
    expect(tokens).toEqual(['Defaults', 'badpass_message', '=', '"bad #1"'])
  })

  it('keeps escaped whitespace inside a command path', () => {
    const { tokens } = tokenize('root ALL=/bin/ls\\ file')
    expect(tokens).toEqual(['root', 'ALL', '=', '/bin/ls\\ file'])
  })
})

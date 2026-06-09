import { describe, it, expect } from 'vitest'
import { splitInlineComment } from './inlineComment'

describe('splitInlineComment', () => {
  it('returns the whole string as body when there is no comment', () => {
    expect(splitInlineComment('Defaults env_reset')).toEqual({ body: 'Defaults env_reset' })
  })

  it('splits a trailing comment and trims both sides', () => {
    expect(splitInlineComment('Defaults env_reset # baseline')).toEqual({
      body: 'Defaults env_reset',
      inlineComment: 'baseline',
    })
  })

  it('does not treat a # inside double quotes as a comment', () => {
    expect(splitInlineComment('Defaults secure_path="/usr/bin:#/bin"')).toEqual({
      body: 'Defaults secure_path="/usr/bin:#/bin"',
    })
  })

  it('does not treat a # inside single quotes as a comment', () => {
    expect(splitInlineComment("Defaults msg='he said #no'")).toEqual({
      body: "Defaults msg='he said #no'",
    })
  })

  it('handles an escaped character before a # without treating it as a comment', () => {
    // The backslash escapes the next char; the # after "\\#" at position 3+ is escaped
    const result = splitInlineComment('foo\\#bar')
    expect(result).toEqual({ body: 'foo\\#bar' })
  })

  it('returns an empty string inlineComment for a bare trailing #', () => {
    expect(splitInlineComment('root ALL=(ALL) ALL #')).toEqual({
      body: 'root ALL=(ALL) ALL',
      inlineComment: '',
    })
  })

  it('trims leading/trailing whitespace from the input', () => {
    expect(splitInlineComment('  Defaults env_reset  ')).toEqual({ body: 'Defaults env_reset' })
  })

  it('does not parse #include as a comment', () => {
    expect(splitInlineComment('#include /etc/sudoers.d/extra')).toEqual({
      body: '#include /etc/sudoers.d/extra',
    })
  })

  it('does not parse #includedir as a comment', () => {
    expect(splitInlineComment('#includedir /etc/sudoers.d')).toEqual({
      body: '#includedir /etc/sudoers.d',
    })
  })
})

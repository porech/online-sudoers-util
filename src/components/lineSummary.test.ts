import { describe, it, expect } from 'vitest'
import { lineSummary, lineTypeLabel } from './lineSummary'
import { parseLine } from '../model/parseLine'

describe('lineSummary', () => {
  it('summarizes a user spec', () => {
    const l = parseLine('%admin ALL=(ALL) NOPASSWD: ALL', 1)
    expect(lineTypeLabel(l)).toBe('User spec')
    expect(lineSummary(l)).toBe('%admin → ALL = (ALL) NOPASSWD: ALL')
  })

  it('summarizes a defaults line', () => {
    const l = parseLine('Defaults env_reset', 1)
    expect(lineTypeLabel(l)).toBe('Defaults')
    expect(lineSummary(l)).toBe('env_reset')
  })

  it('labels blanks and comments', () => {
    expect(lineTypeLabel(parseLine('', 1))).toBe('Blank')
    expect(lineTypeLabel(parseLine('# hi', 1))).toBe('Comment')
  })
})

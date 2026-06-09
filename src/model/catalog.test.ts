import { describe, it, expect } from 'vitest'
import { isKnownDefault, defaultParamInfo, tagInfo, TAGS } from './catalog'

describe('catalog', () => {
  it('recognizes a known boolean default', () => {
    expect(isKnownDefault('requiretty')).toBe(true)
    expect(defaultParamInfo('requiretty')?.type).toBe('flag')
  })

  it('describes an unknown default as not known', () => {
    expect(isKnownDefault('totally_made_up_param')).toBe(false)
    expect(defaultParamInfo('totally_made_up_param')).toBeUndefined()
  })

  it('exposes all 16 tags with descriptions', () => {
    expect(TAGS).toContain('NOPASSWD')
    expect(tagInfo('NOPASSWD')).toMatch(/password/i)
    expect(TAGS.length).toBe(16)
  })
})

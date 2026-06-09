import { describe, it, expect } from 'vitest'
import { parseDocument } from './parseDocument'
import { validateDocument } from './validate'

describe('validateDocument', () => {
  it('warns about a referenced but undefined alias', () => {
    const doc = parseDocument('alice ALL = WEBADMIN_CMNDS')
    const warnings = validateDocument(doc)
    expect(warnings).toEqual([
      { lineIndex: 0, message: 'Command "WEBADMIN_CMNDS" looks like an alias but no Cmnd_Alias defines it.' },
    ])
  })

  it('does not warn when the alias is defined', () => {
    const doc = parseDocument('Cmnd_Alias PKG = /usr/bin/apt\nalice ALL = PKG')
    expect(validateDocument(doc)).toEqual([])
  })
})

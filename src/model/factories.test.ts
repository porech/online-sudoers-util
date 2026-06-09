import { describe, it, expect } from 'vitest'
import { newNode } from './factories'

describe('newNode', () => {
  it('creates a dirty userspec template', () => {
    const n = newNode('userspec')
    expect(n.kind).toBe('userspec')
    expect(n.dirty).toBe(true)
    if (n.kind === 'userspec') {
      expect(n.users).toEqual(['ALL'])
      expect(n.specGroups[0].cmndSpecs[0].command).toBe('ALL')
    }
  })

  it('creates a defaults template', () => {
    expect(newNode('defaults').kind).toBe('defaults')
  })
})

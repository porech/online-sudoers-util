import { describe, it, expect } from 'vitest'
import { createHistory } from './history'

describe('history', () => {
  it('undoes and redoes snapshots', () => {
    const h = createHistory('a')
    h.push('ab', 1000)
    h.push('abc', 5000)
    expect(h.current()).toBe('abc')
    expect(h.undo()).toBe('ab')
    expect(h.undo()).toBe('a')
    expect(h.undo()).toBe('a') // clamped at oldest
    expect(h.redo()).toBe('ab')
  })

  it('coalesces pushes within the window', () => {
    const h = createHistory('a')
    h.push('ab', 1000)
    h.push('abc', 1200) // within 500ms window -> replaces top
    expect(h.undo()).toBe('a')
  })

  it('truncates redo history on a new push', () => {
    const h = createHistory('a')
    h.push('ab', 1000)
    h.push('abc', 5000)
    h.undo() // -> ab
    h.push('abX', 9000)
    expect(h.redo()).toBe('abX')
    expect(h.canRedo()).toBe(false)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDocument } from './useDocument'
import type { UserSpecNode } from '../model/types'

describe('useDocument', () => {
  beforeEach(() => localStorage.clear())

  it('parses initial text into a document', () => {
    const { result } = renderHook(() => useDocument('root ALL=(ALL) ALL'))
    expect(result.current.doc.lines).toHaveLength(1)
    expect(result.current.doc.lines[0].kind).toBe('userspec')
  })

  it('setText reparses and flags origin=editor', () => {
    const { result } = renderHook(() => useDocument(''))
    act(() => result.current.setText('# hi', 'editor'))
    expect(result.current.text).toBe('# hi')
    expect(result.current.lastOrigin).toBe('editor')
    expect(result.current.doc.lines[0].kind).toBe('comment')
  })

  it('updateLine marks the node dirty, re-serializes, and sets origin=table', () => {
    const { result } = renderHook(() => useDocument('root ALL=(ALL) ALL'))
    act(() =>
      result.current.updateLine(0, {
        kind: 'userspec',
        raw: '',
        dirty: true,
        users: ['root', 'alice'],
        specGroups:
          result.current.doc.lines[0].kind === 'userspec'
            ? (result.current.doc.lines[0] as UserSpecNode).specGroups
            : [],
      }),
    )
    expect(result.current.text).toContain('root, alice')
    expect(result.current.lastOrigin).toBe('table')
  })

  it('undo restores previous text', () => {
    const { result } = renderHook(() => useDocument('a # one'))
    act(() => result.current.setText('b # two', 'editor', 5000))
    act(() => result.current.undo())
    expect(result.current.text).toBe('a # one')
  })
})

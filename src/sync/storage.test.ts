import { describe, it, expect, beforeEach } from 'vitest'
import { loadActiveText, saveActiveText, STORAGE_KEY } from './storage'

describe('storage', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty string when nothing is stored', () => {
    expect(loadActiveText()).toBe('')
  })

  it('saves and loads the active session text', () => {
    saveActiveText('root ALL=(ALL) ALL')
    expect(loadActiveText()).toBe('root ALL=(ALL) ALL')
    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(envelope.version).toBe(1)
    expect(envelope.activeSessionId).toBe('default')
    expect(envelope.sessions.default.text).toBe('root ALL=(ALL) ALL')
  })

  it('survives corrupt JSON by returning empty', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadActiveText()).toBe('')
  })
})

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { loadActiveText, saveActiveText, STORAGE_KEY } from './storage'

describe('storage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

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

  it('preserves the existing session name across saves', () => {
    saveActiveText('first')
    saveActiveText('second')
    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(envelope.sessions.default.name).toBe('Untitled')
    expect(envelope.sessions.default.text).toBe('second')
  })

  it('does not throw when localStorage.setItem fails (e.g. private mode/quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })
    expect(() => saveActiveText('anything')).not.toThrow()
  })
})

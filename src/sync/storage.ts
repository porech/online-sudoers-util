export const STORAGE_KEY = 'online-sudoers-util'

interface Session {
  name: string
  text: string
  updatedAt: number
}

interface Envelope {
  version: 1
  activeSessionId: string
  sessions: Record<string, Session>
}

function emptyEnvelope(): Envelope {
  return { version: 1, activeSessionId: 'default', sessions: { default: { name: 'Untitled', text: '', updatedAt: 0 } } }
}

function read(): Envelope {
  // getItem can throw (SecurityError in sandboxed iframes / private mode), and
  // JSON.parse can throw on corrupt data. Both degrade to a fresh envelope.
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyEnvelope()
    const parsed = JSON.parse(raw) as Envelope
    if (parsed?.version !== 1 || !parsed.sessions) return emptyEnvelope()
    return parsed
  } catch {
    return emptyEnvelope()
  }
}

export function loadActiveText(): string {
  const env = read()
  return env.sessions[env.activeSessionId]?.text ?? ''
}

// updatedAt is passed in by the caller (Date.now lives in the UI layer, kept out
// of pure modules so tests stay deterministic).
export function saveActiveText(text: string, updatedAt = 0): void {
  const env = read()
  const id = env.activeSessionId
  env.sessions[id] = { name: env.sessions[id]?.name ?? 'Untitled', text, updatedAt }
  // Persistence is best-effort: ignore quota/security errors (e.g. private mode)
  // so the app keeps working even when localStorage is unavailable.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(env))
  } catch {
    // intentionally ignored
  }
}

export function clearActive(): void {
  saveActiveText('', 0)
}

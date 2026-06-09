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
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyEnvelope()
  try {
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(env))
}

export function clearActive(): void {
  saveActiveText('', 0)
}

import { useState } from 'react'
import type { NewKind } from '../model/factories'

interface Props {
  onAdd: (kind: NewKind) => void
}

const OPTIONS: Array<{ kind: NewKind; label: string; description: string }> = [
  {
    kind: 'userspec',
    label: 'User spec',
    description: 'Grant rule: let users run commands on hosts, optionally as another user.',
  },
  {
    kind: 'alias',
    label: 'Alias',
    description: 'A reusable named group of users, hosts, run-as identities, or commands.',
  },
  {
    kind: 'defaults',
    label: 'Defaults',
    description: 'Global sudo settings and options (e.g. env_reset, secure_path).',
  },
  {
    kind: 'include',
    label: 'Include',
    description: 'Pull in another sudoers file or directory (@include / @includedir).',
  },
  {
    kind: 'comment',
    label: 'Comment',
    description: 'A plain # comment line for documentation.',
  },
]

export function AddEntryMenu({ onAdd }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="add-entry">
      <button onClick={() => setOpen((o) => !o)}>Add entry ▾</button>
      {open && (
        <ul className="menu">
          {OPTIONS.map((o) => (
            <li key={o.kind}>
              <button
                onClick={() => {
                  onAdd(o.kind)
                  setOpen(false)
                }}
              >
                <span className="menu-label">{o.label}</span>
                <span className="menu-desc">{o.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

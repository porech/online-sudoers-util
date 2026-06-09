import { useState } from 'react'
import type { NewKind } from '../model/factories'

interface Props {
  onAdd: (kind: NewKind) => void
}

const OPTIONS: Array<{ kind: NewKind; label: string }> = [
  { kind: 'userspec', label: 'User spec' },
  { kind: 'alias', label: 'Alias' },
  { kind: 'defaults', label: 'Defaults' },
  { kind: 'include', label: 'Include' },
  { kind: 'comment', label: 'Comment' },
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
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

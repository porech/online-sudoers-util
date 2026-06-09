import type { ReactNode } from 'react'

interface ModalShellProps {
  title: string
  children: ReactNode
  onSave: () => void
  onCancel: () => void
  saveDisabled?: boolean
}

export function ModalShell({ title, children, onSave, onCancel, saveDisabled }: ModalShellProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onSave} disabled={saveDisabled}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

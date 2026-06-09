import { useState } from 'react'

interface ToolbarProps {
  text: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onLoadExample: () => void
}

export function Toolbar({
  text,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onLoadExample,
}: ToolbarProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const clear = () => {
    if (window.confirm('Clear the entire document? This cannot be undone except via Undo.'))
      onClear()
  }

  return (
    <div className="toolbar">
      <button onClick={copy}>Copy</button>
      {copied && (
        <span className="copied" role="status">
          Copied!
        </span>
      )}
      <button onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={onRedo} disabled={!canRedo}>
        Redo
      </button>
      <button onClick={onLoadExample}>Load example</button>
      <button onClick={clear}>Clear</button>
    </div>
  )
}

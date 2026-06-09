import { useState, useEffect } from 'react'
import './App.css'
import { Editor } from './editor/Editor'
import { Table } from './components/Table'
import { Toolbar } from './components/Toolbar'
import { AddEntryMenu } from './components/AddEntryMenu'
import { ThemeToggle } from './ui/ThemeToggle'
import { useDocument } from './sync/useDocument'
import { loadActiveText } from './sync/storage'
import { newNode, type NewKind } from './model/factories'
import type { Line } from './model/types'
import { UserSpecModal } from './components/modals/UserSpecModal'
import { AliasModal } from './components/modals/AliasModal'
import { DefaultsModal } from './components/modals/DefaultsModal'
import { IncludeModal } from './components/modals/IncludeModal'
import { CommentModal } from './components/modals/CommentModal'

const EXAMPLE = `# Sample sudoers file
Defaults env_reset
User_Alias ADMINS = alice, bob
root    ALL=(ALL:ALL) ALL
%admin  ALL=(ALL) NOPASSWD: ALL
@includedir /etc/sudoers.d
`

export default function App() {
  const docState = useDocument(loadActiveText())
  const { doc, text, warnings } = docState
  const [editing, setEditing] = useState<{ index: number } | null>(null)
  const [hideNoise, setHideNoise] = useState(false)

  const openEditor = (index: number) => setEditing({ index })
  const closeModal = () => setEditing(null)

  const onAdd = (kind: NewKind) => {
    const newIndex = doc.lines.length
    docState.addLine(newNode(kind))
    setEditing({ index: newIndex })
  }

  const saveEdited = (line: Line) => {
    if (editing) docState.updateLine(editing.index, line)
    closeModal()
  }

  const current = editing ? doc.lines[editing.index] : undefined

  const { undo, redo } = docState
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-row">
          <h1>Online Sudoers Util</h1>
          <div className="header-actions">
            <ThemeToggle />
            <Toolbar
              text={text}
              canUndo={docState.canUndo}
              canRedo={docState.canRedo}
              onUndo={docState.undo}
              onRedo={docState.redo}
              onClear={() => docState.setText('', 'table')}
              onLoadExample={() => docState.setText(EXAMPLE, 'table')}
            />
          </div>
        </div>
        <p className="intro">
          Paste an existing <code>sudoers</code> file into the editor on the left to see it parsed
          into an editable table on the right — or start from scratch with{' '}
          <strong>Add entry</strong> (or <strong>Load example</strong>). Edits sync both ways:
          change the text or the table and the other updates automatically. Everything stays in your
          browser — nothing is uploaded.
        </p>
      </header>

      <main className="split">
        <section className="pane">
          <h2 className="pane-title">Editor</h2>
          <Editor value={text} onChange={(t) => docState.setText(t, 'editor')} />
        </section>
        <section className="pane">
          <h2 className="pane-title">Entries</h2>
          <div className="table-controls">
            <AddEntryMenu onAdd={onAdd} />
            <label>
              <input
                type="checkbox"
                checked={hideNoise}
                onChange={(e) => setHideNoise(e.target.checked)}
              />{' '}
              Hide comments &amp; blanks
            </label>
          </div>
          <Table
            doc={doc}
            warnings={warnings}
            onEdit={openEditor}
            onDelete={docState.removeLine}
            onDuplicate={(i) => docState.addLine({ ...doc.lines[i], dirty: true })}
            onMove={docState.moveLine}
            hideNoise={hideNoise}
          />
        </section>
      </main>

      {current?.kind === 'userspec' && (
        <UserSpecModal node={current} onSave={saveEdited} onCancel={closeModal} />
      )}
      {current?.kind === 'alias' && (
        <AliasModal node={current} onSave={saveEdited} onCancel={closeModal} />
      )}
      {current?.kind === 'defaults' && (
        <DefaultsModal node={current} onSave={saveEdited} onCancel={closeModal} />
      )}
      {current?.kind === 'include' && (
        <IncludeModal node={current} onSave={saveEdited} onCancel={closeModal} />
      )}
      {current?.kind === 'comment' && (
        <CommentModal node={current} onSave={saveEdited} onCancel={closeModal} />
      )}
    </div>
  )
}

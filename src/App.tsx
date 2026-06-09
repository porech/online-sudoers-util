import { useState } from 'react'
import './App.css'
import { Editor } from './editor/Editor'
import { Table } from './components/Table'
import { Toolbar } from './components/Toolbar'
import { AddEntryMenu } from './components/AddEntryMenu'
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

  return (
    <div className="app">
      <header>
        <h1>Online Sudoers Util</h1>
        <Toolbar
          text={text}
          canUndo={docState.canUndo}
          canRedo={docState.canRedo}
          onUndo={docState.undo}
          onRedo={docState.redo}
          onClear={() => docState.setText('', 'table')}
          onLoadExample={() => docState.setText(EXAMPLE, 'table')}
        />
      </header>

      <main className="split">
        <section className="pane">
          <Editor value={text} onChange={(t) => docState.setText(t, 'editor')} />
        </section>
        <section className="pane">
          <AddEntryMenu onAdd={onAdd} />
          <Table
            doc={doc}
            warnings={warnings}
            onEdit={openEditor}
            onDelete={docState.removeLine}
            onDuplicate={(i) => docState.addLine({ ...doc.lines[i], dirty: true })}
            onMove={docState.moveLine}
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

import type { SudoersDocument } from '../model/types'
import type { Warning } from '../model/validate'
import { lineSummary, lineTypeLabel } from './lineSummary'

interface TableProps {
  doc: SudoersDocument
  warnings: Warning[]
  onEdit: (index: number) => void
  onDelete: (index: number) => void
  onDuplicate: (index: number) => void
  onMove: (index: number, delta: number) => void
}

export function Table({ doc, warnings, onEdit, onDelete, onDuplicate, onMove }: TableProps) {
  const warnByIndex = new Map<number, string[]>()
  for (const w of warnings) {
    const arr = warnByIndex.get(w.lineIndex) ?? []
    arr.push(w.message)
    warnByIndex.set(w.lineIndex, arr)
  }

  return (
    <table className="entry-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Summary</th>
          <th>Inline comment</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {doc.lines.map((line, i) => {
          const isMuted = line.kind === 'blank' || line.kind === 'comment'
          const isError = line.kind === 'error'
          const rowWarnings = warnByIndex.get(i)
          const inlineComment =
            line.kind !== 'blank' && line.kind !== 'comment' ? (line.inlineComment ?? '') : ''
          return (
            <tr
              key={i}
              className={[isMuted ? 'muted' : '', isError ? 'error' : ''].join(' ').trim()}
            >
              <td>{lineTypeLabel(line)}</td>
              <td>
                {lineSummary(line)}
                {rowWarnings?.map((w, k) => (
                  <div key={k} className="warning">
                    ⚠ {w}
                  </div>
                ))}
              </td>
              <td>{inlineComment}</td>
              <td className="actions">
                {!isError && line.kind !== 'blank' && (
                  <button aria-label={`edit row ${i}`} onClick={() => onEdit(i)}>
                    Edit
                  </button>
                )}
                <button aria-label={`duplicate row ${i}`} onClick={() => onDuplicate(i)}>
                  Duplicate
                </button>
                <button aria-label={`delete row ${i}`} onClick={() => onDelete(i)}>
                  Delete
                </button>
                <button aria-label={`move up row ${i}`} onClick={() => onMove(i, -1)}>
                  ↑
                </button>
                <button aria-label={`move down row ${i}`} onClick={() => onMove(i, 1)}>
                  ↓
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

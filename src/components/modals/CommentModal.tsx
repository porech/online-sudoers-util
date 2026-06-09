import { useState } from 'react'
import type { CommentNode } from '../../model/types'
import { ModalShell } from './ModalShell'

interface Props {
  node: CommentNode
  onSave: (node: CommentNode) => void
  onCancel: () => void
}

export function CommentModal({ node, onSave, onCancel }: Props) {
  const [text, setText] = useState(node.text)
  return (
    <ModalShell
      title="Comment"
      onCancel={onCancel}
      onSave={() => onSave({ ...node, text, dirty: true })}
    >
      <label>
        Comment text
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
    </ModalShell>
  )
}

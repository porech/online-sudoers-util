import { useState } from 'react'
import type { IncludeNode } from '../../model/types'
import { ModalShell } from './ModalShell'
import { HelpText } from '../HelpText'

interface Props {
  node: IncludeNode
  onSave: (node: IncludeNode) => void
  onCancel: () => void
}

const KINDS: IncludeNode['includeKind'][] = ['@include', '@includedir', '#include', '#includedir']

export function IncludeModal({ node, onSave, onCancel }: Props) {
  const [includeKind, setKind] = useState(node.includeKind)
  const [path, setPath] = useState(node.path)
  const [inlineComment, setInlineComment] = useState(node.inlineComment ?? '')
  return (
    <ModalShell
      title="Include directive"
      onCancel={onCancel}
      onSave={() =>
        onSave({
          ...node,
          includeKind,
          path,
          dirty: true,
          inlineComment: inlineComment.trim() === '' ? undefined : inlineComment.trim(),
        })
      }
      saveDisabled={path.trim() === ''}
    >
      <label>
        Directive{' '}
        <HelpText>@include reads one file; @includedir reads every file in a directory.</HelpText>
        <select
          value={includeKind}
          onChange={(e) => setKind(e.target.value as IncludeNode['includeKind'])}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label>
        Path
        <input value={path} onChange={(e) => setPath(e.target.value)} />
      </label>
      <label>
        Inline comment{' '}
        <HelpText>
          An optional comment shown after this entry on the same line (the part after #).
        </HelpText>
        <input value={inlineComment} onChange={(e) => setInlineComment(e.target.value)} />
      </label>
    </ModalShell>
  )
}

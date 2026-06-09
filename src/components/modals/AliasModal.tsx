import { useState } from 'react'
import type { AliasNode, AliasDef } from '../../model/types'
import { ModalShell } from './ModalShell'
import { HelpText } from '../HelpText'

interface Props {
  node: AliasNode
  onSave: (node: AliasNode) => void
  onCancel: () => void
}

const KINDS: AliasNode['aliasKind'][] = ['User_Alias', 'Runas_Alias', 'Host_Alias', 'Cmnd_Alias']

const HELP: Record<AliasNode['aliasKind'], string> = {
  User_Alias: 'A named group of users you can reference in the user field of a rule.',
  Runas_Alias: 'A named group of users/groups a command may be run as.',
  Host_Alias: 'A named group of hosts where rules apply.',
  Cmnd_Alias: 'A named group of commands you can reference in a rule.',
}

interface EditDef {
  name: string
  itemsCsv: string
}

function toDef(e: EditDef): AliasDef {
  return {
    name: e.name,
    items: e.itemsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }
}

export function AliasModal({ node, onSave, onCancel }: Props) {
  const [aliasKind, setKind] = useState(node.aliasKind)
  const [defs, setDefs] = useState<EditDef[]>(
    node.defs.map((d) => ({ name: d.name, itemsCsv: d.items.join(', ') })),
  )
  const [inlineComment, setInlineComment] = useState(node.inlineComment ?? '')

  const setName = (i: number, name: string) =>
    setDefs((d) => d.map((x, k) => (k === i ? { ...x, name } : x)))
  const setItemsCsv = (i: number, csv: string) =>
    setDefs((d) => d.map((x, k) => (k === i ? { ...x, itemsCsv: csv } : x)))
  const addDef = () => setDefs((d) => [...d, { name: '', itemsCsv: '' }])
  const removeDef = (i: number) => setDefs((d) => d.filter((_, k) => k !== i))

  return (
    <ModalShell
      title="Alias"
      onCancel={onCancel}
      onSave={() =>
        onSave({
          ...node,
          aliasKind,
          defs: defs.map(toDef),
          dirty: true,
          inlineComment: inlineComment.trim() === '' ? undefined : inlineComment.trim(),
        })
      }
      saveDisabled={defs.length === 0 || defs.some((d) => d.name.trim() === '')}
    >
      <label>
        Alias type <HelpText>{HELP[aliasKind]}</HelpText>
        <select
          value={aliasKind}
          onChange={(e) => setKind(e.target.value as AliasNode['aliasKind'])}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      {defs.map((d, i) => (
        <fieldset key={i}>
          <label>
            Name
            <input value={d.name} onChange={(e) => setName(i, e.target.value)} />
          </label>
          <label>
            {`Items for ${d.name || '(new)'}`}
            <input value={d.itemsCsv} onChange={(e) => setItemsCsv(i, e.target.value)} />
          </label>
          <button type="button" onClick={() => removeDef(i)}>
            Remove definition
          </button>
        </fieldset>
      ))}
      <button type="button" onClick={addDef}>
        Add definition
      </button>

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

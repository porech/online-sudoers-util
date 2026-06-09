import { useState } from 'react'
import type { DefaultsNode, DefaultsParam } from '../../model/types'
import { ModalShell } from './ModalShell'
import { HelpText } from '../HelpText'
import { ALL_DEFAULTS } from '../../model/catalog'

interface Props {
  node: DefaultsNode
  onSave: (node: DefaultsNode) => void
  onCancel: () => void
}

export function DefaultsModal({ node, onSave, onCancel }: Props) {
  const [params, setParams] = useState<DefaultsParam[]>(node.params.map((p) => ({ ...p })))
  const [inlineComment, setInlineComment] = useState(node.inlineComment ?? '')

  const find = (name: string) => params.find((p) => p.name === name)
  const upsert = (p: DefaultsParam) =>
    setParams((cur) => {
      const idx = cur.findIndex((x) => x.name === p.name)
      if (idx === -1) return [...cur, p]
      const next = cur.slice()
      next[idx] = p
      return next
    })
  const removeByName = (name: string) => setParams((cur) => cur.filter((p) => p.name !== name))

  const knownBooleans = ALL_DEFAULTS.filter((d) => d.type === 'flag')
  const knownValued = ALL_DEFAULTS.filter((d) => d.type !== 'flag')
  const additional = params.filter((p) => !p.known)

  const setAdditional = (i: number, patch: Partial<DefaultsParam>) =>
    setParams((cur) => {
      const unknownIdx = cur.map((p, k) => ({ p, k })).filter(({ p }) => !p.known)
      const realIdx = unknownIdx[i]?.k
      if (realIdx === undefined) return cur
      const next = cur.slice()
      next[realIdx] = { ...next[realIdx], ...patch }
      return next
    })
  const addAdditional = () =>
    setParams((cur) => [...cur, { name: '', op: '=', value: '', known: false }])

  return (
    <ModalShell
      title="Defaults"
      onCancel={onCancel}
      onSave={() =>
        onSave({
          ...node,
          params,
          dirty: true,
          inlineComment: inlineComment.trim() === '' ? undefined : inlineComment.trim(),
        })
      }
    >
      <section>
        <h3>Flags</h3>
        {knownBooleans.map((d) => {
          const present = !!find(d.name)
          return (
            <label key={d.name}>
              <input
                type="checkbox"
                checked={present}
                onChange={(e) =>
                  e.target.checked
                    ? upsert({ name: d.name, op: 'bool', known: true })
                    : removeByName(d.name)
                }
              />
              <span>
                <span className="opt-name">{d.name}</span> — <HelpText>{d.description}</HelpText>
              </span>
            </label>
          )
        })}
      </section>

      <section>
        <h3>Values</h3>
        {knownValued.map((d) => {
          const cur = find(d.name)
          return (
            <label key={d.name}>
              <span className="opt-name">{d.name}</span> <HelpText>{d.description}</HelpText>
              <input
                value={cur?.value ?? ''}
                placeholder={d.type}
                onChange={(e) =>
                  e.target.value === ''
                    ? removeByName(d.name)
                    : upsert({
                        name: d.name,
                        op: d.type === 'list' ? '+=' : '=',
                        value: e.target.value,
                        known: true,
                      })
                }
              />
            </label>
          )
        })}
      </section>

      <section>
        <h3>Additional parameters</h3>
        <p className="help">
          Any parameter sudo supports that isn't listed above. Kept exactly as written.
        </p>
        {additional.map((p, i) => (
          <div key={i} className="param-row">
            <input
              aria-label={`param name ${i}`}
              value={p.name}
              onChange={(e) => setAdditional(i, { name: e.target.value })}
            />
            <select
              aria-label={`param op ${i}`}
              value={p.op}
              onChange={(e) => setAdditional(i, { op: e.target.value as DefaultsParam['op'] })}
            >
              <option value="bool">flag</option>
              <option value="=">=</option>
              <option value="+=">+=</option>
              <option value="-=">-=</option>
            </select>
            {p.op !== 'bool' && (
              <input
                aria-label={`param value ${i}`}
                value={p.value ?? ''}
                onChange={(e) => setAdditional(i, { value: e.target.value })}
              />
            )}
            <label>
              <input
                type="checkbox"
                checked={!!p.negated}
                onChange={(e) => setAdditional(i, { negated: e.target.checked })}
              />{' '}
              negate (!)
            </label>
          </div>
        ))}
        <button type="button" onClick={addAdditional}>
          Add parameter
        </button>
      </section>

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

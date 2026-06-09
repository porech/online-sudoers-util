import { useState } from 'react'
import type { UserSpecNode, SpecGroup, CmndSpec, Tag, CmndOption } from '../../model/types'
import { ModalShell } from './ModalShell'
import { HelpText } from '../HelpText'
import { TAGS, tagInfo } from '../../model/catalog'

interface Props {
  node: UserSpecNode
  onSave: (node: UserSpecNode) => void
  onCancel: () => void
}

const clone = (g: SpecGroup): SpecGroup => ({
  hosts: [...g.hosts],
  cmndSpecs: g.cmndSpecs.map((c) => ({
    ...c,
    tags: [...c.tags],
    options: c.options.map((o) => ({ ...o })),
    runas: c.runas ? { users: [...c.runas.users], groups: [...c.runas.groups] } : undefined,
  })),
})

export function UserSpecModal({ node, onSave, onCancel }: Props) {
  const [users, setUsers] = useState(node.users.join(', '))
  const [groups, setGroups] = useState<SpecGroup[]>(node.specGroups.map(clone))
  const [inlineComment, setInlineComment] = useState(node.inlineComment ?? '')

  const updateGroup = (gi: number, patch: Partial<SpecGroup>) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)))
  const updateCmnd = (gi: number, ci: number, patch: Partial<CmndSpec>) =>
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi
          ? { ...g, cmndSpecs: g.cmndSpecs.map((c, k) => (k === ci ? { ...c, ...patch } : c)) }
          : g,
      ),
    )
  const toggleTag = (gi: number, ci: number, tag: Tag) =>
    setGroups((gs) =>
      gs.map((g, i) => {
        if (i !== gi) return g
        return {
          ...g,
          cmndSpecs: g.cmndSpecs.map((c, k) => {
            if (k !== ci) return c
            const has = c.tags.includes(tag)
            return { ...c, tags: has ? c.tags.filter((t) => t !== tag) : [...c.tags, tag] }
          }),
        }
      }),
    )
  const updateOptions = (gi: number, ci: number, options: CmndOption[]) =>
    updateCmnd(gi, ci, { options })
  const updateOption = (gi: number, ci: number, oi: number, patch: Partial<CmndOption>) =>
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi
          ? {
              ...g,
              cmndSpecs: g.cmndSpecs.map((c, k) =>
                k === ci
                  ? { ...c, options: c.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) }
                  : c,
              ),
            }
          : g,
      ),
    )
  const addCmnd = (gi: number) =>
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi
          ? { ...g, cmndSpecs: [...g.cmndSpecs, { tags: [], options: [], command: '' }] }
          : g,
      ),
    )
  const addGroup = () =>
    setGroups((gs) => [
      ...gs,
      { hosts: ['ALL'], cmndSpecs: [{ tags: [], options: [], command: 'ALL' }] },
    ])

  const save = () =>
    onSave({
      ...node,
      dirty: true,
      users: users
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      specGroups: groups.map((g) => ({
        ...g,
        cmndSpecs: g.cmndSpecs.map((c) => ({
          ...c,
          options: c.options.filter((o) => o.name.trim() !== ''),
        })),
      })),
      inlineComment: inlineComment.trim() === '' ? undefined : inlineComment.trim(),
    })

  return (
    <ModalShell title="User specification" onCancel={onCancel} onSave={save}>
      <label>
        Users{' '}
        <HelpText>
          Who the rule applies to — one or more usernames, %group names, or a User_Alias, separated
          by commas (e.g. alice, %wheel).
        </HelpText>
        <input value={users} onChange={(e) => setUsers(e.target.value)} />
      </label>

      {groups.map((g, gi) => (
        <fieldset key={gi}>
          <label>
            Hosts{' '}
            <HelpText>
              Where the rule applies — one or more hostnames, ALL, or a Host_Alias, separated by
              commas.
            </HelpText>
            <input
              value={g.hosts.join(', ')}
              onChange={(e) =>
                updateGroup(gi, {
                  hosts: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>

          {g.cmndSpecs.map((c, ci) => (
            <div key={ci} className="cmnd-spec">
              <label>
                Run as{' '}
                <HelpText>
                  The identity the command runs as: one or more users, optionally followed by a
                  colon and one or more groups — e.g. root or root, deploy:wheel. Multiple
                  users/groups are comma-separated. Leave blank for the default (root).
                </HelpText>
                <input
                  value={
                    c.runas
                      ? `${c.runas.users.join(', ')}${c.runas.groups.length ? ':' + c.runas.groups.join(', ') : ''}`
                      : ''
                  }
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    if (v === '') return updateCmnd(gi, ci, { runas: undefined })
                    const [u, grp] = v.split(':')
                    updateCmnd(gi, ci, {
                      runas: {
                        users: u
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                        groups: (grp ?? '')
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    })
                  }}
                />
              </label>
              <label>
                Command{' '}
                <HelpText>
                  A single command: a full path (e.g. /usr/bin/apt), ALL for any command, or a
                  Cmnd_Alias. Prefix with ! to forbid it. To allow several commands, click “Add
                  command” below to add a row for each.
                </HelpText>
                <input
                  value={c.command}
                  onChange={(e) => updateCmnd(gi, ci, { command: e.target.value })}
                />
              </label>
              <div className="tag-section">
                <span className="options-label">
                  Tags{' '}
                  <HelpText>
                    Tags change how this command runs. Check any that apply — each tag carries
                    forward to the commands after it in the same list until you change it.
                  </HelpText>
                </span>
                <ul className="tag-list">
                  {TAGS.map((t) => (
                    <li key={t}>
                      <label>
                        <input
                          type="checkbox"
                          checked={c.tags.includes(t)}
                          onChange={() => toggleTag(gi, ci, t)}
                        />
                        <span>
                          <span className="opt-name">{t}</span> — <HelpText>{tagInfo(t)}</HelpText>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="options">
                <span className="options-label">
                  Options{' '}
                  <HelpText>
                    Per-command options like CWD (working directory), TIMEOUT, or CHROOT, written as
                    NAME=value.
                  </HelpText>
                </span>
                {c.options.map((o, oi) => (
                  <div key={oi} className="option-row">
                    <input
                      aria-label={`option name ${gi}-${ci}-${oi}`}
                      value={o.name}
                      onChange={(e) => updateOption(gi, ci, oi, { name: e.target.value })}
                    />
                    <span> = </span>
                    <input
                      aria-label={`option value ${gi}-${ci}-${oi}`}
                      value={o.value}
                      onChange={(e) => updateOption(gi, ci, oi, { value: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateOptions(
                          gi,
                          ci,
                          c.options.filter((_, j) => j !== oi),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateOptions(gi, ci, [...c.options, { name: '', value: '' }])}
                >
                  Add option
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => addCmnd(gi)}>
            Add command
          </button>
        </fieldset>
      ))}
      <button type="button" onClick={addGroup}>
        Add host group
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

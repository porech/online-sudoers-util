import type { Line, AliasNode, AliasDef } from './types'
import { tokenize } from './tokenizer'
import { splitTopLevel } from './parseDefaults'

const KINDS = ['User_Alias', 'Runas_Alias', 'Host_Alias', 'Cmnd_Alias'] as const

export function parseAlias(raw: string, _line: number): Line {
  const { inlineComment } = tokenize(raw)
  const work = stripInlineComment(raw.trim())

  const kind = KINDS.find((k) => work.startsWith(k))
  if (!kind) throw new Error('unknown alias keyword')

  const rest = work.slice(kind.length).trim()
  const defs: AliasDef[] = splitTopLevel(rest, ':').map((segment) => {
    const eq = segment.indexOf('=')
    if (eq === -1) throw new Error(`alias definition missing '=': ${segment.trim()}`)
    const name = segment.slice(0, eq).trim()
    const items = splitTopLevel(segment.slice(eq + 1), ',').map((s) => s.trim()).filter((s) => s !== '')
    return { name, items }
  })

  const node: AliasNode = { kind: 'alias', raw, dirty: false, aliasKind: kind, defs }
  if (inlineComment !== undefined) node.inlineComment = inlineComment
  return node
}

function stripInlineComment(s: string): string {
  let inD = false
  let inS = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length) { i++; continue }
    if (c === '"' && !inS) inD = !inD
    else if (c === "'" && !inD) inS = !inS
    else if (c === '#' && !inD && !inS) return s.slice(0, i).trim()
  }
  return s
}

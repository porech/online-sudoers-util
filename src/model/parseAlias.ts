import type { Line, AliasNode, AliasDef } from './types'
import { splitTopLevel } from './parseDefaults'
import { splitInlineComment } from './inlineComment'

const KINDS = ['User_Alias', 'Runas_Alias', 'Host_Alias', 'Cmnd_Alias'] as const

export function parseAlias(raw: string, _line: number): Line {
  const { body: work, inlineComment } = splitInlineComment(raw)

  const kind = KINDS.find((k) => work.startsWith(k))
  if (!kind) throw new Error('unknown alias keyword')

  const rest = work.slice(kind.length).trim()
  const defs: AliasDef[] = splitTopLevel(rest, ':').map((segment) => {
    const eq = segment.indexOf('=')
    if (eq === -1) throw new Error(`alias definition missing '=': ${segment.trim()}`)
    const name = segment.slice(0, eq).trim()
    const items = splitTopLevel(segment.slice(eq + 1), ',')
      .map((s) => s.trim())
      .filter((s) => s !== '')
    return { name, items }
  })

  const node: AliasNode = { kind: 'alias', raw, dirty: false, aliasKind: kind, defs }
  if (inlineComment !== undefined) node.inlineComment = inlineComment
  return node
}

import type { Line, DefaultsNode, DefaultsParam, DefaultsBinding } from './types'
import { tokenize } from './tokenizer'
import { isKnownDefault } from './catalog'

// We work off the raw string for params because values can contain '=' inside
// quotes; we split params by top-level commas using the tokenizer for the head.
export function parseDefaults(raw: string, _line: number): Line {
  const { inlineComment } = tokenize(raw)
  const trimmed = raw.trim()

  // Separate the inline comment off the working string.
  const work = stripInlineComment(trimmed)

  const m = /^Defaults([@:!>])?(\S*)?\s*(.*)$/.exec(work)
  if (!m) throw new Error('malformed Defaults line')

  let binding: DefaultsBinding | undefined
  if (m[1]) binding = { type: m[1] as DefaultsBinding['type'], value: m[2] ?? '' }

  const body = m[3].trim()
  const params = body === '' ? [] : splitTopLevel(body, ',').map(parseParam)

  const node: DefaultsNode = {
    kind: 'defaults', raw, dirty: false, binding, params,
  }
  if (inlineComment !== undefined) node.inlineComment = inlineComment
  return node
}

function parseParam(seg: string): DefaultsParam {
  const s = seg.trim()
  const neg = s.startsWith('!')
  const rest = neg ? s.slice(1).trim() : s

  const opMatch = /^([A-Za-z0-9_]+)\s*(\+=|-=|=)\s*(.*)$/.exec(rest)
  if (opMatch) {
    const name = opMatch[1]
    return {
      name,
      op: opMatch[2] as '=' | '+=' | '-=',
      value: opMatch[3].trim(),
      known: isKnownDefault(name),
      ...(neg ? { negated: true } : {}),
    }
  }
  return {
    name: rest,
    op: 'bool',
    known: isKnownDefault(rest),
    ...(neg ? { negated: true } : {}),
  }
}

// Split on a delimiter that is not inside quotes.
export function splitTopLevel(s: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inD = false
  let inS = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length) { cur += c + s[i + 1]; i++; continue }
    if (c === '"' && !inS) inD = !inD
    else if (c === "'" && !inD) inS = !inS
    if (c === delim && !inD && !inS) { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out
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

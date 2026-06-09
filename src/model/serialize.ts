import type { Line, DefaultsNode, DefaultsParam } from './types'

export function serializeLine(line: Line): string {
  let body: string
  switch (line.kind) {
    case 'blank': return line.raw === '' ? '' : line.raw
    case 'comment': body = `# ${line.text}`; return body // comments have no inline comment
    case 'include': body = `${line.includeKind} ${line.path}`; break
    case 'defaults': body = serializeDefaults(line); break
    case 'error': return line.raw
    case 'alias': throw new Error('serializeAlias added in Phase 4')
    case 'userspec': throw new Error('serializeUserSpec added in Phase 6')
  }
  return appendInline(body, line.inlineComment)
}

function appendInline(body: string, inline?: string): string {
  if (inline === undefined) return body
  return inline === '' ? `${body} #` : `${body} # ${inline}`
}

function serializeDefaults(n: DefaultsNode): string {
  const head = n.binding ? `Defaults${n.binding.type}${n.binding.value}` : 'Defaults'
  const params = n.params.map(serializeParam).join(', ')
  return params === '' ? head : `${head} ${params}`
}

function serializeParam(p: DefaultsParam): string {
  const neg = p.negated ? '!' : ''
  if (p.op === 'bool') return `${neg}${p.name}`
  return `${neg}${p.name}${p.op}${p.value ?? ''}`
}

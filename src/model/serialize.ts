import type {
  Line, DefaultsNode, DefaultsParam, AliasNode,
  UserSpecNode, SpecGroup, CmndSpec, RunasSpec, Tag,
  SudoersDocument,
} from './types'

export function serializeLine(line: Line): string {
  let body: string
  switch (line.kind) {
    case 'blank': return line.raw === '' ? '' : line.raw
    case 'comment': body = `# ${line.text}`; return body // comments have no inline comment
    case 'include': body = `${line.includeKind} ${line.path}`; break
    case 'defaults': body = serializeDefaults(line); break
    case 'error': return line.raw
    case 'alias': body = serializeAlias(line); break
    case 'userspec': body = serializeUserSpec(line); break
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

function serializeAlias(n: AliasNode): string {
  const defs = n.defs
    .map((d) => `${d.name} = ${d.items.join(', ')}`)
    .join(' : ')
  return `${n.aliasKind} ${defs}`
}

function serializeUserSpec(n: UserSpecNode): string {
  const users = n.users.join(', ')
  const groups = n.specGroups.map(serializeSpecGroup).join(' : ')
  return `${users} ${groups}`
}

function serializeSpecGroup(g: SpecGroup): string {
  const hosts = g.hosts.join(', ')
  const cmnds = serializeCmndSpecList(g.cmndSpecs)
  return `${hosts} = ${cmnds}`
}

function serializeCmndSpecList(specs: CmndSpec[]): string {
  let prevRunas: string | undefined
  let prevTags: Tag[] = []
  return specs
    .map((s) => {
      const parts: string[] = []
      const runasStr = s.runas ? serializeRunas(s.runas) : undefined
      if (runasStr !== undefined && runasStr !== prevRunas) {
        parts.push(runasStr)
        prevRunas = runasStr
      }
      const newTags = s.tags.filter((t) => !prevTags.includes(t))
      for (const t of newTags) parts.push(`${t}:`)
      prevTags = s.tags
      for (const o of s.options) parts.push(`${o.name}=${o.value}`)
      parts.push(s.command)
      return parts.join(' ')
    })
    .join(', ')
}

function serializeRunas(r: RunasSpec): string {
  const u = r.users.join(', ')
  return r.groups.length > 0 ? `(${u}:${r.groups.join(', ')})` : `(${u})`
}

export function serializeDocument(doc: SudoersDocument): string {
  return doc.lines
    .map((line) => (line.dirty ? serializeLine(line) : line.raw))
    .join('\n')
}

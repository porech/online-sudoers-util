import type { Line, IncludeNode } from './types'

const KINDS = ['@includedir', '@include', '#includedir', '#include'] as const

export function parseInclude(raw: string, _line: number): Line {
  const trimmed = raw.trim()
  const kind = KINDS.find((k) => trimmed.startsWith(k))
  if (!kind) throw new Error('not an include directive')
  const path = trimmed.slice(kind.length).trim()
  const node: IncludeNode = { kind: 'include', raw, dirty: false, includeKind: kind, path }
  return node
}

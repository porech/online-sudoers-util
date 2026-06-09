import type { Line } from '../model/types'
import { serializeLine } from '../model/serialize'

export function lineTypeLabel(l: Line): string {
  switch (l.kind) {
    case 'userspec':
      return 'User spec'
    case 'alias':
      return l.aliasKind.replace('_', ' ')
    case 'defaults':
      return 'Defaults'
    case 'include':
      return 'Include'
    case 'comment':
      return 'Comment'
    case 'blank':
      return 'Blank'
    case 'error':
      return 'Error'
  }
}

export function lineSummary(l: Line): string {
  switch (l.kind) {
    case 'userspec': {
      const users = l.users.join(', ')
      const rest = serializeLine({ ...l, dirty: true })
        .slice(users.length)
        .trim()
      return `${users} → ${rest}`
    }
    case 'defaults': {
      const head = l.binding ? `${l.binding.type}${l.binding.value} ` : ''
      const body = serializeLine({ ...l, dirty: true }).replace(/^Defaults[@:!>]?\S*\s*/, '')
      return `${head}${body}`.trim()
    }
    case 'alias':
      return l.defs.map((d) => `${d.name} = ${d.items.join(', ')}`).join(' : ')
    case 'include':
      return `${l.includeKind} ${l.path}`
    case 'comment':
      return l.text
    case 'blank':
      return ''
    case 'error':
      return l.message
  }
}

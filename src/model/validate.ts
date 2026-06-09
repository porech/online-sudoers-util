import type { SudoersDocument } from './types'
import { isAlias, isUserSpec } from './types'

export interface Warning {
  lineIndex: number
  message: string
}

// An uppercase identifier (no slash, no leading %) used as a command but not
// defined by any Cmnd_Alias is probably a typo'd alias reference.
const ALIAS_NAME = /^[A-Z][A-Z0-9_]*$/

export function validateDocument(doc: SudoersDocument): Warning[] {
  const cmndAliases = new Set<string>()
  for (const l of doc.lines) {
    if (isAlias(l) && l.aliasKind === 'Cmnd_Alias') {
      for (const d of l.defs) cmndAliases.add(d.name)
    }
  }

  const warnings: Warning[] = []
  doc.lines.forEach((l, lineIndex) => {
    if (!isUserSpec(l)) return
    for (const g of l.specGroups) {
      for (const c of g.cmndSpecs) {
        const cmd = c.command.replace(/^!/, '')
        if (cmd !== 'ALL' && ALIAS_NAME.test(cmd) && !cmndAliases.has(cmd)) {
          warnings.push({
            lineIndex,
            message: `Command "${cmd}" looks like an alias but no Cmnd_Alias defines it.`,
          })
        }
      }
    }
  })
  return warnings
}

import type { Line, ErrorNode } from './types'
import { parseDefaults } from './parseDefaults'
import { parseAlias } from './parseAlias'
import { parseInclude } from './parseInclude'
import { parseUserSpec } from './parseUserSpec'

const ALIAS_KW = /^(User_Alias|Runas_Alias|Host_Alias|Cmnd_Alias)\b/
const DEFAULTS_KW = /^Defaults\b|^Defaults[@:!>]/
const INCLUDE_KW = /^(@include(dir)?|#include(dir)?)\b/

export function parseLine(raw: string, line: number): Line {
  const trimmed = raw.trim()

  if (trimmed === '') return { kind: 'blank', raw, dirty: false }

  if (INCLUDE_KW.test(trimmed)) return parseInclude(raw, line)

  if (trimmed.startsWith('#')) {
    return { kind: 'comment', raw, dirty: false, text: trimmed.slice(1).trim() }
  }

  try {
    if (DEFAULTS_KW.test(trimmed)) return parseDefaults(raw, line)
    if (ALIAS_KW.test(trimmed)) return parseAlias(raw, line)
    return parseUserSpec(raw, line)
  } catch (e) {
    const err: ErrorNode = {
      kind: 'error',
      raw,
      dirty: false,
      line,
      message: e instanceof Error ? e.message : String(e),
    }
    return err
  }
}

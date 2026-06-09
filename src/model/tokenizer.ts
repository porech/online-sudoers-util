const STRUCT = new Set(['=', '(', ')', ':', ','])

export interface TokenizeResult {
  tokens: string[]
  inlineComment?: string
}

// `#include` / `#includedir` are directives, not comments, when at line start.
function startsWithIncludeDirective(s: string): boolean {
  return /^#include(dir)?\b/.test(s.trimStart())
}

export function tokenize(line: string): TokenizeResult {
  const isInclude = startsWithIncludeDirective(line)
  const tokens: string[] = []
  let cur = ''
  let inDquote = false
  let inSquote = false
  let inlineComment: string | undefined

  const push = () => {
    if (cur !== '') {
      tokens.push(cur)
      cur = ''
    }
  }

  for (let i = 0; i < line.length; i++) {
    const c = line[i]

    if (c === '\\' && i + 1 < line.length) {
      // keep the escape and the next char verbatim (escaped space, etc.)
      cur += c + line[i + 1]
      i++
      continue
    }
    if (c === '"' && !inSquote) {
      inDquote = !inDquote
      cur += c
      continue
    }
    if (c === "'" && !inDquote) {
      inSquote = !inSquote
      cur += c
      continue
    }

    if (!inDquote && !inSquote) {
      if (c === '#' && !isInclude) {
        push()
        inlineComment = line.slice(i + 1).trim()
        return { tokens, inlineComment: inlineComment === '' ? '' : inlineComment }
      }
      if (c === ' ' || c === '\t') {
        push()
        continue
      }
      if (STRUCT.has(c)) {
        push()
        tokens.push(c)
        continue
      }
    }
    cur += c
  }
  push()
  return { tokens, inlineComment }
}

import { StreamLanguage, type StreamParser } from '@codemirror/language'

const KEYWORDS =
  /^(Defaults|User_Alias|Runas_Alias|Host_Alias|Cmnd_Alias|@includedir|@include|#includedir|#include)\b/
const TAGS =
  /^(NOPASSWD|PASSWD|NOEXEC|EXEC|SETENV|NOSETENV|LOG_INPUT|NOLOG_INPUT|LOG_OUTPUT|NOLOG_OUTPUT|MAIL|NOMAIL|FOLLOW|NOFOLLOW|INTERCEPT|NOINTERCEPT)\b/
const ALIAS_REF = /^[A-Z][A-Z0-9_]*\b/

interface SudoersState {
  startedInclude: boolean
}

export const sudoersStreamParser: StreamParser<SudoersState> = {
  startState: () => ({ startedInclude: false }),
  token(stream, _state): string | null {
    if (stream.sol() && stream.match(/^#include(dir)?\b/, false)) {
      // include directive starting with '#': treat as keyword, not comment.
      stream.match(KEYWORDS)
      return 'keyword'
    }
    if (stream.eatSpace()) return null
    const ch = stream.peek()
    if (ch === '#') {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match(KEYWORDS)) return 'keyword'
    if (stream.match(TAGS)) return 'labelName'
    if (ch === '"' || ch === "'") {
      const quote = stream.next()
      let escaped = false
      while (!stream.eol()) {
        const c = stream.next()
        if (c === quote && !escaped) break
        escaped = c === '\\' && !escaped
      }
      return 'string'
    }
    if (/[=(),:!]/.test(ch ?? '')) {
      stream.next()
      return 'operator'
    }
    if (stream.match(ALIAS_REF)) return 'typeName'
    stream.eatWhile(/[^\s=(),:!#'"]/)
    return null
  },
}

export const sudoersLanguage = StreamLanguage.define(sudoersStreamParser)

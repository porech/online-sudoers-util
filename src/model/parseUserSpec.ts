import type { Line, UserSpecNode, SpecGroup, CmndSpec, RunasSpec, Tag, CmndOption } from './types'
import { splitTopLevel } from './parseDefaults'
import { isTag } from './catalog'
import { splitInlineComment } from './inlineComment'

export function parseUserSpec(raw: string, _line: number): Line {
  const { body: work, inlineComment } = splitInlineComment(raw)

  // Split "userlist hostgroup=cmnds [: hostgroup=cmnds]*"
  // The first whitespace run after the user list separates users from the rest.
  const firstSpace = indexOfTopLevelSpace(work)
  if (firstSpace === -1) throw new Error('user spec missing host/command section')

  const usersPart = work.slice(0, firstSpace).trim()
  const remainder = work.slice(firstSpace + 1).trim()
  const users = splitTopLevel(usersPart, ',')
    .map((s) => s.trim())
    .filter(Boolean)

  const groups: SpecGroup[] = splitSpecGroups(remainder).map((seg) => parseSpecGroup(seg.trim()))

  const node: UserSpecNode = { kind: 'userspec', raw, dirty: false, users, specGroups: groups }
  if (inlineComment !== undefined) node.inlineComment = inlineComment
  return node
}

function parseSpecGroup(seg: string): SpecGroup {
  const eq = seg.indexOf('=')
  if (eq === -1) throw new Error(`spec group missing '=': ${seg}`)
  const hosts = splitTopLevel(seg.slice(0, eq), ',')
    .map((s) => s.trim())
    .filter(Boolean)
  const cmndPart = seg.slice(eq + 1).trim()
  const cmndSpecs = parseCmndSpecList(cmndPart)
  return { hosts, cmndSpecs }
}

function parseCmndSpecList(s: string): CmndSpec[] {
  // Split on top-level commas, skipping commas inside a runas spec's parentheses
  // (e.g. "(root, daemon) /bin/a" is ONE command spec, not two).
  const segments = splitTopLevelParen(s, ',')
    .map((x) => x.trim())
    .filter(Boolean)
  let inheritedRunas: RunasSpec | undefined
  let inheritedTags: Tag[] = []
  const specs: CmndSpec[] = []

  for (const seg of segments) {
    const parsed = parseOneCmndSpec(seg)
    if (parsed.runas) inheritedRunas = parsed.runas
    // tags accumulate/override: a present tag replaces; we merge by name family.
    inheritedTags = mergeTags(inheritedTags, parsed.tags)

    const spec: CmndSpec = {
      tags: [...inheritedTags],
      options: parsed.options,
      command: parsed.command,
    }
    if (inheritedRunas)
      spec.runas = { users: [...inheritedRunas.users], groups: [...inheritedRunas.groups] }
    specs.push(spec)
  }
  return specs
}

interface RawCmndSpec {
  runas?: RunasSpec
  tags: Tag[]
  options: CmndOption[]
  command: string
}

function parseOneCmndSpec(seg: string): RawCmndSpec {
  let rest = seg
  let runas: RunasSpec | undefined
  const tags: Tag[] = []
  const options: CmndOption[] = []

  // Optional runas at the start: (users:groups)
  const runasMatch = /^\(([^)]*)\)\s*(.*)$/.exec(rest)
  if (runasMatch) {
    runas = parseRunas(runasMatch[1])
    rest = runasMatch[2].trim()
  }

  // Leading "TAG:" tokens and "OPTION=value" tokens, then the command.
  // Tags are of the form WORD followed by ':'. Options are WORD=value.
  // Loop consuming prefix tokens.
  for (;;) {
    const tagMatch = /^([A-Z_]+)\s*:\s*(.*)$/.exec(rest)
    if (tagMatch && isTag(tagMatch[1])) {
      tags.push(tagMatch[1] as Tag)
      rest = tagMatch[2].trim()
      continue
    }
    const optMatch = /^([A-Z_]+)=("[^"]*"|\S+)\s+(.*)$/.exec(rest)
    if (optMatch) {
      options.push({ name: optMatch[1], value: optMatch[2] })
      rest = optMatch[3].trim()
      continue
    }
    break
  }

  return { runas, tags, options, command: rest.trim() }
}

function parseRunas(inside: string): RunasSpec {
  const colon = splitTopLevel(inside, ':')
  const users = splitTopLevel(colon[0] ?? '', ',')
    .map((s) => s.trim())
    .filter(Boolean)
  const groups =
    colon.length > 1
      ? splitTopLevel(colon[1], ',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
  return { users, groups }
}

// Replace any tag with its opposite if present; otherwise append.
function mergeTags(base: Tag[], incoming: Tag[]): Tag[] {
  const opposite: Partial<Record<Tag, Tag>> = {
    NOPASSWD: 'PASSWD',
    PASSWD: 'NOPASSWD',
    NOEXEC: 'EXEC',
    EXEC: 'NOEXEC',
    SETENV: 'NOSETENV',
    NOSETENV: 'SETENV',
    LOG_INPUT: 'NOLOG_INPUT',
    NOLOG_INPUT: 'LOG_INPUT',
    LOG_OUTPUT: 'NOLOG_OUTPUT',
    NOLOG_OUTPUT: 'LOG_OUTPUT',
    MAIL: 'NOMAIL',
    NOMAIL: 'MAIL',
    FOLLOW: 'NOFOLLOW',
    NOFOLLOW: 'FOLLOW',
    INTERCEPT: 'NOINTERCEPT',
    NOINTERCEPT: 'INTERCEPT',
  }
  const result = [...base]
  for (const t of incoming) {
    const opp = opposite[t]
    const filtered = result.filter((x) => x !== t && x !== opp)
    filtered.push(t)
    result.length = 0
    result.push(...filtered)
  }
  return result
}

// Split the remainder of a UserSpec into SpecGroup segments at the structural ':'.
// A top-level ':' separates HostList=CmndSpecList groups UNLESS it is:
//   - inside a runas spec's parentheses  (e.g. the ':' in "(root:wheel)"), or
//   - the colon terminating a tag keyword (e.g. the ':' in "NOPASSWD:").
// A tag colon is identified by the uppercase word immediately preceding it. This
// is robust against inline options like "CWD=/x" whose '=' would otherwise be
// mistaken for a group separator by an '='-counting approach.
function splitSpecGroups(s: string): string[] {
  const result: string[] = []
  let segStart = 0
  let inD = false
  let inS = false
  let inParen = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length) {
      i++
      continue
    }
    if (c === '"' && !inS) {
      inD = !inD
      continue
    }
    if (c === "'" && !inD) {
      inS = !inS
      continue
    }
    if (inD || inS) continue
    if (c === '(') {
      inParen++
      continue
    }
    if (c === ')') {
      if (inParen > 0) inParen--
      continue
    }
    if (c === ':' && inParen === 0 && !isTagColon(s, i)) {
      result.push(s.slice(segStart, i))
      segStart = i + 1
    }
  }
  result.push(s.slice(segStart))
  return result
}

// True if the ':' at index i terminates a tag keyword (e.g. the ':' in "NOPASSWD:").
function isTagColon(s: string, i: number): boolean {
  let j = i - 1
  while (j >= 0 && (s[j] === ' ' || s[j] === '\t')) j--
  const end = j
  while (j >= 0 && /[A-Z_]/.test(s[j])) j--
  const word = s.slice(j + 1, end + 1)
  return word.length > 0 && isTag(word)
}

// Like splitTopLevel but also skips content inside parentheses.
function splitTopLevelParen(s: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inD = false
  let inS = false
  let inParen = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length) {
      cur += c + s[i + 1]
      i++
      continue
    }
    if (c === '"' && !inS) inD = !inD
    else if (c === "'" && !inD) inS = !inS
    else if (c === '(' && !inD && !inS) inParen++
    else if (c === ')' && !inD && !inS) inParen--
    if (c === delim && !inD && !inS && inParen === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur)
  return out
}

function indexOfTopLevelSpace(s: string): number {
  let inD = false
  let inS = false
  let inParen = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length) {
      i++
      continue
    }
    if (c === '"' && !inS) inD = !inD
    else if (c === "'" && !inD) inS = !inS
    else if (c === '(' && !inD && !inS) inParen++
    else if (c === ')' && !inD && !inS) inParen--
    else if ((c === ' ' || c === '\t') && !inD && !inS && inParen === 0) return i
  }
  return -1
}

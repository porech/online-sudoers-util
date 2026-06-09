# Online Sudoers Util Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side web app that parses, generates, and bidirectionally edits sudoers files via a syntax-highlighted editor and a graphical table, deployed to GitHub Pages.

**Architecture:** A pure, framework-free model layer (`Document` = ordered list of typed `Line` nodes) is the single source of truth. A tokenizer + recursive-descent parser turns text into the model; a serializer turns it back, re-emitting only edited (`dirty`) nodes and reusing original `raw` text for untouched lines. A sync engine projects the model into a CodeMirror editor and a React table, guarded against feedback loops. Undo/redo is a model-level snapshot stack; persistence is a versioned `localStorage` envelope.

**Tech Stack:** Vite, React, TypeScript, CodeMirror 6, Vitest, Testing Library, ESLint, Prettier, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-06-09-online-sudoers-util-design.md`

---

## File Structure

```
src/
  model/
    types.ts          # Line union, Document, sub-types, type guards
    tokenizer.ts      # logical-line tokenizer (continuations, quotes, comments)
    catalog.ts        # known Defaults params + tags + descriptions
    parseDefaults.ts  # Defaults line -> DefaultsNode
    parseAlias.ts     # *_Alias line -> AliasNode
    parseInclude.ts   # @include/#include line -> IncludeNode
    parseUserSpec.ts  # user spec line -> UserSpecNode (runas/tag/option inheritance)
    parseLine.ts      # dispatch a single physical/logical line -> Line
    parseDocument.ts  # full text -> Document, with line-diff against previous
    serialize.ts      # Line -> text (only called on dirty nodes); Document -> text
    validate.ts       # non-blocking warnings (undefined alias references)
  sync/
    storage.ts        # versioned localStorage envelope (load/save active session)
    history.ts        # undo/redo snapshot stack with coalescing
    useDocument.ts    # React hook: model state + sync orchestration + origin guard
  editor/
    sudoersLanguage.ts # CodeMirror StreamLanguage sudoers highlighter
    Editor.tsx         # CodeMirror 6 React wrapper
  components/
    Table.tsx
    Toolbar.tsx
    AddEntryMenu.tsx
    modals/
      ModalShell.tsx
      UserSpecModal.tsx
      AliasModal.tsx
      DefaultsModal.tsx
      IncludeModal.tsx
      CommentModal.tsx
    HelpText.tsx
  App.tsx
  main.tsx
tests/                 # mirrors src/, plus tests/fixtures/*.sudoers corpus
```

---

## Phase 0 — Project scaffold

### Task 0.1: Initialize Vite React-TS project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Scaffold with Vite**

Run from the repo root (`/home/alerinaldi/online-sudoers-util`):

```bash
npm create vite@latest . -- --template react-ts
npm install
```

If Vite refuses because the directory is non-empty (it contains `docs/`, `.git/`, `.gitignore`), scaffold in a temp dir and copy:

```bash
npm create vite@latest .vite-tmp -- --template react-ts
cp -rn .vite-tmp/. .
rm -rf .vite-tmp
npm install
```

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
npm install codemirror @codemirror/state @codemirror/view @codemirror/language @codemirror/commands @lezer/highlight
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @vitest/coverage-v8 eslint prettier eslint-config-prettier
```

- [ ] **Step 3: Configure Vite base path + Vitest**

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/online-sudoers-util/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

Create `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add scripts**

In `package.json`, set the `scripts` block to:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "eslint . && prettier --check ."
}
```

- [ ] **Step 5: Smoke test the toolchain**

Run: `npm run build`
Expected: TypeScript compiles and `dist/` is produced with no errors.

Run: `npm run test`
Expected: "No test files found" (exit 0) — toolchain works, no tests yet.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React-TS project with Vitest"
```

---

## Phase 1 — Model types & tokenizer

### Task 1.1: Define the model types

**Files:**
- Create: `src/model/types.ts`
- Test: `src/model/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { isUserSpec, makeBlank, type Line } from './types'

describe('model types', () => {
  it('type guard narrows a UserSpec node', () => {
    const line: Line = {
      kind: 'userspec',
      raw: 'root ALL=(ALL) ALL',
      dirty: false,
      users: ['root'],
      specGroups: [
        { hosts: ['ALL'], cmndSpecs: [{ runas: { users: ['ALL'], groups: [] }, tags: [], options: [], command: 'ALL' }] },
      ],
    }
    expect(isUserSpec(line)).toBe(true)
    if (isUserSpec(line)) expect(line.users).toEqual(['root'])
  })

  it('makeBlank builds a blank node', () => {
    expect(makeBlank()).toEqual({ kind: 'blank', raw: '', dirty: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/types.test.ts`
Expected: FAIL — cannot find module `./types`.

- [ ] **Step 3: Implement the types**

```ts
export type Tag =
  | 'NOPASSWD' | 'PASSWD' | 'NOEXEC' | 'EXEC'
  | 'SETENV' | 'NOSETENV' | 'LOG_INPUT' | 'NOLOG_INPUT'
  | 'LOG_OUTPUT' | 'NOLOG_OUTPUT' | 'MAIL' | 'NOMAIL'
  | 'FOLLOW' | 'NOFOLLOW' | 'INTERCEPT' | 'NOINTERCEPT'

export interface RunasSpec {
  users: string[]
  groups: string[]
}

export interface CmndOption {
  name: string   // e.g. CWD, TIMEOUT, CHROOT
  value: string
}

export interface CmndSpec {
  runas?: RunasSpec
  tags: Tag[]
  options: CmndOption[]
  command: string // may be negated with a leading '!'
}

export interface SpecGroup {
  hosts: string[]
  cmndSpecs: CmndSpec[]
}

export interface DefaultsParam {
  name: string
  op: '=' | '+=' | '-=' | 'bool'
  value?: string
  negated?: boolean // for boolean flags written as !flag
  known: boolean
}

export interface DefaultsBinding {
  type: '@' | ':' | '!' | '>'
  value: string
}

export interface AliasDef {
  name: string
  items: string[]
}

interface Base {
  raw: string
  dirty: boolean
  inlineComment?: string
}

export interface UserSpecNode extends Base {
  kind: 'userspec'
  users: string[]
  specGroups: SpecGroup[]
}

export interface AliasNode extends Base {
  kind: 'alias'
  aliasKind: 'User_Alias' | 'Runas_Alias' | 'Host_Alias' | 'Cmnd_Alias'
  defs: AliasDef[]
}

export interface DefaultsNode extends Base {
  kind: 'defaults'
  binding?: DefaultsBinding
  params: DefaultsParam[]
}

export interface IncludeNode extends Base {
  kind: 'include'
  includeKind: '@include' | '@includedir' | '#include' | '#includedir'
  path: string
}

export interface CommentNode extends Base {
  kind: 'comment'
  text: string // content after the leading '#', not including it
}

export interface BlankNode extends Base {
  kind: 'blank'
}

export interface ErrorNode extends Base {
  kind: 'error'
  message: string
  line: number
}

export type Line =
  | UserSpecNode | AliasNode | DefaultsNode | IncludeNode
  | CommentNode | BlankNode | ErrorNode

export interface SudoersDocument {
  lines: Line[]
}

export const isUserSpec = (l: Line): l is UserSpecNode => l.kind === 'userspec'
export const isAlias = (l: Line): l is AliasNode => l.kind === 'alias'
export const isDefaults = (l: Line): l is DefaultsNode => l.kind === 'defaults'
export const isInclude = (l: Line): l is IncludeNode => l.kind === 'include'
export const isComment = (l: Line): l is CommentNode => l.kind === 'comment'
export const isBlank = (l: Line): l is BlankNode => l.kind === 'blank'
export const isError = (l: Line): l is ErrorNode => l.kind === 'error'

export const makeBlank = (): BlankNode => ({ kind: 'blank', raw: '', dirty: false })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/types.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/model/types.ts src/model/types.test.ts
git commit -m "feat(model): add Line union and document types"
```

### Task 1.2: Tokenizer — split a logical line into tokens

The tokenizer splits a logical line (after continuations are joined — joining happens in `parseDocument`) into tokens, separating an optional trailing inline comment. It must NOT treat `#` as a comment when it is part of `#include`/`#includedir`, and not inside quotes or when escaped.

**Files:**
- Create: `src/model/tokenizer.ts`
- Test: `src/model/tokenizer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { tokenize } from './tokenizer'

describe('tokenize', () => {
  it('splits on whitespace and keeps structural punctuation', () => {
    const { tokens, inlineComment } = tokenize('root ALL=(ALL) ALL')
    expect(tokens).toEqual(['root', 'ALL', '=', '(', 'ALL', ')', 'ALL'])
    expect(inlineComment).toBeUndefined()
  })

  it('extracts a trailing inline comment', () => {
    const { tokens, inlineComment } = tokenize('%admin ALL=NOPASSWD: ALL # no password')
    expect(tokens).toEqual(['%admin', 'ALL', '=', 'NOPASSWD', ':', 'ALL'])
    expect(inlineComment).toBe('no password')
  })

  it('does not split #include into a comment', () => {
    const { tokens, inlineComment } = tokenize('#include /etc/sudoers.local')
    expect(tokens).toEqual(['#include', '/etc/sudoers.local'])
    expect(inlineComment).toBeUndefined()
  })

  it('keeps # inside double quotes', () => {
    const { tokens } = tokenize('Defaults badpass_message="bad #1"')
    expect(tokens).toEqual(['Defaults', 'badpass_message', '=', '"bad #1"'])
  })

  it('keeps escaped whitespace inside a command path', () => {
    const { tokens } = tokenize('root ALL=/bin/ls\\ file')
    expect(tokens).toEqual(['root', 'ALL', '=', '/bin/ls\\ file'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/tokenizer.test.ts`
Expected: FAIL — cannot find module `./tokenizer`.

- [ ] **Step 3: Implement the tokenizer**

```ts
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
    if (c === '"' && !inSquote) { inDquote = !inDquote; cur += c; continue }
    if (c === "'" && !inDquote) { inSquote = !inSquote; cur += c; continue }

    if (!inDquote && !inSquote) {
      if (c === '#' && !isInclude) {
        push()
        inlineComment = line.slice(i + 1).trim()
        return { tokens, inlineComment: inlineComment === '' ? '' : inlineComment }
      }
      if (c === ' ' || c === '\t') { push(); continue }
      if (STRUCT.has(c)) { push(); tokens.push(c); continue }
    }
    cur += c
  }
  push()
  return { tokens, inlineComment }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/tokenizer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/model/tokenizer.ts src/model/tokenizer.test.ts
git commit -m "feat(model): add sudoers line tokenizer"
```

---

## Phase 2 — Line dispatch, comments, blanks

### Task 2.1: parseLine dispatch with Comment and Blank

`parseLine` takes the raw physical text of one logical line (continuations already joined upstream) plus a 1-based line number, and returns a `Line`. In this task it only handles blank, comment, and a fallback `Error`; later tasks register the other parsers.

**Files:**
- Create: `src/model/parseLine.ts`
- Test: `src/model/parseLine.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { parseLine } from './parseLine'

describe('parseLine: blank & comment', () => {
  it('parses a blank line', () => {
    expect(parseLine('', 1)).toEqual({ kind: 'blank', raw: '', dirty: false })
    expect(parseLine('   ', 2)).toEqual({ kind: 'blank', raw: '   ', dirty: false })
  })

  it('parses a standalone comment', () => {
    expect(parseLine('# hello world', 3)).toEqual({
      kind: 'comment', raw: '# hello world', dirty: false, text: 'hello world',
    })
  })

  it('does not treat #include as a comment', () => {
    expect(parseLine('#include /etc/x', 4).kind).toBe('include')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/parseLine.test.ts`
Expected: FAIL — cannot find module `./parseLine`.

- [ ] **Step 3: Implement parseLine (with stubs that delegate to later parsers)**

```ts
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
```

- [ ] **Step 4: Create minimal throwing stubs so the module compiles**

Create `src/model/parseDefaults.ts`, `src/model/parseAlias.ts`, `src/model/parseInclude.ts`, `src/model/parseUserSpec.ts`, each with the signature and a stub:

`src/model/parseInclude.ts` (real implementation in Task 5.1; for now a stub):

```ts
import type { Line } from './types'
export function parseInclude(raw: string, _line: number): Line {
  // Replaced in Task 5.1
  return { kind: 'include', raw, dirty: false, includeKind: '@include', path: '' }
}
```

`src/model/parseDefaults.ts`:

```ts
import type { Line } from './types'
export function parseDefaults(_raw: string, _line: number): Line {
  throw new Error('parseDefaults not implemented') // Replaced in Task 3.2
}
```

`src/model/parseAlias.ts`:

```ts
import type { Line } from './types'
export function parseAlias(_raw: string, _line: number): Line {
  throw new Error('parseAlias not implemented') // Replaced in Task 4.1
}
```

`src/model/parseUserSpec.ts`:

```ts
import type { Line } from './types'
export function parseUserSpec(_raw: string, _line: number): Line {
  throw new Error('parseUserSpec not implemented') // Replaced in Task 6.1
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/model/parseLine.test.ts`
Expected: PASS (3 tests). The `#include` test passes because the stub returns an `include` node.

- [ ] **Step 6: Commit**

```bash
git add src/model/parseLine.ts src/model/parseDefaults.ts src/model/parseAlias.ts src/model/parseInclude.ts src/model/parseUserSpec.ts src/model/parseLine.test.ts
git commit -m "feat(model): add parseLine dispatch with comment/blank handling"
```

---

## Phase 3 — Defaults parser, serializer, catalog

### Task 3.1: Catalog of known Defaults params and tags

**Files:**
- Create: `src/model/catalog.ts`
- Test: `src/model/catalog.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { isKnownDefault, defaultParamInfo, tagInfo, TAGS } from './catalog'

describe('catalog', () => {
  it('recognizes a known boolean default', () => {
    expect(isKnownDefault('requiretty')).toBe(true)
    expect(defaultParamInfo('requiretty')?.type).toBe('flag')
  })

  it('describes an unknown default as not known', () => {
    expect(isKnownDefault('totally_made_up_param')).toBe(false)
    expect(defaultParamInfo('totally_made_up_param')).toBeUndefined()
  })

  it('exposes all 16 tags with descriptions', () => {
    expect(TAGS).toContain('NOPASSWD')
    expect(tagInfo('NOPASSWD')).toMatch(/password/i)
    expect(TAGS.length).toBe(16)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/catalog.test.ts`
Expected: FAIL — cannot find module `./catalog`.

- [ ] **Step 3: Implement the catalog**

```ts
import type { Tag } from './types'

export type DefaultType = 'flag' | 'integer' | 'string' | 'list'

export interface DefaultInfo {
  name: string
  type: DefaultType
  description: string
}

// A curated subset of common sudoers Defaults parameters. Unknown params are
// preserved and shown in the "Additional parameters" section of the UI.
const DEFAULTS: DefaultInfo[] = [
  { name: 'requiretty', type: 'flag', description: 'Require a real tty (not a pipe) to run sudo.' },
  { name: 'visiblepw', type: 'flag', description: 'Allow sudo to prompt for a password even when it would be echoed (no terminal).' },
  { name: 'always_set_home', type: 'flag', description: 'Set HOME to the target user’s home directory.' },
  { name: 'env_reset', type: 'flag', description: 'Reset the environment to a minimal set of variables.' },
  { name: 'mail_badpass', type: 'flag', description: 'Send mail to mailto when a user enters the wrong password.' },
  { name: 'insults', type: 'flag', description: 'Insult the user when they type an incorrect password.' },
  { name: 'rootpw', type: 'flag', description: 'Prompt for the root password instead of the invoking user’s.' },
  { name: 'targetpw', type: 'flag', description: 'Prompt for the target user’s password instead of the invoking user’s.' },
  { name: 'use_pty', type: 'flag', description: 'Run the command in a pseudo-terminal even when logging is not enabled.' },
  { name: 'secure_path', type: 'string', description: 'Path used for every command run by sudo, overriding the user’s PATH.' },
  { name: 'editor', type: 'string', description: 'Path(s) to the editor used by sudoedit/visudo.' },
  { name: 'mailto', type: 'string', description: 'Address that receives sudo notification mail.' },
  { name: 'badpass_message', type: 'string', description: 'Message shown when an incorrect password is entered.' },
  { name: 'lecture', type: 'string', description: 'When to show the sudo lecture: never, once, or always.' },
  { name: 'logfile', type: 'string', description: 'Path to the sudo log file.' },
  { name: 'passwd_tries', type: 'integer', description: 'Number of password attempts allowed before failure.' },
  { name: 'timestamp_timeout', type: 'integer', description: 'Minutes before sudo re-prompts for a password.' },
  { name: 'passwd_timeout', type: 'integer', description: 'Minutes before the password prompt times out (0 = no timeout).' },
  { name: 'env_keep', type: 'list', description: 'Environment variables preserved from the user’s environment.' },
  { name: 'env_check', type: 'list', description: 'Environment variables kept only if they pass a safety check.' },
  { name: 'env_delete', type: 'list', description: 'Environment variables removed before running a command.' },
]

const DEFAULTS_MAP = new Map(DEFAULTS.map((d) => [d.name, d]))

export const ALL_DEFAULTS = DEFAULTS

export function isKnownDefault(name: string): boolean {
  return DEFAULTS_MAP.has(name)
}

export function defaultParamInfo(name: string): DefaultInfo | undefined {
  return DEFAULTS_MAP.get(name)
}

const TAG_INFO: Record<Tag, string> = {
  NOPASSWD: 'Do not prompt for a password for these commands.',
  PASSWD: 'Prompt for a password (the default) — used to override an earlier NOPASSWD.',
  NOEXEC: 'Prevent the command from running further commands.',
  EXEC: 'Allow the command to run further commands (overrides NOEXEC).',
  SETENV: 'Allow the user to set environment variables on the command line.',
  NOSETENV: 'Disallow setting environment variables on the command line.',
  LOG_INPUT: 'Log all user input for the command.',
  NOLOG_INPUT: 'Do not log user input.',
  LOG_OUTPUT: 'Log all output from the command.',
  NOLOG_OUTPUT: 'Do not log command output.',
  MAIL: 'Send notification mail when the command is run.',
  NOMAIL: 'Do not send notification mail.',
  FOLLOW: 'Follow symbolic links when editing files with sudoedit.',
  NOFOLLOW: 'Do not follow symbolic links with sudoedit.',
  INTERCEPT: 'Intercept further commands run by the command for policy checks.',
  NOINTERCEPT: 'Do not intercept further commands.',
}

export const TAGS = Object.keys(TAG_INFO) as Tag[]

export function tagInfo(tag: Tag): string {
  return TAG_INFO[tag]
}

export function isTag(s: string): s is Tag {
  return (TAGS as string[]).includes(s)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/catalog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/model/catalog.ts src/model/catalog.test.ts
git commit -m "feat(model): add catalog of known defaults and tag descriptions"
```

### Task 3.2: Defaults parser

Grammar: `Defaults[@:!>binding] param[, param]*` where each param is `name`, `!name`, `name=value`, `name+=value`, or `name-=value`.

**Files:**
- Modify: `src/model/parseDefaults.ts` (replace stub)
- Test: `src/model/parseDefaults.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { parseDefaults } from './parseDefaults'
import { isDefaults } from './types'

describe('parseDefaults', () => {
  it('parses a simple boolean and a negated boolean', () => {
    const n = parseDefaults('Defaults !insults, requiretty', 1)
    expect(isDefaults(n)).toBe(true)
    if (!isDefaults(n)) return
    expect(n.binding).toBeUndefined()
    expect(n.params).toEqual([
      { name: 'insults', op: 'bool', negated: true, known: true },
      { name: 'requiretty', op: 'bool', known: true },
    ])
  })

  it('parses assignment, append, and unknown params', () => {
    const n = parseDefaults('Defaults secure_path="/bin", env_keep+="LANG", foo=bar', 1)
    if (!isDefaults(n)) throw new Error('expected defaults')
    expect(n.params).toEqual([
      { name: 'secure_path', op: '=', value: '"/bin"', known: true },
      { name: 'env_keep', op: '+=', value: '"LANG"', known: true },
      { name: 'foo', op: '=', value: 'bar', known: false },
    ])
  })

  it('parses a user binding', () => {
    const n = parseDefaults('Defaults:alice !requiretty', 1)
    if (!isDefaults(n)) throw new Error('expected defaults')
    expect(n.binding).toEqual({ type: ':', value: 'alice' })
  })

  it('captures an inline comment', () => {
    const n = parseDefaults('Defaults env_reset # baseline', 1)
    if (!isDefaults(n)) throw new Error('expected defaults')
    expect(n.inlineComment).toBe('baseline')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/parseDefaults.test.ts`
Expected: FAIL — `parseDefaults not implemented`.

- [ ] **Step 3: Implement parseDefaults**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/parseDefaults.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/model/parseDefaults.ts src/model/parseDefaults.test.ts
git commit -m "feat(model): parse Defaults lines with bindings and params"
```

### Task 3.3: Serializer for Defaults (and comment/blank/include passthrough)

`serializeLine` renders a node back to text. For non-dirty nodes the caller uses `raw`; this function is what produces text for `dirty` nodes. We implement Defaults, Comment, Blank, and Include here; Alias and UserSpec are added in their phases.

**Files:**
- Create: `src/model/serialize.ts`
- Test: `src/model/serialize.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { serializeLine } from './serialize'
import { parseDefaults } from './parseDefaults'
import type { CommentNode } from './types'

describe('serializeLine: defaults', () => {
  it('round-trips a defaults line semantically', () => {
    const n = parseDefaults('Defaults:alice !insults, secure_path="/bin", foo=bar', 1)
    expect(serializeLine(n)).toBe('Defaults:alice !insults, secure_path="/bin", foo=bar')
  })

  it('appends an inline comment', () => {
    const n = parseDefaults('Defaults env_reset', 1)
    ;(n as any).inlineComment = 'baseline'
    expect(serializeLine(n)).toBe('Defaults env_reset # baseline')
  })

  it('renders a comment node', () => {
    const c: CommentNode = { kind: 'comment', raw: '', dirty: true, text: 'hi' }
    expect(serializeLine(c)).toBe('# hi')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/serialize.test.ts`
Expected: FAIL — cannot find module `./serialize`.

- [ ] **Step 3: Implement serializeLine (Defaults/Comment/Blank/Include now; others throw until their phase)**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/serialize.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/model/serialize.ts src/model/serialize.test.ts
git commit -m "feat(model): serialize defaults, comment, blank, include nodes"
```

---

## Phase 4 — Alias parser & serializer

### Task 4.1: Alias parser

Grammar: `User_Alias NAME = item, item [: NAME2 = ...]`. The keyword determines `aliasKind`. Multiple definitions are separated by top-level `:`.

**Files:**
- Modify: `src/model/parseAlias.ts` (replace stub)
- Test: `src/model/parseAlias.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { parseAlias } from './parseAlias'
import { isAlias } from './types'

describe('parseAlias', () => {
  it('parses a single user alias', () => {
    const n = parseAlias('User_Alias ADMINS = alice, bob, %wheel', 1)
    expect(isAlias(n)).toBe(true)
    if (!isAlias(n)) return
    expect(n.aliasKind).toBe('User_Alias')
    expect(n.defs).toEqual([{ name: 'ADMINS', items: ['alice', 'bob', '%wheel'] }])
  })

  it('parses multiple definitions on one line', () => {
    const n = parseAlias('Host_Alias WEB = web1, web2 : DB = db1', 1)
    if (!isAlias(n)) throw new Error('expected alias')
    expect(n.defs).toEqual([
      { name: 'WEB', items: ['web1', 'web2'] },
      { name: 'DB', items: ['db1'] },
    ])
  })

  it('captures an inline comment', () => {
    const n = parseAlias('Cmnd_Alias PKG = /usr/bin/apt # package mgmt', 1)
    if (!isAlias(n)) throw new Error('expected alias')
    expect(n.inlineComment).toBe('package mgmt')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/parseAlias.test.ts`
Expected: FAIL — `parseAlias not implemented`.

- [ ] **Step 3: Implement parseAlias**

```ts
import type { Line, AliasNode, AliasDef } from './types'
import { tokenize } from './tokenizer'
import { splitTopLevel } from './parseDefaults'

const KINDS = ['User_Alias', 'Runas_Alias', 'Host_Alias', 'Cmnd_Alias'] as const

export function parseAlias(raw: string, _line: number): Line {
  const { inlineComment } = tokenize(raw)
  const work = stripInlineComment(raw.trim())

  const kind = KINDS.find((k) => work.startsWith(k))
  if (!kind) throw new Error('unknown alias keyword')

  const rest = work.slice(kind.length).trim()
  const defs: AliasDef[] = splitTopLevel(rest, ':').map((segment) => {
    const eq = segment.indexOf('=')
    if (eq === -1) throw new Error(`alias definition missing '=': ${segment.trim()}`)
    const name = segment.slice(0, eq).trim()
    const items = splitTopLevel(segment.slice(eq + 1), ',').map((s) => s.trim()).filter((s) => s !== '')
    return { name, items }
  })

  const node: AliasNode = { kind: 'alias', raw, dirty: false, aliasKind: kind, defs }
  if (inlineComment !== undefined) node.inlineComment = inlineComment
  return node
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/parseAlias.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/model/parseAlias.ts src/model/parseAlias.test.ts
git commit -m "feat(model): parse alias lines (all four kinds, multi-def)"
```

### Task 4.2: Alias serializer

**Files:**
- Modify: `src/model/serialize.ts`
- Test: `src/model/serialize.test.ts` (add cases)

- [ ] **Step 1: Add failing tests**

Append to `src/model/serialize.test.ts`:

```ts
import { parseAlias } from './parseAlias'

describe('serializeLine: alias', () => {
  it('round-trips a multi-def alias', () => {
    const n = parseAlias('Host_Alias WEB = web1, web2 : DB = db1', 1)
    expect(serializeLine(n)).toBe('Host_Alias WEB = web1, web2 : DB = db1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/serialize.test.ts`
Expected: FAIL — `serializeAlias added in Phase 4`.

- [ ] **Step 3: Implement alias serialization**

In `src/model/serialize.ts`, replace the `case 'alias'` line with:

```ts
    case 'alias': body = serializeAlias(line); break
```

And add the import and function:

```ts
import type { Line, DefaultsNode, DefaultsParam, AliasNode } from './types'

function serializeAlias(n: AliasNode): string {
  const defs = n.defs
    .map((d) => `${d.name} = ${d.items.join(', ')}`)
    .join(' : ')
  return `${n.aliasKind} ${defs}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/serialize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/serialize.ts src/model/serialize.test.ts
git commit -m "feat(model): serialize alias nodes"
```

---

## Phase 5 — Include parser & serializer

### Task 5.1: Include parser

Grammar: `@include path`, `@includedir path`, `#include path`, `#includedir path`. The path may be quoted or contain escaped spaces; keep it verbatim.

**Files:**
- Modify: `src/model/parseInclude.ts` (replace stub)
- Test: `src/model/parseInclude.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { parseInclude } from './parseInclude'
import { isInclude } from './types'

describe('parseInclude', () => {
  it('parses @includedir', () => {
    const n = parseInclude('@includedir /etc/sudoers.d', 1)
    expect(isInclude(n)).toBe(true)
    if (!isInclude(n)) return
    expect(n.includeKind).toBe('@includedir')
    expect(n.path).toBe('/etc/sudoers.d')
  })

  it('parses legacy #include', () => {
    const n = parseInclude('#include /etc/sudoers.local', 1)
    if (!isInclude(n)) throw new Error('expected include')
    expect(n.includeKind).toBe('#include')
    expect(n.path).toBe('/etc/sudoers.local')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/parseInclude.test.ts`
Expected: FAIL — the stub returns `path: ''`, so assertions fail.

- [ ] **Step 3: Implement parseInclude**

```ts
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
```

Note: `@includedir`/`#includedir` must be checked before `@include`/`#include` because of the shared prefix.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/parseInclude.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify serializer already handles includes**

Run: `npx vitest run src/model/serialize.test.ts`
Expected: PASS (the existing `case 'include'` in `serializeLine` renders `${includeKind} ${path}`).

- [ ] **Step 6: Commit**

```bash
git add src/model/parseInclude.ts src/model/parseInclude.test.ts
git commit -m "feat(model): parse include directives"
```

---

## Phase 6 — User spec parser & serializer (the hard one)

Grammar (simplified from sudoers(5)):
```
UserSpec  := UserList HostList '=' CmndSpecList (':' HostList '=' CmndSpecList)*
CmndSpec  := [RunasSpec] [Tag ':']* [Option]* Cmnd
RunasSpec := '(' [RunasUserList] [':' RunasGroupList] ')'
```
Runas, tags, and options set on one command **carry forward** to the following
commands in the same `CmndSpecList` until explicitly changed. The parser
resolves the inherited state into each `CmndSpec`.

### Task 6.1: Parse a simple user spec (no inheritance yet)

**Files:**
- Modify: `src/model/parseUserSpec.ts` (replace stub)
- Test: `src/model/parseUserSpec.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { parseUserSpec } from './parseUserSpec'
import { isUserSpec } from './types'

describe('parseUserSpec: basics', () => {
  it('parses root ALL=(ALL:ALL) ALL', () => {
    const n = parseUserSpec('root ALL=(ALL:ALL) ALL', 1)
    expect(isUserSpec(n)).toBe(true)
    if (!isUserSpec(n)) return
    expect(n.users).toEqual(['root'])
    expect(n.specGroups).toHaveLength(1)
    const g = n.specGroups[0]
    expect(g.hosts).toEqual(['ALL'])
    expect(g.cmndSpecs).toEqual([
      { runas: { users: ['ALL'], groups: ['ALL'] }, tags: [], options: [], command: 'ALL' },
    ])
  })

  it('parses a command list and a single NOPASSWD tag', () => {
    const n = parseUserSpec('%admin ALL = NOPASSWD: /bin/ls, /bin/cat', 1)
    if (!isUserSpec(n)) throw new Error('expected userspec')
    expect(n.users).toEqual(['%admin'])
    const cs = n.specGroups[0].cmndSpecs
    expect(cs).toHaveLength(2)
    expect(cs[0]).toEqual({ tags: ['NOPASSWD'], options: [], command: '/bin/ls' })
    // inheritance: second command keeps NOPASSWD
    expect(cs[1]).toEqual({ tags: ['NOPASSWD'], options: [], command: '/bin/cat' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/parseUserSpec.test.ts`
Expected: FAIL — `parseUserSpec not implemented`.

- [ ] **Step 3: Implement parseUserSpec**

```ts
import type { Line, UserSpecNode, SpecGroup, CmndSpec, RunasSpec, Tag, CmndOption } from './types'
import { tokenize } from './tokenizer'
import { splitTopLevel } from './parseDefaults'
import { isTag } from './catalog'

export function parseUserSpec(raw: string, _line: number): Line {
  const { inlineComment } = tokenize(raw)
  const work = stripInlineComment(raw.trim())

  // Split "userlist hostgroup=cmnds [: hostgroup=cmnds]*"
  // The first whitespace run after the user list separates users from the rest.
  const firstSpace = indexOfTopLevelSpace(work)
  if (firstSpace === -1) throw new Error('user spec missing host/command section')

  const usersPart = work.slice(0, firstSpace).trim()
  const remainder = work.slice(firstSpace + 1).trim()
  const users = splitTopLevel(usersPart, ',').map((s) => s.trim()).filter(Boolean)

  const groups: SpecGroup[] = splitTopLevel(remainder, ':')
    .map((seg) => parseSpecGroup(seg.trim()))

  const node: UserSpecNode = { kind: 'userspec', raw, dirty: false, users, specGroups: groups }
  if (inlineComment !== undefined) node.inlineComment = inlineComment
  return node
}

function parseSpecGroup(seg: string): SpecGroup {
  const eq = seg.indexOf('=')
  if (eq === -1) throw new Error(`spec group missing '=': ${seg}`)
  const hosts = splitTopLevel(seg.slice(0, eq), ',').map((s) => s.trim()).filter(Boolean)
  const cmndPart = seg.slice(eq + 1).trim()
  const cmndSpecs = parseCmndSpecList(cmndPart)
  return { hosts, cmndSpecs }
}

function parseCmndSpecList(s: string): CmndSpec[] {
  const segments = splitTopLevel(s, ',').map((x) => x.trim()).filter(Boolean)
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
    if (inheritedRunas) spec.runas = { users: [...inheritedRunas.users], groups: [...inheritedRunas.groups] }
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
  const users = splitTopLevel(colon[0] ?? '', ',').map((s) => s.trim()).filter(Boolean)
  const groups = colon.length > 1
    ? splitTopLevel(colon[1], ',').map((s) => s.trim()).filter(Boolean)
    : []
  return { users, groups }
}

// Replace any tag with its opposite if present; otherwise append.
function mergeTags(base: Tag[], incoming: Tag[]): Tag[] {
  const opposite: Partial<Record<Tag, Tag>> = {
    NOPASSWD: 'PASSWD', PASSWD: 'NOPASSWD',
    NOEXEC: 'EXEC', EXEC: 'NOEXEC',
    SETENV: 'NOSETENV', NOSETENV: 'SETENV',
    LOG_INPUT: 'NOLOG_INPUT', NOLOG_INPUT: 'LOG_INPUT',
    LOG_OUTPUT: 'NOLOG_OUTPUT', NOLOG_OUTPUT: 'LOG_OUTPUT',
    MAIL: 'NOMAIL', NOMAIL: 'MAIL',
    FOLLOW: 'NOFOLLOW', NOFOLLOW: 'FOLLOW',
    INTERCEPT: 'NOINTERCEPT', NOINTERCEPT: 'INTERCEPT',
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

function indexOfTopLevelSpace(s: string): number {
  let inD = false, inS = false, inParen = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length) { i++; continue }
    if (c === '"' && !inS) inD = !inD
    else if (c === "'" && !inD) inS = !inS
    else if (c === '(' && !inD && !inS) inParen++
    else if (c === ')' && !inD && !inS) inParen--
    else if ((c === ' ' || c === '\t') && !inD && !inS && inParen === 0) return i
  }
  return -1
}

function stripInlineComment(s: string): string {
  let inD = false, inS = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length) { i++; continue }
    if (c === '"' && !inS) inD = !inD
    else if (c === "'" && !inD) inS = !inS
    else if (c === '#' && !inD && !inS) return s.slice(0, i).trim()
  }
  return s
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/parseUserSpec.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/model/parseUserSpec.ts src/model/parseUserSpec.test.ts
git commit -m "feat(model): parse user specs with runas/tag/option inheritance"
```

### Task 6.2: User spec serializer (minimal `:`-separated form)

The serializer must reproduce inheritance compactly: only emit runas/tags when they change from the previous command in the list.

**Files:**
- Modify: `src/model/serialize.ts`
- Test: `src/model/serialize.test.ts` (add cases)

- [ ] **Step 1: Add failing tests**

Append to `src/model/serialize.test.ts`:

```ts
import { parseUserSpec } from './parseUserSpec'

describe('serializeLine: userspec', () => {
  it('round-trips runas + command list with shared tag', () => {
    const n = parseUserSpec('%admin ALL = NOPASSWD: /bin/ls, /bin/cat', 1)
    expect(serializeLine(n)).toBe('%admin ALL = NOPASSWD: /bin/ls, /bin/cat')
  })

  it('round-trips runas group spec', () => {
    const n = parseUserSpec('root ALL=(ALL:ALL) ALL', 1)
    expect(serializeLine(n)).toBe('root ALL = (ALL:ALL) ALL')
  })

  it('round-trips multiple host groups', () => {
    const n = parseUserSpec('alice web=/bin/a : db=/bin/b', 1)
    expect(serializeLine(n)).toBe('alice web = /bin/a : db = /bin/b')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/serialize.test.ts`
Expected: FAIL — `serializeUserSpec added in Phase 6`.

- [ ] **Step 3: Implement userspec serialization**

In `src/model/serialize.ts`, replace the `case 'userspec'` line with:

```ts
    case 'userspec': body = serializeUserSpec(line); break
```

Add imports and functions:

```ts
import type {
  Line, DefaultsNode, DefaultsParam, AliasNode,
  UserSpecNode, SpecGroup, CmndSpec, RunasSpec, Tag,
} from './types'

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/serialize.test.ts`
Expected: PASS. Note the canonical form normalizes spacing around `=` (the round-trip-byte-for-byte guarantee applies only via `raw` reuse for non-dirty nodes, exercised in Phase 7).

- [ ] **Step 5: Commit**

```bash
git add src/model/serialize.ts src/model/serialize.test.ts
git commit -m "feat(model): serialize user specs with minimal inheritance form"
```

---

## Phase 7 — Document parse/serialize, round-trip, dirty handling

### Task 7.1: parseDocument with line-continuation joining

**Files:**
- Create: `src/model/parseDocument.ts`
- Test: `src/model/parseDocument.test.ts`
- Create corpus: `tests/fixtures/example.sudoers`

- [ ] **Step 1: Create the fixture corpus**

Create `tests/fixtures/example.sudoers` with exactly:

```
# Sample sudoers file
Defaults env_reset
Defaults:alice !requiretty

User_Alias ADMINS = alice, bob
Cmnd_Alias PKG = /usr/bin/apt, /usr/bin/dpkg

root    ALL=(ALL:ALL) ALL
%admin  ALL=(ALL) NOPASSWD: ALL
ADMINS  ALL = PKG # package management only
@includedir /etc/sudoers.d
```

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseDocument } from './parseDocument'

describe('parseDocument', () => {
  it('joins line continuations into one logical line', () => {
    const doc = parseDocument('root ALL=(ALL) \\\n  /bin/ls')
    expect(doc.lines).toHaveLength(1)
    expect(doc.lines[0].kind).toBe('userspec')
    expect(doc.lines[0].raw).toBe('root ALL=(ALL) \\\n  /bin/ls')
  })

  it('parses the example corpus into the expected node kinds', () => {
    const text = readFileSync('tests/fixtures/example.sudoers', 'utf8')
    const doc = parseDocument(text)
    const kinds = doc.lines.map((l) => l.kind)
    expect(kinds).toEqual([
      'comment', 'defaults', 'defaults', 'blank',
      'alias', 'alias', 'blank',
      'userspec', 'userspec', 'userspec', 'include',
    ])
    expect(doc.lines.some((l) => l.kind === 'error')).toBe(false)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/model/parseDocument.test.ts`
Expected: FAIL — cannot find module `./parseDocument`.

- [ ] **Step 4: Implement parseDocument**

```ts
import type { SudoersDocument } from './types'
import { parseLine } from './parseLine'

// Split text into logical lines, joining backslash-continued physical lines.
// The joined `raw` preserves the original text including the backslash+newline.
export function splitLogicalLines(text: string): string[] {
  const physical = text.split('\n')
  const logical: string[] = []
  let buf: string[] = []
  for (const line of physical) {
    if (/\\\s*$/.test(line)) {
      buf.push(line)
    } else {
      buf.push(line)
      logical.push(buf.join('\n'))
      buf = []
    }
  }
  if (buf.length > 0) logical.push(buf.join('\n'))
  return logical
}

export function parseDocument(text: string): SudoersDocument {
  if (text === '') return { lines: [] }
  const logical = splitLogicalLines(text)
  const lines = logical.map((raw, i) => parseLine(raw, i + 1))
  return { lines }
}
```

Note: `parseLine`'s sub-parsers must tolerate embedded newlines in `raw`. The `tokenize`/`stripInlineComment` helpers already treat `\` + next char (including newline) as escaped, so continuations inside commands are preserved.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/model/parseDocument.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/model/parseDocument.ts src/model/parseDocument.test.ts tests/fixtures/example.sudoers
git commit -m "feat(model): parse full documents with line-continuation joining"
```

### Task 7.2: serializeDocument with dirty/raw handling and round-trip invariant

**Files:**
- Modify: `src/model/serialize.ts` (add `serializeDocument`)
- Test: `src/model/roundtrip.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseDocument } from './parseDocument'
import { serializeDocument } from './serialize'

const text = readFileSync('tests/fixtures/example.sudoers', 'utf8')

describe('round-trip', () => {
  it('returns the input byte-for-byte when nothing is dirty', () => {
    const doc = parseDocument(text)
    expect(serializeDocument(doc)).toBe(text)
  })

  it('re-serializes a node when it is marked dirty', () => {
    const doc = parseDocument(text)
    // Force every node dirty -> canonical render, still semantically valid & re-parseable.
    const dirtyDoc = { lines: doc.lines.map((l) => ({ ...l, dirty: true })) }
    const out = serializeDocument(dirtyDoc)
    // Re-parsing the canonical output yields the same node kinds (semantic stability).
    const reparsed = parseDocument(out)
    expect(reparsed.lines.map((l) => l.kind)).toEqual(doc.lines.map((l) => l.kind))
    expect(reparsed.lines.some((l) => l.kind === 'error')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/roundtrip.test.ts`
Expected: FAIL — `serializeDocument` is not exported.

- [ ] **Step 3: Implement serializeDocument**

Add to `src/model/serialize.ts`:

```ts
import type { SudoersDocument } from './types'

export function serializeDocument(doc: SudoersDocument): string {
  return doc.lines
    .map((line) => (line.dirty ? serializeLine(line) : line.raw))
    .join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/roundtrip.test.ts`
Expected: PASS (2 tests).

If the byte-for-byte test fails, the cause is almost always a trailing-newline or join mismatch in `splitLogicalLines`; verify the fixture has no trailing blank line beyond the final `@includedir` line, or adjust the join to preserve it.

- [ ] **Step 5: Run the full model suite**

Run: `npx vitest run src/model`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add src/model/serialize.ts src/model/roundtrip.test.ts
git commit -m "feat(model): serialize documents preserving untouched lines"
```

### Task 7.3: Non-blocking validation warnings

**Files:**
- Create: `src/model/validate.ts`
- Test: `src/model/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { parseDocument } from './parseDocument'
import { validateDocument } from './validate'

describe('validateDocument', () => {
  it('warns about a referenced but undefined alias', () => {
    const doc = parseDocument('alice ALL = WEBADMIN_CMNDS')
    const warnings = validateDocument(doc)
    expect(warnings).toEqual([
      { lineIndex: 0, message: 'Command "WEBADMIN_CMNDS" looks like an alias but no Cmnd_Alias defines it.' },
    ])
  })

  it('does not warn when the alias is defined', () => {
    const doc = parseDocument('Cmnd_Alias PKG = /usr/bin/apt\nalice ALL = PKG')
    expect(validateDocument(doc)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/model/validate.test.ts`
Expected: FAIL — cannot find module `./validate`.

- [ ] **Step 3: Implement validateDocument**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/model/validate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/model/validate.ts src/model/validate.test.ts
git commit -m "feat(model): add non-blocking alias-reference validation"
```

---

## Phase 8 — Persistence (versioned localStorage envelope)

### Task 8.1: Storage load/save

**Files:**
- Create: `src/sync/storage.ts`
- Test: `src/sync/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadActiveText, saveActiveText, STORAGE_KEY } from './storage'

describe('storage', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty string when nothing is stored', () => {
    expect(loadActiveText()).toBe('')
  })

  it('saves and loads the active session text', () => {
    saveActiveText('root ALL=(ALL) ALL')
    expect(loadActiveText()).toBe('root ALL=(ALL) ALL')
    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(envelope.version).toBe(1)
    expect(envelope.activeSessionId).toBe('default')
    expect(envelope.sessions.default.text).toBe('root ALL=(ALL) ALL')
  })

  it('survives corrupt JSON by returning empty', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadActiveText()).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sync/storage.test.ts`
Expected: FAIL — cannot find module `./storage`.

- [ ] **Step 3: Implement storage**

```ts
export const STORAGE_KEY = 'online-sudoers-util'

interface Session {
  name: string
  text: string
  updatedAt: number
}

interface Envelope {
  version: 1
  activeSessionId: string
  sessions: Record<string, Session>
}

function emptyEnvelope(): Envelope {
  return { version: 1, activeSessionId: 'default', sessions: { default: { name: 'Untitled', text: '', updatedAt: 0 } } }
}

function read(): Envelope {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyEnvelope()
  try {
    const parsed = JSON.parse(raw) as Envelope
    if (parsed?.version !== 1 || !parsed.sessions) return emptyEnvelope()
    return parsed
  } catch {
    return emptyEnvelope()
  }
}

export function loadActiveText(): string {
  const env = read()
  return env.sessions[env.activeSessionId]?.text ?? ''
}

// updatedAt is passed in by the caller (Date.now lives in the UI layer, kept out
// of pure modules so tests stay deterministic).
export function saveActiveText(text: string, updatedAt = 0): void {
  const env = read()
  const id = env.activeSessionId
  env.sessions[id] = { name: env.sessions[id]?.name ?? 'Untitled', text, updatedAt }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(env))
}

export function clearActive(): void {
  saveActiveText('', 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sync/storage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sync/storage.ts src/sync/storage.test.ts
git commit -m "feat(sync): versioned localStorage persistence (multi-session ready)"
```

---

## Phase 9 — Undo/redo history

### Task 9.1: History stack with coalescing

The history stores text snapshots (text is the canonical serialization; reparsing is cheap and keeps the stack simple). Consecutive pushes within a coalesce window replace the top entry.

**Files:**
- Create: `src/sync/history.ts`
- Test: `src/sync/history.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { createHistory } from './history'

describe('history', () => {
  it('undoes and redoes snapshots', () => {
    const h = createHistory('a')
    h.push('ab', 1000)
    h.push('abc', 5000)
    expect(h.current()).toBe('abc')
    expect(h.undo()).toBe('ab')
    expect(h.undo()).toBe('a')
    expect(h.undo()).toBe('a') // clamped at oldest
    expect(h.redo()).toBe('ab')
  })

  it('coalesces pushes within the window', () => {
    const h = createHistory('a')
    h.push('ab', 1000)
    h.push('abc', 1200) // within 500ms window -> replaces top
    expect(h.undo()).toBe('a')
  })

  it('truncates redo history on a new push', () => {
    const h = createHistory('a')
    h.push('ab', 1000)
    h.push('abc', 5000)
    h.undo() // -> ab
    h.push('abX', 9000)
    expect(h.redo()).toBe('abX')
    expect(h.canRedo()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sync/history.test.ts`
Expected: FAIL — cannot find module `./history`.

- [ ] **Step 3: Implement history**

```ts
const COALESCE_MS = 500

export interface History {
  current(): string
  push(snapshot: string, at: number): void
  undo(): string
  redo(): string
  canUndo(): boolean
  canRedo(): boolean
}

export function createHistory(initial: string): History {
  const stack: string[] = [initial]
  let index = 0
  let lastPushAt = -Infinity

  return {
    current: () => stack[index],
    push(snapshot, at) {
      if (snapshot === stack[index]) return
      // Drop any redo entries.
      stack.length = index + 1
      if (at - lastPushAt < COALESCE_MS && index > 0) {
        stack[index] = snapshot // coalesce into current top
      } else {
        stack.push(snapshot)
        index++
      }
      lastPushAt = at
    },
    undo() {
      if (index > 0) index--
      return stack[index]
    },
    redo() {
      if (index < stack.length - 1) index++
      return stack[index]
    },
    canUndo: () => index > 0,
    canRedo: () => index < stack.length - 1,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sync/history.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sync/history.ts src/sync/history.test.ts
git commit -m "feat(sync): undo/redo history stack with coalescing"
```

---

## Phase 10 — Sync orchestration hook

### Task 10.1: useDocument hook (model state + text + origin guard)

This React hook holds the canonical text, derives the parsed document + warnings, and exposes setters from both the editor (`setText`) and the table (`updateLine`, `addLine`, `removeLine`, `moveLine`). It persists on change and drives history. The "origin" guard prevents an editor-originated update from being echoed back as a programmatic editor change.

**Files:**
- Create: `src/sync/useDocument.ts`
- Test: `src/sync/useDocument.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDocument } from './useDocument'

describe('useDocument', () => {
  beforeEach(() => localStorage.clear())

  it('parses initial text into a document', () => {
    const { result } = renderHook(() => useDocument('root ALL=(ALL) ALL'))
    expect(result.current.doc.lines).toHaveLength(1)
    expect(result.current.doc.lines[0].kind).toBe('userspec')
  })

  it('setText reparses and flags origin=editor', () => {
    const { result } = renderHook(() => useDocument(''))
    act(() => result.current.setText('# hi', 'editor'))
    expect(result.current.text).toBe('# hi')
    expect(result.current.lastOrigin).toBe('editor')
    expect(result.current.doc.lines[0].kind).toBe('comment')
  })

  it('updateLine marks the node dirty, re-serializes, and sets origin=table', () => {
    const { result } = renderHook(() => useDocument('root ALL=(ALL) ALL'))
    act(() =>
      result.current.updateLine(0, {
        kind: 'userspec', raw: '', dirty: true,
        users: ['root', 'alice'],
        specGroups: result.current.doc.lines[0].kind === 'userspec'
          ? (result.current.doc.lines[0] as any).specGroups : [],
      }),
    )
    expect(result.current.text).toContain('root, alice')
    expect(result.current.lastOrigin).toBe('table')
  })

  it('undo restores previous text', () => {
    const { result } = renderHook(() => useDocument('a # one'))
    act(() => result.current.setText('b # two', 'editor', 5000))
    act(() => result.current.undo())
    expect(result.current.text).toBe('a # one')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sync/useDocument.test.ts`
Expected: FAIL — cannot find module `./useDocument`.

- [ ] **Step 3: Implement useDocument**

```ts
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Line, SudoersDocument } from '../model/types'
import { parseDocument } from '../model/parseDocument'
import { serializeDocument } from '../model/serialize'
import { validateDocument, type Warning } from '../model/validate'
import { saveActiveText } from './storage'
import { createHistory } from './history'

export type Origin = 'editor' | 'table' | 'history' | 'init'

export interface UseDocument {
  text: string
  doc: SudoersDocument
  warnings: Warning[]
  lastOrigin: Origin
  setText: (text: string, origin?: Origin, at?: number) => void
  updateLine: (index: number, line: Line) => void
  addLine: (line: Line, at?: number) => void
  removeLine: (index: number) => void
  moveLine: (index: number, delta: number) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useDocument(initial: string): UseDocument {
  const [text, setTextState] = useState(initial)
  const [lastOrigin, setLastOrigin] = useState<Origin>('init')
  const [, forceTick] = useState(0)
  const history = useRef(createHistory(initial))

  const commit = useCallback((next: string, origin: Origin, at = 0) => {
    setTextState(next)
    setLastOrigin(origin)
    saveActiveText(next, at)
    if (origin !== 'history') history.current.push(next, at)
    forceTick((n) => n + 1)
  }, [])

  const setText = useCallback((next: string, origin: Origin = 'editor', at = 0) => {
    commit(next, origin, at)
  }, [commit])

  const doc = useMemo(() => parseDocument(text), [text])
  const warnings = useMemo(() => validateDocument(doc), [doc])

  const writeLines = useCallback((lines: Line[], at = 0) => {
    const next = serializeDocument({ lines })
    commit(next, 'table', at)
  }, [commit])

  const updateLine = useCallback((index: number, line: Line) => {
    const lines = doc.lines.slice()
    lines[index] = { ...line, dirty: true }
    writeLines(lines)
  }, [doc, writeLines])

  const addLine = useCallback((line: Line, at = 0) => {
    writeLines([...doc.lines, { ...line, dirty: true }], at)
  }, [doc, writeLines])

  const removeLine = useCallback((index: number) => {
    writeLines(doc.lines.filter((_, i) => i !== index))
  }, [doc, writeLines])

  const moveLine = useCallback((index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= doc.lines.length) return
    const lines = doc.lines.slice()
    const [item] = lines.splice(index, 1)
    lines.splice(target, 0, item)
    writeLines(lines)
  }, [doc, writeLines])

  const undo = useCallback(() => commit(history.current.undo(), 'history'), [commit])
  const redo = useCallback(() => commit(history.current.redo(), 'history'), [commit])

  return {
    text, doc, warnings, lastOrigin,
    setText, updateLine, addLine, removeLine, moveLine,
    undo, redo,
    canUndo: history.current.canUndo(),
    canRedo: history.current.canRedo(),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sync/useDocument.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sync/useDocument.ts src/sync/useDocument.test.ts
git commit -m "feat(sync): useDocument hook orchestrating model, history, persistence"
```

---

## Phase 11 — Editor (CodeMirror 6 + sudoers highlighter)

### Task 11.1: Sudoers StreamLanguage highlighter

**Files:**
- Create: `src/editor/sudoersLanguage.ts`
- Test: `src/editor/sudoersLanguage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { sudoersStreamParser } from './sudoersLanguage'

// We test the StreamParser token function directly (no editor needed).
function tokensOf(line: string): Array<[string, string | null]> {
  const stream = makeStream(line)
  const state = sudoersStreamParser.startState!()
  const out: Array<[string, string | null]> = []
  while (!stream.eol()) {
    const start = stream.pos
    const tok = sudoersStreamParser.token(stream as any, state)
    out.push([line.slice(start, stream.pos), tok])
    if (stream.pos === start) stream.pos++ // guard against no-advance
  }
  return out
}

// Minimal StringStream-like shim sufficient for our token function.
function makeStream(line: string) {
  return {
    pos: 0,
    string: line,
    eol() { return this.pos >= line.length },
    sol() { return this.pos === 0 },
    peek() { return line[this.pos] },
    next() { return line[this.pos++] },
    eat(re: RegExp) { const c = line[this.pos]; if (c && re.test(c)) { this.pos++; return c } return undefined },
    eatWhile(re: RegExp) { let ate = false; while (this.pos < line.length && re.test(line[this.pos])) { this.pos++; ate = true } return ate },
    eatSpace() { return this.eatWhile(/\s/) },
    match(re: RegExp, consume = true) { const m = re.exec(line.slice(this.pos)); if (m && m.index === 0) { if (consume) this.pos += m[0].length; return m } return null },
    skipToEnd() { this.pos = line.length },
  }
}

describe('sudoers highlighter', () => {
  it('marks keywords and comments', () => {
    const toks = tokensOf('Defaults env_reset # note')
    expect(toks[0]).toEqual(['Defaults', 'keyword'])
    expect(toks.some(([t, k]) => k === 'comment' && t.includes('# note'))).toBe(true)
  })

  it('marks alias keywords', () => {
    const toks = tokensOf('User_Alias ADMINS = alice')
    expect(toks[0]).toEqual(['User_Alias', 'keyword'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/editor/sudoersLanguage.test.ts`
Expected: FAIL — cannot find module `./sudoersLanguage`.

- [ ] **Step 3: Implement the StreamLanguage parser**

```ts
import { StreamLanguage, type StreamParser } from '@codemirror/language'

const KEYWORDS = /^(Defaults|User_Alias|Runas_Alias|Host_Alias|Cmnd_Alias|@includedir|@include|#includedir|#include)\b/
const TAGS = /^(NOPASSWD|PASSWD|NOEXEC|EXEC|SETENV|NOSETENV|LOG_INPUT|NOLOG_INPUT|LOG_OUTPUT|NOLOG_OUTPUT|MAIL|NOMAIL|FOLLOW|NOFOLLOW|INTERCEPT|NOINTERCEPT)\b/
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
    if (ch === '#') { stream.skipToEnd(); return 'comment' }
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
    if (/[=(),:!]/.test(ch ?? '')) { stream.next(); return 'operator' }
    if (stream.match(ALIAS_REF)) return 'typeName'
    stream.eatWhile(/[^\s=(),:!#'"]/)
    return null
  },
}

export const sudoersLanguage = StreamLanguage.define(sudoersStreamParser)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/editor/sudoersLanguage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/editor/sudoersLanguage.ts src/editor/sudoersLanguage.test.ts
git commit -m "feat(editor): sudoers syntax highlighting StreamLanguage"
```

### Task 11.2: Editor React component

**Files:**
- Create: `src/editor/Editor.tsx`
- Test: `src/editor/Editor.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Editor } from './Editor'

describe('Editor', () => {
  it('renders initial text', () => {
    render(<Editor value="root ALL=(ALL) ALL" onChange={() => {}} />)
    expect(screen.getByText(/root/)).toBeInTheDocument()
  })

  it('calls onChange when the user types', async () => {
    const onChange = vi.fn()
    render(<Editor value="" onChange={onChange} />)
    const content = document.querySelector('.cm-content') as HTMLElement
    await userEvent.click(content)
    await userEvent.type(content, '# hi')
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('#')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/editor/Editor.test.tsx`
Expected: FAIL — cannot find module `./Editor`.

- [ ] **Step 3: Implement the Editor component**

```tsx
import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history as cmHistory } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { sudoersLanguage } from './sudoersLanguage'

interface EditorProps {
  value: string
  onChange: (text: string) => void
}

export function Editor({ value, onChange }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Mount once.
  useEffect(() => {
    if (!host.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        // CodeMirror's own history is intentionally NOT enabled; we use the
        // model-level history. (cmHistory imported only to document the choice.)
        keymap.of(defaultKeymap),
        sudoersLanguage,
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString())
        }),
      ],
    })
    const v = new EditorView({ state, parent: host.current })
    view.current = v
    return () => v.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply external value changes (from the table / undo) without losing focus.
  useEffect(() => {
    const v = view.current
    if (!v) return
    const currentText = v.state.doc.toString()
    if (currentText !== value) {
      v.dispatch({ changes: { from: 0, to: currentText.length, insert: value } })
    }
  }, [value])

  return <div ref={host} className="editor" data-testid="editor" />
}

void cmHistory // referenced to keep the import meaningful without enabling it
```

Note: if the unused-import lint is strict, remove the `cmHistory` import and the `void` line entirely; it is only there to document that CodeMirror history is deliberately off.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/editor/Editor.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/editor/Editor.tsx src/editor/Editor.test.tsx
git commit -m "feat(editor): CodeMirror 6 React editor wrapper"
```

---

## Phase 12 — Table

### Task 12.1: Summaries for each line type

**Files:**
- Create: `src/components/lineSummary.ts`
- Test: `src/components/lineSummary.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { lineSummary, lineTypeLabel } from './lineSummary'
import { parseLine } from '../model/parseLine'

describe('lineSummary', () => {
  it('summarizes a user spec', () => {
    const l = parseLine('%admin ALL=(ALL) NOPASSWD: ALL', 1)
    expect(lineTypeLabel(l)).toBe('User spec')
    expect(lineSummary(l)).toBe('%admin → ALL = (ALL) NOPASSWD: ALL')
  })

  it('summarizes a defaults line', () => {
    const l = parseLine('Defaults env_reset', 1)
    expect(lineTypeLabel(l)).toBe('Defaults')
    expect(lineSummary(l)).toBe('env_reset')
  })

  it('labels blanks and comments', () => {
    expect(lineTypeLabel(parseLine('', 1))).toBe('Blank')
    expect(lineTypeLabel(parseLine('# hi', 1))).toBe('Comment')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/lineSummary.test.ts`
Expected: FAIL — cannot find module `./lineSummary`.

- [ ] **Step 3: Implement lineSummary**

```ts
import type { Line } from '../model/types'
import { serializeLine } from '../model/serialize'

export function lineTypeLabel(l: Line): string {
  switch (l.kind) {
    case 'userspec': return 'User spec'
    case 'alias': return l.aliasKind.replace('_', ' ')
    case 'defaults': return 'Defaults'
    case 'include': return 'Include'
    case 'comment': return 'Comment'
    case 'blank': return 'Blank'
    case 'error': return 'Error'
  }
}

export function lineSummary(l: Line): string {
  switch (l.kind) {
    case 'userspec': {
      const users = l.users.join(', ')
      const rest = serializeLine({ ...l, dirty: true }).slice(users.length).trim()
      return `${users} → ${rest}`
    }
    case 'defaults': {
      const head = l.binding ? `${l.binding.type}${l.binding.value} ` : ''
      const body = serializeLine({ ...l, dirty: true }).replace(/^Defaults[@:!>]?\S*\s*/, '')
      return `${head}${body}`.trim()
    }
    case 'alias': return l.defs.map((d) => `${d.name} = ${d.items.join(', ')}`).join(' : ')
    case 'include': return `${l.includeKind} ${l.path}`
    case 'comment': return l.text
    case 'blank': return ''
    case 'error': return l.message
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/lineSummary.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/lineSummary.ts src/components/lineSummary.test.ts
git commit -m "feat(ui): per-line summaries and type labels for the table"
```

### Task 12.2: Table component

**Files:**
- Create: `src/components/Table.tsx`
- Test: `src/components/Table.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table } from './Table'
import { parseDocument } from '../model/parseDocument'

describe('Table', () => {
  const doc = parseDocument('# header\nroot ALL=(ALL) ALL\n')

  it('renders one row per line including comments and blanks', () => {
    render(<Table doc={doc} warnings={[]} onEdit={() => {}} onDelete={() => {}} onDuplicate={() => {}} onMove={() => {}} />)
    expect(screen.getByText('Comment')).toBeInTheDocument()
    expect(screen.getByText('User spec')).toBeInTheDocument()
    expect(screen.getByText('Blank')).toBeInTheDocument()
  })

  it('invokes onEdit with the row index', async () => {
    const onEdit = vi.fn()
    render(<Table doc={doc} warnings={[]} onEdit={onEdit} onDelete={() => {}} onDuplicate={() => {}} onMove={() => {}} />)
    await userEvent.click(screen.getAllByRole('button', { name: /edit/i })[1])
    expect(onEdit).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Table.test.tsx`
Expected: FAIL — cannot find module `./Table`.

- [ ] **Step 3: Implement the Table**

```tsx
import type { SudoersDocument } from '../model/types'
import type { Warning } from '../model/validate'
import { lineSummary, lineTypeLabel } from './lineSummary'

interface TableProps {
  doc: SudoersDocument
  warnings: Warning[]
  onEdit: (index: number) => void
  onDelete: (index: number) => void
  onDuplicate: (index: number) => void
  onMove: (index: number, delta: number) => void
}

export function Table({ doc, warnings, onEdit, onDelete, onDuplicate, onMove }: TableProps) {
  const warnByIndex = new Map<number, string[]>()
  for (const w of warnings) {
    const arr = warnByIndex.get(w.lineIndex) ?? []
    arr.push(w.message)
    warnByIndex.set(w.lineIndex, arr)
  }

  return (
    <table className="entry-table">
      <thead>
        <tr><th>Type</th><th>Summary</th><th>Comment</th><th>Actions</th></tr>
      </thead>
      <tbody>
        {doc.lines.map((line, i) => {
          const isMuted = line.kind === 'blank' || line.kind === 'comment'
          const isError = line.kind === 'error'
          const rowWarnings = warnByIndex.get(i)
          return (
            <tr key={i} className={[isMuted ? 'muted' : '', isError ? 'error' : ''].join(' ').trim()}>
              <td>{lineTypeLabel(line)}</td>
              <td>
                {lineSummary(line)}
                {rowWarnings?.map((w, k) => <div key={k} className="warning">⚠ {w}</div>)}
              </td>
              <td>{line.kind !== 'blank' && line.kind !== 'comment' ? (line.inlineComment ?? '') : ''}</td>
              <td className="actions">
                {!isError && line.kind !== 'blank' && (
                  <button aria-label={`edit row ${i}`} onClick={() => onEdit(i)}>Edit</button>
                )}
                <button aria-label={`duplicate row ${i}`} onClick={() => onDuplicate(i)}>Duplicate</button>
                <button aria-label={`delete row ${i}`} onClick={() => onDelete(i)}>Delete</button>
                <button aria-label={`move up row ${i}`} onClick={() => onMove(i, -1)}>↑</button>
                <button aria-label={`move down row ${i}`} onClick={() => onMove(i, 1)}>↓</button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Table.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Table.tsx src/components/Table.test.tsx
git commit -m "feat(ui): entry table with one row per line and row actions"
```

---

## Phase 13 — Modals

### Task 13.1: ModalShell and HelpText

**Files:**
- Create: `src/components/modals/ModalShell.tsx`, `src/components/HelpText.tsx`
- Test: `src/components/modals/ModalShell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModalShell } from './ModalShell'

describe('ModalShell', () => {
  it('renders title and children and fires save/cancel', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<ModalShell title="Edit" onSave={onSave} onCancel={onCancel}><p>body</p></ModalShell>)
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onSave).toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/modals/ModalShell.test.tsx`
Expected: FAIL — cannot find module `./ModalShell`.

- [ ] **Step 3: Implement ModalShell and HelpText**

`src/components/HelpText.tsx`:

```tsx
interface HelpTextProps { children: string }
export function HelpText({ children }: HelpTextProps) {
  return <span className="help" title={children} role="note">ⓘ {children}</span>
}
```

`src/components/modals/ModalShell.tsx`:

```tsx
import type { ReactNode } from 'react'

interface ModalShellProps {
  title: string
  children: ReactNode
  onSave: () => void
  onCancel: () => void
  saveDisabled?: boolean
}

export function ModalShell({ title, children, onSave, onCancel, saveDisabled }: ModalShellProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onSave} disabled={saveDisabled}>Save</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/modals/ModalShell.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/ModalShell.tsx src/components/HelpText.tsx src/components/modals/ModalShell.test.tsx
git commit -m "feat(ui): modal shell and inline help text"
```

### Task 13.2: CommentModal and IncludeModal (simple forms)

**Files:**
- Create: `src/components/modals/CommentModal.tsx`, `src/components/modals/IncludeModal.tsx`
- Test: `src/components/modals/CommentModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommentModal } from './CommentModal'
import type { CommentNode } from '../../model/types'

describe('CommentModal', () => {
  it('edits comment text and saves a node', async () => {
    const initial: CommentNode = { kind: 'comment', raw: '# old', dirty: false, text: 'old' }
    const onSave = vi.fn()
    render(<CommentModal node={initial} onSave={onSave} onCancel={() => {}} />)
    const input = screen.getByLabelText(/comment text/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'new text')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kind: 'comment', text: 'new text' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/modals/CommentModal.test.tsx`
Expected: FAIL — cannot find module `./CommentModal`.

- [ ] **Step 3: Implement both modals**

`src/components/modals/CommentModal.tsx`:

```tsx
import { useState } from 'react'
import type { CommentNode } from '../../model/types'
import { ModalShell } from './ModalShell'

interface Props {
  node: CommentNode
  onSave: (node: CommentNode) => void
  onCancel: () => void
}

export function CommentModal({ node, onSave, onCancel }: Props) {
  const [text, setText] = useState(node.text)
  return (
    <ModalShell title="Comment" onCancel={onCancel} onSave={() => onSave({ ...node, text, dirty: true })}>
      <label>
        Comment text
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
    </ModalShell>
  )
}
```

`src/components/modals/IncludeModal.tsx`:

```tsx
import { useState } from 'react'
import type { IncludeNode } from '../../model/types'
import { ModalShell } from './ModalShell'
import { HelpText } from '../HelpText'

interface Props {
  node: IncludeNode
  onSave: (node: IncludeNode) => void
  onCancel: () => void
}

const KINDS: IncludeNode['includeKind'][] = ['@include', '@includedir', '#include', '#includedir']

export function IncludeModal({ node, onSave, onCancel }: Props) {
  const [includeKind, setKind] = useState(node.includeKind)
  const [path, setPath] = useState(node.path)
  return (
    <ModalShell
      title="Include directive"
      onCancel={onCancel}
      onSave={() => onSave({ ...node, includeKind, path, dirty: true })}
      saveDisabled={path.trim() === ''}
    >
      <label>
        Directive <HelpText>@include reads one file; @includedir reads every file in a directory.</HelpText>
        <select value={includeKind} onChange={(e) => setKind(e.target.value as IncludeNode['includeKind'])}>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      <label>
        Path
        <input value={path} onChange={(e) => setPath(e.target.value)} />
      </label>
    </ModalShell>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/modals/CommentModal.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/CommentModal.tsx src/components/modals/IncludeModal.tsx src/components/modals/CommentModal.test.tsx
git commit -m "feat(ui): comment and include modals"
```

### Task 13.3: AliasModal

**Files:**
- Create: `src/components/modals/AliasModal.tsx`
- Test: `src/components/modals/AliasModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AliasModal } from './AliasModal'
import type { AliasNode } from '../../model/types'

describe('AliasModal', () => {
  it('edits items (comma-separated) and saves', async () => {
    const node: AliasNode = { kind: 'alias', raw: '', dirty: false, aliasKind: 'User_Alias', defs: [{ name: 'ADMINS', items: ['alice'] }] }
    const onSave = vi.fn()
    render(<AliasModal node={node} onSave={onSave} onCancel={() => {}} />)
    const items = screen.getByLabelText(/items for ADMINS/i)
    await userEvent.clear(items)
    await userEvent.type(items, 'alice, bob')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      defs: [{ name: 'ADMINS', items: ['alice', 'bob'] }],
    }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/modals/AliasModal.test.tsx`
Expected: FAIL — cannot find module `./AliasModal`.

- [ ] **Step 3: Implement AliasModal**

```tsx
import { useState } from 'react'
import type { AliasNode, AliasDef } from '../../model/types'
import { ModalShell } from './ModalShell'
import { HelpText } from '../HelpText'

interface Props {
  node: AliasNode
  onSave: (node: AliasNode) => void
  onCancel: () => void
}

const KINDS: AliasNode['aliasKind'][] = ['User_Alias', 'Runas_Alias', 'Host_Alias', 'Cmnd_Alias']

const HELP: Record<AliasNode['aliasKind'], string> = {
  User_Alias: 'A named group of users you can reference in the user field of a rule.',
  Runas_Alias: 'A named group of users/groups a command may be run as.',
  Host_Alias: 'A named group of hosts where rules apply.',
  Cmnd_Alias: 'A named group of commands you can reference in a rule.',
}

export function AliasModal({ node, onSave, onCancel }: Props) {
  const [aliasKind, setKind] = useState(node.aliasKind)
  const [defs, setDefs] = useState<AliasDef[]>(node.defs.map((d) => ({ ...d, items: [...d.items] })))

  const setName = (i: number, name: string) =>
    setDefs((d) => d.map((x, k) => (k === i ? { ...x, name } : x)))
  const setItems = (i: number, csv: string) =>
    setDefs((d) => d.map((x, k) => (k === i ? { ...x, items: csv.split(',').map((s) => s.trim()).filter(Boolean) } : x)))
  const addDef = () => setDefs((d) => [...d, { name: '', items: [] }])
  const removeDef = (i: number) => setDefs((d) => d.filter((_, k) => k !== i))

  return (
    <ModalShell
      title="Alias"
      onCancel={onCancel}
      onSave={() => onSave({ ...node, aliasKind, defs, dirty: true })}
      saveDisabled={defs.length === 0 || defs.some((d) => d.name.trim() === '')}
    >
      <label>
        Alias type <HelpText>{HELP[aliasKind]}</HelpText>
        <select value={aliasKind} onChange={(e) => setKind(e.target.value as AliasNode['aliasKind'])}>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      {defs.map((d, i) => (
        <fieldset key={i}>
          <label>Name<input value={d.name} onChange={(e) => setName(i, e.target.value)} /></label>
          <label>
            {`Items for ${d.name || '(new)'}`}
            <input value={d.items.join(', ')} onChange={(e) => setItems(i, e.target.value)} />
          </label>
          <button type="button" onClick={() => removeDef(i)}>Remove definition</button>
        </fieldset>
      ))}
      <button type="button" onClick={addDef}>Add definition</button>
    </ModalShell>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/modals/AliasModal.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/AliasModal.tsx src/components/modals/AliasModal.test.tsx
git commit -m "feat(ui): alias modal"
```

### Task 13.4: DefaultsModal with known + additional params

**Files:**
- Create: `src/components/modals/DefaultsModal.tsx`
- Test: `src/components/modals/DefaultsModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DefaultsModal } from './DefaultsModal'
import type { DefaultsNode } from '../../model/types'

describe('DefaultsModal', () => {
  it('shows unknown params in the additional section and preserves them on save', async () => {
    const node: DefaultsNode = {
      kind: 'defaults', raw: '', dirty: false,
      params: [{ name: 'my_custom', op: '=', value: 'x', known: false }],
    }
    const onSave = vi.fn()
    render(<DefaultsModal node={node} onSave={onSave} onCancel={() => {}} />)
    expect(screen.getByText(/Additional parameters/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('my_custom')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.arrayContaining([expect.objectContaining({ name: 'my_custom', value: 'x', known: false })]),
    }))
  })

  it('toggles a known boolean default', async () => {
    const node: DefaultsNode = { kind: 'defaults', raw: '', dirty: false, params: [] }
    const onSave = vi.fn()
    render(<DefaultsModal node={node} onSave={onSave} onCancel={() => {}} />)
    await userEvent.click(screen.getByLabelText(/requiretty/i))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.arrayContaining([expect.objectContaining({ name: 'requiretty', op: 'bool', known: true })]),
    }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/modals/DefaultsModal.test.tsx`
Expected: FAIL — cannot find module `./DefaultsModal`.

- [ ] **Step 3: Implement DefaultsModal**

```tsx
import { useState } from 'react'
import type { DefaultsNode, DefaultsParam } from '../../model/types'
import { ModalShell } from './ModalShell'
import { HelpText } from '../HelpText'
import { ALL_DEFAULTS } from '../../model/catalog'

interface Props {
  node: DefaultsNode
  onSave: (node: DefaultsNode) => void
  onCancel: () => void
}

export function DefaultsModal({ node, onSave, onCancel }: Props) {
  const [params, setParams] = useState<DefaultsParam[]>(node.params.map((p) => ({ ...p })))

  const find = (name: string) => params.find((p) => p.name === name)
  const upsert = (p: DefaultsParam) =>
    setParams((cur) => {
      const idx = cur.findIndex((x) => x.name === p.name)
      if (idx === -1) return [...cur, p]
      const next = cur.slice()
      next[idx] = p
      return next
    })
  const removeByName = (name: string) => setParams((cur) => cur.filter((p) => p.name !== name))

  const knownBooleans = ALL_DEFAULTS.filter((d) => d.type === 'flag')
  const knownValued = ALL_DEFAULTS.filter((d) => d.type !== 'flag')
  const additional = params.filter((p) => !p.known)

  const setAdditional = (i: number, patch: Partial<DefaultsParam>) =>
    setParams((cur) => {
      const unknownIdx = cur.map((p, k) => ({ p, k })).filter(({ p }) => !p.known)
      const realIdx = unknownIdx[i]?.k
      if (realIdx === undefined) return cur
      const next = cur.slice()
      next[realIdx] = { ...next[realIdx], ...patch }
      return next
    })
  const addAdditional = () =>
    setParams((cur) => [...cur, { name: '', op: '=', value: '', known: false }])

  return (
    <ModalShell title="Defaults" onCancel={onCancel} onSave={() => onSave({ ...node, params, dirty: true })}>
      <section>
        <h3>Flags</h3>
        {knownBooleans.map((d) => {
          const present = !!find(d.name)
          return (
            <label key={d.name}>
              <input
                type="checkbox"
                checked={present}
                onChange={(e) =>
                  e.target.checked
                    ? upsert({ name: d.name, op: 'bool', known: true })
                    : removeByName(d.name)
                }
              />
              {d.name} <HelpText>{d.description}</HelpText>
            </label>
          )
        })}
      </section>

      <section>
        <h3>Values</h3>
        {knownValued.map((d) => {
          const cur = find(d.name)
          return (
            <label key={d.name}>
              {d.name} <HelpText>{d.description}</HelpText>
              <input
                value={cur?.value ?? ''}
                placeholder={d.type}
                onChange={(e) =>
                  e.target.value === ''
                    ? removeByName(d.name)
                    : upsert({ name: d.name, op: d.type === 'list' ? '+=' : '=', value: e.target.value, known: true })
                }
              />
            </label>
          )
        })}
      </section>

      <section>
        <h3>Additional parameters</h3>
        <p className="help">Any parameter sudo supports that isn’t listed above. Kept exactly as written.</p>
        {additional.map((p, i) => (
          <div key={i} className="param-row">
            <input aria-label={`param name ${i}`} value={p.name} onChange={(e) => setAdditional(i, { name: e.target.value })} />
            <select aria-label={`param op ${i}`} value={p.op} onChange={(e) => setAdditional(i, { op: e.target.value as DefaultsParam['op'] })}>
              <option value="bool">flag</option>
              <option value="=">=</option>
              <option value="+=">+=</option>
              <option value="-=">-=</option>
            </select>
            {p.op !== 'bool' && (
              <input aria-label={`param value ${i}`} value={p.value ?? ''} onChange={(e) => setAdditional(i, { value: e.target.value })} />
            )}
            <label><input type="checkbox" checked={!!p.negated} onChange={(e) => setAdditional(i, { negated: e.target.checked })} /> negate (!)</label>
          </div>
        ))}
        <button type="button" onClick={addAdditional}>Add parameter</button>
      </section>
    </ModalShell>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/modals/DefaultsModal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/DefaultsModal.tsx src/components/modals/DefaultsModal.test.tsx
git commit -m "feat(ui): defaults modal with known params and additional section"
```

### Task 13.5: UserSpecModal

**Files:**
- Create: `src/components/modals/UserSpecModal.tsx`
- Test: `src/components/modals/UserSpecModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserSpecModal } from './UserSpecModal'
import { parseUserSpec } from '../../model/parseUserSpec'
import type { UserSpecNode } from '../../model/types'

describe('UserSpecModal', () => {
  it('edits users and toggles NOPASSWD, then saves', async () => {
    const node = parseUserSpec('alice ALL = /bin/ls', 1) as UserSpecNode
    const onSave = vi.fn()
    render(<UserSpecModal node={node} onSave={onSave} onCancel={() => {}} />)

    const users = screen.getByLabelText(/users/i)
    await userEvent.clear(users)
    await userEvent.type(users, 'alice, bob')

    await userEvent.click(screen.getByLabelText(/NOPASSWD/i))
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    const saved = onSave.mock.calls[0][0] as UserSpecNode
    expect(saved.users).toEqual(['alice', 'bob'])
    expect(saved.specGroups[0].cmndSpecs[0].tags).toContain('NOPASSWD')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/modals/UserSpecModal.test.tsx`
Expected: FAIL — cannot find module `./UserSpecModal`.

- [ ] **Step 3: Implement UserSpecModal**

```tsx
import { useState } from 'react'
import type { UserSpecNode, SpecGroup, CmndSpec, Tag } from '../../model/types'
import { ModalShell } from './ModalShell'
import { HelpText } from '../HelpText'
import { TAGS, tagInfo } from '../../model/catalog'

interface Props {
  node: UserSpecNode
  onSave: (node: UserSpecNode) => void
  onCancel: () => void
}

const clone = (g: SpecGroup): SpecGroup => ({
  hosts: [...g.hosts],
  cmndSpecs: g.cmndSpecs.map((c) => ({
    ...c,
    tags: [...c.tags],
    options: c.options.map((o) => ({ ...o })),
    runas: c.runas ? { users: [...c.runas.users], groups: [...c.runas.groups] } : undefined,
  })),
})

export function UserSpecModal({ node, onSave, onCancel }: Props) {
  const [users, setUsers] = useState(node.users.join(', '))
  const [groups, setGroups] = useState<SpecGroup[]>(node.specGroups.map(clone))

  const updateGroup = (gi: number, patch: Partial<SpecGroup>) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)))
  const updateCmnd = (gi: number, ci: number, patch: Partial<CmndSpec>) =>
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi ? { ...g, cmndSpecs: g.cmndSpecs.map((c, k) => (k === ci ? { ...c, ...patch } : c)) } : g,
      ),
    )
  const toggleTag = (gi: number, ci: number, tag: Tag) =>
    setGroups((gs) =>
      gs.map((g, i) => {
        if (i !== gi) return g
        return {
          ...g,
          cmndSpecs: g.cmndSpecs.map((c, k) => {
            if (k !== ci) return c
            const has = c.tags.includes(tag)
            return { ...c, tags: has ? c.tags.filter((t) => t !== tag) : [...c.tags, tag] }
          }),
        }
      }),
    )
  const addCmnd = (gi: number) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, cmndSpecs: [...g.cmndSpecs, { tags: [], options: [], command: '' }] } : g)))
  const addGroup = () => setGroups((gs) => [...gs, { hosts: ['ALL'], cmndSpecs: [{ tags: [], options: [], command: 'ALL' }] }])

  const save = () =>
    onSave({
      ...node,
      dirty: true,
      users: users.split(',').map((s) => s.trim()).filter(Boolean),
      specGroups: groups,
    })

  return (
    <ModalShell title="User specification" onCancel={onCancel} onSave={save}>
      <label>
        Users <HelpText>Who the rule applies to: usernames, %group, or a User_Alias. Comma-separated.</HelpText>
        <input value={users} onChange={(e) => setUsers(e.target.value)} />
      </label>

      {groups.map((g, gi) => (
        <fieldset key={gi}>
          <label>
            Hosts <HelpText>Where the rule applies: hostnames, ALL, or a Host_Alias. Comma-separated.</HelpText>
            <input value={g.hosts.join(', ')} onChange={(e) => updateGroup(gi, { hosts: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </label>

          {g.cmndSpecs.map((c, ci) => (
            <div key={ci} className="cmnd-spec">
              <label>
                Run as (users:groups) <HelpText>The identity the command runs as, e.g. (root) or (root:wheel). Leave blank for the default.</HelpText>
                <input
                  value={c.runas ? `${c.runas.users.join(', ')}${c.runas.groups.length ? ':' + c.runas.groups.join(', ') : ''}` : ''}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    if (v === '') return updateCmnd(gi, ci, { runas: undefined })
                    const [u, grp] = v.split(':')
                    updateCmnd(gi, ci, {
                      runas: {
                        users: u.split(',').map((s) => s.trim()).filter(Boolean),
                        groups: (grp ?? '').split(',').map((s) => s.trim()).filter(Boolean),
                      },
                    })
                  }}
                />
              </label>
              <label>
                Command <HelpText>Full path, ALL, or a Cmnd_Alias. Prefix with ! to forbid.</HelpText>
                <input value={c.command} onChange={(e) => updateCmnd(gi, ci, { command: e.target.value })} />
              </label>
              <div className="tags">
                {TAGS.map((t) => (
                  <label key={t} title={tagInfo(t)}>
                    <input type="checkbox" checked={c.tags.includes(t)} onChange={() => toggleTag(gi, ci, t)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => addCmnd(gi)}>Add command</button>
        </fieldset>
      ))}
      <button type="button" onClick={addGroup}>Add host group</button>
    </ModalShell>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/modals/UserSpecModal.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/UserSpecModal.tsx src/components/modals/UserSpecModal.test.tsx
git commit -m "feat(ui): user spec modal with per-command runas/tags"
```

---

## Phase 14 — Toolbar & Add-entry

### Task 14.1: Toolbar (copy, undo/redo, clear with confirm, load example)

**Files:**
- Create: `src/components/Toolbar.tsx`
- Test: `src/components/Toolbar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('copies text to clipboard', async () => {
    render(<Toolbar text="root ALL=(ALL) ALL" canUndo canRedo onUndo={() => {}} onRedo={() => {}} onClear={() => {}} onLoadExample={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /copy/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('root ALL=(ALL) ALL')
    expect(await screen.findByText(/copied/i)).toBeInTheDocument()
  })

  it('confirms before clearing', async () => {
    const onClear = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Toolbar text="" canUndo={false} canRedo={false} onUndo={() => {}} onRedo={() => {}} onClear={onClear} onLoadExample={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(onClear).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Toolbar.test.tsx`
Expected: FAIL — cannot find module `./Toolbar`.

- [ ] **Step 3: Implement the Toolbar**

```tsx
import { useState } from 'react'

interface ToolbarProps {
  text: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onLoadExample: () => void
}

export function Toolbar({ text, canUndo, canRedo, onUndo, onRedo, onClear, onLoadExample }: ToolbarProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const clear = () => {
    if (window.confirm('Clear the entire document? This cannot be undone except via Undo.')) onClear()
  }

  return (
    <div className="toolbar">
      <button onClick={copy}>Copy</button>
      {copied && <span className="copied" role="status">Copied!</span>}
      <button onClick={onUndo} disabled={!canUndo}>Undo</button>
      <button onClick={onRedo} disabled={!canRedo}>Redo</button>
      <button onClick={onLoadExample}>Load example</button>
      <button onClick={clear}>Clear</button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Toolbar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx src/components/Toolbar.test.tsx
git commit -m "feat(ui): toolbar with copy, undo/redo, clear, load-example"
```

### Task 14.2: AddEntryMenu + node factories

**Files:**
- Create: `src/components/AddEntryMenu.tsx`, `src/model/factories.ts`
- Test: `src/model/factories.test.ts`, `src/components/AddEntryMenu.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/model/factories.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { newNode } from './factories'

describe('newNode', () => {
  it('creates a dirty userspec template', () => {
    const n = newNode('userspec')
    expect(n.kind).toBe('userspec')
    expect(n.dirty).toBe(true)
    if (n.kind === 'userspec') {
      expect(n.users).toEqual(['ALL'])
      expect(n.specGroups[0].cmndSpecs[0].command).toBe('ALL')
    }
  })

  it('creates a defaults template', () => {
    expect(newNode('defaults').kind).toBe('defaults')
  })
})
```

`src/components/AddEntryMenu.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddEntryMenu } from './AddEntryMenu'

describe('AddEntryMenu', () => {
  it('emits the chosen kind', async () => {
    const onAdd = vi.fn()
    render(<AddEntryMenu onAdd={onAdd} />)
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }))
    await userEvent.click(screen.getByRole('button', { name: /^user spec$/i }))
    expect(onAdd).toHaveBeenCalledWith('userspec')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/model/factories.test.ts src/components/AddEntryMenu.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement factories and AddEntryMenu**

`src/model/factories.ts`:

```ts
import type { Line } from './types'

export type NewKind = 'userspec' | 'alias' | 'defaults' | 'include' | 'comment'

export function newNode(kind: NewKind): Line {
  switch (kind) {
    case 'userspec':
      return {
        kind: 'userspec', raw: '', dirty: true, users: ['ALL'],
        specGroups: [{ hosts: ['ALL'], cmndSpecs: [{ tags: [], options: [], command: 'ALL' }] }],
      }
    case 'alias':
      return { kind: 'alias', raw: '', dirty: true, aliasKind: 'User_Alias', defs: [{ name: 'NAME', items: [] }] }
    case 'defaults':
      return { kind: 'defaults', raw: '', dirty: true, params: [] }
    case 'include':
      return { kind: 'include', raw: '', dirty: true, includeKind: '@includedir', path: '/etc/sudoers.d' }
    case 'comment':
      return { kind: 'comment', raw: '', dirty: true, text: '' }
  }
}
```

`src/components/AddEntryMenu.tsx`:

```tsx
import { useState } from 'react'
import type { NewKind } from '../model/factories'

interface Props { onAdd: (kind: NewKind) => void }

const OPTIONS: Array<{ kind: NewKind; label: string }> = [
  { kind: 'userspec', label: 'User spec' },
  { kind: 'alias', label: 'Alias' },
  { kind: 'defaults', label: 'Defaults' },
  { kind: 'include', label: 'Include' },
  { kind: 'comment', label: 'Comment' },
]

export function AddEntryMenu({ onAdd }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="add-entry">
      <button onClick={() => setOpen((o) => !o)}>Add entry ▾</button>
      {open && (
        <ul className="menu">
          {OPTIONS.map((o) => (
            <li key={o.kind}>
              <button onClick={() => { onAdd(o.kind); setOpen(false) }}>{o.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/model/factories.test.ts src/components/AddEntryMenu.test.tsx`
Expected: PASS (3 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/model/factories.ts src/components/AddEntryMenu.tsx src/model/factories.test.ts src/components/AddEntryMenu.test.tsx
git commit -m "feat(ui): add-entry menu and node factories"
```

---

## Phase 15 — App wiring & integration

### Task 15.1: App component wiring editor + table + modals + toolbar

**Files:**
- Modify: `src/App.tsx` (replace scaffold)
- Create: `src/App.css` (minimal layout)
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write the failing integration tests**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App integration', () => {
  beforeEach(() => localStorage.clear())

  it('parses initial example into the table after Load example', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /load example/i }))
    expect(await screen.findAllByText('User spec')).not.toHaveLength(0)
  })

  it('editing a row via modal updates the editor text', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }))
    await userEvent.click(screen.getByRole('button', { name: /^user spec$/i }))
    // modal opens automatically on add
    const users = await screen.findByLabelText(/users/i)
    await userEvent.clear(users)
    await userEvent.type(users, 'deploy')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByTestId('editor').textContent).toContain('deploy')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — current scaffold App has no such controls.

- [ ] **Step 3: Implement App**

```tsx
import { useState } from 'react'
import './App.css'
import { Editor } from './editor/Editor'
import { Table } from './components/Table'
import { Toolbar } from './components/Toolbar'
import { AddEntryMenu } from './components/AddEntryMenu'
import { useDocument } from './sync/useDocument'
import { loadActiveText } from './sync/storage'
import { newNode, type NewKind } from './model/factories'
import type { Line } from './model/types'
import { UserSpecModal } from './components/modals/UserSpecModal'
import { AliasModal } from './components/modals/AliasModal'
import { DefaultsModal } from './components/modals/DefaultsModal'
import { IncludeModal } from './components/modals/IncludeModal'
import { CommentModal } from './components/modals/CommentModal'

const EXAMPLE = `# Sample sudoers file
Defaults env_reset
User_Alias ADMINS = alice, bob
root    ALL=(ALL:ALL) ALL
%admin  ALL=(ALL) NOPASSWD: ALL
@includedir /etc/sudoers.d
`

export default function App() {
  const docState = useDocument(loadActiveText())
  const { doc, text, warnings } = docState
  const [editing, setEditing] = useState<{ index: number } | null>(null)

  const openEditor = (index: number) => setEditing({ index })
  const closeModal = () => setEditing(null)

  const onAdd = (kind: NewKind) => {
    docState.addLine(newNode(kind))
    setEditing({ index: doc.lines.length }) // edit the newly appended row
  }

  const saveEdited = (line: Line) => {
    if (editing) docState.updateLine(editing.index, line)
    closeModal()
  }

  const current = editing ? doc.lines[editing.index] : undefined

  return (
    <div className="app">
      <header>
        <h1>Online Sudoers Util</h1>
        <Toolbar
          text={text}
          canUndo={docState.canUndo}
          canRedo={docState.canRedo}
          onUndo={docState.undo}
          onRedo={docState.redo}
          onClear={() => docState.setText('', 'table')}
          onLoadExample={() => docState.setText(EXAMPLE, 'table')}
        />
      </header>

      <main className="split">
        <section className="pane">
          <Editor value={text} onChange={(t) => docState.setText(t, 'editor')} />
        </section>
        <section className="pane">
          <AddEntryMenu onAdd={onAdd} />
          <Table
            doc={doc}
            warnings={warnings}
            onEdit={openEditor}
            onDelete={docState.removeLine}
            onDuplicate={(i) => docState.addLine({ ...doc.lines[i], dirty: true })}
            onMove={docState.moveLine}
          />
        </section>
      </main>

      {current?.kind === 'userspec' && <UserSpecModal node={current} onSave={saveEdited} onCancel={closeModal} />}
      {current?.kind === 'alias' && <AliasModal node={current} onSave={saveEdited} onCancel={closeModal} />}
      {current?.kind === 'defaults' && <DefaultsModal node={current} onSave={saveEdited} onCancel={closeModal} />}
      {current?.kind === 'include' && <IncludeModal node={current} onSave={saveEdited} onCancel={closeModal} />}
      {current?.kind === 'comment' && <CommentModal node={current} onSave={saveEdited} onCancel={closeModal} />}
    </div>
  )
}
```

`src/App.css`:

```css
.app { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 1400px; padding: 1rem; }
header { display: flex; align-items: center; gap: 1rem; justify-content: space-between; flex-wrap: wrap; }
.toolbar { display: flex; gap: .5rem; align-items: center; }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
@media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
.pane { min-width: 0; }
.editor { border: 1px solid #ccc; min-height: 400px; }
.cm-content { font-family: ui-monospace, monospace; }
.entry-table { width: 100%; border-collapse: collapse; }
.entry-table th, .entry-table td { border: 1px solid #ddd; padding: .3rem .5rem; text-align: left; font-size: .9rem; }
.entry-table tr.muted { color: #888; }
.entry-table tr.error { background: #fff0f0; }
.warning { color: #b36b00; font-size: .8rem; }
.actions { display: flex; gap: .25rem; flex-wrap: wrap; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; }
.modal { background: #fff; padding: 1rem; border-radius: 8px; max-width: 700px; width: 90%; max-height: 90vh; overflow: auto; }
.modal label { display: block; margin: .5rem 0; }
.modal input, .modal select { width: 100%; box-sizing: border-box; }
.modal .tags { display: flex; flex-wrap: wrap; gap: .5rem; }
.modal .tags label { width: auto; display: inline-flex; gap: .25rem; align-items: center; }
.help { color: #555; font-size: .8rem; }
.copied { color: green; }
.add-entry { position: relative; margin-bottom: .5rem; }
.add-entry .menu { position: absolute; background: #fff; border: 1px solid #ccc; list-style: none; margin: 0; padding: .25rem; z-index: 10; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite + build**

Run: `npm run test`
Expected: ALL PASS.

Run: `npm run build`
Expected: clean TypeScript build, `dist/` produced.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.css src/App.test.tsx
git commit -m "feat(app): wire editor, table, modals, and toolbar together"
```

### Task 15.2: Manual smoke test in the browser

- [ ] **Step 1: Run dev server and verify the four flows**

Run: `npm run dev`

In the browser at the printed local URL, verify:
1. Type a rule in the editor → table updates, syntax is colored.
2. Type an obviously broken line (e.g. `foo bar baz`) → that row shows as an error, others remain.
3. Edit a row via the modal → editor text updates, untouched lines unchanged.
4. Copy button copies; Undo/Redo work; Clear asks for confirmation; reload preserves content.

- [ ] **Step 2: Commit any fixes found, otherwise proceed**

```bash
git commit -am "fix: address manual smoke-test findings" || echo "no fixes needed"
```

---

## Phase 16 — CI/CD, Pages, README, license

### Task 16.1: ESLint + Prettier config

**Files:**
- Create: `.eslintrc.cjs` (or `eslint.config.js` per installed ESLint major), `.prettierrc.json`, `.prettierignore`

- [ ] **Step 1: Add Prettier config**

`.prettierrc.json`:

```json
{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

`.prettierignore`:

```
dist
node_modules
```

- [ ] **Step 2: Add ESLint config matching the installed ESLint major**

If ESLint 9+ (flat config) was installed, create `eslint.config.js`:

```js
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  { languageOptions: { globals: { ...globals.browser } } },
  { ignores: ['dist/'] },
)
```

Install the extra flat-config deps if missing:

```bash
npm install -D @eslint/js globals typescript-eslint
```

- [ ] **Step 3: Run lint and fix findings**

Run: `npm run lint`
Expected: passes, or reports fixable issues.

Run: `npx prettier --write . && npx eslint . --fix`
Then re-run `npm run lint` → Expected: clean.

- [ ] **Step 4: Run full test suite to confirm nothing broke**

Run: `npm run test`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add eslint + prettier configuration"
```

### Task 16.2: GitHub Actions — PR checks and Pages deploy

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the PR checks workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

- [ ] **Step 2: Create the Pages deploy workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Add an SPA-safe note (no router, so no 404 fallback needed)**

No client-side router is used (single page), so no `404.html` fallback is required. Confirm `vite.config.ts` `base` is `/online-sudoers-util/` (set in Task 0.1).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "ci: add PR checks and GitHub Pages deploy workflows"
```

### Task 16.3: README and LICENSE

**Files:**
- Create: `README.md`, `LICENSE`

- [ ] **Step 1: Write the MIT LICENSE**

Create `LICENSE` with the standard MIT text, copyright line:

```
MIT License

Copyright (c) 2026 porech

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Write the README**

Create `README.md`:

```markdown
# Online Sudoers Util

A client-side web app to parse, generate, and bidirectionally edit sudoers files.
Paste your sudoers content into the syntax-highlighted editor and edit it
graphically in the table — changes flow both ways. Everything runs in your
browser; nothing is uploaded.

**Live:** https://porech.github.io/online-sudoers-util/

## Features

- Full sudoers syntax: user specs, all four alias types, Defaults (with bindings),
  include directives, comments, and inline comments.
- Bidirectional, debounced sync between editor and table.
- Untouched lines preserved verbatim when editing via the table.
- Per-line error reporting — one bad line never breaks the rest.
- Verbose, beginner-friendly modals explaining what each option does.
- Unknown Defaults parameters preserved and editable in an "Additional
  parameters" section.
- Undo/redo, copy-to-clipboard, and local persistence across reloads.

## Development

```bash
npm install
npm run dev      # start dev server
npm run test     # run the test suite
npm run build    # production build to dist/
npm run lint     # eslint + prettier check
```

## Deployment

Pushing to `main` builds and deploys to GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`). Enable Pages with the "GitHub Actions" source
in repository settings.

## License

MIT — see [LICENSE](LICENSE).
```

- [ ] **Step 3: Commit**

```bash
git add README.md LICENSE
git commit -m "docs: add README and MIT license"
```

### Task 16.4: Final verification

- [ ] **Step 1: Full local verification**

Run: `npm run lint && npm run test && npm run build`
Expected: all three succeed with no errors.

- [ ] **Step 2: Confirm the deployment prerequisites (manual, on GitHub)**

After pushing to `main` on `porech/online-sudoers-util`:
1. Repo Settings → Pages → Source = "GitHub Actions".
2. Confirm the Deploy workflow ran green and the site loads at the live URL.

- [ ] **Step 3: Commit any final fixes**

```bash
git commit -am "fix: final verification adjustments" || echo "nothing to fix"
```

---

## Self-Review notes (for the planner; resolve before execution)

- **Round-trip byte-for-byte** depends on `splitLogicalLines` preserving trailing
  newlines. The fixture in Task 7.1 ends with a newline; `serializeDocument` joins
  with `\n`. If the input has a trailing newline, `split('\n')` yields a trailing
  empty string → a final `BlankNode` with `raw === ''`, which serializes back to
  `''`, reproducing the trailing newline. Keep this behavior; the Task 7.2 test
  guards it.
- **Tag inheritance vs. serialization:** the parser expands inherited tags onto
  every command; the serializer emits a tag only when it first appears. The
  round-trip test in Task 6.2 covers the shared-tag case. If a later command
  *removes* an inherited tag, that requires an explicit opposite tag (e.g.
  `PASSWD:`) — covered by `mergeTags`.
- **Option detection regex** in `parseOneCmndSpec` requires a space after the
  option value before the command. Multi-option commands and quoted option values
  are handled; a command immediately following an option with no space is not a
  valid sudoers construct.
```

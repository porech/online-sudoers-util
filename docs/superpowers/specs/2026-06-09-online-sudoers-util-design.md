# Online Sudoers Util — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)
**Repository:** `porech/online-sudoers-util`
**Hosting:** GitHub Pages (`porech.github.io/online-sudoers-util`)

## 1. Purpose

A fully client-side web utility to parse, generate, and edit sudoers entries. The
core experience is a **bidirectional editor**: a syntax-highlighted text editor on
one side and a graphical, fully-editable table on the other, kept in sync. Editing
the text updates the table (per-line, even while parts are invalid); editing the
table updates the text. It is designed to be usable by people unfamiliar with
sudoers syntax — configuration screens are verbose and explain what each option does.

### Goals

- Parse the **full sudoers syntax**: user specs, all four alias types
  (`User_Alias`, `Runas_Alias`, `Host_Alias`, `Cmnd_Alias`), `Defaults` (with
  bindings), include directives (`@include`/`@includedir`, legacy `#include*`),
  comments, and blank lines.
- Inline comments (trailing `# …` on a line) are first-class model fields:
  parsed out, editable per-entry in the table, and preserved.
- Bidirectional, debounced sync between editor and table.
- Preserve untouched lines **verbatim** (spacing, comments, blanks) when the table
  regenerates text — only re-render lines that were actually edited.
- Per-line error handling: a bad line shows as an error row and an editor gutter
  marker, without breaking the rest of the document.
- Graceful handling of unknown `Defaults` parameters and unknown tags — preserved,
  surfaced, and editable; never silently dropped.
- Syntax highlighting in the editor.
- Undo/redo, copy-to-clipboard, and local persistence across reloads.
- Educational UI: human-readable descriptions for tags, Defaults params, runas,
  and aliases.

### Non-goals (now)

- No backend, accounts, or server-side validation.
- No multi-file/multi-session UI yet (designed for, not built — see §10).
- No execution or live validation against a real `sudo`/`visudo`.

## 2. Architecture

Single source of truth: a **`Document`** model = an ordered list of typed `Line`
nodes. The editor and the table are both projections of this model and both
subscribe to it. Sync is debounced and guarded against feedback loops with an
"origin" flag.

```
src/
  model/      pure, framework-free
    types.ts        Line union, Document, sub-types
    tokenizer.ts    logical-line tokenizer
    parseLine.ts    dispatch + sub-parsers
    serialize.ts    node -> canonical text
    catalog.ts      human-readable descriptions, known params/tags
  sync/
    engine.ts       editor<->model<->table sync, origin guard, debounce
    history.ts      undo/redo snapshot stack
    storage.ts      localStorage persistence (versioned envelope)
  components/
    Editor.tsx      CodeMirror 6 + sudoers highlighter
    Table.tsx       one row per Line node
    modals/         UserSpec, Alias, Defaults, Include, Comment
    Toolbar.tsx     copy, undo/redo, clear, load-example, add-entry
  App.tsx
```

The `model/` layer is pure and has no React/CodeMirror dependency, so it is tested
in isolation against a corpus of real sudoers files.

## 3. Data model

Every `Line` node carries:

- `raw: string` — the original source text for the line.
- `dirty: boolean` — set true when edited via the table; controls re-serialization.
- `inlineComment?: string` — trailing `# …` content, editable in the table.

`Line` is a tagged union:

- **`UserSpec`** — `users: string[]`; `specGroups: SpecGroup[]`.
  - `SpecGroup` = `{ hosts: string[]; cmndSpecs: CmndSpec[] }`.
  - `CmndSpec` = `{ runas?: { users: string[]; groups: string[] }; tags: Tag[]; options: Option[]; command: string }`.
  - Runas/tags/options follow sudoers **inheritance**: a value set on one command
    carries forward to later commands in the list until overridden. The parser
    resolves inheritance into each `CmndSpec`; the serializer re-derives the
    minimal `:`-separated form.
- **`Alias`** — `kind: 'User_Alias'|'Runas_Alias'|'Host_Alias'|'Cmnd_Alias'`;
  `defs: { name: string; items: string[] }[]` (multiple `:`-separated defs allowed).
- **`Defaults`** — `binding?: { type: '@'|':'|'!'|'>'; value: string }`;
  `params: DefaultsParam[]` where
  `DefaultsParam = { name: string; op: '='|'+='|'-='|'bool'; value?: string; negated?: boolean; known: boolean }`.
  Unknown params have `known: false` and are surfaced in the "Additional
  parameters" section.
- **`Include`** — `kind: '@include'|'@includedir'|'#include'|'#includedir'`; `path: string`.
- **`Comment`** — standalone `# …` line; `text: string`.
- **`Blank`** — empty line (preserved).
- **`Error`** — `raw`, `message: string`, `line: number`.

## 4. Parser & serializer

Hand-written tokenizer + recursive-descent parser.

- **`tokenizer.ts`** — splits a logical line into tokens; handles line continuations
  (`\` at EOL joins lines), quoted strings, escaped whitespace inside commands, and
  `#` comment detection (NOT inside `#include`/`#includedir`, NOT inside quotes).
- **`parseLine.ts`** — dispatches on the leading token:
  - `Defaults*` → defaults parser
  - one of the four `*_Alias` keywords → alias parser
  - `@include`/`@includedir`/`#include`/`#includedir` → include parser
  - blank → `Blank`; leading `#…` → `Comment`
  - otherwise → user-spec parser (with runas/tag/option inheritance)
  - any failure → `Error` node (raw + message); never throws past the line.
- **`serialize.ts`** — inverse of the parser; called only on `dirty` nodes.
  Untouched nodes return their `raw`.

### Round-trip invariants (test backbone)

1. `parse → serialize` with **no edits** returns the input **byte-for-byte**
   (nothing is dirty → all `raw` reused).
2. `parse → serialize-all` (forcing every node dirty) produces **semantically
   equivalent** sudoers for any valid input.

Built test-first against a corpus of real-world sudoers examples.

### Validation stance

Lenient. The parser accepts references to undefined aliases. A separate,
**non-blocking** validation pass produces gentle warnings (e.g., "alias `X` is
referenced but not defined in this document"). Warnings never become parse errors.

## 5. Sync engine

Model is the single source of truth; both views subscribe. Sync is debounced
(~150ms) and guarded with an "origin" flag so a model update triggered by the
editor does not bounce back and re-render the editor mid-keystroke.

- **Editor → model:** debounced change events feed text to the parser, producing a
  fresh `Document`. Line-by-line diff against the current model: unchanged lines
  keep node identity and `raw`; changed lines reparse. Result replaces the model.
- **Model → editor:** table edits mark nodes `dirty` and update the model;
  serialize to text and dispatch a CodeMirror transaction. Because untouched nodes
  re-emit `raw`, the diff is minimal and cursor/unedited lines stay put.
- **Syntax highlighting:** CodeMirror 6 sudoers mode (StreamLanguage or lightweight
  Lezer) coloring keywords (`Defaults`, `*_Alias`, `@include`), tags, operators
  (`=`, `:`, `!`), comments, and aliases. Error lines get a red gutter marker +
  underline with the parse message on hover.

The origin guard is covered by explicit tests (edit in editor → assert table; edit
in table → assert editor text + cursor stability).

## 6. UI: table & modals

**Layout:** editor left, table right, side by side; stacks vertically on narrow
screens. Copy-to-clipboard button on the editor. "Add entry" button above the
table opens a type picker (User spec / Alias / Defaults / Include / Comment) → the
relevant modal. This is the "generate entries" feature.

**Table:** one row per `Line` node, in document order. Shared shape: **Type** badge,
a **summary** rendering, **inline comment** (if any), and **actions** (edit,
duplicate, delete, move up/down). Blank/comment lines render as muted rows so
document structure stays visible; a "hide comments/blanks" toggle focuses on grants.
Error rows are red with the message inline.

**Modals** (all use the `catalog.ts` help text):

- **User spec:** user list (chips/tokens); one or more host-spec groups; within a
  group, a list of commands each exposing runas (`(users:groups)`), tags (labeled
  checkboxes with descriptions), options (`CWD=`, `TIMEOUT=`, …), and the command
  field. Inline comment field at the bottom.
- **Alias:** kind selector + one or more `NAME = items` definitions (token input).
- **Defaults:** optional binding picker (`@host`/`:user`/`!cmnd`/`>runas`); known
  parameters as typed controls (booleans → toggles, integers/strings → fields, list
  params with `+=`/`-=`) grouped by category with descriptions; a free-form
  **"Additional parameters"** section holding unknown/custom params (add/edit/remove
  arbitrary `name`, `!name`, `name=value`, `name+=value`, `name-=value`).
- **Include / Comment:** simple focused forms.

Every modal validates on save and writes back to the model (marking nodes `dirty`),
which flows to the editor.

**Education:** `catalog.ts` provides human-readable descriptions for every tag,
known Defaults parameter, runas spec, and alias type, rendered as inline help /
tooltips so newcomers understand each control.

## 7. Undo/redo, clipboard, persistence

- **Undo/redo:** single history stack at the **model level**. Each committed change
  (a settled debounced editor edit, a modal save, a row action) pushes a snapshot;
  bursts of typing coalesce into one step. Undo/redo restores a snapshot and
  re-projects to both views. Shortcuts `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` plus
  toolbar buttons. CodeMirror's internal history is disabled so there is one
  unified timeline.
- **Copy to clipboard:** async Clipboard API with a brief "Copied!" confirmation
  and `document.execCommand` fallback.
- **Persistence:** the document is mirrored to `localStorage` (see §10 envelope) so
  a reload or return visit preserves work.
- **Clear:** wipes the active document after a confirmation dialog.
- **Load example:** seeds a representative sudoers file for first-time users.

## 8. Testing

- **Stack:** Vitest + Testing Library, ESLint + Prettier.
- **Model layer (test-first):** round-trip invariants (§4) and a parser corpus of
  real sudoers files drive development.
- **Component tests:** sync origin-guard, modal write-back per type.
- **Integration:** edit-in-editor↔edit-in-table; undo/redo across both views.

## 9. Build, CI/CD, repo

- **Stack:** Vite + React + TypeScript + CodeMirror 6.
- **Vite `base`:** `/online-sudoers-util/` so asset paths resolve on the project
  Pages URL.
- **CI (GitHub Actions):**
  - On push to `main`: install → lint → test → `vite build` → deploy `dist/` to
    GitHub Pages via `actions/deploy-pages`.
  - On PR: lint + test, no deploy.
- **Repo hygiene:** README (with screenshot + usage), **MIT** license, `.gitignore`,
  this spec committed under `docs/`.

## 10. Future considerations (designed-for, not built)

**Multiple sessions / multiple files.** Persistence uses a versioned envelope shaped
to allow multiple named sessions later without migration:

```jsonc
{
  "version": 1,
  "activeSessionId": "default",
  "sessions": {
    "default": { "name": "Untitled", "text": "…", "updatedAt": 0 }
  }
}
```

Today exactly one session (`default`) exists and there is no switcher UI. Adding a
session list + "new/rename/delete session" later is purely additive against this
envelope.

Other possible future work: CodeMirror Lezer grammar for richer highlighting,
import/export of files, and shareable URLs.

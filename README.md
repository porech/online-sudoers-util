# Online Sudoers Editor &amp; Parser

A free, client-side web app to **parse, generate, and edit sudoers files**. Paste
your sudoers content into the syntax-highlighted editor and edit it graphically in
a table — changes flow both ways. Everything runs in your browser; nothing is
uploaded.

**Live:** https://porech.github.io/online-sudoers-util/

## Features

- **Full sudoers syntax**: user specs (with per-command runas, tags, and options),
  all four alias types (`User_Alias`, `Runas_Alias`, `Host_Alias`, `Cmnd_Alias`),
  `Defaults` (with `@host` / `:user` / `!cmnd` / `>runas` bindings), include
  directives, comments, and inline comments.
- **Bidirectional editing**: edit the text or the table — each updates the other.
- **Untouched lines preserved verbatim** when you edit via the table; only the
  lines you change are re-rendered.
- **Per-line error handling**: one malformed line shows as an error row without
  breaking the rest of the document.
- **Beginner-friendly**: every option in the modals explains what it does, so you
  don't need to memorize sudoers syntax.
- **Unknown `Defaults` parameters preserved** and editable in an "Additional
  parameters" section — nothing you wrote is silently dropped.
- **Undo/redo**, **copy to clipboard**, and **local persistence** across reloads.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run test     # run the test suite (Vitest)
npm run build    # production build to dist/
npm run lint     # eslint + prettier check + test type-check
```

## How it works

The single source of truth is a `Document` model — an ordered list of typed line
nodes. A tokenizer + recursive-descent parser turns text into the model; a
serializer turns it back, re-emitting only edited nodes and reusing the original
text for untouched lines. The CodeMirror editor and the React table are both
projections of this model, kept in sync through a small orchestration hook.

## Deployment

Pushing to `main` builds and deploys to GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`). In the repository settings, set **Pages →
Source** to **GitHub Actions**.

## License

[MIT](LICENSE)

export interface SplitComment {
  body: string
  inlineComment?: string
}

// Single-pass quote/escape-aware split of a logical line into its body and an
// optional trailing inline comment (the text after a top-level '#', trimmed).
// A leading #include / #includedir directive is NOT a comment.
export function splitInlineComment(raw: string): SplitComment {
  const trimmed = raw.trim()
  if (/^#include(dir)?\b/.test(trimmed)) return { body: trimmed }
  let inD = false
  let inS = false
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i]
    if (c === '\\' && i + 1 < trimmed.length) {
      i++
      continue
    }
    if (c === '"' && !inS) inD = !inD
    else if (c === "'" && !inD) inS = !inS
    else if (c === '#' && !inD && !inS) {
      const comment = trimmed.slice(i + 1).trim()
      return { body: trimmed.slice(0, i).trim(), inlineComment: comment }
    }
  }
  return { body: trimmed }
}

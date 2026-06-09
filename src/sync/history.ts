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

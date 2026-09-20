let counter = 1000

/** Deterministic, replayable ids — the demo journey replays actions from a clean slate. */
export const resetIds = () => {
  counter = 1000
}

export const nextId = (prefix: string) => `${prefix}-${++counter}`

export const idCounter = () => counter

export const setIdCounter = (value: number) => {
  counter = Math.max(counter, value)
}

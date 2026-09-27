/** The value after a flag, or undefined when the flag is absent. */
export function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  return index !== -1 ? argv[index + 1] : undefined
}

/** Repeatable, comma-split selection. Absent → undefined. Present and empty → []. */
export function parseSelect(argv: string[], name: string): string[] | undefined {
  const keys: string[] = []
  let seen = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== name) continue
    seen = true
    for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) {
      keys.push(...argv[j].split(',').map((key) => key.trim()).filter(Boolean))
    }
  }
  return seen ? keys : undefined
}

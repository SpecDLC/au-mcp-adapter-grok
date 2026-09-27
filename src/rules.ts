// Write `au-inject-*.md` into `<workspace>/.grok/rules/`, replacing the previous set.
// Session end does not delete them: the next launch reconciles.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PREFIX = 'au-inject-'

export function syncInjectRules(workspace: string, files: Map<string, string>): void {
  const dir = join(workspace, '.grok', 'rules')
  mkdirSync(dir, { recursive: true })
  let existing: string[] = []
  try {
    existing = readdirSync(dir)
  } catch {
    existing = []
  }
  for (const name of existing) {
    if (name.startsWith(PREFIX) && name.endsWith('.md') && !files.has(name)) rmSync(join(dir, name))
  }
  for (const [name, content] of files) {
    if (!name.startsWith(PREFIX) || !name.endsWith('.md')) throw new Error(`Refusing to write rules file ${name}`)
    writeFileSync(join(dir, name), content.endsWith('\n') ? content : `${content}\n`)
  }
}

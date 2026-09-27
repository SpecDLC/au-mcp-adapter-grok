#!/usr/bin/env node
// stdout: one absolute plugin directory per line. Empty when the workspace has no skills.
import { resolve } from 'node:path'

import { materialize, skillManifest } from '@arsumbris/au-mcp'
import { LAUNCH_ENV } from '@arsumbris/au-mcp-sdk'

import { flagValue, parseSelect } from '../src/cli-args.ts'
import { grokSkillTransform } from '../src/skills-grok.ts'

const USAGE = 'usage: gen-skills --workspace <entry> [--manifest] [--skills <owner:name> ...]'

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const workspace = flagValue(argv, '--workspace') ?? process.env[LAUNCH_ENV.WORKSPACE]
  if (!workspace) {
    process.stderr.write(`${USAGE}\n`)
    process.exit(2)
  }
  const entry = resolve(workspace)
  if (argv.includes('--manifest')) {
    process.stdout.write(`${JSON.stringify(await skillManifest(entry))}\n`)
    return
  }
  const select = parseSelect(argv, '--skills')
  const result = await materialize(entry, 'grok', grokSkillTransform, select ? { select } : {})
  for (const skipped of result.skipped) process.stderr.write(`gen-skills: skipped ${skipped.path} — ${skipped.reason}\n`)
  if (result.collected.length > 0) process.stderr.write(`gen-skills: swept ${result.collected.length} dead-socket gen tree(s)\n`)
  for (const dir of result.pluginDirs) process.stdout.write(`${dir}\n`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`gen-skills failed: ${message}\nIs the engine daemon running on this workspace?\n`)
  process.exit(1)
})

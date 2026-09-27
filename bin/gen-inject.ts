#!/usr/bin/env node
// stdout: the directory holding `au-inject-*.md`, one line, or empty when nothing is selected.
import { resolve } from 'node:path'

import { injectManifest, materializeInjects } from '@arsumbris/au-mcp'
import { LAUNCH_ENV } from '@arsumbris/au-mcp-sdk'

import { flagValue, parseSelect } from '../src/cli-args.ts'
import { grokInjectTransform } from '../src/inject-grok.ts'

const USAGE = 'usage: gen-inject --workspace <entry> [--manifest] [--inject <owner:name> ...]'

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const workspace = flagValue(argv, '--workspace') ?? process.env[LAUNCH_ENV.WORKSPACE]
  if (!workspace) {
    process.stderr.write(`${USAGE}\n`)
    process.exit(2)
  }
  const entry = resolve(workspace)
  if (argv.includes('--manifest')) {
    process.stdout.write(`${JSON.stringify(await injectManifest(entry))}\n`)
    return
  }
  const select = parseSelect(argv, '--inject')
  const result = await materializeInjects(entry, 'grok', grokInjectTransform, select ? { select } : {})
  for (const skipped of result.skipped) process.stderr.write(`gen-inject: skipped ${skipped.path} — ${skipped.reason}\n`)
  for (const dropped of result.dropped) process.stderr.write(`gen-inject: dropped ${dropped.addr}\n`)
  for (const dir of result.pluginDirs) process.stdout.write(`${dir}\n`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`gen-inject failed: ${message}\nIs the engine daemon running on this workspace?\n`)
  process.exit(1)
})

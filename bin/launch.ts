#!/usr/bin/env node
// Prints one JSON launch for au-host: { session, binary, argv, env, command }.
// Merges `[plugins].paths` and writes `.grok/rules/au-inject-*.md` before printing.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { materialize, materializeInjects } from '@arsumbris/au-mcp'
import { buildLaunchEnv, LAUNCH_ENV } from '@arsumbris/au-mcp-sdk'

import { flagValue, parseSelect } from '../src/cli-args.ts'
import { CALLING_NOTE, grokInjectTransform } from '../src/inject-grok.ts'
import { grokLaunchCommand } from '../src/launch-grok.ts'
import { isAdapterManagedPath, mergePluginPathsToml } from '../src/project-config.ts'
import { syncInjectRules } from '../src/rules.ts'
import { grokSkillTransform } from '../src/skills-grok.ts'

const USAGE =
  'usage: launch --workspace <entry> --binary <grok>\n' +
  '              [--skills <owner:name> ...] [--inject <owner:name> ...]\n' +
  '              [--profile <locator>] [--resume <session-id>]'

const SIDECAR = join('.grok', 'au-mcp-adapter-grok.json')

function readManaged(workspace: string): string[] {
  try {
    const parsed = JSON.parse(readFileSync(join(workspace, SIDECAR), 'utf8')) as { managedPaths?: unknown }
    return Array.isArray(parsed.managedPaths) ? parsed.managedPaths.filter((path): path is string => typeof path === 'string') : []
  } catch {
    return []
  }
}

function writeManaged(workspace: string, managedPaths: string[]): void {
  const path = join(workspace, SIDECAR)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ managedPaths }, null, 2)}\n`)
}

async function safeDirs(label: string, run: () => Promise<{ pluginDirs: string[] }>): Promise<string[]> {
  try {
    return (await run()).pluginDirs
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`launch: ${label} skipped (${message}); is the engine daemon up on this workspace?\n`)
    return []
  }
}

function injectFiles(dirs: string[]): Map<string, string> {
  const files = new Map<string, string>()
  for (const dir of dirs) {
    let names: string[] = []
    try {
      names = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names.filter((entry) => entry.startsWith('au-inject-') && entry.endsWith('.md')).sort()) {
      files.set(name, readFileSync(join(dir, name), 'utf8'))
    }
  }
  return files
}

function mergeConfig(workspace: string, adapterDir: string, skillDirs: string[]): void {
  const configPath = join(workspace, '.grok', 'config.toml')
  let existing: string | null = null
  try {
    existing = readFileSync(configPath, 'utf8')
  } catch {
    existing = null
  }
  const previous = readManaged(workspace)
  const remove = [...new Set([...previous, adapterDir, ...skillDirs].filter((path) => isAdapterManagedPath(path, adapterDir) || previous.includes(path)))]
  const add = [adapterDir, ...skillDirs]
  const merged = mergePluginPathsToml(existing, remove, add)
  if (!merged.ok) {
    process.stderr.write(`launch: left .grok/config.toml unchanged (${merged.error})\n`)
    return
  }
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, merged.toml.endsWith('\n') ? merged.toml : `${merged.toml}\n`)
  writeManaged(workspace, add)
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const workspace = flagValue(argv, '--workspace') ?? process.env[LAUNCH_ENV.WORKSPACE]
  const binary = flagValue(argv, '--binary')
  if (!workspace || !binary) {
    process.stderr.write(`${USAGE}\n`)
    process.exit(2)
  }
  const entry = resolve(workspace)
  const adapterDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const skills = parseSelect(argv, '--skills')
  const inject = parseSelect(argv, '--inject')
  const profile = flagValue(argv, '--profile')
  const resume = flagValue(argv, '--resume')

  const skillDirs = await safeDirs('skills', () => materialize(entry, 'grok', grokSkillTransform, skills ? { select: skills } : {}))
  const injectDirs = await safeDirs('inject', () => materializeInjects(entry, 'grok', grokInjectTransform, inject ? { select: inject } : {}))

  mergeConfig(entry, adapterDir, skillDirs)
  const rules = injectFiles(injectDirs)
  rules.set('au-inject-00-calling.md', CALLING_NOTE)
  syncInjectRules(entry, rules)

  const launchEnv = buildLaunchEnv({ workspace: entry, profile })
  const launch = grokLaunchCommand(launchEnv, binary, entry, { resume })
  process.stdout.write(`${JSON.stringify({ session: launchEnv.session, ...(resume ? { resume } : {}), ...launch })}\n`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`launch failed: ${message}\n`)
  process.exit(1)
})

// Merge absolute plugin roots into `<workspace>/.grok/config.toml` `[plugins].paths`.
// Project `[plugins].paths` is the channel interactive Grok auto-enables once the folder is trusted.
// A parse failure returns an error and writes nothing.

import { parse, stringify } from 'smol-toml'

export interface MergeResult {
  ok: true
  toml: string
  paths: string[]
}

export interface MergeFailure {
  ok: false
  error: string
}

/** Paths this adapter owns: its own checkout, and generated skill trees under the au-mcp gen dir. */
export function isAdapterManagedPath(candidate: string, adapterDir: string): boolean {
  if (candidate === adapterDir) return true
  const norm = candidate.replace(/\\/g, '/')
  return norm.includes('/.arsumbris/au-mcp/gen/skill/') && norm.includes('/grok/')
}

/**
 * Reconcile `[plugins].paths`. `remove` entries drop out; `add` entries are appended.
 * Every other key is kept. Comments are not: the file is parsed and written back.
 */
export function mergePluginPathsToml(existing: string | null, remove: string[], add: string[]): MergeResult | MergeFailure {
  let doc: Record<string, unknown> = {}
  if (existing !== null && existing.trim().length > 0) {
    try {
      const parsed = parse(existing)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, error: 'config root is not a table' }
      doc = parsed as Record<string, unknown>
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  const plugins = doc.plugins
  if (plugins !== undefined && (typeof plugins !== 'object' || plugins === null || Array.isArray(plugins))) {
    return { ok: false, error: '[plugins] is not a table' }
  }
  const table = { ...(plugins as Record<string, unknown> | undefined) }
  const current = table.paths
  if (current !== undefined && !Array.isArray(current)) return { ok: false, error: '[plugins].paths is not an array' }

  const removeSet = new Set(remove)
  const kept: unknown[] = []
  for (const entry of current ?? []) {
    if (typeof entry === 'string' && removeSet.has(entry)) continue
    kept.push(entry)
  }
  const have = new Set(kept.filter((entry): entry is string => typeof entry === 'string'))
  for (const path of add) {
    if (have.has(path)) continue
    kept.push(path)
    have.add(path)
  }
  table.paths = kept
  doc.plugins = table
  const paths = kept.filter((entry): entry is string => typeof entry === 'string')
  return { ok: true, toml: stringify(doc), paths }
}

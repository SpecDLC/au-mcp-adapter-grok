// Grok's native tool surface — the one thing only this adapter can declare.
//
// Payload identities are Grok's names. Hook matchers also accept Claude aliases
// (`Bash` → `run_terminal_command`); those aliases are not the names mediate sees.
// An MCP call arrives as the catalog key `au__<tool>`, which is what `gatePrefix` matches.

import type { AdapterInfo, NativeTool } from '@arsumbris/au-mcp-sdk'

export const MCP_SERVER_NAME = 'au'
/** Catalog key prefix. `au-mcp-core` strips this before precondition and read-guard checks. */
export const GATE_PREFIX = `${MCP_SERVER_NAME}__`

export const GROK_NATIVE_TOOLS: NativeTool[] = [
  { name: 'run_terminal_command', gateEquivalent: `${GATE_PREFIX}bash` },
  { name: 'read_file', gateEquivalent: `${GATE_PREFIX}read_file_pinned` },
  { name: 'search_replace', gateEquivalent: `${GATE_PREFIX}edit_file` },
  { name: 'grep', gateEquivalent: `${GATE_PREFIX}grep_files` },
  { name: 'list_dir', gateEquivalent: `${GATE_PREFIX}glob` },
  { name: 'web_search' },
  { name: 'web_fetch' },
  { name: 'spawn_subagent' },
]

/** Native tools with a single file direction. Shell access is not one of them. */
export const GROK_FILE_ACCESS: Record<string, 'read' | 'write'> = {
  read_file: 'read',
  search_replace: 'write',
}

export interface GrokSessionOptions {
  resume?: boolean
  profile?: string
  handle?: string
}

/** `resumeRef` is the Grok session UUID (`grok -r <id>`). */
export function grokAdapterInfo(
  session: string,
  workspace: string,
  options: GrokSessionOptions = {},
): AdapterInfo {
  return {
    harness: 'mcp.adapter.grok',
    session,
    workspace,
    resumeRef: session,
    nativeTools: GROK_NATIVE_TOOLS,
    gatePrefix: GATE_PREFIX,
    ...(options.handle ? { handle: options.handle } : {}),
    ...(options.resume ? { resume: true } : {}),
    ...(options.profile ? { profile: options.profile } : {}),
  }
}

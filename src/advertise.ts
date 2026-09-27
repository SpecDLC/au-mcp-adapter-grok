// Forward the daemon's tool manifests. Names must pass Grok's catalog admission:
// ASCII letters, digits, underscores, and hyphens, and no extra `__`.

import type { PluginManifest, ToolManifest } from '@arsumbris/au-mcp-sdk'

export interface McpToolDescriptor {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

const EMPTY_SCHEMA: Record<string, unknown> = { type: 'object', properties: {}, additionalProperties: false }
const TOOL_NAME = /^[A-Za-z0-9_-]+$/

/** Agent-facing tool name (`mcp.read_file_pinned` → `read_file_pinned`). */
export const toolName = (id: string): string => id.replace(/^mcp\./, '')

export function admissibleToolName(name: string): boolean {
  return TOOL_NAME.test(name) && !name.includes('__') && name.length > 0
}

export function provenanceNote(callables: PluginManifest[]): string {
  const contributed = new Map<string, string[]>()
  for (const manifest of callables) {
    if (!manifest.provenance || manifest.provenance === 'core') continue
    const name = toolName(manifest.id)
    if (!admissibleToolName(name)) continue
    contributed.set(manifest.provenance, [...(contributed.get(manifest.provenance) ?? []), name])
  }
  if (contributed.size === 0) {
    return '\nTool provenance: every tool here is CORE, built into the gate by the arsumbris engine. No capability packages contribute tools in this workspace.'
  }
  const groups = [...contributed].map(([repo, names]) => `${names.sort().join(', ')} (from ${repo})`).join('; ')
  return `\nTool provenance: tools not named here are CORE, built into the gate by the arsumbris engine. CONTRIBUTED by mounted capability packages: ${groups}.`
}

export function toolCatalogue(tools: McpToolDescriptor[]): string {
  if (tools.length === 0) {
    return '\nNo au tools are available in this session. If you expected some, the au-mcp daemon may not be running for this workspace.'
  }
  const lines = tools.map((tool) => `- au__${tool.name}: ${tool.description}`).join('\n')
  return `\nThe ${tools.length} au tools in this session. Call each with use_tool and tool_name set to the au__ key:\n${lines}`
}

export function guidanceNotes(callables: PluginManifest[]): string {
  const notes = callables
    .filter((manifest): manifest is ToolManifest => manifest.kind === 'tool')
    .filter((manifest) => manifest.guidance && admissibleToolName(toolName(manifest.id)))
    .map((manifest) => `- au__${toolName(manifest.id)}: ${manifest.guidance}`)
  return notes.length === 0 ? '' : `\nWhen to reach for these, unprompted:\n${notes.join('\n')}`
}

export function buildTools(callables: PluginManifest[]): McpToolDescriptor[] {
  const tools: McpToolDescriptor[] = []
  for (const manifest of callables) {
    if (manifest.kind !== 'tool') continue
    const name = toolName(manifest.id)
    if (!admissibleToolName(name)) {
      process.stderr.write(`au-mcp shim: skipping tool ${manifest.id}; its name is not a Grok catalog key\n`)
      continue
    }
    tools.push({
      name,
      description: manifest.description ?? manifest.name,
      inputSchema: manifest.inputSchema ?? EMPTY_SCHEMA,
    })
  }
  return tools
}

// Grok hook stdin is one JSON object: camelCase fields, plus snake_case aliases
// and `hook_event_name` holding Claude's PascalCase event name.

export interface GrokHookPayload {
  /** PascalCase event name (`PreToolUse`). */
  hookEventName: string
  sessionId: string
  cwd?: string
  workspaceRoot?: string
  transcriptPath?: string
  toolName?: string
  toolInput?: unknown
  toolUseId?: string
  toolResult?: unknown
  prompt?: string
  source?: string
  reason?: string
  permissionMode?: string
  agentId?: string
  agentType?: string
  raw: Record<string, unknown>
}

/** Read all of stdin and parse JSON. A bad body becomes `{ unparseable }`. */
export async function readPayload(stream: AsyncIterable<string | Buffer>): Promise<Record<string, unknown>> {
  let raw = ''
  for await (const chunk of stream) raw += chunk
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { unparseable: raw }
  }
}

function str(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

/**
 * Prefer `hook_event_name`, which already holds the PascalCase event.
 * Otherwise read `hookEventName` and turn `pre_tool_use` into `PreToolUse`.
 */
export function normalizePayload(raw: Record<string, unknown>): GrokHookPayload {
  const pascal = str(raw, 'hook_event_name')
  const snake = str(raw, 'hookEventName')
  const hookEventName = pascal ?? (snake ? snake.replace(/(^|_)([a-z])/g, (_, _p, c: string) => c.toUpperCase()) : 'Unknown')
  return {
    hookEventName,
    sessionId: str(raw, 'sessionId', 'session_id') ?? 'unknown-session',
    cwd: str(raw, 'cwd'),
    workspaceRoot: str(raw, 'workspaceRoot', 'workspace_root'),
    transcriptPath: str(raw, 'transcriptPath', 'transcript_path'),
    toolName: str(raw, 'toolName', 'tool_name'),
    toolInput: raw.toolInput ?? raw.tool_input,
    toolUseId: str(raw, 'toolUseId', 'tool_use_id'),
    toolResult: raw.toolResult ?? raw.tool_response ?? raw.tool_result,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : undefined,
    source: str(raw, 'source'),
    reason: str(raw, 'reason'),
    permissionMode: str(raw, 'permissionMode', 'permission_mode'),
    agentId: str(raw, 'agentId', 'agent_id'),
    agentType: str(raw, 'agentType', 'agent_type', 'subagentType', 'subagent_type'),
    raw,
  }
}

/** Read one hook payload from stdin, run `work`, and exit. A thrown error still fails the process. */
export async function runHook(work: (payload: GrokHookPayload) => Promise<unknown>): Promise<void> {
  const payload = normalizePayload(await readPayload(process.stdin))
  await work(payload)
  process.exit(0)
}

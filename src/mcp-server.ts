// stdio MCP server Grok spawns as the `au` plugin server.
// Tool calls forward `invoke` to the daemon. A missing launch handle refuses every call.

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { connectSocket, createDaemonClient, DaemonConnectionError, socketPath, type DaemonClient } from '@arsumbris/au-mcp-sdk'

import { buildTools, guidanceNotes, provenanceNote, toolCatalogue } from './advertise.ts'
import { resolveProfile, resolveSessionHandle } from './bridge.ts'

const fail = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true })
const ok = (result: unknown, isError?: boolean) => ({
  content: [{ type: 'text' as const, text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
  isError,
})

const RECONNECT_BACKOFF_MS = [100, 300, 900]
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const FRAMING = `The "au" gate mediates this workspace's typed knowledge base (the arsumbris engine).
These tools are MCP tools on the server "au". Call them with use_tool and tool_name "au__<tool>" (for example au__edit_file). They are not separate built-in tools.
State-touching actions route through the gate, so every one is governed and traced.
For plain file content, use read_file and grep unless this session's native-tool allowlist says otherwise. Reach for the gate's reads when you want typed or structured answers about the knowledge base.
Paths are absolute. Your au tools in this session are exactly the ones listed below.`

const HANDLE_MISSING_TOOL_ERROR =
  'This session is missing the required AU_MCP_SESSION handle, so the au gate is non-functional. ' +
  'Tell the user this session was launched without AU_MCP_SESSION and must be relaunched. Do not retry the au tools.'

const HANDLE_MISSING_FRAMING =
  'HIGHEST PRIORITY — the au gate is installed but this session is missing AU_MCP_SESSION, so every au tool will refuse. ' +
  'Tell the user to relaunch with a proper launcher before anything else.\n\n'

async function dialDaemon(workspace: string): Promise<DaemonClient | null> {
  const transport = await connectSocket(socketPath(workspace)).catch(() => null)
  return transport ? createDaemonClient(transport) : null
}

async function reconnectDaemon(workspace: string): Promise<DaemonClient | null> {
  for (const delay of RECONNECT_BACKOFF_MS) {
    await sleep(delay)
    const client = await dialDaemon(workspace)
    if (client) return client
  }
  return null
}

const NO_CAPS = { callables: [] } as Awaited<ReturnType<DaemonClient['listCapabilities']>>

export async function resolveStartupCapabilities(
  client: DaemonClient | null,
  workspace: string,
  profile: string | undefined,
  reconnect: (ws: string) => Promise<DaemonClient | null> = reconnectDaemon,
): Promise<{ client: DaemonClient | null; caps: Awaited<ReturnType<DaemonClient['listCapabilities']>> }> {
  if (!client) return { client: null, caps: NO_CAPS }
  try {
    return { client, caps: await client.listCapabilities(undefined, profile) }
  } catch (error) {
    process.stderr.write(`au-mcp shim: listCapabilities failed at startup (${messageOf(error)}); retrying once\n`)
    client.dispose()
    const retry = await reconnect(workspace)
    if (!retry) return { client: null, caps: NO_CAPS }
    try {
      return { client: retry, caps: await retry.listCapabilities(undefined, profile) }
    } catch (again) {
      process.stderr.write(`au-mcp shim: listCapabilities still failing (${messageOf(again)}); starting degraded\n`)
      retry.dispose()
      return { client: null, caps: NO_CAPS }
    }
  }
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Run the MCP server for `workspace`. */
export async function runMcpServer(workspace: string): Promise<void> {
  const handle = resolveSessionHandle()
  const degraded = handle === undefined
  const profile = resolveProfile()
  let { client, caps } = await resolveStartupCapabilities(await dialDaemon(workspace), workspace, profile)
  const tools = buildTools(caps.callables)
  const advertised = new Set(tools.map((tool) => tool.name))

  const server = new Server(
    { name: 'au', version: '0.0.0' },
    {
      capabilities: { tools: {} },
      instructions:
        (degraded ? HANDLE_MISSING_FRAMING : '') +
        FRAMING +
        toolCatalogue(tools) +
        guidanceNotes(caps.callables) +
        provenanceNote(caps.callables),
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name
    const args = (request.params.arguments ?? {}) as Record<string, unknown>
    if (degraded) return fail(HANDLE_MISSING_TOOL_ERROR)
    if (!advertised.has(name)) return fail(`tool not available in this session: ${name}`)
    if (!client) {
      client = await reconnectDaemon(workspace)
      if (!client) return fail('au-mcp daemon not reachable for this workspace — is it running?')
    }
    try {
      const { result, isError } = await client.invoke(handle, `mcp.${name}`, args)
      return ok(result, isError)
    } catch (error) {
      if (!(error instanceof DaemonConnectionError)) throw error
      if (error.code === 'timeout') return fail('au-mcp daemon is not responding (wedged) — restart the daemon')
      client.dispose()
      client = await reconnectDaemon(workspace)
      if (!client) return fail('au-mcp daemon connection dropped and could not reconnect — restart the daemon')
      try {
        const { result, isError } = await client.invoke(handle, `mcp.${name}`, args)
        return ok(result, isError)
      } catch {
        return fail('au-mcp daemon still unreachable after reconnect — restart the daemon or this session')
      }
    }
  })

  await server.connect(new StdioServerTransport())
}

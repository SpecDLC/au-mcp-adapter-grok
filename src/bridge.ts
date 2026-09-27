// Hook process → daemon. A down daemon must not crash the Grok session.
// Mediation fails open. The MCP shim fails closed when AU_MCP_SESSION is missing.

import {
  connectSocket,
  createDaemonClient,
  LAUNCH_ENV,
  parseProfile,
  parseSessionHandle,
  socketPath,
  traceEvent,
  type DaemonClient,
  type Decision,
  type PendingAction,
  type ReplayEvent,
} from '@arsumbris/au-mcp-sdk'

import type { GrokHookPayload } from './payload.ts'
import { grokAdapterInfo } from './surface.ts'

export function resolveSessionHandle(): string | undefined {
  return parseSessionHandle(process.env[LAUNCH_ENV.SESSION])
}

export function resolveProfile(): string | undefined {
  return parseProfile(process.env[LAUNCH_ENV.PROFILE])
}

export function resolveResume(payload: { source?: string } | null): boolean {
  return payload?.source === 'resume'
}

export function resolveContext(payload: GrokHookPayload | null): { workspace: string; session: string } {
  const workspace =
    process.env[LAUNCH_ENV.WORKSPACE] ??
    payload?.workspaceRoot ??
    payload?.cwd ??
    process.cwd()
  return { workspace, session: payload?.sessionId ?? 'unknown-session' }
}

export function agentFields(payload: GrokHookPayload | null): { agent_id?: string; agent_type?: string } {
  return {
    ...(payload?.agentId ? { agent_id: payload.agentId } : {}),
    ...(payload?.agentType ? { agent_type: payload.agentType } : {}),
  }
}

async function withSession<T>(
  payload: GrokHookPayload | null,
  fn: (client: DaemonClient, session: string) => Promise<T>,
  fallback: T,
): Promise<T> {
  const { workspace, session } = resolveContext(payload)
  const transport = await connectSocket(socketPath(workspace)).catch(() => null)
  if (!transport) return fallback
  const client = createDaemonClient(transport)
  try {
    await client.sessionOpen(
      grokAdapterInfo(session, workspace, {
        handle: resolveSessionHandle(),
        resume: resolveResume(payload),
        profile: resolveProfile(),
      }),
    )
    return await fn(client, session)
  } catch {
    return fallback
  } finally {
    client.dispose()
    transport.close()
  }
}

export async function observeEvent(
  payload: GrokHookPayload | null,
  kind: string,
  data: unknown,
): Promise<string | undefined> {
  return withSession(payload, (client, session) => client.observe(session, traceEvent(kind, session, data)), undefined)
}

export async function observeEvents(
  payload: GrokHookPayload | null,
  events: Array<{ kind: string; data: unknown; at?: string; dedupeKey?: string }>,
): Promise<boolean> {
  if (events.length === 0) return true
  return withSession(
    payload,
    async (client, session) => {
      for (const event of events) {
        await client.observe(session, traceEvent(event.kind, session, event.data, event.at, event.dedupeKey))
      }
      return true
    },
    false,
  )
}

export async function sendRehydrate(
  payload: GrokHookPayload | null,
  events: ReplayEvent[],
): Promise<{ injected: number; refused: number } | undefined> {
  if (events.length === 0) return undefined
  return withSession(payload, (client, session) => client.sessionRehydrate(session, events), undefined)
}

export async function reportTurnEnd(payload: GrokHookPayload | null): Promise<void> {
  await withSession(payload, (client, session) => client.turnEnd(session), undefined)
}

/** Allows when the daemon cannot be reached. */
export async function mediateAction(payload: GrokHookPayload | null, action: PendingAction): Promise<Decision> {
  return withSession(payload, (client, session) => client.mediate(session, action), { kind: 'allow' })
}

export async function sessionStartContext(payload: GrokHookPayload | null): Promise<{ inject: string[] }> {
  return withSession(payload, (client, session) => client.sessionStartContext(session), { inject: [] })
}

export async function closeSession(payload: GrokHookPayload | null): Promise<void> {
  const { workspace, session } = resolveContext(payload)
  const transport = await connectSocket(socketPath(workspace)).catch(() => null)
  if (!transport) return
  const client = createDaemonClient(transport)
  try {
    await client.sessionClose(session)
  } catch {
    // best-effort
  } finally {
    client.dispose()
    transport.close()
  }
}

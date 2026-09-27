// Read Grok's `updates.jsonl` and turn observable lines into daemon replay events.
// Prefer the hook's `transcriptPath`. Otherwise locate
// `$GROK_HOME/sessions/<percent-encoded cwd>/<session id>/updates.jsonl`.

import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { EventKind, type ReplayEvent } from '@arsumbris/au-mcp-sdk'

import { observeEvents, resolveContext, sendRehydrate } from './bridge.ts'
import type { GrokHookPayload } from './payload.ts'

const cursors = new Map<string, number>()

/** Percent-encode every byte outside the unreserved set, matching Grok's `encode_cwd_dirname`. */
export function encodeCwdDirname(cwd: string): string {
  let encoded = ''
  for (const byte of Buffer.from(cwd)) {
    const char = String.fromCharCode(byte)
    encoded += /[A-Za-z0-9\-_.~]/.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
  }
  return encoded.length <= 255 ? encoded : ''
}

export function grokHome(): string {
  return process.env.GROK_HOME ?? join(homedir(), '.grok')
}

/** Session transcript path. Empty encode means the cwd is too long for a directory name. */
export function updatesPath(workspace: string, sessionId: string, home = grokHome()): string | null {
  const encoded = encodeCwdDirname(workspace)
  if (!encoded) return null
  return join(home, 'sessions', encoded, sessionId, 'updates.jsonl')
}

export function transcriptPath(payload: GrokHookPayload): string | null {
  if (payload.transcriptPath) return payload.transcriptPath
  const { workspace, session } = resolveContext(payload)
  return updatesPath(workspace, session)
}

interface UpdateLine {
  timestamp?: number
  update: Record<string, unknown>
}

function readUpdate(line: string): UpdateLine | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const record = parsed as { timestamp?: unknown; method?: unknown; params?: { update?: unknown }; update?: unknown }
  const update = (record.params && typeof record.params === 'object' ? record.params.update : undefined) ?? record.update
  if (!update || typeof update !== 'object') return null
  return { timestamp: typeof record.timestamp === 'number' ? record.timestamp : undefined, update: update as Record<string, unknown> }
}

function atFrom(timestamp: number | undefined): string | undefined {
  if (timestamp === undefined) return undefined
  const ms = timestamp > 1e12 ? timestamp : timestamp > 1e9 ? timestamp * 1000 : undefined
  return ms === undefined ? undefined : new Date(ms).toISOString()
}

function textOf(update: Record<string, unknown>): string {
  const content = update.content
  if (!content || typeof content !== 'object') return ''
  const text = (content as { text?: unknown }).text
  return typeof text === 'string' ? text : ''
}

/**
 * Observable events from one transcript slice.
 * Consecutive message chunks of the same role join. In-progress tool updates are skipped.
 */
export function extractObservable(text: string): ReplayEvent[] {
  const events: ReplayEvent[] = []
  let user = ''
  let agent = ''
  let userAt: string | undefined
  let agentAt: string | undefined
  let index = 0

  const flushUser = () => {
    if (!user) return
    events.push({ kind: EventKind.UserPrompt, data: { prompt: user }, at: userAt, dedupeKey: `user:${index++}` })
    user = ''
    userAt = undefined
  }
  const flushAgent = () => {
    if (!agent) return
    events.push({
      kind: EventKind.AssistantMessage,
      data: { blocks: [{ kind: 'text', text: agent }] },
      at: agentAt,
      dedupeKey: `agent:${index++}`,
    })
    agent = ''
    agentAt = undefined
  }

  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const row = readUpdate(line)
    if (!row) continue
    const kind = row.update.sessionUpdate
    const at = atFrom(row.timestamp)
    if (kind === 'user_message_chunk') {
      flushAgent()
      if (!user) userAt = at
      user += textOf(row.update)
      continue
    }
    if (kind === 'agent_message_chunk') {
      flushUser()
      if (!agent) agentAt = at
      agent += textOf(row.update)
      continue
    }
    if (kind !== 'tool_call' && kind !== 'tool_call_update') continue
    const status = typeof row.update.status === 'string' ? row.update.status : undefined
    if (status === 'in_progress' || status === 'pending') continue
    flushUser()
    flushAgent()
    const failed = status === 'failed' || status === 'error'
    const id = typeof row.update.toolCallId === 'string' ? row.update.toolCallId : `${index}`
    events.push({
      kind: failed ? EventKind.ToolFailed : EventKind.ToolCall,
      data: {
        tool: typeof row.update.title === 'string' ? row.update.title : typeof row.update.kind === 'string' ? row.update.kind : 'tool',
        input: row.update.rawInput ?? null,
        tool_use_id: id,
        response: row.update.rawOutput ?? row.update.content ?? null,
      },
      at,
      dedupeKey: `tool:${id}:${status ?? kind}`,
    })
  }
  flushUser()
  flushAgent()
  return events
}

function readNew(path: string, from: number): { text: string; next: number } | null {
  let fd: number
  try {
    fd = openSync(path, 'r')
  } catch {
    return null
  }
  try {
    const size = fstatSync(fd).size
    if (size < from) return { text: readFileSync(fd, 'utf8'), next: size }
    if (size === from) return { text: '', next: size }
    const buffer = Buffer.alloc(size - from)
    readSync(fd, buffer, 0, buffer.length, from)
    return { text: buffer.toString('utf8'), next: size }
  } finally {
    closeSync(fd)
  }
}

/** Replay the whole transcript on a resume. Advances the cursor only when the daemon accepts it. */
export async function rehydrateSession(payload: GrokHookPayload): Promise<void> {
  const path = transcriptPath(payload)
  if (!path) return
  const slice = readNew(path, 0)
  if (!slice || !slice.text) return
  const events = extractObservable(slice.text)
  const tally = await sendRehydrate(payload, events)
  if (tally) cursors.set(path, slice.next)
}

/** Lift the transcript tail since the last successful flush. */
export async function liftTranscript(payload: GrokHookPayload): Promise<void> {
  const path = transcriptPath(payload)
  if (!path) return
  const from = cursors.get(path) ?? 0
  const slice = readNew(path, from)
  if (!slice || !slice.text) return
  const events = extractObservable(slice.text)
  const flushed = await observeEvents(payload, events)
  if (flushed) cursors.set(path, slice.next)
}

/** Test hook: forget cursors. */
export function resetLiftCursors(): void {
  cursors.clear()
}

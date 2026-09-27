import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { EventKind } from '@arsumbris/au-mcp-sdk'

import { encodeCwdDirname, extractObservable, updatesPath } from '../src/lift.ts'

const line = (timestamp: number, update: unknown) =>
  JSON.stringify({ timestamp, method: 'session/update', params: { sessionId: 's', update } })

describe('lift', () => {
  it('percent-encodes a workspace cwd the way Grok names session directories', () => {
    expect(encodeCwdDirname('/tmp/proj')).toBe('%2Ftmp%2Fproj')
    const home = mkdtempSync(join(tmpdir(), 'grok-home-'))
    expect(updatesPath('/tmp/proj', 'sid', home)).toBe(join(home, 'sessions', '%2Ftmp%2Fproj', 'sid', 'updates.jsonl'))
  })

  it('reads a fixture updates.jsonl into user, assistant, and tool events', () => {
    const dir = mkdtempSync(join(tmpdir(), 'updates-'))
    const path = join(dir, 'updates.jsonl')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      path,
      [
        line(1_700_000_000_000, { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'hello ' } }),
        line(1_700_000_000_001, { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'there' } }),
        line(1_700_000_000_002, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hi' } }),
        line(1_700_000_000_003, { sessionUpdate: 'tool_call', toolCallId: 'tc1', title: 'Read file', kind: 'read', status: 'in_progress' }),
        line(1_700_000_000_004, { sessionUpdate: 'tool_call_update', toolCallId: 'tc1', title: 'Read file', status: 'completed', rawOutput: 'ok' }),
      ].join('\n'),
    )
    const events = extractObservable(readFileSync(path, 'utf8'))
    expect(events.map((event) => event.kind)).toEqual([EventKind.UserPrompt, EventKind.AssistantMessage, EventKind.ToolCall])
    expect(events[0]?.data).toEqual({ prompt: 'hello there' })
    expect(events[2]?.dedupeKey).toBe('tool:tc1:completed')
  })
})

import { describe, expect, it } from 'vitest'

import { normalizePayload } from '../src/payload.ts'
import { resolveResume } from '../src/bridge.ts'

describe('payload', () => {
  it('reads camelCase fields and the PascalCase event alias', () => {
    const payload = normalizePayload({
      hookEventName: 'pre_tool_use',
      hook_event_name: 'PreToolUse',
      sessionId: 'abc',
      cwd: '/work',
      toolName: 'au__edit_file',
      tool_name: 'ignored',
      toolInput: { path: 'a.md' },
      toolUseId: 'tu1',
    })
    expect(payload.hookEventName).toBe('PreToolUse')
    expect(payload.sessionId).toBe('abc')
    expect(payload.toolName).toBe('au__edit_file')
    expect(payload.toolInput).toEqual({ path: 'a.md' })
    expect(payload.toolUseId).toBe('tu1')
  })

  it('falls back to snake_case aliases', () => {
    const payload = normalizePayload({
      hook_event_name: 'PostToolUse',
      session_id: 'sid',
      tool_name: 'read_file',
      transcript_path: '/tmp/updates.jsonl',
    })
    expect(payload.hookEventName).toBe('PostToolUse')
    expect(payload.sessionId).toBe('sid')
    expect(payload.toolName).toBe('read_file')
    expect(payload.transcriptPath).toBe('/tmp/updates.jsonl')
  })

  it('treats a start as a resume only when source is resume', () => {
    expect(resolveResume(normalizePayload({ source: 'startup', sessionId: 'a' }))).toBe(false)
    expect(resolveResume(normalizePayload({ source: 'resume', sessionId: 'a' }))).toBe(true)
  })
})

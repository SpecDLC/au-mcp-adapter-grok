#!/usr/bin/env node
// PostToolUse records the completed call. It does not replace the tool output.
import { EventKind, commitReferent, pinnedFileTarget } from '@arsumbris/au-mcp-sdk'

import { agentFields, observeEvent } from '../src/bridge.ts'
import { postToolContext } from '../src/decisions.ts'
import { liftTranscript } from '../src/lift.ts'
import { normalizePayload, readPayload } from '../src/payload.ts'
import { GROK_FILE_ACCESS } from '../src/surface.ts'
import { extractTouch } from '../src/touched.ts'

const payload = normalizePayload(await readPayload(process.stdin))
const touch = extractTouch(payload.toolResult)
const target = pinnedFileTarget(touch) ?? undefined
const access = target ? (touch?.access ?? 'write') : payload.toolName ? GROK_FILE_ACCESS[payload.toolName] : undefined
const from = touch?.from
const committed = touch?.priorCommit ? (commitReferent(touch.commit) ?? undefined) : undefined
const review = await observeEvent(payload, EventKind.ToolCall, {
  tool: payload.toolName ?? null,
  input: payload.toolInput ?? null,
  tool_use_id: payload.toolUseId ?? null,
  response: payload.toolResult ?? null,
  ...(target ? { target } : {}),
  ...(access ? { access } : {}),
  ...(from ? { from } : {}),
  ...(committed ? { committed } : {}),
  ...agentFields(payload),
})
if (review) process.stdout.write(postToolContext(review))
await liftTranscript(payload)
process.exit(0)

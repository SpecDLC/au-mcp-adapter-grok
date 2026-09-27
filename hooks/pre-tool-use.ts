#!/usr/bin/env node
// PreToolUse asks the daemon to mediate. A down daemon allows the call.
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { agentFields, mediateAction, observeEvent } from '../src/bridge.ts'
import { preToolOutput } from '../src/decisions.ts'
import { normalizePayload, readPayload } from '../src/payload.ts'

const payload = normalizePayload(await readPayload(process.stdin))
const tool = payload.toolName ?? ''
const input = payload.toolInput ?? {}
const decision = await mediateAction(payload, { tool, input })

if (decision.kind === 'deny' || decision.kind === 'ask') {
  const output = preToolOutput(decision)
  if (output) process.stdout.write(output)
  process.exit(0)
}

await observeEvent(payload, EventKind.ToolStart, {
  tool,
  input,
  tool_use_id: payload.toolUseId ?? null,
  ...agentFields(payload),
})
const output = preToolOutput(decision)
if (output) process.stdout.write(output)
process.exit(0)

#!/usr/bin/env node
// PreToolUse asks the daemon to mediate. A down daemon allows the call.
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { agentFields, mediateAction, observeEvent } from '../src/bridge.ts'
import { preToolOutput } from '../src/decisions.ts'
import { runHook } from '../src/payload.ts'

await runHook(async (payload) => {
  const tool = payload.toolName ?? ''
  const input = payload.toolInput ?? {}
  const decision = await mediateAction(payload, { tool, input })
  if (decision.kind === 'deny' || decision.kind === 'ask') {
    const output = preToolOutput(decision)
    if (output) process.stdout.write(output)
    return
  }
  await observeEvent(payload, EventKind.ToolStart, {
    tool,
    input,
    tool_use_id: payload.toolUseId ?? null,
    ...agentFields(payload),
  })
  const output = preToolOutput(decision)
  if (output) process.stdout.write(output)
})

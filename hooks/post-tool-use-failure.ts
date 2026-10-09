#!/usr/bin/env node
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { agentFields, observeEvent } from '../src/bridge.ts'
import { runHook } from '../src/payload.ts'

await runHook(async (payload) => {
  await observeEvent(payload, EventKind.ToolFailed, {
    tool: payload.toolName ?? null,
    input: payload.toolInput ?? null,
    tool_use_id: payload.toolUseId ?? null,
    response: payload.toolResult ?? null,
    ...agentFields(payload),
  })
})

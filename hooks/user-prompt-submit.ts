#!/usr/bin/env node
// UserPromptSubmit records the prompt. An allowing hook's stdout is discarded.
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { observeEvent } from '../src/bridge.ts'
import { normalizePayload, readPayload } from '../src/payload.ts'

const payload = normalizePayload(await readPayload(process.stdin))
await observeEvent(payload, EventKind.UserPrompt, {
  prompt: payload.prompt ?? null,
  permission_mode: payload.permissionMode ?? null,
})
process.exit(0)

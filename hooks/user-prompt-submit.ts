#!/usr/bin/env node
// UserPromptSubmit records the prompt. An allowing hook's stdout is discarded.
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { observeEvent } from '../src/bridge.ts'
import { runHook } from '../src/payload.ts'

await runHook((payload) =>
  observeEvent(payload, EventKind.UserPrompt, {
    prompt: payload.prompt ?? null,
    permission_mode: payload.permissionMode ?? null,
  }),
)

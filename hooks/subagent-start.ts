#!/usr/bin/env node
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { agentFields, observeEvent } from '../src/bridge.ts'
import { runHook } from '../src/payload.ts'

await runHook((payload) =>
  observeEvent(payload, EventKind.Notification, { notification: 'subagent_start', ...agentFields(payload) }),
)

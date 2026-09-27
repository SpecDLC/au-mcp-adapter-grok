#!/usr/bin/env node
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { agentFields, observeEvent } from '../src/bridge.ts'
import { normalizePayload, readPayload } from '../src/payload.ts'

const payload = normalizePayload(await readPayload(process.stdin))
await observeEvent(payload, EventKind.Notification, { notification: 'subagent_start', ...agentFields(payload) })
process.exit(0)

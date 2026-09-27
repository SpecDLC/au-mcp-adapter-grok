#!/usr/bin/env node
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { observeEvent } from '../src/bridge.ts'
import { normalizePayload, readPayload } from '../src/payload.ts'

const payload = normalizePayload(await readPayload(process.stdin))
await observeEvent(payload, EventKind.Compaction, { trigger: payload.source ?? payload.reason ?? null })
process.exit(0)

#!/usr/bin/env node
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { closeSession, observeEvent } from '../src/bridge.ts'
import { liftTranscript } from '../src/lift.ts'
import { normalizePayload, readPayload } from '../src/payload.ts'

const payload = normalizePayload(await readPayload(process.stdin))
await liftTranscript(payload)
await observeEvent(payload, EventKind.SessionEnd, { reason: payload.reason ?? null })
await closeSession(payload)
process.exit(0)

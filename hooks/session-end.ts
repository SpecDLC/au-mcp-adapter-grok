#!/usr/bin/env node
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { closeSession, observeEvent } from '../src/bridge.ts'
import { liftTranscript } from '../src/lift.ts'
import { runHook } from '../src/payload.ts'

await runHook(async (payload) => {
  await liftTranscript(payload)
  await observeEvent(payload, EventKind.SessionEnd, { reason: payload.reason ?? null })
  await closeSession(payload)
})

#!/usr/bin/env node
// SessionStart opens the daemon session. Stdout is not delivered to the model.
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { observeEvent, resolveResume, sessionStartContext } from '../src/bridge.ts'
import { rehydrateSession } from '../src/lift.ts'
import { normalizePayload, readPayload } from '../src/payload.ts'

const payload = normalizePayload(await readPayload(process.stdin))
await observeEvent(payload, EventKind.SessionStart, { source: payload.source ?? null, transcript: payload.transcriptPath ?? null })
if (resolveResume(payload)) await rehydrateSession(payload)
const { inject } = await sessionStartContext(payload)
if (inject.length > 0) {
  process.stderr.write(
    `session-start: ${inject.length} computed block(s) stayed on the daemon; Grok does not deliver SessionStart stdout to the model\n`,
  )
}
process.exit(0)

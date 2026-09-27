#!/usr/bin/env node
// Stop lifts the transcript and reports the turn. It does not block the stop.
// A session-end Stop (reason other than end_turn) is observed by SessionEnd.
import { liftTranscript } from '../src/lift.ts'
import { reportTurnEnd } from '../src/bridge.ts'
import { normalizePayload, readPayload } from '../src/payload.ts'

const payload = normalizePayload(await readPayload(process.stdin))
await liftTranscript(payload)
if (payload.reason === undefined || payload.reason === 'end_turn') await reportTurnEnd(payload)
process.exit(0)

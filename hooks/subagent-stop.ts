#!/usr/bin/env node
import { liftTranscript } from '../src/lift.ts'
import { reportTurnEnd } from '../src/bridge.ts'
import { normalizePayload, readPayload } from '../src/payload.ts'

const payload = normalizePayload(await readPayload(process.stdin))
await liftTranscript(payload)
await reportTurnEnd(payload)
process.exit(0)

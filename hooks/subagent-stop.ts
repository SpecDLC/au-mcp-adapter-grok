#!/usr/bin/env node
import { liftTranscript } from '../src/lift.ts'
import { reportTurnEnd } from '../src/bridge.ts'
import { runHook } from '../src/payload.ts'

await runHook(async (payload) => {
  await liftTranscript(payload)
  await reportTurnEnd(payload)
})

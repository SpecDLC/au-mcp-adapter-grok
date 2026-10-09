#!/usr/bin/env node
import { EventKind } from '@arsumbris/au-mcp-sdk'

import { observeEvent } from '../src/bridge.ts'
import { runHook } from '../src/payload.ts'

await runHook((payload) => observeEvent(payload, EventKind.Compaction, { trigger: payload.source ?? payload.reason ?? null }))

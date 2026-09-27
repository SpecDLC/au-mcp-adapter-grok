// Map a daemon Decision onto the JSON Grok's PreToolUse hook reads.
// `additionalContext` on this event is delivered after the tool runs.

import type { Decision } from '@arsumbris/au-mcp-sdk'

/** JSON for stdout, or null when the tool should run with nothing else to say. */
export function preToolOutput(decision: Decision): string | null {
  if (decision.kind === 'deny') {
    return JSON.stringify({
      decision: 'deny',
      reason: decision.reason,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: decision.reason,
      },
    })
  }
  if (decision.kind === 'ask') {
    return JSON.stringify({
      decision: 'ask',
      reason: decision.reason,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: decision.reason,
      },
    })
  }
  const extra = decision.kind === 'inject' ? decision.text : decision.note
  if (!extra) return null
  return JSON.stringify({
    decision: 'allow',
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      additionalContext: extra,
    },
  })
}

/** PostToolUse context. Does not replace the tool output. */
export function postToolContext(text: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text },
  })
}

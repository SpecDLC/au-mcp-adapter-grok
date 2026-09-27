import { describe, expect, it } from 'vitest'

import { preToolOutput } from '../src/decisions.ts'

describe('preToolOutput', () => {
  it('denies and asks with Grok decision names', () => {
    const deny = JSON.parse(preToolOutput({ kind: 'deny', reason: 'use au__edit_file instead' }) ?? '{}')
    expect(deny.decision).toBe('deny')
    expect(deny.reason).toContain('au__edit_file')
    const ask = JSON.parse(preToolOutput({ kind: 'ask', reason: 'confirm' }) ?? '{}')
    expect(ask.decision).toBe('ask')
  })

  it('emits additionalContext for an inject and stays quiet for a plain allow', () => {
    expect(preToolOutput({ kind: 'allow' })).toBeNull()
    const inject = JSON.parse(preToolOutput({ kind: 'inject', text: 'note' }) ?? '{}')
    expect(inject.decision).toBe('allow')
    expect(inject.hookSpecificOutput.additionalContext).toBe('note')
  })
})

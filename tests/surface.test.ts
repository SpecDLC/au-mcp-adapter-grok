import { describe, expect, it } from 'vitest'

import { GATE_PREFIX, GROK_FILE_ACCESS, GROK_NATIVE_TOOLS, grokAdapterInfo } from '../src/surface.ts'

describe('surface', () => {
  it('declares Grok tool names and the au__ gate prefix', () => {
    expect(GATE_PREFIX).toBe('au__')
    expect(GROK_NATIVE_TOOLS.map((tool) => tool.name)).toEqual([
      'run_terminal_command',
      'read_file',
      'search_replace',
      'grep',
      'list_dir',
      'web_search',
      'web_fetch',
      'spawn_subagent',
    ])
    expect(GROK_NATIVE_TOOLS.find((tool) => tool.name === 'search_replace')?.gateEquivalent).toBe('au__edit_file')
    expect(GROK_FILE_ACCESS.read_file).toBe('read')
    expect(GROK_FILE_ACCESS.search_replace).toBe('write')
    expect(GROK_FILE_ACCESS.run_terminal_command).toBeUndefined()
  })

  it('reports the adapter type name as the harness join key', () => {
    const info = grokAdapterInfo('session-1', '/work', { handle: 'handle-1', resume: true, profile: 'Grok.yaml' })
    expect(info.harness).toBe('mcp.adapter.grok')
    expect(info.resumeRef).toBe('session-1')
    expect(info.gatePrefix).toBe('au__')
    expect(info.handle).toBe('handle-1')
    expect(info.resume).toBe(true)
    expect(info.profile).toBe('Grok.yaml')
  })
})

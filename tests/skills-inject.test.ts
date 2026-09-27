import { describe, expect, it } from 'vitest'

import type { InjectBlock, Skill } from '@arsumbris/au-mcp'

import { renderInjectTree } from '../src/inject-grok.ts'
import { grokSkillTransform, pluginName } from '../src/skills-grok.ts'

const skill = (owner: string, name: string): Skill => ({
  path: `/${owner}/${name}.md`,
  owner,
  name,
  description: 'When to use it',
  relatedTools: [],
  allowedTools: ['mcp.tool.edit_file'],
  body: 'Do the thing.',
})

describe('skills and injects', () => {
  it('builds one plugin per owner with an au__ allowed tool', () => {
    const tree = grokSkillTransform([skill('au-mcp-sdk', 'build-a-plugin'), skill('AU Host', 'orchestrate')])
    expect(tree.pluginRoots).toEqual(['au-host', 'au-mcp-sdk'])
    const markdown = tree.files.find((file) => file.relPath.endsWith('build-a-plugin/SKILL.md'))?.content ?? ''
    expect(markdown).toContain('allowed-tools: [au__edit_file]')
    expect(pluginName('AU Host')).toBe('au-host')
  })

  it('packs injects into au-inject files and names an overflow', () => {
    const blocks: InjectBlock[] = [
      { key: 'a:one', stem: 'one', repo: 'a', body: 'x'.repeat(40) },
      { key: 'a:two', stem: 'two', repo: 'a', body: 'y'.repeat(40) },
    ]
    const tree = renderInjectTree(blocks, { budget: 80, maxSlots: 1 })
    expect(tree.files[0]?.relPath).toBe('au-inject-01.md')
    expect(tree.files.some((file) => file.content.includes('NOT injected'))).toBe(true)
    expect(tree.dropped.length).toBeGreaterThan(0)
  })
})

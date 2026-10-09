import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildLaunchEnv } from '@arsumbris/au-mcp-sdk'

import { assertLaunchShape, grokLaunchCommand } from '../src/launch-grok.ts'
import { isAdapterManagedPath, mergePluginPathsToml, pathsToReplace } from '../src/project-config.ts'
import { syncInjectRules } from '../src/rules.ts'

describe('launch', () => {
  it('cds to the workspace, passes --trust, and omits plugin-dir and GROK_CONFIG', () => {
    const env = buildLaunchEnv({ workspace: '/work space', profile: 'profiles/Grok.yaml' })
    const launch = grokLaunchCommand(env, '/usr/local/bin/grok', '/work space', { resume: '11111111-1111-1111-1111-111111111111' })
    assertLaunchShape(launch)
    expect(launch.argv).toEqual(['--trust', '-r', '11111111-1111-1111-1111-111111111111'])
    expect(launch.command.startsWith("cd '/work space' && ")).toBe(true)
    expect(launch.command).toContain("'/usr/local/bin/grok'")
    expect(launch.command).not.toContain('--plugin-dir')
    expect(launch.env.GROK_CONFIG).toBeUndefined()
    expect(launch.env.AU_MCP_WORKSPACE).toBe('/work space')
    expect(launch.env.AU_MCP_PROFILE).toBe('profiles/Grok.yaml')
    expect(launch.env.AU_MCP_SESSION).toBeTruthy()
  })

  it('merges plugin paths and keeps unrelated config', () => {
    const existing = '[mcp_servers.other]\ncommand = "npx"\n\n[plugins]\npaths = ["/keep/mine", "/old/adapter"]\n'
    const merged = mergePluginPathsToml(existing, ['/old/adapter'], ['/repo/au-mcp-adapter-grok', '/gen/skills/owner'])
    expect(merged.ok).toBe(true)
    if (!merged.ok) return
    expect(merged.paths).toEqual(['/keep/mine', '/repo/au-mcp-adapter-grok', '/gen/skills/owner'])
    expect(merged.toml).toContain('npx')
    expect(merged.toml).not.toContain('/old/adapter')
  })

  it('refuses to rewrite a config it cannot parse', () => {
    const merged = mergePluginPathsToml('plugins = "nope"\n', [], ['/repo'])
    expect(merged.ok).toBe(false)
  })

  it('replaces the previous managed set and any next path this adapter owns', () => {
    expect(
      pathsToReplace(
        ['/old/skills', '/keep-not-in-next'],
        ['/repo', '/Users/me/.arsumbris/au-mcp/gen/skill/abc/grok/sel/pkg', '/other/plugin'],
        '/repo',
      ),
    ).toEqual(['/old/skills', '/keep-not-in-next', '/repo', '/Users/me/.arsumbris/au-mcp/gen/skill/abc/grok/sel/pkg'])
  })

  it('recognizes generated skill paths as adapter-managed', () => {
    expect(isAdapterManagedPath('/Users/me/.arsumbris/au-mcp/gen/skill/abc/grok/sel/au-mcp-sdk', '/repo')).toBe(true)
    expect(isAdapterManagedPath('/repo', '/repo')).toBe(true)
    expect(isAdapterManagedPath('/keep/mine', '/repo')).toBe(false)
  })

  it('replaces au-inject rules and leaves other rules', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'au-grok-'))
    mkdirSync(join(workspace, '.grok', 'rules'), { recursive: true })
    writeFileSync(join(workspace, '.grok', 'rules', 'local.md'), 'keep\n')
    writeFileSync(join(workspace, '.grok', 'rules', 'au-inject-09.md'), 'stale\n')
    syncInjectRules(workspace, new Map([['au-inject-00-calling.md', 'call use_tool\n']]))
    expect(readFileSync(join(workspace, '.grok', 'rules', 'local.md'), 'utf8')).toBe('keep\n')
    expect(readFileSync(join(workspace, '.grok', 'rules', 'au-inject-00-calling.md'), 'utf8')).toContain('use_tool')
    expect(() => readFileSync(join(workspace, '.grok', 'rules', 'au-inject-09.md'))).toThrow()
  })
})

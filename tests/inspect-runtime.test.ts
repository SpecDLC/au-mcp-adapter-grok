// Optional. Set GROK_TEST_BINARY to an absolute grok path.
// Uses a private GROK_HOME so it does not touch the user's Grok config.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const binary = process.env.GROK_TEST_BINARY
const adapterDir = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'))

describe('grok inspect', () => {
  it.skipIf(!binary)('loads this plugin, the au server, and an inject rule when the folder is trusted', () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'au-grok-ws-')))
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'au-grok-home-')))
    execFileSync('git', ['init', '-q'], { cwd: workspace })
    mkdirSync(join(workspace, '.grok', 'rules'), { recursive: true })
    writeFileSync(join(workspace, '.grok', 'config.toml'), `[plugins]\npaths = [${JSON.stringify(adapterDir)}]\n`)
    writeFileSync(join(workspace, '.grok', 'rules', 'au-inject-00-calling.md'), 'call use_tool\n')
    writeFileSync(
      join(home, 'trusted_folders.toml'),
      `[folders.${JSON.stringify(workspace)}]\ntrusted = true\ndecided_at = 1\n`,
    )

    const stdout = execFileSync(binary!, ['inspect', '--json'], {
      cwd: workspace,
      env: { ...process.env, GROK_HOME: home },
      encoding: 'utf8',
      timeout: 30_000,
    })
    const report = JSON.parse(stdout) as {
      projectTrusted?: boolean
      projectInstructions?: Array<{ path?: string }>
      plugins?: Array<{ name?: string; enabled?: boolean; scope?: string }>
      mcpServers?: Array<{ name?: string; source?: { plugin_name?: string } }>
    }
    expect(report.projectTrusted).toBe(true)
    expect(report.projectInstructions?.some((file) => file.path?.endsWith('au-inject-00-calling.md'))).toBe(true)
    expect(report.plugins).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'au-mcp-adapter-grok', enabled: true, scope: 'config' })]),
    )
    expect(report.mcpServers).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'au', source: expect.objectContaining({ plugin_name: 'au-mcp-adapter-grok' }) })]),
    )
  })
})

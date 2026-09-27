// Turn a harness-agnostic launch into an interactive `grok` command.
// The terminal cwd should be the workspace. The command also cds there, so it stands alone.

import { LAUNCH_ENV, type LaunchEnvResult } from '@arsumbris/au-mcp-sdk'

export interface GrokLaunch {
  env: Record<string, string>
  binary: string
  argv: string[]
  command: string
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** `grok --trust`, plus `-r <id>` when resuming. No `--plugin-dir` and no GROK_CONFIG. */
export function grokLaunchCommand(
  launch: LaunchEnvResult,
  binary: string,
  workspace: string,
  opts: { resume?: string } = {},
): GrokLaunch {
  const argv = ['--trust', ...(opts.resume ? ['-r', opts.resume] : [])]
  const prefix = Object.entries(launch.env)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(' ')
  const command = `cd ${shellQuote(workspace)} && ${prefix} ${shellQuote(binary)} ${argv.map(shellQuote).join(' ')}`
  return { env: { ...launch.env }, binary, argv, command }
}

export function assertLaunchShape(launch: GrokLaunch): void {
  if (launch.argv.includes('--plugin-dir')) throw new Error('grok launch must not pass --plugin-dir')
  if (LAUNCH_ENV.SESSION in launch.env && launch.env.GROK_CONFIG) throw new Error('grok launch must not set GROK_CONFIG')
  if (!launch.argv.includes('--trust')) throw new Error('grok launch must pass --trust')
  if (!launch.command.startsWith('cd ')) throw new Error('grok launch command must cd to the workspace')
}

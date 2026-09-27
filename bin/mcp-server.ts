#!/usr/bin/env node
// Grok spawns this from the plugin `.mcp.json` and speaks MCP over stdio.
import { resolve } from 'node:path'

import { LAUNCH_ENV } from '@arsumbris/au-mcp-sdk'

import { runMcpServer } from '../src/mcp-server.ts'

await runMcpServer(resolve(process.env[LAUNCH_ENV.WORKSPACE] ?? process.env.GROK_WORKSPACE_ROOT ?? process.cwd()))

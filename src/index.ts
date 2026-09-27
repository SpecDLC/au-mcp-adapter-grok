// @arsumbris/au-mcp-adapter-grok — the Grok adapter for the au-mcp kernel.
// Declares Grok's native surface and bridges its hooks. Holds no policy.

export * from './surface.ts'
export * from './payload.ts'
export * from './decisions.ts'
export * from './bridge.ts'
export { buildTools, toolName, admissibleToolName, type McpToolDescriptor } from './advertise.ts'
export { runMcpServer } from './mcp-server.ts'
export * from './skills-grok.ts'
export * from './inject-grok.ts'
export * from './project-config.ts'
export * from './launch-grok.ts'
export { extractObservable, encodeCwdDirname, updatesPath } from './lift.ts'

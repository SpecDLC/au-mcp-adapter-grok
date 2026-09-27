// mcp.inject blocks → markdown files the launcher copies into `<workspace>/.grok/rules/`.
// Grok does not deliver SessionStart hook stdout to the model. Project rules do.

import { packBlocks, type DroppedInject, type InjectBlock, type InjectTree, type PackBlock } from '@arsumbris/au-mcp'

/** Headroom under the 10k character clip Grok applies to hook context. Rules files use the same budget. */
export const GROK_SLOT_BUDGET = 8500

export const CALLING_NOTE = `The au gate is an MCP server named au. Call its tools with use_tool and tool_name set to au__<tool>, for example au__edit_file, au__write_file, or au__read_file_pinned. A refusal that says "use au__… instead" is naming that tool_name. These are not separate built-in tools.
`

export function grokInjectTransform(blocks: InjectBlock[]): InjectTree {
  return renderInjectTree(blocks, { budget: GROK_SLOT_BUDGET })
}

export function renderInjectTree(blocks: InjectBlock[], opts: { budget: number; maxSlots?: number }): InjectTree {
  if (blocks.length === 0) return { files: [], pluginRoots: [], dropped: [] }
  const rendered: PackBlock[] = blocks.map((block) => {
    const addr = `[[${block.stem}::${block.repo}]]`
    return { key: block.key, addr, text: injectedBlock(addr, block.body) }
  })
  const { slots, dropped } = packBlocks(rendered, opts)
  const texts = dropped.length > 0 ? [...slots, overflowNotice(dropped)] : slots
  const files = texts.map((text, index) => ({
    relPath: `au-inject-${String(index + 1).padStart(2, '0')}.md`,
    content: text.endsWith('\n') ? text : `${text}\n`,
  }))
  return { files, pluginRoots: ['.'], dropped }
}

function injectedBlock(addr: string, body: string): string {
  return `<injected file ${addr}>\n\n${body.trim()}\n\n</injected file ${addr}>\n`
}

function overflowNotice(dropped: DroppedInject[]): string {
  const lines = dropped.map((block) => `- ${block.addr}`).join('\n')
  return `<injected budget-overflow>\n${dropped.length} blocks NOT injected.\n${lines}\n</injected budget-overflow>\n`
}

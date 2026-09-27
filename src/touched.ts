// Lift a file-op `touched` pin out of a Grok tool result.
// The shim returns mutation JSON as a text block; a hook may also see that object directly.

import type { FileOpTouch } from '@arsumbris/au-mcp-sdk'

function responseText(toolResponse: unknown): string {
  if (typeof toolResponse === 'string') return toolResponse
  if (Array.isArray(toolResponse)) {
    return (toolResponse as Array<{ text?: unknown }>)
      .map((block) => (block && typeof block.text === 'string' ? block.text : ''))
      .join('')
  }
  return ''
}

function asTouch(value: unknown): FileOpTouch | null {
  if (value && typeof value === 'object' && typeof (value as FileOpTouch).path === 'string') return value as FileOpTouch
  return null
}

/** The file-op pin, or null when this result is not a mutation. */
export function extractTouch(toolResponse: unknown): FileOpTouch | null {
  const direct = toolResponse && typeof toolResponse === 'object' && !Array.isArray(toolResponse)
    ? asTouch((toolResponse as { touched?: unknown }).touched)
    : null
  if (direct) return direct
  const text = responseText(toolResponse).trim()
  if (!text || text[0] !== '{') return null
  try {
    return asTouch((JSON.parse(text) as { touched?: unknown }).touched)
  } catch {
    return null
  }
}

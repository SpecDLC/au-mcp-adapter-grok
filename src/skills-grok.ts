// mcp.skill instances → one Grok plugin per owning repo.
// Grok qualifies a colliding skill as `/<plugin>:<skill>`, and the plugin name is the owner.

import type { Skill, SkillTree } from '@arsumbris/au-mcp'

import { GATE_PREFIX } from './surface.ts'

const MAX_PLUGIN_NAME = 64

/** Plugin directory name: lowercase, digits, hyphens, within Grok's 64-character limit. */
export function pluginName(owner: string): string {
  const slug = owner
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_PLUGIN_NAME)
    .replace(/-+$/g, '')
  if (!slug) throw new Error(`Invalid Grok plugin name from owner ${JSON.stringify(owner)}`)
  return slug
}

export function grokSkillTransform(skills: Skill[]): SkillTree {
  const byOwner = new Map<string, Skill[]>()
  for (const skill of skills) byOwner.set(skill.owner, [...(byOwner.get(skill.owner) ?? []), skill])

  const files: SkillTree['files'] = []
  const pluginRoots: string[] = []
  const used = new Set<string>()
  for (const [owner, owned] of [...byOwner].sort(([a], [b]) => a.localeCompare(b))) {
    let root = pluginName(owner)
    for (let n = 2; used.has(root); n++) root = pluginName(`${owner}-${n}`)
    used.add(root)
    pluginRoots.push(root)
    files.push({
      relPath: `${root}/plugin.json`,
      content: `${JSON.stringify({ name: root, version: '0.0.0', description: `Agent guidance from ${owner}.` }, null, 2)}\n`,
    })
    for (const skill of owned) {
      files.push({ relPath: `${root}/skills/${skill.name}/SKILL.md`, content: skillMarkdown(skill) })
    }
  }
  return { files, pluginRoots }
}

function skillMarkdown(skill: Skill): string {
  const front = [`name: ${yamlScalar(skill.name)}`, `description: ${yamlScalar(skill.description)}`]
  const allowed = skill.allowedTools.map((name) => `${GATE_PREFIX}${name.replace(/^mcp\.tool\./, '')}`)
  if (allowed.length > 0) front.push(`allowed-tools: [${allowed.join(', ')}]`)
  const body = skill.body.trim()
  return `---\n${front.join('\n')}\n---\n\n${body}${body ? '\n' : ''}`
}

function yamlScalar(value: string): string {
  return !value || /[:#\n\r\t]|^\s|\s$|^[!&*{}\[\],%@`>|'"]/.test(value) || /^(?:true|false|null|yes|no|on|off|~|[-+]?\d.*)$/i.test(value)
    ? JSON.stringify(value)
    : value
}

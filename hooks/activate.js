#!/usr/bin/env node
// SessionStart hook — injects cold-shower skill into every Claude Code session.
// User never needs to type /cold-shower — Claude already knows it and offers it.

const fs = require('fs')
const path = require('path')

const locations = [
  process.env.CLAUDE_PLUGIN_ROOT
    ? path.join(process.env.CLAUDE_PLUGIN_ROOT, 'skills', 'cold-shower', 'SKILL.md')
    : null,
  path.join(__dirname, '..', 'skills', 'cold-shower', 'SKILL.md'),
  path.join(process.env.HOME || '', '.claude', 'skills', 'cold-shower', 'SKILL.md'),
].filter(Boolean)

const skillPath = locations.find(p => { try { return fs.existsSync(p) } catch { return false } })
if (!skillPath) process.exit(0)

process.stdout.write(fs.readFileSync(skillPath, 'utf8'))

// Inject recall memories from brain files
const os = require('os')
const projectName = path.basename(process.cwd())
const brainFiles = [
  path.join(os.homedir(), '.claude', 'brain', 'preferences.md'),
  path.join(os.homedir(), '.claude', 'projects', projectName, 'brain', 'context.md'),
  path.join(os.homedir(), '.claude', 'projects', projectName, 'brain', 'avoid.md'),
  path.join(os.homedir(), '.claude', 'projects', projectName, 'brain', 'decisions.md'),
]
const memoryLines = []
for (const f of brainFiles) {
  try {
    const content = fs.readFileSync(f, 'utf8')
    const headers = content.split('\n').filter(l => l.startsWith('##')).slice(0, 5)
    if (headers.length > 0) memoryLines.push(...headers)
  } catch {}
}
if (memoryLines.length > 0) {
  process.stdout.write('\n\n## RECALL: Project Memory\n' + memoryLines.slice(0, 15).join('\n') + '\n')
}

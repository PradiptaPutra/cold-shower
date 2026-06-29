#!/usr/bin/env node
// SessionStart hook — injects cold-shower skill into every Claude Code session.

'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const projectName = path.basename(process.cwd())

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}

function isNewSession(lastWorkedOn, todayStr) {
  if (!lastWorkedOn) return false
  const lastDate = lastWorkedOn.slice(0, 10)
  const gapMs = Date.now() - new Date(lastWorkedOn).getTime()
  return lastDate !== todayStr || gapMs > 4 * 60 * 60 * 1000
}

function formatTimeAgo(isoStr) {
  try {
    const m = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 48) return m % 60 > 0 ? `${h}h ${m % 60}m ago` : `${h}h ago`
    return `${Math.floor(h / 24)} days ago`
  } catch { return '' }
}

function parseFrontmatter(content) {
  const result = { lastWorkedOn: null, branch: null, filesModified: [], body: '' }
  try {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (!match) { result.body = content; return result }
    const yaml = match[1]; result.body = match[2] || ''
    const lw = yaml.match(/^last_worked_on:\s*(.+)$/m)
    if (lw) result.lastWorkedOn = lw[1].trim().replace(/^['"]|['"]$/g, '')
    const br = yaml.match(/^branch:\s*(.+)$/m)
    if (br) result.branch = br[1].trim().replace(/^['"]|['"]$/g, '')
    const fb = yaml.match(/^files_modified:\s*\n((?:[ \t]*-[^\n]*\n?)*)/m)
    if (fb) result.filesModified = fb[1].split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean)
  } catch {}
  return result
}

function extractSection(body, name) {
  try {
    const m = body.match(new RegExp(`###?\\s+${name}[^\\n]*\\n([\\s\\S]*?)(?=\\n###?\\s+|$)`, 'i'))
    return m ? m[1].trim() : ''
  } catch { return '' }
}

// ── 1. Daily Brief — written FIRST so it's within the ~10k additionalContext cap ──

try {
  const today = getTodayLocal()
  const progressFile = path.join(os.homedir(), '.claude', 'projects', projectName, 'brain', 'progress.md')
  let progressContent = null
  try { progressContent = fs.readFileSync(progressFile, 'utf8') } catch {}

  if (progressContent) {
    const { lastWorkedOn, branch, filesModified, body } = parseFrontmatter(progressContent)
    if (isNewSession(lastWorkedOn, today)) {
      const inProgress = extractSection(body, 'In Progress')
      const decisions = extractSection(body, 'Decisions')
      const timeAgo = lastWorkedOn ? formatTimeAgo(lastWorkedOn) : null
      const hasItems = (inProgress && !inProgress.startsWith('(none')) || (filesModified && filesModified.length > 0)

      const now = new Date()
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      const headerDate = `${dayNames[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`

      let ctx = '[COLD-SHOWER DAILY BRIEF — MANDATORY FIRST RESPONSE]\n'
      ctx += `INSTRUCTION: Your first reply MUST be exactly this box (use these box-drawing chars verbatim):\n\n`
      ctx += `┌──────────────────────────────────────────────────────────┐\n`
      ctx += `│  🧊 DAILY BRIEF — ${projectName} — ${headerDate}\n`
      ctx += `│  Last session: ${timeAgo || 'unknown'} · Branch: ${branch || 'unknown'}\n`
      ctx += `├──────────────────────────────────────────────────────────┤\n`
      if (hasItems && inProgress && !inProgress.startsWith('(none')) {
        ctx += `│  Left off:\n`
        inProgress.split('\n').filter(l => l.trim()).slice(0, 4).forEach(l => {
          ctx += `│    ${l}\n`
        })
      } else {
        ctx += `│  Left off: (start coding to capture tasks)\n`
      }
      if (filesModified && filesModified.length) {
        ctx += `├──────────────────────────────────────────────────────────┤\n`
        ctx += `│  Files touched:\n`
        filesModified.slice(0, 4).forEach(f => { ctx += `│    · ${f}\n` })
      }
      ctx += `├──────────────────────────────────────────────────────────┤\n`
      ctx += `│  Type 'what should I work on today' for a plan           │\n`
      ctx += `└──────────────────────────────────────────────────────────┘\n\n`
      ctx += `After the box, ask what they want to work on.\n`
      ctx += `last_session: ${lastWorkedOn || 'unknown'}\n`
      ctx += `branch: ${branch || 'unknown'}\n`
      if (filesModified && filesModified.length) ctx += `files_touched: ${filesModified.join(', ')}\n`
      if (inProgress && !inProgress.startsWith('(none')) ctx += `in_progress: ${inProgress}\n`
      if (decisions && !decisions.startsWith('(none')) ctx += `decisions: ${decisions}\n`
      ctx += '\n'

      process.stdout.write(ctx)
    }
  }
} catch {}

// ── 2. SKILL.md ───────────────────────────────────────────────────────────────

const locations = [
  process.env.CLAUDE_PLUGIN_ROOT
    ? path.join(process.env.CLAUDE_PLUGIN_ROOT, 'skills', 'cold-shower', 'SKILL.md')
    : null,
  path.join(__dirname, '..', 'skills', 'cold-shower', 'SKILL.md'),
  path.join(os.homedir(), '.claude', 'skills', 'cold-shower', 'SKILL.md'),
].filter(Boolean)

const skillPath = locations.find(p => { try { return fs.existsSync(p) } catch { return false } })
if (skillPath) {
  try { process.stdout.write(fs.readFileSync(skillPath, 'utf8')) } catch {}
}

// ── 3. RECALL — brain file headers ───────────────────────────────────────────

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

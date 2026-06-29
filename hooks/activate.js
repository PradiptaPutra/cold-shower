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

// ── Daily Brief ──────────────────────────────────────────────────────────────

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}

function isNewDay() {
  const stateFile = path.join(os.homedir(), '.claude', 'cold-shower', 'state.json')
  let state = {}
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) } catch {}
  const today = getTodayLocal()
  if (state.briefDate !== today) return true
  const lastActivity = state.lastEnd || state.lastHeartbeat
  if (lastActivity) {
    const gapMs = Date.now() - new Date(lastActivity).getTime()
    if (gapMs > 4 * 60 * 60 * 1000) return true
  }
  return false
}

function claimBriefSlot(todayStr) {
  const stateDir = path.join(os.homedir(), '.claude', 'cold-shower')
  const lockFile = path.join(stateDir, `brief-lock-${todayStr}.lock`)
  try {
    fs.mkdirSync(stateDir, { recursive: true })
    const fd = fs.openSync(lockFile, 'wx') // atomic — throws EEXIST if already claimed
    fs.closeSync(fd)
    return true
  } catch { return false }
}

function markBriefShown(todayStr) {
  const stateFile = path.join(os.homedir(), '.claude', 'cold-shower', 'state.json')
  try {
    let state = {}
    try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) } catch {}
    state.briefDate = todayStr
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
  } catch {}
}

function formatTimeAgo(isoStr) {
  try {
    const diffMs = Date.now() - new Date(isoStr).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 48) {
      const remMins = diffMins % 60
      return remMins > 0 ? `${diffHours}h ${remMins}m ago` : `${diffHours}h ago`
    }
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} days ago`
  } catch { return '' }
}

function formatSessionTime(isoStr) {
  try {
    const d = new Date(isoStr)
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const day = days[d.getDay()]
    let hours = d.getHours()
    const mins = String(d.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    return `${day} ${hours}:${mins} ${ampm}`
  } catch { return '' }
}

function parseFrontmatter(content) {
  const result = { lastWorkedOn: null, branch: null, filesModified: [], status: null, body: '' }
  try {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (!match) { result.body = content; return result }
    const yaml = match[1]
    result.body = match[2] || ''

    const lastWorkedOnMatch = yaml.match(/^last_worked_on:\s*(.+)$/m)
    if (lastWorkedOnMatch) result.lastWorkedOn = lastWorkedOnMatch[1].trim().replace(/^['"]|['"]$/g, '')

    const branchMatch = yaml.match(/^branch:\s*(.+)$/m)
    if (branchMatch) result.branch = branchMatch[1].trim().replace(/^['"]|['"]$/g, '')

    const statusMatch = yaml.match(/^status:\s*(.+)$/m)
    if (statusMatch) result.status = statusMatch[1].trim().replace(/^['"]|['"]$/g, '')

    // Parse files_modified as YAML list items
    const filesBlock = yaml.match(/^files_modified:\s*\n((?:[ \t]*-[^\n]*\n?)*)/m)
    if (filesBlock) {
      result.filesModified = filesBlock[1]
        .split('\n')
        .map(l => l.replace(/^\s*-\s*/, '').trim())
        .filter(Boolean)
    }
  } catch {}
  return result
}

function extractSection(body, sectionName) {
  try {
    const regex = new RegExp(`###?\\s+${sectionName}[^\n]*\n([\\s\\S]*?)(?=\n###?\\s+|$)`, 'i')
    const match = body.match(regex)
    return match ? match[1].trim() : ''
  } catch { return '' }
}

function truncateLines(text, maxLines) {
  const lines = text.split('\n').filter(l => l.trim())
  return lines.slice(0, maxLines).join('\n')
}

try {
  const today = getTodayLocal()
  const progressFile = path.join(os.homedir(), '.claude', 'projects', projectName, 'brain', 'progress.md')

  let progressContent = null
  try { progressContent = fs.readFileSync(progressFile, 'utf8') } catch {}

  if (progressContent && isNewDay() && claimBriefSlot(today)) {
    markBriefShown(today)

    const { lastWorkedOn, branch, filesModified, body } = parseFrontmatter(progressContent)

    const now = new Date()
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const headerDate = `${dayNames[now.getDay()]} ${monthNames[now.getMonth()]} ${now.getDate()}`

    const W = 60
    const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length))
    const row = (s) => `│  ${pad(s, W - 4)}│\n`
    const div = `├${'─'.repeat(W - 2)}┤\n`
    const top = `┌${'─'.repeat(W - 2)}┐\n`
    const bot = `└${'─'.repeat(W - 2)}┘\n`

    const sessionTime = lastWorkedOn ? formatSessionTime(lastWorkedOn) : null
    const timeAgo = lastWorkedOn ? formatTimeAgo(lastWorkedOn) : null

    let brief = '\n\n'
    brief += top
    brief += row(`🧊 DAILY BRIEF — ${projectName} — ${headerDate}`)
    if (sessionTime) brief += row(`Last session: ${sessionTime}${timeAgo ? ` (${timeAgo})` : ''}`)
    if (branch) brief += row(`Branch: ${branch}`)
    brief += div

    const inProgress = extractSection(body, 'In Progress')
    if (inProgress) {
      brief += row('Left off:')
      truncateLines(inProgress, 5).split('\n').filter(l => l.trim()).forEach(l => { brief += row(`  ${l}`) })
    }

    if (filesModified.length > 0) {
      if (inProgress) brief += div
      brief += row('Files touched:')
      filesModified.slice(0, 5).forEach(f => { brief += row(`  · ${f}`) })
    }

    const decisions = extractSection(body, 'Decisions')
    if (decisions) {
      brief += div
      brief += row('Decisions:')
      truncateLines(decisions, 3).split('\n').filter(l => l.trim()).forEach(l => { brief += row(`  ${l}`) })
    }

    brief += div
    brief += row("Ask: 'what should I work on today' for today's plan")
    brief += bot

    process.stderr.write(brief)  // show instantly in terminal before user types
    process.stdout.write(brief)  // inject into Claude context
  }
} catch {}

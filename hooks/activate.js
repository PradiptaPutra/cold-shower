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

function isNewSession(lastWorkedOn, todayStr) {
  if (!lastWorkedOn) return false
  const lastDate = lastWorkedOn.slice(0, 10)
  const gapMs = Date.now() - new Date(lastWorkedOn).getTime()
  return lastDate !== todayStr || gapMs > 4 * 60 * 60 * 1000
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

  const { lastWorkedOn, branch, filesModified, body } = progressContent ? parseFrontmatter(progressContent) : {}

  // Inject session context for Claude — visual display handled by brief.js pre-launch
  if (progressContent && isNewSession(lastWorkedOn, today)) {
    const inProgress = extractSection(body, 'In Progress')
    const decisions = extractSection(body, 'Decisions')
    const timeAgo = lastWorkedOn ? formatTimeAgo(lastWorkedOn) : null
    const hasItems = (inProgress && !inProgress.startsWith('(none')) || (filesModified && filesModified.length > 0)

    let ctx = '\n\n[COLD-SHOWER DAILY BRIEF — MANDATORY FIRST RESPONSE]\n'
    ctx += `Your FIRST response this session MUST acknowledge this brief. Do NOT just say "Hey" or "Hi".\n`
    if (hasItems) {
      ctx += `Say: "Welcome back to ${projectName}. Last session${timeAgo ? ` was ${timeAgo} ago` : ''} on branch ${branch || 'unknown'}."\n`
      ctx += `Then name the most important in-progress item and offer to continue it.\n`
    } else {
      ctx += `Say: "Welcome back to ${projectName}. Last session${timeAgo ? ` was ${timeAgo} ago` : ''} on branch ${branch || 'unknown'}. No tasks were captured yet — what are you building today?"\n`
    }
    ctx += `\n--- session data ---\n`
    if (lastWorkedOn) ctx += `last_session: ${lastWorkedOn} (${timeAgo})\n`
    if (branch) ctx += `branch: ${branch}\n`
    if (filesModified && filesModified.length) ctx += `files_touched: ${filesModified.join(', ')}\n`
    if (inProgress && !inProgress.startsWith('(none')) ctx += `in_progress:\n${inProgress}\n`
    if (decisions && !decisions.startsWith('(none')) ctx += `decisions:\n${decisions}\n`
    process.stdout.write(ctx)
  }
} catch {}

#!/usr/bin/env node
// Pre-launch brief display — called by shell wrapper BEFORE claude starts.
// Prints daily brief to stdout (visible in terminal). Project-scoped lock.

'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const projectName = path.basename(process.cwd())
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

const stateDir = path.join(os.homedir(), '.claude', 'cold-shower')
const lockFile = path.join(stateDir, `brief-lock-${projectName}-${today}.lock`)
const progressFile = path.join(os.homedir(), '.claude', 'projects', projectName, 'brain', 'progress.md')

if (fs.existsSync(lockFile)) process.exit(0)

let progressContent
try { progressContent = fs.readFileSync(progressFile, 'utf8') } catch { process.exit(0) }

function parseFrontmatter(content) {
  const result = { lastWorkedOn: null, branch: null, filesModified: [], body: '' }
  try {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    if (!match) { result.body = content; return result }
    const yaml = match[1]; result.body = match[2] || ''
    const low = yaml.match(/^last_worked_on:\s*(.+)$/m)
    if (low) result.lastWorkedOn = low[1].trim().replace(/^['"]|['"]$/g, '')
    const br = yaml.match(/^branch:\s*(.+)$/m)
    if (br) result.branch = br[1].trim().replace(/^['"]|['"]$/g, '')
    const fb = yaml.match(/^files_modified:\s*\n((?:[ \t]*-[^\n]*\n?)*)/m)
    if (fb) result.filesModified = fb[1].split('\n').map(l => l.replace(/^\s*-\s*/, '').replace(/^["']|["']$/g, '').trim()).filter(Boolean)
  } catch {}
  return result
}

const { lastWorkedOn, branch, filesModified, body } = parseFrontmatter(progressContent)

if (lastWorkedOn) {
  const lastDate = lastWorkedOn.slice(0, 10)
  const gapMs = Date.now() - new Date(lastWorkedOn).getTime()
  if (lastDate === today && gapMs <= 4 * 60 * 60 * 1000) process.exit(0)
}

try {
  fs.mkdirSync(stateDir, { recursive: true })
  const fd = fs.openSync(lockFile, 'wx')
  fs.closeSync(fd)
} catch { process.exit(0) }

function formatTimeAgo(iso) {
  try {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 48) return m % 60 > 0 ? `${h}h ${m % 60}m ago` : `${h}h ago`
    return `${Math.floor(h / 24)} days ago`
  } catch { return '' }
}

function formatTime(iso) {
  try {
    const d = new Date(iso)
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    let h = d.getHours(); const mins = String(d.getMinutes()).padStart(2,'0')
    const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12
    return `${days[d.getDay()]} ${h}:${mins} ${ampm}`
  } catch { return '' }
}

function section(b, name) {
  try {
    const m = b.match(new RegExp(`###?\\s+${name}[^\\n]*\\n([\\s\\S]*?)(?=\\n###?\\s+|$)`, 'i'))
    return m ? m[1].trim() : ''
  } catch { return '' }
}

function truncate(text, max) {
  return text.split('\n').filter(l => l.trim()).slice(0, max).join('\n')
}

const W = 60
const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length))
const row = (s) => `│  ${pad(s, W - 4)}│`
const div = `├${'─'.repeat(W - 2)}┤`
const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const headerDate = `${dayNames[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`

const lines = [`┌${'─'.repeat(W - 2)}┐`]
lines.push(row(`🧊 DAILY BRIEF — ${projectName} — ${headerDate}`))
if (lastWorkedOn) lines.push(row(`Last session: ${formatTime(lastWorkedOn)} (${formatTimeAgo(lastWorkedOn)})`))
if (branch) lines.push(row(`Branch: ${branch}`))
lines.push(div)

const inProgress = section(body, 'In Progress')
lines.push(row('Left off:'))
if (inProgress && !inProgress.startsWith('(none')) {
  truncate(inProgress, 5).split('\n').filter(l => l.trim()).forEach(l => lines.push(row(`  ${l}`)))
} else {
  lines.push(row('  (no items captured yet)'))
}

if (filesModified.length) {
  lines.push(div)
  lines.push(row('Files touched:'))
  filesModified.slice(0, 5).forEach(f => lines.push(row(`  · ${f}`)))
}

const decisions = section(body, 'Decisions')
if (decisions && !decisions.startsWith('(none')) {
  lines.push(div)
  lines.push(row('Decisions:'))
  truncate(decisions, 3).split('\n').filter(l => l.trim()).forEach(l => lines.push(row(`  ${l}`)))
}

lines.push(div)
lines.push(row("Type 'what should I work on today' for a plan"))
lines.push(`└${'─'.repeat(W - 2)}┘`)

process.stdout.write('\n' + lines.join('\n') + '\n\n')

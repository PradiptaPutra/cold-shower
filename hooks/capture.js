#!/usr/bin/env node
// Stop hook — scans session transcript at session end and suggests memories to save.
// Fires once when Claude Code finishes a session. Silent on error — never breaks shutdown.

const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const os = require('os')

const DECISIONS_PATTERNS = [
  "we'll use", "we will use", "we decided", "going with", "chose ", "chosen ",
  "the reason we", "instead of", "switching to", "moved to", "migrated to",
]
const AVOID_PATTERNS = [
  "don't touch", "do not touch", "leave alone", "leave it alone",
  "fragile", "be careful with", "be careful about", "this is tricky",
  "handle with care", "avoid touching", "don't modify",
]
const BUG_PATTERNS = [
  "the bug was", "fixed by", "the issue was", "root cause", "to fix this",
  "the fix was", "was caused by", "turned out to be", "discovered that",
]
const CONTEXT_PATTERNS = [
  "this project", "the users are", "this app is", "remember that",
  "important to note", "worth noting", "key thing is", "the system",
]

function classify(lower) {
  if (AVOID_PATTERNS.some(p => lower.includes(p))) return 'avoid'
  if (BUG_PATTERNS.some(p => lower.includes(p))) return 'bugs'
  if (DECISIONS_PATTERNS.some(p => lower.includes(p))) return 'decisions'
  if (CONTEXT_PATTERNS.some(p => lower.includes(p))) return 'context'
  return null
}

// Extract a short one-line summary from the surrounding sentence.
function extractSnippet(content, matchIndex) {
  // Walk back to sentence start
  let start = matchIndex
  while (start > 0 && content[start - 1] !== '.' && content[start - 1] !== '\n') start--
  // Walk forward to sentence end or 120 chars
  let end = matchIndex
  while (end < content.length && content[end] !== '.' && content[end] !== '\n' && end - start < 120) end++
  return content.slice(start, end).trim().replace(/\s+/g, ' ')
}

function scanMessages(transcript) {
  const candidates = []

  for (const msg of transcript) {
    if (msg.role !== 'assistant') continue
    const raw = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map(b => (typeof b === 'string' ? b : b.text || '')).join(' ')
        : ''
    if (!raw) continue
    const lower = raw.toLowerCase()

    // Find the first matching pattern in this message
    const allPatterns = [
      ...AVOID_PATTERNS,
      ...BUG_PATTERNS,
      ...DECISIONS_PATTERNS,
      ...CONTEXT_PATTERNS,
    ]
    for (const pat of allPatterns) {
      const idx = lower.indexOf(pat)
      if (idx === -1) continue
      const category = classify(lower)
      if (!category) continue
      const snippet = extractSnippet(raw, idx)
      if (snippet.length < 10) continue
      // Avoid duplicate snippets
      if (!candidates.some(c => c.snippet === snippet)) {
        candidates.push({ category, snippet })
      }
      break // one candidate per assistant message
    }
  }

  return candidates
}

function buildTag(category) {
  const map = { decisions: '[decisions]', avoid: '[avoid]', bugs: '[bugs]', context: '[context]' }
  return map[category] || '[context]'
}

function buildOutput(candidates, projectName) {
  // Pick up to 5, most recent (last in array = most recent)
  const top = candidates.slice(-5)
  if (top.length === 0) return '{}'

  const brainBase = `~/.claude/projects/${projectName}/brain`
  const fileMap = {
    decisions: `${brainBase}/decisions.md`,
    avoid: `${brainBase}/avoid.md`,
    bugs: `${brainBase}/bugs.md`,
    context: `${brainBase}/context.md`,
  }

  const lines = top.map((c, i) => `${i + 1}. ${buildTag(c.category)} ${c.snippet}`)

  const fileHints = [...new Set(top.map(c => fileMap[c.category]))]
    .map(f => `  → ${f}`)
    .join('\n')

  const block = [
    'COLD-SHOWER RECALL: Session ended. Suggested memories to save:',
    '',
    ...lines,
    '',
    `Memory files:\n${fileHints}`,
    '',
    "To save: tell Claude 'remember #1' or 'save all'. To skip: 'no memories'.",
    'Or type /recall to manage memories anytime.',
  ].join('\n')

  return JSON.stringify({ additionalContext: block })
}

const TOOL_NAMES = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']

function extractModifiedFiles(transcript, cwd) {
  const seen = new Set()

  for (const record of transcript) {
    // Top-level tool_name + tool_input.file_path pattern
    if (record.tool_name && TOOL_NAMES.includes(record.tool_name)) {
      const fp = record.tool_input && record.tool_input.file_path
      if (fp) seen.add(fp)
    }

    // message.content array with type: "tool_use"
    const content = record.message && record.message.content
    if (Array.isArray(content)) {
      for (const item of content) {
        if (item.type === 'tool_use' && TOOL_NAMES.includes(item.name)) {
          const fp = item.input && item.input.file_path
          if (fp) seen.add(fp)
        }
      }
    }
  }

  const cwdWithSlash = cwd.endsWith('/') ? cwd : cwd + '/'
  return [...seen].map(fp => fp.startsWith(cwdWithSlash) ? fp.slice(cwdWithSlash.length) : fp)
}

function getGitDiffSummary(cwd) {
  try {
    const out = execSync('git diff --stat HEAD', { cwd, timeout: 5000, encoding: 'utf8' })
    const last = out.trim().split('\n').pop() || ''
    return last.trim() || null
  } catch {
    return null
  }
}

function getGitBranch(cwd) {
  try {
    return execSync('git branch --show-current', { cwd, timeout: 3000, encoding: 'utf8' }).trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

function getLastAssistantSnippets(transcript, count) {
  const IN_PROGRESS_PATTERNS = [
    'working on', 'implementing', 'fixing', 'in progress',
    'left off', 'next step', 'still need to',
  ]
  const results = []
  const messages = transcript.filter(r => r.role === 'assistant').slice(-count)
  for (const msg of messages) {
    const raw = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map(b => (typeof b === 'string' ? b : b.text || '')).join(' ')
        : ''
    if (!raw) continue
    const sentences = raw.split(/(?<=[.!\n])/)
    for (const sentence of sentences) {
      const sl = sentence.toLowerCase()
      if (IN_PROGRESS_PATTERNS.some(p => sl.includes(p))) {
        const trimmed = sentence.trim().replace(/\s+/g, ' ')
        if (trimmed.length > 10) results.push(trimmed)
      }
    }
  }
  return results.slice(0, 5)
}

function writeProgress(candidates, transcript, projectName, cwd) {
  try {
    const brainDir = path.join(os.homedir(), '.claude', 'projects', projectName, 'brain')
    fs.mkdirSync(brainDir, { recursive: true })

    const now = new Date().toISOString()
    const branch = getGitBranch(cwd)
    const filesModified = extractModifiedFiles(transcript, cwd)

    const decisions = candidates.filter(c => c.category === 'decisions').slice(0, 3)
    const avoids = candidates.filter(c => c.category === 'avoid').slice(0, 2)

    const inProgressSnippets = getLastAssistantSnippets(transcript, 3)

    const filesYaml = filesModified.length > 0
      ? filesModified.map(f => `  - "${f}"`).join('\n')
      : '  []'

    const inProgressSection = inProgressSnippets.length > 0
      ? inProgressSnippets.map(s => `- ${s}`).join('\n')
      : '(none captured)'

    const decisionsSection = decisions.length > 0
      ? decisions.map(d => `- ${d.snippet}`).join('\n')
      : '(none this session)'

    const watchSection = avoids.length > 0
      ? avoids.map(a => `- ${a.snippet}`).join('\n')
      : '(none this session)'

    const content = [
      '---',
      'schema_version: "session.v1"',
      `last_worked_on: "${now}"`,
      `branch: "${branch}"`,
      'status: "in-progress"',
      'files_modified:',
      filesYaml,
      '---',
      '',
      '## Last Session Summary',
      '',
      '### In Progress',
      inProgressSection,
      '',
      '### Decisions Made This Session',
      decisionsSection,
      '',
      '### Watch Out',
      watchSection,
    ].join('\n')

    fs.writeFileSync(path.join(brainDir, 'progress.md'), content, 'utf8')
  } catch {
    // silent
  }
}

function writeStateJson(now) {
  try {
    const stateDir = path.join(os.homedir(), '.claude', 'cold-shower')
    fs.mkdirSync(stateDir, { recursive: true })
    const statePath = path.join(stateDir, 'state.json')

    let existing = {}
    try { existing = JSON.parse(fs.readFileSync(statePath, 'utf8')) } catch { /* ok */ }

    const merged = Object.assign({}, existing, { lastEnd: now })
    fs.writeFileSync(statePath, JSON.stringify(merged, null, 2), 'utf8')
  } catch {
    // silent
  }
}

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input)

    if (data.stop_hook_active) { process.stdout.write('{}'); return }

    const transcript = Array.isArray(data.transcript) ? data.transcript : []
    const candidates = scanMessages(transcript)
    const projectName = path.basename(process.cwd())
    const cwd = process.cwd()
    const now = new Date().toISOString()

    writeProgress(candidates, transcript, projectName, cwd)
    writeStateJson(now)

    process.stdout.write(buildOutput(candidates, projectName))
  } catch {
    process.stdout.write('{}')
  }
})

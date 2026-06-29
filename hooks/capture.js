#!/usr/bin/env node
// Stop hook — scans session transcript at session end and suggests memories to save.
// Fires once when Claude Code finishes a session. Silent on error — never breaks shutdown.

const path = require('path')

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

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input)
    const transcript = Array.isArray(data.transcript) ? data.transcript : []
    const candidates = scanMessages(transcript)
    const projectName = path.basename(process.cwd())
    process.stdout.write(buildOutput(candidates, projectName))
  } catch {
    process.stdout.write('{}')
  }
})

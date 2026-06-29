#!/usr/bin/env node
// PreToolUse hook — two jobs:
//   Job 1 (Plan-gate): Block edit tools until a plan is approved via .plan-gate/APPROVED.
//   Job 2 (Anti-regression): Warn when a file being edited is listed in brain/avoid.md.

'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

const PLAN_GATE_BLOCK = `PLAN-GATE: No approved plan found.

Cold-shower requires a plan before editing files.
Claude should generate the implementation plan first, then ask the user to type APPROVED.

To skip plan-gate for this change: delete .plan-gate/ACTIVE`

function encodeCwd(cwd) {
  // /Users/pradipt/Code/hukumai → Users-pradipt-Code-hukumai
  return cwd.replace(/^\//, '').replace(/\//g, '-')
}

function fileExists(p) {
  try { return fs.existsSync(p) } catch { return false }
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8') } catch { return null }
}

// Parse avoid.md for file paths.
// Looks for:
//   - Lines that start with a path-like token (starts with / or ./ or contains /)
//   - Lines that contain backtick-wrapped paths: `path/to/file`
// Returns array of { filePath, reason } objects.
function parseAvoidMd(content) {
  const entries = []
  const lines = content.split('\n')

  // Group lines: a "path line" followed by subsequent non-path lines form one entry.
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Check for backtick path(s) anywhere on the line
    const backtickMatches = [...line.matchAll(/`([^`]+)`/g)]
    const backtickPaths = backtickMatches
      .map(m => m[1])
      .filter(p => p.includes('/') || p.endsWith('.js') || p.endsWith('.ts') ||
                   p.endsWith('.py') || p.endsWith('.rb') || p.endsWith('.go') ||
                   p.endsWith('.rs') || p.endsWith('.java') || p.endsWith('.kt') ||
                   p.endsWith('.swift') || p.endsWith('.cs') || p.endsWith('.tsx') ||
                   p.endsWith('.jsx') || p.endsWith('.vue') || p.endsWith('.php'))

    if (backtickPaths.length > 0) {
      // Treat rest of line (after the backtick) as reason
      const reason = line.replace(/`[^`]+`/g, '').replace(/^[\s\-*#:]+/, '').trim() || line.trim()
      for (const fp of backtickPaths) {
        entries.push({ filePath: fp, reason: reason || line.trim() })
      }
      i++
      continue
    }

    // Check for a line that starts like a path
    const trimmed = line.trim()
    const pathMatch = trimmed.match(/^([\/.]?[^\s]+\.[a-zA-Z0-9]{1,10})(\s+(.*))?$/)
    if (pathMatch && (pathMatch[1].includes('/') || pathMatch[1].startsWith('.'))) {
      const fp = pathMatch[1]
      let reason = (pathMatch[3] || '').trim()
      // Gather following indented lines as part of reason
      let j = i + 1
      while (j < lines.length) {
        const next = lines[j]
        if (next.match(/^\s+\S/) || next.match(/^[>*\-]\s/)) {
          if (!reason) reason = next.trim()
          j++
        } else {
          break
        }
      }
      entries.push({ filePath: fp, reason: reason || trimmed })
      i = j
      continue
    }

    i++
  }

  return entries
}

// Returns a warning string if filePath matches any avoid entry, otherwise null.
function checkAvoid(filePath, avoidEntries) {
  if (!filePath) return null
  const basename = path.basename(filePath)
  const normalised = filePath.replace(/\\/g, '/')

  for (const entry of avoidEntries) {
    const ep = entry.filePath.replace(/\\/g, '/')
    const epBasename = path.basename(ep)

    // Match on full path suffix, basename, or exact match
    if (
      normalised.endsWith(ep) ||
      normalised === ep ||
      (epBasename && basename === epBasename && epBasename.length > 3) ||
      normalised.includes(ep)
    ) {
      const reason = entry.reason || '(no reason given)'
      return `RECALL WARNING: ${basename} is marked fragile in recall memory. Reason: ${reason}. Proceed carefully.`
    }
  }

  return null
}

function main(data) {
  const toolName = data.tool_name || ''
  const toolInput = data.tool_input || {}

  if (!EDIT_TOOLS.has(toolName)) {
    // Not an edit tool — nothing to do
    process.exit(0)
  }

  const cwd = process.cwd()
  const filePath = toolInput.file_path || toolInput.path || ''

  // ── Job 1: Plan-gate ──────────────────────────────────────────────────────
  const activePath = path.join(cwd, '.plan-gate', 'ACTIVE')
  const approvedPath = path.join(cwd, '.plan-gate', 'APPROVED')

  if (fileExists(activePath) && !fileExists(approvedPath)) {
    process.stderr.write(PLAN_GATE_BLOCK + '\n')
    process.exit(2)
  }

  // ── Job 2: Anti-regression warn ──────────────────────────────────────────
  const encodedCwd = encodeCwd(cwd)
  const homeDir = os.homedir()

  const avoidPaths = [
    path.join(homeDir, '.claude', 'projects', encodedCwd, 'brain', 'avoid.md'),
    path.join(homeDir, '.claude', 'brain', 'avoid-global.md'),
  ]

  let avoidEntries = []
  for (const ap of avoidPaths) {
    const content = readFile(ap)
    if (content) {
      avoidEntries = avoidEntries.concat(parseAvoidMd(content))
    }
  }

  if (avoidEntries.length > 0) {
    const warning = checkAvoid(filePath, avoidEntries)
    if (warning) {
      process.stderr.write(warning + '\n')
    }
  }

  // Allow the edit
  process.exit(0)
}

// Read stdin fully, then process
let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input)
    main(data)
  } catch {
    // Silent fail — never break user session
    process.exit(0)
  }
})

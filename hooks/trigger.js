#!/usr/bin/env node
// UserPromptSubmit hook — detects cold-shower trigger phrases in the user's prompt.
// When matched, reinforces the skill context so Claude activates it automatically.

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input)
    const prompt = (data.prompt || '').toLowerCase()

    const triggers = [
      'cold shower', 'cold-shower',
      'audit my codebase', 'audit my app', 'audit my project', 'audit this',
      'is this ready to ship', 'ready to ship', 'ready to deploy', 'can i ship',
      'reality check',
      'something always breaks', 'always breaks when i',
      'llm bill', 'api bill', 'openai bill', 'anthropic bill',
      'costs too high', 'spending too much', 'api costs',
      'is my ai secure', 'ai endpoint', 'prompt injection',
      'clean up my deps', 'unused packages', 'too many packages', 'remove packages',
      'app crashed', 'app is down', '500 errors', 'getting 500s',
      'too many connections', 'database overload', 'db is slow',
      'went viral', 'hacker news', 'product hunt', 'traffic spike',
      'vibe code mess', 'vibe coding debt', 'my code is a mess', 'codebase is a mess',
      'god component', 'god file', 'file is too long',
      'circular dep', 'duplicate code', 'technical debt',
      // Audit F — git/github/CI triggers
      'github setup', 'ci setup', 'github actions', 'branch protection',
      'gitignore', '.gitignore', 'secrets in git', 'env committed',
      'no ci', 'missing ci', 'no pipeline', 'devops setup',
      'staging environment', 'production environment', 'preview deployment',
      'dependabot', 'unpinned actions', 'workflow security',
      'git hygiene', 'git setup', 'repo setup', 'missing workflow',
      // Pre-deploy gate triggers
      'about to deploy', 'about to push', 'about to ship',
      'pushing to prod', 'pushing to production', 'merging to main',
      'going live', 'going to prod', 'before i push', 'before i deploy',
      'ready to merge', 'shipping today', 'deploy today',
      // Re-audit / score check triggers
      're-audit', 'reaudit', 'check score', 'check my score',
      'did score improve', 'run audit again', 'audit again',
      // Plan-gate triggers — implementation intent
      'implement', 'add feature', 'add endpoint', 'add support for',
      'build this', 'create component', 'create a new', 'create the',
      'fix this bug', 'fix the bug', 'fix the issue', 'fix the error',
      'refactor', 'migrate', 'rewrite', 'update the', 'modify the',
      // Recall triggers — memory commands
      'remember this', 'remember that', 'save this', 'dont forget',
      "don't forget", 'recall', 'what did we decide', 'brain dump',
      '/recall', '/plan',
    ]

    const matched = triggers.some(t => prompt.includes(t))

    if (!matched) return

    // Detect which mode triggered
    const planTriggers = ['implement', 'add feature', 'add endpoint', 'add support for',
      'build this', 'create component', 'create a new', 'create the',
      'fix this bug', 'fix the bug', 'fix the issue', 'fix the error',
      'refactor', 'migrate', 'rewrite', 'update the', 'modify the']
    const recallTriggers = ['remember this', 'remember that', 'save this', 'dont forget',
      "don't forget", 'recall', 'what did we decide', 'brain dump', '/recall']
    const auditTriggers = ['cold shower', 'cold-shower', 'audit', 'vibe score',
      'ready to ship', 'ready to deploy', 'about to deploy', 'about to push',
      're-audit', 'reaudit', 'check score']

    const isPlan = planTriggers.some(t => prompt.includes(t))
    const isRecall = recallTriggers.some(t => prompt.includes(t))
    const isAudit = auditTriggers.some(t => prompt.includes(t))

    // Load score history for audit mode
    const scoreHistoryPath = require('path').join(process.cwd(), '.cold-shower', 'score-history.json')
    let scoreHistory = []
    try { scoreHistory = JSON.parse(require('fs').readFileSync(scoreHistoryPath, 'utf8')) } catch {}
    const lastScore = scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : null
    const scoreContext = lastScore
      ? `Last Vibe Score: ${lastScore.score}/100 (${lastScore.grade}) on ${lastScore.date}.`
      : 'No previous Vibe Score.'

    // Load recall memories
    const path = require('path')
    const os = require('os')
    const projectName = path.basename(process.cwd())
    const brainDir = path.join(os.homedir(), '.claude', 'brain')
    const projectBrainDir = path.join(os.homedir(), '.claude', 'projects', projectName, 'brain')
    let recallContext = ''
    try {
      const files = ['context.md', 'decisions.md', 'avoid.md', 'bugs.md']
      const lines = []
      for (const f of files) {
        try {
          const content = require('fs').readFileSync(path.join(projectBrainDir, f), 'utf8')
          lines.push(...content.split('\n').filter(l => l.startsWith('##')).slice(0, 3))
        } catch {}
      }
      if (lines.length > 0) recallContext = '\nRECALL CONTEXT:\n' + lines.slice(0, 8).join('\n')
    } catch {}

    // Create plan-gate ACTIVE marker if implementation intent
    if (isPlan && !isAudit) {
      try {
        const fs = require('fs')
        fs.mkdirSync(path.join(process.cwd(), '.plan-gate'), { recursive: true })
        fs.writeFileSync(path.join(process.cwd(), '.plan-gate', 'ACTIVE'), new Date().toISOString())
        // Remove any stale approval
        try { fs.unlinkSync(path.join(process.cwd(), '.plan-gate', 'APPROVED')) } catch {}
      } catch {}
    }

    let additionalContext = ''

    if (isRecall && !isPlan && !isAudit) {
      additionalContext = [
        'COLD-SHOWER RECALL MODE',
        recallContext,
        'User wants to manage memories. Available commands:',
        '- "remember [decision/pattern/bug/context]" → save to brain',
        '- "what did we decide about X" → search brain files',
        '- "show avoid list" → show fragile files',
        '- "/recall review" → review memories older than 90 days',
        'Brain files: ~/.claude/brain/ (global) and ~/.claude/projects/' + projectName + '/brain/ (project)',
      ].join('\n')
    } else if (isPlan && !isAudit) {
      additionalContext = [
        'COLD-SHOWER PLAN-GATE ACTIVATED',
        recallContext,
        'User wants to implement something. Generate a structured plan BEFORE writing any code:',
        '',
        '## Plan: [task name]',
        '### Understanding — problem, definition of done, out of scope',
        '### Files to Touch — table: file | lines | change type | reason',
        '### Files NOT to Touch — table: file | reason (check recall avoid.md for fragile files)',
        '### Contracts That Cannot Change — API signatures, response shapes callers depend on',
        '### Dependency Order — numbered, which changes unlock others',
        '### Risk Assessment — HIGH/MEDIUM/LOW with specific failure mode',
        '### Pre-Mortem — "If this fails, most likely cause is..."',
        '### Rollback — exact steps to undo, does it need migration rollback?',
        '',
        'After generating the plan: ask user "Type APPROVED to proceed with implementation."',
        'Do NOT write any code or edit any files until user types APPROVED.',
        'Plan-gate is active — edits are blocked until approved.',
      ].join('\n')
    } else {
      // Audit mode (default)
      additionalContext = [
        'COLD-SHOWER SKILL ACTIVATED',
        scoreContext,
        recallContext,
        'Run the audit workflow:',
        '1. Emergency check — app actively failing? Jump to EMERGENCY MODE.',
        '2. Phase 0: detect stack.',
        '3. Phase 1: run audits A-F in parallel.',
        '4. Phase 2: compute Vibe Score, write to .cold-shower/score-history.json.',
        '5. Phase 3: ask which fix sprint. After sprint: remind user to type re-audit.',
      ].join('\n')
    }

    process.stdout.write(JSON.stringify({ additionalContext }))
  } catch {
    // Silent fail — never break the user session
  }
})

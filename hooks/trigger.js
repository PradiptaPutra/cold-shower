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
    ]

    const matched = triggers.some(t => prompt.includes(t))
    if (!matched) return

    const scoreHistoryPath = require('path').join(process.cwd(), '.cold-shower', 'score-history.json')
    let scoreHistory = []
    try { scoreHistory = JSON.parse(require('fs').readFileSync(scoreHistoryPath, 'utf8')) } catch {}
    const lastScore = scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : null
    const scoreContext = lastScore
      ? `Last Vibe Score: ${lastScore.score}/100 (${lastScore.grade}) on ${lastScore.date}. Show this at start and compare after new audit.`
      : 'No previous Vibe Score found — this is first audit.'

    process.stdout.write(JSON.stringify({
      additionalContext: [
        'COLD-SHOWER SKILL ACTIVATED',
        scoreContext,
        'User message matches a cold-shower trigger. Run the workflow:',
        '1. Emergency check — app actively failing? Jump to EMERGENCY MODE.',
        '2. Phase 0: detect stack (JS/PY, framework, AI, DB, package manager). Read .cold-shower/score-history.json if exists.',
        '3. Phase 1: run applicable audits in parallel (A=LLM costs, B=AI security, C=code health, D=dependencies, E=prod readiness, F=git/devops).',
        '4. Phase 2: compute Vibe Score, print unified health report. Write score to .cold-shower/score-history.json.',
        '5. Phase 3: ask which fix sprint to start. After sprint completes, remind user: "Type re-audit to measure improvement."',
        'Do not wait for /cold-shower — start the audit now.',
      ].join('\n'),
    }))
  } catch {
    // Silent fail — never break the user session
  }
})

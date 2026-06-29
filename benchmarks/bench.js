#!/usr/bin/env node
'use strict'

const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const WORK = '/private/tmp/cold-shower-bench'
fs.mkdirSync(WORK, { recursive: true })

const REPOS = [
  // Known vulnerable
  { name: 'NodeGoat',    url: 'https://github.com/OWASP/NodeGoat',        tier: 'vulnerable' },
  { name: 'juice-shop',  url: 'https://github.com/juice-shop/juice-shop',  tier: 'vulnerable' },
  { name: 'dvna',        url: 'https://github.com/appsecco/dvna',          tier: 'vulnerable' },
  // Startup/vibe-coded grade
  { name: 'hoppscotch',  url: 'https://github.com/hoppscotch/hoppscotch',  tier: 'startup' },
  { name: 'formbricks',  url: 'https://github.com/formbricks/formbricks',  tier: 'startup' },
  { name: 'twenty',      url: 'https://github.com/twentyhq/twenty',         tier: 'startup' },
  { name: 'cal.com',     url: 'https://github.com/calcom/cal.com',          tier: 'startup' },
  { name: 'plane',       url: 'https://github.com/makeplane/plane',         tier: 'startup' },
  { name: 'dub',         url: 'https://github.com/dubinc/dub',              tier: 'startup' },
  { name: 'documenso',   url: 'https://github.com/documenso/documenso',     tier: 'startup' },
  // Well-maintained OSS control group
  { name: 'express',     url: 'https://github.com/expressjs/express',       tier: 'clean' },
  { name: 'fastify',     url: 'https://github.com/fastify/fastify',         tier: 'clean' },
  { name: 'trpc',        url: 'https://github.com/trpc/trpc',               tier: 'clean' },
  { name: 'zod',         url: 'https://github.com/colinhacks/zod',          tier: 'clean' },
  { name: 'lucia',       url: 'https://github.com/lucia-auth/lucia',        tier: 'clean' },
]

function run(cmd, cwd) {
  try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe','pipe','pipe'], timeout: 30000 }) }
  catch(e) { return e.stdout || '' }
}

function cloneRepo(repo) {
  const dir = path.join(WORK, repo.name)
  if (fs.existsSync(dir)) { console.log(`  [cached] ${repo.name}`); return dir }
  console.log(`  cloning ${repo.name}...`)
  spawnSync('git', ['clone', '--depth=1', '--quiet', repo.url, dir], { stdio: 'inherit', timeout: 120000 })
  return dir
}

function auditA(dir) {
  const hasAI = parseInt(run(`grep -rl "openai\\|anthropic\\|gpt-4\\|claude\\|gemini" . --include="*.ts" --include="*.js" --include="*.tsx" 2>/dev/null | grep -v node_modules | wc -l`, dir).trim())
  if (hasAI === 0) return { score: 20, issues: [], note: 'no AI' }
  const issues = []
  if (parseInt(run(`grep -rl "upstash\\|redis.*cache\\|semantic.*cache" . --include="*.ts" --include="*.js" 2>/dev/null | grep -v node_modules | wc -l`, dir).trim()) === 0) issues.push('no semantic cache')
  if (parseInt(run(`grep -rn "gpt-4\\|claude-3-opus" . --include="*.ts" --include="*.js" 2>/dev/null | grep -v node_modules | wc -l`, dir).trim()) > 0) issues.push('hardcoded expensive model')
  return { score: Math.max(0, 20 - issues.length * 6), issues }
}

function auditB(dir) {
  const hasAI = parseInt(run(`grep -rl "openai\\|anthropic" . --include="*.ts" --include="*.js" 2>/dev/null | grep -v node_modules | wc -l`, dir).trim())
  if (hasAI === 0) return { score: 15, issues: [] }
  const issues = []
  if (parseInt(run(`grep -rl "rateLimit\\|rate-limit\\|@upstash/ratelimit" . --include="*.ts" --include="*.js" --include="*.json" 2>/dev/null | grep -v node_modules | wc -l`, dir).trim()) === 0) issues.push('no rate limiting on AI endpoints')
  if (parseInt(run(`grep -rn "maxToken\\|max_token\\|tokenBudget" . --include="*.ts" --include="*.js" 2>/dev/null | grep -v node_modules | wc -l`, dir).trim()) === 0) issues.push('no per-user token budget')
  return { score: Math.max(0, 15 - issues.length * 6), issues }
}

function auditC(dir) {
  const issues = []
  const bigFiles = run(`find . \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \\) | grep -v node_modules | grep -v dist | grep -v ".min." | xargs wc -l 2>/dev/null | awk '$1>500 && $2!="total"' | wc -l`, dir).trim()
  const godCount = parseInt(bigFiles)
  if (godCount > 0) issues.push(`${godCount} god files >500 lines`)
  const floating = parseInt(run(`grep -rn "^\\.then\\|[^a-z]\\.then(" . --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v node_modules | grep -v "return\\|const\\|let\\|var\\|=\\|await" | wc -l`, dir).trim())
  if (floating > 5) issues.push(`${floating} floating promises`)
  const penalty = Math.min(20, godCount * 2 + (floating > 5 ? 5 : 0))
  return { score: Math.max(0, 20 - penalty), issues }
}

function auditD(dir) {
  if (!fs.existsSync(path.join(dir, 'package.json'))) return { score: 15, issues: ['no package.json'], critical: 0, high: 0 }
  const issues = []
  let critical = 0, high = 0, moderate = 0
  try {
    const a = JSON.parse(run(`npm audit --json 2>/dev/null`, dir))
    const v = a.metadata?.vulnerabilities || {}
    critical = v.critical || 0; high = v.high || 0; moderate = v.moderate || 0
    if (critical > 0) issues.push(`${critical} critical CVEs`)
    if (high > 0) issues.push(`${high} high CVEs`)
    if (moderate > 10) issues.push(`${moderate} moderate CVEs`)
  } catch {}
  return { score: Math.max(0, 15 - critical * 6 - high * 3 - (moderate > 10 ? 2 : 0)), issues, critical, high, moderate }
}

function auditE(dir) {
  const issues = []
  if (parseInt(run(`grep -rl "rateLimit\\|rate-limit\\|express-rate\\|@upstash/ratelimit" . --include="*.ts" --include="*.js" --include="*.json" 2>/dev/null | grep -v node_modules | wc -l`, dir).trim()) === 0) issues.push('no rate limiting')
  if (parseInt(run(`grep -rn "app\\.use.*err\\|errorHandler" . --include="*.ts" --include="*.js" 2>/dev/null | grep -v node_modules | wc -l`, dir).trim()) === 0) issues.push('no error middleware')
  return { score: Math.max(0, 15 - issues.length * 4), issues }
}

function auditF(dir) {
  const issues = []
  const gitignore = fs.existsSync(path.join(dir, '.gitignore')) ? fs.readFileSync(path.join(dir, '.gitignore'), 'utf8') : ''
  if (!gitignore.includes('.env')) issues.push('.env not in .gitignore')
  if (parseInt(run(`git log --oneline --all -- ".env" 2>/dev/null | wc -l`, dir).trim()) > 0) issues.push('.env committed to history')
  const workflows = run(`find .github/workflows -name "*.yml" 2>/dev/null`, dir).trim().split('\n').filter(Boolean)
  let unpinned = 0
  workflows.forEach(w => {
    try { unpinned += (fs.readFileSync(path.join(dir, w), 'utf8').match(/uses:\s+\S+@v\d+(?!\.\d)/g) || []).length } catch {}
  })
  if (unpinned > 0) issues.push(`${unpinned} unpinned Actions (@vN not SHA)`)
  if (!fs.existsSync(path.join(dir, '.github/dependabot.yml'))) issues.push('no Dependabot')
  if (workflows.length === 0) issues.push('no CI')
  return { score: Math.max(0, 15 - issues.length * 2), issues }
}

function grade(s) { return s>=90?'A':s>=75?'B':s>=60?'C':s>=40?'D':'F' }

// Run
const results = []
for (const repo of REPOS) {
  process.stdout.write(`\n[${repo.tier}] ${repo.name} `)
  const start = Date.now()
  const dir = cloneRepo(repo)
  const a=auditA(dir), b=auditB(dir), c=auditC(dir), d=auditD(dir), e=auditE(dir), f=auditF(dir)
  const score = a.score+b.score+c.score+d.score+e.score+f.score
  const elapsed = ((Date.now()-start)/1000).toFixed(1)
  const allIssues = [...a.issues,...b.issues,...c.issues,...d.issues,...e.issues,...f.issues]
  console.log(`→ ${score}/100 (${grade(score)}) | ${allIssues.length} issues | ${elapsed}s`)
  results.push({ name:repo.name, tier:repo.tier, score, grade:grade(score), issues:allIssues.length, elapsed:parseFloat(elapsed), a:a.score, b:b.score, c:c.score, d:d.score, e:e.score, f:f.score, allIssues })
}

// Summary
console.log('\n\n╔══════════════════════════════════════════════════════════╗')
console.log('║         COLD SHOWER BENCHMARK — 15 REPOS                ║')
console.log('╚══════════════════════════════════════════════════════════╝\n')

const tierLabel = { vulnerable:'🔴 VULNERABLE', startup:'🟡 STARTUP', clean:'🟢 CLEAN' }
;['vulnerable','startup','clean'].forEach(tier => {
  const g = results.filter(r => r.tier===tier)
  const avg = Math.round(g.reduce((s,r)=>s+r.score,0)/g.length)
  console.log(`${tierLabel[tier]}  avg ${avg}/100`)
  g.forEach(r => {
    const bar = '█'.repeat(Math.round(r.score/5)) + '░'.repeat(20-Math.round(r.score/5))
    console.log(`  ${r.name.padEnd(14)} ${String(r.score).padStart(3)}/100  ${r.grade}  ${bar}  ${r.issues} issues`)
  })
  console.log()
})

const v = results.filter(r=>r.tier==='vulnerable')
const s = results.filter(r=>r.tier==='startup')
const c = results.filter(r=>r.tier==='clean')
const avgV = Math.round(v.reduce((a,r)=>a+r.score,0)/v.length)
const avgS = Math.round(s.reduce((a,r)=>a+r.score,0)/s.length)
const avgC = Math.round(c.reduce((a,r)=>a+r.score,0)/c.length)
const avgTime = (results.reduce((a,r)=>a+r.elapsed,0)/results.length).toFixed(1)

console.log('── DETECTION STATS ─────────────────────────────────────────')
console.log(`Vulnerable repos avg:  ${avgV}/100`)
console.log(`Startup repos avg:     ${avgS}/100`)
console.log(`Clean repos avg:       ${avgC}/100`)
console.log(`Score separation:      ${avgC - avgV} pts (clean vs vulnerable)`)
console.log(`Avg runtime:           ${avgTime}s per repo`)
console.log(`Repos with issues:     ${results.filter(r=>r.issues>0).length}/15`)
console.log(`False positive check:  clean repos scoring <60: ${c.filter(r=>r.score<60).length}`)

fs.writeFileSync('/private/tmp/cold-shower-bench/results.json', JSON.stringify(results, null, 2))
console.log('\nFull results → /private/tmp/cold-shower-bench/results.json')

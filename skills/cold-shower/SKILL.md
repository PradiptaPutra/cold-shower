---
name: cold-shower
description: |
  Four modes, one skill. Auto-triggers on what you say — no commands to memorize.
  🔍 AUDIT: 6 parallel audits (LLM costs, AI security, code health, deps, prod readiness, git/devops) → Vibe Score 0-100.
  📋 PLAN-GATE: generates structured plan (files to touch, rollback, pre-mortem) then PreToolUse hook blocks all edits until user types APPROVED.
  🧠 RECALL: saves decisions + WHY, fragile file warnings, bug history to local brain files; grep-based retrieval across sessions.
  📅 DAILY BRIEF: auto-injects at session start after a gap/new day — shows what you left off, files touched, decisions made last session. No command needed.
  Emergency mode auto-activates when app is actively failing under traffic.

  Trigger on: "audit my codebase", "is this ready to ship", "cold shower", "reality check",
  "something always breaks", "LLM bill too high", "is my AI secure", "clean up my deps",
  "app crashed under traffic", "vibe code mess", "/cold-shower",
  "implement X", "add X", "fix X", "refactor X", "build X",
  "remember this", "what did we decide", "save this decision".
  The daily brief is AUTOMATIC — fires on SessionStart hook when date changed or >4h gap. No trigger phrase needed.
tools: Read, Write, Bash, Grep, Glob
---

# cold-shower v2 — Reality Check for Vibe-Coded Apps

Four modes, one skill:
- 🔍 AUDIT: 6 parallel audits (LLM costs, AI security, code health, deps, prod readiness, git/devops) → Vibe Score 0-100
- 📋 PLAN-GATE: structured implementation plan → PreToolUse hook blocks edits until approved  
- 🧠 RECALL: persistent second brain → decisions, fragile files, bug history across sessions
- 📅 DAILY BRIEF: auto-injects at session start after a gap/new day — shows what you left off, files touched, decisions made last session. No command needed.

---

## EMERGENCY CHECK — Run This First

Before anything else, check if the app is actively on fire:

**Signs of emergency:** user mentions 500 errors, timeouts, "too many connections", DB overload,
app down, crashing under traffic, HN/Product Hunt spike.

**If emergency detected → jump to EMERGENCY MODE at the bottom of this file.**
Fix the bleeding first. Run full audit after app is stable.

---

## Phase 0: Stack Detection (30 seconds)

```bash
mkdir -p .cold-shower && echo ".cold-shower/" >> .gitignore 2>/dev/null

[ -f package.json ] && echo "JS_PROJECT=1"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "PY_PROJECT=1"

grep -q '"next"' package.json 2>/dev/null && echo "FRAMEWORK=nextjs"
grep -q '"express"' package.json 2>/dev/null && echo "FRAMEWORK=express"
grep -q 'fastapi' requirements.txt pyproject.toml 2>/dev/null && echo "FRAMEWORK=fastapi"
grep -q 'django' requirements.txt pyproject.toml 2>/dev/null && echo "FRAMEWORK=django"

grep -rql 'openai\|@anthropic-ai\|anthropic\|langchain\|llamaindex' \
  --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null \
  && echo "HAS_AI=1"

grep -qE 'supabase|postgres|prisma|mongoose|mysql|sequelize|drizzle|sqlalchemy' \
  package.json requirements.txt pyproject.toml 2>/dev/null \
  && echo "HAS_DB=1"

[ -f pnpm-lock.yaml ] && echo "PM=pnpm"
[ -f yarn.lock ] && echo "PM=yarn"
[ -f bun.lockb ] && echo "PM=bun"
[ -f package-lock.json ] && echo "PM=npm"

node -e "const p=require('./package.json'); \
  console.log('DEPS:', Object.keys(p.dependencies||{}).length, \
  'DEV_DEPS:', Object.keys(p.devDependencies||{}).length)" 2>/dev/null
```

**Load previous Vibe Score (if exists):**
```bash
mkdir -p .cold-shower
if [ -f .cold-shower/score-history.json ]; then
  LAST=$(python3 -c "import json; h=json.load(open('.cold-shower/score-history.json')); e=h[-1]; print(f\"Last score: {e['score']}/100 ({e['grade']}) on {e['date']}\")" 2>/dev/null)
  echo "📊 $LAST — comparing after this audit"
fi
```

---

## Phase 1: Five Audits in Parallel

---

### AUDIT A — LLM Cost Scan (run if HAS_AI=1)

**Goal:** Find why the OpenAI/Anthropic bill is higher than it should be.

```bash
# Find all LLM call sites
grep -rn "chat.completions.create\|messages.create\|openai.chat\|anthropic.messages\|ChatOpenAI\|ChatAnthropic" \
  --include="*.ts" --include="*.js" --include="*.py" . \
  > .cold-shower/ai-callsites.txt 2>/dev/null
echo "LLM call sites: $(wc -l < .cold-shower/ai-callsites.txt)"

# 1. Unbounded history accumulation
grep -rn "messages.push\|chat_history.append\|history +=" \
  --include="*.ts" --include="*.js" --include="*.py" . >> .cold-shower/a-issues.txt

# 2. Hardcoded expensive model everywhere
grep -rn '"gpt-4"\|"claude-opus"\|"claude-3-opus"\|"gpt-4o"[^-]' \
  --include="*.ts" --include="*.js" --include="*.py" . >> .cold-shower/a-issues.txt

# 3. No caching layer at all
grep -q 'redis\|upstash\|gptcache\|semantic-cache' \
  package.json requirements.txt pyproject.toml 2>/dev/null \
  || echo "NO_CACHE=1" >> .cold-shower/a-issues.txt

# 4. Retry loops without circuit breaker
grep -rn "for.*retry\|while.*retry\|attempts.*range\|maxRetries" \
  --include="*.ts" --include="*.js" --include="*.py" . >> .cold-shower/a-issues.txt

# 5. No observability (flying blind on costs)
grep -rq 'helicone\|langfuse\|langsmith\|portkey' \
  --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null \
  || echo "NO_LLM_OBSERVABILITY=1" >> .cold-shower/a-issues.txt
```

**Generate on fix request:**
- `lib/llm-cache.ts` — Upstash semantic cache (40-70% call reduction)
- `lib/llm-router.ts` — heuristic model router (gpt-4o-mini for simple queries = 20x cheaper)
- `lib/llm-client.ts` — drop-in wrapper: history truncation + Helicone + cache + router

---

### AUDIT B — AI Security Scan (run if HAS_AI=1)

**Goal:** Find AI endpoints exposed to real users with no protection.

```bash
# Map all route handlers
grep -rn "router\.\(post\|get\)\|app\.\(post\|get\)\|export.*POST\|export.*GET" \
  --include="*.ts" --include="*.js" . | grep -v node_modules > .cold-shower/b-endpoints.txt
grep -rn "@app\.\(post\|get\)\|@router\.\|path(" \
  --include="*.py" . >> .cold-shower/b-endpoints.txt

# 1. Raw user input going straight to LLM (prompt injection risk)
grep -rn "req\.body\.\|request\.json\(\)\|await request\.body" \
  --include="*.ts" --include="*.js" --include="*.py" . \
  > .cold-shower/b-raw-inputs.txt

# 2. No rate limiting on AI endpoint
grep -rq 'rateLimit\|rate_limit\|slowapi\|RateLimiter\|@upstash/ratelimit' \
  --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null \
  || echo "NO_RATE_LIMIT=1" >> .cold-shower/b-issues.txt

# 3. No PII scrubbing before LLM
grep -rq 'presidio\|redact\|scrub\|anonymize' \
  package.json requirements.txt pyproject.toml 2>/dev/null \
  || echo "NO_PII_SCRUBBING=1" >> .cold-shower/b-issues.txt

# 4. Secrets inside system prompt
grep -rn 'SYSTEM_PROMPT\|systemPrompt\|system_prompt' \
  --include="*.ts" --include="*.js" --include="*.py" . \
  | grep -i 'api_key\|secret\|internal\|admin' \
  >> .cold-shower/b-issues.txt

# 5. No per-user spend limit
grep -rq 'token.*budget\|usage.*limit\|user.*quota' \
  --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null \
  || echo "NO_USER_SPEND_LIMIT=1" >> .cold-shower/b-issues.txt
```

**Generate on fix request:**
- `middleware/ai-guard.ts` — injection pattern detection + input sanitization
- `middleware/ai-rate-limit.ts` — Redis sliding window per-user token budget
- Canary token in system prompt (detects extraction attempts)

---

### AUDIT C — Code Health Scan (always run)

**Goal:** Vibe Score — how bad is the AI-generated rot?

```bash
# Install tools if missing
command -v madge >/dev/null || npm install -g madge 2>/dev/null
command -v pylint >/dev/null || pip install pylint -q 2>/dev/null

# God files (>500 lines = warning, >1000 = critical)
find . \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" \) \
  | grep -v node_modules | grep -v dist | grep -v ".cold-shower" \
  | xargs wc -l 2>/dev/null | awk '$1 > 500 {print $1, $2}' | sort -rn \
  > .cold-shower/c-god-files.txt
echo "God files (>500 lines): $(wc -l < .cold-shower/c-god-files.txt)"

# Circular dependencies
madge --circular --json src/ > .cold-shower/c-circular.json 2>/dev/null
echo "Circular dep chains: $(python3 -c \
  'import json; d=json.load(open(".cold-shower/c-circular.json")); print(len(d))' 2>/dev/null || echo 0)"

# Code duplication (>10% = failing grade, GitClear found AI code hits 12.3% avg)
npx --yes jscpd src/ --min-tokens 50 --reporters json \
  --output .cold-shower/ >/dev/null 2>&1
echo "Duplication %: $(python3 -c \
  'import json; d=json.load(open(".cold-shower/jscpd-report.json")); \
   print(round(d.get("statistics",{}).get("total",{}).get("percentage",0),1))' 2>/dev/null || echo "N/A")"

# Floating promises — async calls with no error handling (silent crash sites)
npx eslint src/ \
  --rule '{"@typescript-eslint/no-floating-promises":"error","no-async-promise-executor":"error"}' \
  --format json > .cold-shower/c-async.json 2>/dev/null
echo "Floating promises: $(python3 -c \
  'import json; d=json.load(open(".cold-shower/c-async.json")); \
   print(sum(len(f["messages"]) for f in d))' 2>/dev/null || echo 0)"

# Dead exports
npx --yes knip --reporter json > .cold-shower/c-knip.json 2>/dev/null
```

**Vibe Score calculation (0-100):**
- Start: 100
- `-15` if duplication > 10%
- `-10` per circular dep chain (max -30)
- `-5` per god file >1000 lines (max -20)
- `-3` per god file >500 lines (max -15)
- `-2` per floating promise (max -20)

**Grades:** 90+=A | 75-89=B | 60-74=C | 40-59=D | <40=F (do not ship)

---

### AUDIT D — Dependency Scan (always run)

**Goal:** Find what AI installed that's dead weight.

```bash
# Unused deps (knip result reused from Audit C if already ran)
npx --yes knip --reporter json 2>/dev/null > .cold-shower/d-knip.json
node -e "
const r = JSON.parse(require('fs').readFileSync('.cold-shower/d-knip.json'));
const unused = [...new Set((r.issues||[]).flatMap(f =>
  [...(f.dependencies||[]),...(f.devDependencies||[])].map(d=>d.name)))];
console.log('Unused deps:', unused.length);
require('fs').writeFileSync('.cold-shower/d-unused.json', JSON.stringify(unused,null,2));
" 2>/dev/null

# Python unused
command -v deptry >/dev/null && deptry . --json-output .cold-shower/d-deptry.json 2>/dev/null

# Security CVEs
npm audit --json > .cold-shower/d-audit.json 2>/dev/null
node -e "const r=require('./.cold-shower/d-audit.json'); \
  const v=r.metadata?.vulnerabilities||{}; \
  console.log('CVEs — critical:',v.critical,'high:',v.high,'moderate:',v.moderate)" 2>/dev/null

# Bundle size for top 10 unused via bundlephobia (no API key needed)
node -e "
const unused=JSON.parse(require('fs').readFileSync('.cold-shower/d-unused.json')||'[]');
const pkg=require('./package.json');
const deps={...(pkg.dependencies||{}),...(pkg.devDependencies||{})};
unused.slice(0,10).forEach(n=>{
  const v=(deps[n]||'latest').replace(/[^\d.]/g,'').split(' ')[0]||'latest';
  console.log(n+'@'+v);
});
" 2>/dev/null | while read pkgver; do
  gzip=$(curl -s "https://bundlephobia.com/api/size?package=${pkgver}" \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('gzip',0))" 2>/dev/null)
  echo "${pkgver} | ${gzip}B gzip" >> .cold-shower/d-sizes.txt
  sleep 0.3
done

# Semantic duplicates — same job, multiple packages
node -e "
const CATS={
  http:['axios','got','superagent','node-fetch','ky','undici','request'],
  date:['moment','date-fns','dayjs','luxon'],
  util:['lodash','underscore','ramda','remeda','radash'],
  validation:['joi','yup','zod','valibot','ajv'],
  uuid:['uuid','nanoid','cuid','cuid2','ulid'],
  logging:['winston','pino','bunyan','loglevel'],
  state:['redux','zustand','mobx','jotai','valtio','recoil'],
};
const pkg=require('./package.json');
const inst=Object.keys({...(pkg.dependencies||{}),...(pkg.devDependencies||{})});
const dupes=Object.entries(CATS)
  .map(([cat,pkgs])=>({cat,found:pkgs.filter(p=>inst.includes(p))}))
  .filter(d=>d.found.length>1);
if(dupes.length){
  require('fs').writeFileSync('.cold-shower/d-dupes.json',JSON.stringify(dupes,null,2));
  dupes.forEach(d=>console.log('DUPE CATEGORY:',d.cat,'->',d.found.join(' + ')));
}
" 2>/dev/null
```

---

### AUDIT F — Git/GitHub/DevOps Hygiene (always run)

**Goal:** Find everything vibe coders skip in git setup that causes security incidents or broken deploys.

```bash
# 1. .env committed to git? (CRITICAL — rotate ALL secrets if yes)
git ls-files | grep -E "^\.env$|^\.env\.(local|production|staging|prod)$" \
  && echo "CRITICAL_ENV_COMMITTED=1" >> .cold-shower/f-issues.txt

# 2. Secrets in git history
git log --all --diff-filter=A --name-only --format="" -- "*.env" "*.pem" "*.key" 2>/dev/null \
  | head -5 >> .cold-shower/f-issues.txt

# 3. .gitignore completeness
[ -f .gitignore ] || echo "MISSING_GITIGNORE=1" >> .cold-shower/f-issues.txt
for entry in ".env" ".env.local" "node_modules" "dist/" "build/" ".next/" \
             "__pycache__" ".DS_Store" "terraform.tfstate" "*.pem" "*.key"; do
  grep -q "$entry" .gitignore 2>/dev/null \
    || echo "GITIGNORE_MISSING_ENTRY: $entry" >> .cold-shower/f-issues.txt
done

# 4. Claude settings.local.json committed? (contains personal API keys)
git ls-files | grep -q "settings.local.json" \
  && echo "CLAUDE_SETTINGS_LOCAL_COMMITTED=1" >> .cold-shower/f-issues.txt

# 5. CI workflows exist?
[ -d .github/workflows ] && ls .github/workflows/*.yml >/dev/null 2>&1 \
  || echo "NO_CI_WORKFLOWS=1" >> .cold-shower/f-issues.txt

# 6. Typecheck in CI?
grep -rq "typecheck\|tsc --noEmit\|mypy\|pyright" .github/workflows/ 2>/dev/null \
  || echo "NO_TYPECHECK_IN_CI=1" >> .cold-shower/f-issues.txt

# 7. Tests in CI?
grep -rq "npm test\|pytest\|jest\|vitest\|mocha" .github/workflows/ 2>/dev/null \
  || echo "NO_TESTS_IN_CI=1" >> .cold-shower/f-issues.txt

# 8. Unpinned GitHub Actions (CVE-2025-30066: 23,000 repos compromised via floating tags)
grep -rE "uses: .+@(v[0-9]|main|master|latest)" .github/workflows/ 2>/dev/null \
  && echo "UNPINNED_ACTIONS=1" >> .cold-shower/f-issues.txt

# 9. Workflow injection — untrusted PR input interpolated into run: (command injection)
grep -rn '\${{ github.event.pull_request.title\|\${{ github.event.issue.title\|\${{ github.head_ref' \
  .github/workflows/ 2>/dev/null >> .cold-shower/f-issues.txt

# 10. pull_request_target + fork checkout = "Pwn Request" attack
if grep -rq "pull_request_target" .github/workflows/ 2>/dev/null; then
  grep -rq "head\.ref\|head\.sha" .github/workflows/ 2>/dev/null \
    && echo "PWN_REQUEST_RISK=1" >> .cold-shower/f-issues.txt
fi

# 11. No explicit permissions block in workflows (default is write-all in older repos)
for f in .github/workflows/*.yml 2>/dev/null; do
  grep -q "^permissions:" "$f" 2>/dev/null \
    || echo "NO_PERMISSIONS_BLOCK: $f" >> .cold-shower/f-issues.txt
done

# 12. ACTIONS_RUNNER_DEBUG left on (dumps env vars + masked secrets to logs)
grep -rn "ACTIONS_RUNNER_DEBUG\|ACTIONS_STEP_DEBUG" .github/workflows/ 2>/dev/null \
  >> .cold-shower/f-issues.txt

# 13. secrets: inherit in reusable workflows (exposes ALL repo secrets to called workflow)
grep -rn "secrets: inherit" .github/workflows/ 2>/dev/null \
  >> .cold-shower/f-issues.txt

# 14. No env validation on startup (missing vars fail silently at runtime, not startup)
grep -rq "z\.object\|BaseSettings\|envalid\|dotenv-safe\|pydantic_settings" \
  --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null \
  || echo "NO_ENV_VALIDATION=1" >> .cold-shower/f-issues.txt

# 15. No .env.example (teammates can't onboard)
[ -f .env.example ] || [ -f .env.sample ] \
  || echo "NO_ENV_EXAMPLE=1" >> .cold-shower/f-issues.txt

# 16. No Dependabot (CVEs accumulate silently between manual audits)
[ -f .github/dependabot.yml ] \
  || echo "NO_DEPENDABOT=1" >> .cold-shower/f-issues.txt

# 17. Branch protection on main? (requires gh CLI)
if command -v gh >/dev/null 2>&1; then
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
  if [ -n "$REPO" ]; then
    PROTECTED=$(gh api repos/$REPO/branches/main --jq '.protected' 2>/dev/null)
    [ "$PROTECTED" = "true" ] \
      || echo "NO_BRANCH_PROTECTION=1" >> .cold-shower/f-issues.txt
  fi
fi

# 18. Python-specific
if [ -f requirements.txt ] || [ -f pyproject.toml ]; then
  [ -f .python-version ] || echo "NO_PYTHON_VERSION_FILE=1" >> .cold-shower/f-issues.txt
  grep -rq "pip-audit" .github/workflows/ 2>/dev/null \
    || echo "NO_PIP_AUDIT_IN_CI=1" >> .cold-shower/f-issues.txt
  UNPINNED=$(grep -E "^[a-zA-Z]" requirements.txt 2>/dev/null | grep -v "==" | wc -l)
  [ "$UNPINNED" -gt 0 ] \
    && echo "UNPINNED_PYTHON_DEPS: ${UNPINNED} packages" >> .cold-shower/f-issues.txt
fi

echo "Git/DevOps issues: $(wc -l < .cold-shower/f-issues.txt)"
```

**Critical issues that require immediate action (before any other sprint):**
- `.env` committed → rotate ALL secrets NOW, then remove from history with `git filter-repo`
- Workflow injection pattern → fix before next PR
- `pull_request_target` Pwn Request → fix before repo goes public

**Generate on fix request:**
- `.github/workflows/ci.yml` — minimum viable CI (lint + typecheck + test + build)
- `.github/dependabot.yml` — weekly dep + actions updates
- `src/env.ts` or `src/env.py` — startup env validation (zod/pydantic)
- Updated `.gitignore` with all missing entries

---

### AUDIT E — Production Readiness (run if HAS_DB=1)

**Goal:** Will this survive its first real traffic spike?

```bash
# Connection pool configured?
grep -rn "new Pool\|pool_size\|max:\s*[0-9]\|MAX_CONNECTIONS" \
  --include="*.ts" --include="*.js" --include="*.py" . \
  | grep -v node_modules > .cold-shower/e-pool.txt
[ ! -s .cold-shower/e-pool.txt ] && echo "NO_POOL_CONFIG=1" >> .cold-shower/e-issues.txt

# N+1 patterns — DB calls inside loops
grep -rn "\.map.*await\|forEach.*await\|for.*await.*find\|for.*await.*query" \
  --include="*.ts" --include="*.js" --include="*.py" . \
  | grep -v node_modules > .cold-shower/e-n1.txt
N1=$(wc -l < .cold-shower/e-n1.txt)
[ "$N1" -gt 0 ] && echo "N1_SITES: ${N1}" >> .cold-shower/e-issues.txt

# API rate limiting present?
grep -rq 'express-rate-limit\|rateLimit\|@upstash/ratelimit\|slowapi\|Flask-Limiter' \
  package.json requirements.txt pyproject.toml 2>/dev/null \
  || echo "NO_API_RATE_LIMIT=1" >> .cold-shower/e-issues.txt

# SELECT * (fetches entire row when you need 2 columns)
grep -rn 'SELECT \*\|findMany()\|find({})' \
  --include="*.ts" --include="*.js" --include="*.py" . \
  | grep -v node_modules > .cold-shower/e-selectstar.txt
```

---

## Phase 2: Unified Health Report

Print to terminal AND save to `.cold-shower/REPORT.md`:

```
╔══════════════════════════════════════════════════════════╗
║  COLD SHOWER — [project] — [date]                       ║
╚══════════════════════════════════════════════════════════╝

VIBE SCORE: [XX]/100  Grade: [A/B/C/D/F]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[A] LLM COSTS       — [X issues / CLEAN]
[B] AI SECURITY     — [X issues / CLEAN]
[C] CODE HEALTH     — [X] god files | [X]% duplication | [X] floating promises
[D] DEPENDENCIES    — [X] unused | [X] CVEs | [X] semantic dupes
[E] PROD READINESS  — [READY / X issues]
[F] GIT/DEVOPS      — [X] gitignore gaps | [X] CI issues | [X] secrets risks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 CRITICAL (fix before shipping anything)
  [specific findings with file:line]

🟡 HIGH (fix this sprint)
  [findings]

🟢 QUICK WINS (<30 min each)
  [findings with install command + code snippet]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDED FIX ORDER

Sprint 0.5 — 15 min — Rotate exposed secrets + fix .gitignore (IF .env committed)
Sprint 1   — 30 min — Dead deps + security headers + .env.example
Sprint 2   — 2 hr   — Async errors + rate limiting + env validation
Sprint 3   — 2 hr   — Connection pool + N+1 fixes
Sprint 4   — 4 hr   — LLM cost middleware + caching
Sprint 5   — 1 day  — God component surgery
Sprint 6   — 1 hr   — CI workflow + branch protection + Dependabot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Save Vibe Score to history:**
```bash
mkdir -p .cold-shower
DATE=$(date +%Y-%m-%d)
SCORE=<computed_score>
GRADE=<computed_grade>
python3 - <<'PYEOF'
import json, os
path = '.cold-shower/score-history.json'
history = []
try:
    with open(path) as f:
        history = json.load(f)
except:
    pass
history.append({"date": os.environ.get("DATE",""), "score": int(os.environ.get("SCORE",0)), "grade": os.environ.get("GRADE","")})
with open(path, 'w') as f:
    json.dump(history[-20:], f, indent=2)  # keep last 20 entries
print(f"Score saved. History: {len(history)} entries.")
PYEOF
```

Note: when running this, substitute the actual computed SCORE and GRADE values into `DATE`, `SCORE`, `GRADE` env vars before running the python block.

Ask user: "Which sprint to start? (1-5 or describe what to fix)"

---

## Phase 3: Fix Sprints

Commit after every fix: `git add -p && git commit -m "cold-shower: [description]"`

**After completing any sprint:** type `re-audit` or `check score` to re-run the audit and see if Vibe Score improved. Closing the loop is the point — a sprint without a re-audit is unverified.

### Sprint 0.5 — Secrets Emergency (15 min, ONLY if .env committed)
```bash
# 1. Rotate EVERY secret in the committed .env — assume all compromised
# 2. Remove from git history
pip install git-filter-repo  # or: brew install git-filter-repo
git filter-repo --path .env --invert-paths
# 3. Force push (required — this is the one case where it's correct)
git push --force-with-lease origin main
# 4. Add to .gitignore immediately
echo ".env" >> .gitignore && echo ".env.*" >> .gitignore
git add .gitignore && git commit -m "cold-shower: add .env to gitignore"
```
⚠️ All collaborators must re-clone after force push.

### Sprint 1 — Dead Deps + Quick Wins (30 min)

**Dep removal loop — always one at a time, never batch:**
```bash
UNUSED=$(node -e "console.log(JSON.parse(require('fs').readFileSync('.cold-shower/d-unused.json')).join(' '))" 2>/dev/null)
for pkg in $UNUSED; do
  echo "Removing: $pkg"
  npm uninstall $pkg
  if npm run build 2>/dev/null && npx tsc --noEmit 2>/dev/null; then
    git add package.json package-lock.json
    git commit -m "cold-shower: remove unused dep $pkg"
    echo "✓ $pkg safely removed"
  else
    echo "✗ $pkg broke build — reverting"
    git checkout -- package.json package-lock.json && npm install --silent
  fi
done
```

**Add `knip.json` to project root to suppress knip false positives:**
```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "ignoreDependencies": ["eslint-plugin-*", "jest-environment-*", "@types/node", "cross-env"],
  "ignoreBinaries": ["tsc", "eslint", "prettier"]
}
```

**Security headers:**
```bash
npm install helmet
```
```typescript
import helmet from 'helmet'
app.use(helmet())
```

- Add `.env.example` if missing (copy `.env`, blank out all values)

### Sprint 2 — Async + Rate Limiting (2 hr)
- Wrap each floating promise: try/catch, log error, return safe default
- Generate rate limiting middleware for all API routes
- Add per-user token budget middleware for AI endpoints

### Sprint 3 — Production DB Hardening (2 hr)
- Generate pool config for detected ORM (Prisma/pg/SQLAlchemy/Sequelize/Drizzle)
- Add `include`/`select_related`/`joinedLoad` at each N+1 site
- Add dev-only query logger to catch future N+1s early

### Sprint 4 — LLM Cost Middleware (4 hr)

Generate these 3 files. User only changes call sites from `openai.chat.completions.create` → `llmChat`.

**`lib/llm-cache.ts`** — Upstash semantic cache (40-70% call reduction):
```typescript
// npm install @upstash/semantic-cache @upstash/vector
import { SemanticCache } from '@upstash/semantic-cache'
import { Index } from '@upstash/vector'

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
})
const cache = new SemanticCache({ index, minProximity: 0.85 })

export async function cachedCall(prompt: string, fn: () => Promise<string>): Promise<string> {
  const hit = await cache.get(prompt)
  if (hit) return hit
  const result = await fn()
  await cache.set(prompt, result)
  return result
}
```

**`lib/llm-router.ts`** — heuristic model router (20x cheaper on simple queries):
```typescript
export function routeModel(prompt: string): string {
  const tokens = prompt.split(/\s+/).length
  const hasCode = /```|function |class |def |import /.test(prompt)
  const hasReasoning = /analyze|compare|explain why|step by step|summarize/i.test(prompt)
  if (tokens < 100 && !hasCode && !hasReasoning) return 'gpt-4o-mini'
  if (tokens > 500 || (hasCode && hasReasoning)) return 'gpt-4o'
  return 'gpt-4o-mini'
}
```

**`lib/llm-client.ts`** — drop-in wrapper (cache + router + Helicone + history truncation):
```typescript
import OpenAI from 'openai'
import { cachedCall } from './llm-cache'
import { routeModel } from './llm-router'

const client = new OpenAI({
  baseURL: process.env.HELICONE_API_KEY ? 'https://oai.helicone.ai/v1' : undefined,
  defaultHeaders: process.env.HELICONE_API_KEY
    ? { 'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}` }
    : undefined,
})

const MAX_HISTORY = 20

export async function llmChat(
  messages: Array<{ role: string; content: string }>,
  opts: { bypassCache?: boolean; model?: string } = {}
): Promise<string> {
  const system = messages.find(m => m.role === 'system')
  const history = messages.filter(m => m.role !== 'system').slice(-MAX_HISTORY)
  const truncated = [...(system ? [system] : []), ...history]
  const userMsg = truncated.at(-1)?.content ?? ''
  const model = opts.model ?? routeModel(userMsg)

  const callFn = async () => {
    const res = await client.chat.completions.create({ model, messages: truncated as any })
    return res.choices[0]?.message?.content ?? ''
  }
  return opts.bypassCache ? callFn() : cachedCall(userMsg, callFn)
}
```

**Add to `.env.example`:**
```
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=
HELICONE_API_KEY=      # get free at helicone.ai — 1 line, instant cost visibility
```

**Replace call sites:**
```bash
# Find all direct openai call sites to migrate
grep -rn "chat.completions.create\|openai.chat" --include="*.ts" --include="*.js" src/
```

### Sprint 5 — God Component Surgery (1 day)

**Non-negotiable rules — break any of these and you'll break the app:**
1. Write characterization tests BEFORE touching any code. Assert current behavior including weird parts.
2. Extract pure presentational components first (JSX only, all handlers stay in parent).
3. Extract custom hooks second (one concern per hook, define return interface before moving logic).
4. Commit after every single extraction — never batch two extractions in one commit.
5. Never mix structural and behavioral changes in the same commit.

**Add to ESLint config to detect rot going forward:**
```json
{
  "rules": {
    "complexity": ["warn", { "max": 10 }],
    "max-lines": ["warn", { "max": 300 }],
    "max-lines-per-function": ["warn", { "max": 50 }],
    "max-params": ["warn", 4],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "no-async-promise-executor": "error"
  }
}
```

**Safe extraction order for a god file:**
```
Phase A — Lock current behavior
  → Write characterization tests (assert outputs, not implementation)
  → git commit "characterization tests for [ComponentName]"

Phase B — Extract presentational components (safest)
  → Move JSX that only needs props, no new state/effects
  → Keep ALL handlers in parent, pass them down
  → Run tests → git commit

Phase C — Extract derived values
  → Move derived values out of useState into useMemo or plain variables
  → One at a time → tests → commit

Phase D — Extract custom hooks (last)
  → Group related useState/useEffect pairs with single purpose into useX
  → Run tests → git commit

RULE: never proceed to next phase until current phase tests are green.
```

**Duplication consolidation — Rule of Three only:**
Only consolidate logic that appears 3+ times. Two similar functions is fine. Three = extract to `src/lib/`.
```bash
# Find top duplicate blocks
npx jscpd src/ --min-tokens 50 --reporters console 2>/dev/null | head -40
```

---

## EMERGENCY MODE

**App actively failing under traffic. Do these in order. Speed > perfection.**

### Step 1 — Rate Limit (2 min)

**Express:**
```typescript
// npm install express-rate-limit
import rateLimit from 'express-rate-limit'
app.use(rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true }))
```

**Next.js — create `middleware.ts` at project root:**
```typescript
// npm install @upstash/ratelimit @upstash/redis
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(60, '1m') })
export async function middleware(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await ratelimit.limit(ip)
  return success ? NextResponse.next() : new NextResponse('Too Many Requests', { status: 429 })
}
```

**FastAPI:**
```python
# pip install slowapi
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
@app.post("/api/chat")
@limiter.limit("60/minute")
async def chat(request: Request): ...
```

### Step 2 — Fix Connection Pool (2-5 min)

**Supabase — zero code, one env var change:**
```
DATABASE_URL: change port 5432 → 6543   (enables built-in PgBouncer)
```

**Prisma:**
```
DATABASE_URL="postgresql://...?connection_limit=1&pgbouncer=true"
```

**node-postgres:**
```typescript
const pool = new Pool({ max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 })
```

**SQLAlchemy:**
```python
engine = create_engine(DATABASE_URL, pool_size=20, max_overflow=10, pool_pre_ping=True)
```

### Step 3 — In-Memory Cache (3 min) — cuts DB load 60-80%

**Node.js:**
```typescript
// npm install lru-cache
import { LRUCache } from 'lru-cache'
const cache = new LRUCache<string, any>({ max: 500, ttl: 1000 * 60 * 5 })
app.get('/api/posts', async (req, res) => {
  if (cache.has('posts')) return res.json(cache.get('posts'))
  const data = await db.query('SELECT id, title, created_at FROM posts LIMIT 50')
  cache.set('posts', data.rows)
  res.json(data.rows)
})
```

**Python:**
```python
# pip install cachetools
from cachetools import TTLCache, cached
cache = TTLCache(maxsize=500, ttl=300)
@cached(cache)
async def get_posts(): ...
```

### Step 4 — Detect N+1 (1 min, no restart needed with hot reload)

```typescript
// Add temporarily to db.ts
const queryCounts = new Map<string, number>()
const _query = pool.query.bind(pool)
pool.query = (text: any, values?: any) => {
  const key = (typeof text === 'string' ? text : text.text ?? '').substring(0, 80)
  const n = (queryCounts.get(key) || 0) + 1
  queryCounts.set(key, n)
  if (n > 10) console.warn(`[N+1 ALERT] Repeated ${n}x:`, key)
  return _query(text, values)
}
```

### Step 5 — Scale (last resort, costs money)

```bash
heroku ps:scale web=2:standard-2x
railway scale --replicas 2
fly scale count 2
```

**Once stable: run full `/cold-shower` to find root cause.**

---

### Sprint 6 — CI + Branch Protection + Dependabot (1 hr)

**Generate `.github/workflows/ci.yml`:**
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
        with:
          persist-credentials: false
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --passWithNoTests
      - run: npm run build
```

**Generate `.github/dependabot.yml`:**
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    groups:
      all-dependencies:
        patterns: ["*"]
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
```

**Pin all unpinned Actions (run once):**
```bash
npx pinact .github/workflows/ci.yml
```

**Branch protection via gh CLI:**
```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api repos/$REPO/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

**Generate `src/env.ts` startup validation:**
```typescript
import { z } from 'zod'
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
})
export const env = EnvSchema.parse(process.env)
// Add your other required vars — throws at startup if any are missing
```

---

## PLAN-GATE — Structured Planning Before Implementation

Auto-activates when user says: "implement X", "add X", "fix X", "create X", "refactor X", "build X"

### When plan-gate is active:
- gate.js hook blocks all Edit/Write/MultiEdit tool calls
- Claude MUST generate a structured plan first
- Edits only allowed after user types `APPROVED`
- Plan stored at `.plan-gate/plan.md`

### Structured plan format (generate this before any code):

```markdown
## Plan: [task name]

### Understanding
- Problem being solved (the WHY, not just the WHAT)
- Definition of done (behavior, not code description)
- Out of scope (explicit exclusions)

### Files to Touch
| File | Lines | Change | Reason |
|------|-------|--------|--------|

### Files NOT to Touch
| File | Reason |
|------|--------|

### Contracts That Cannot Change
(API signatures, HTTP response codes, DB columns callers depend on)

### Dependency Order
1. First change (unlocks others)
2. Second change
...

### Risk Assessment
- HIGH: [specific failure mode]
- MEDIUM: [specific failure mode]

### Pre-Mortem
"If this fails, the most likely cause is..."

### Rollback
(exact steps — does it need migration rollback? data backfill?)
```

### After plan is generated:
Ask user: **"Review the plan above. Type `APPROVED` to proceed with implementation."**

Do NOT write code, create files, or edit anything until user types APPROVED.

### After implementation:
Remind user: `"Type re-audit to verify Vibe Score didn't drop."`

### To skip plan-gate for a quick change:
User can say "skip plan" or delete `.plan-gate/ACTIVE`

---

## RECALL — Persistent Second Brain

Replaces Obsidian for developers who want memory inside their coding workflow.

### Brain file locations:
```
~/.claude/brain/                          ← global (all projects)
  preferences.md                          ← coding style, tool preferences

~/.claude/projects/<project>/brain/       ← project-scoped
  decisions.md   ← architectural choices + WHY + rejected alternatives
  avoid.md       ← fragile files/areas — checked by PreToolUse hook before edits
  bugs.md        ← fixed bugs + how to detect regression
  context.md     ← domain knowledge, user base, compliance, business context
  patterns.md    ← code patterns with project-specific examples
```

### Memory entry format (always include WHY and date):
```markdown
## 2026-06-29 · [one-line summary]
**Decision/Pattern/Bug/Context:** [the WHAT]
**Why:** [the reason — constraints, rejected alternatives, incidents]
**Source:** [commit sha, issue #, or "session decision"]
```

### How to save memories:

**Manual:** User says "remember that..." or "save this decision..." → append to appropriate brain file

**Auto-capture:** Stop hook (capture.js) scans session at end, surfaces 3-5 suggestions

**Anti-regression:** gate.js PreToolUse hook warns before editing files listed in avoid.md

### Recall commands:
- `"remember [X]"` → save to appropriate brain file
- `"what did we decide about [X]"` → grep brain files and return matches
- `"show avoid list"` → read avoid.md
- `"show context"` → read context.md
- `"/recall review"` → show memories older than 90 days for staleness review
- `"forget [X]"` → remove matching entry from brain files

### When user says "remember [X]", classify and save:
- Architectural choice → `decisions.md`
- File/area to avoid → `avoid.md` (also triggers gate.js warning on future edits)
- Bug pattern → `bugs.md`
- Domain/business context → `context.md`
- Code pattern → `patterns.md`
- Personal style → `~/.claude/brain/preferences.md`

### Hard limits (never exceed):
- Each brain file: 50 lines max → archive oldest to `brain/archive/` when full
- Session injection: 15 headlines max (~1,500 tokens)
- Never inject full file content at session start — headers only, full content on demand

### Privacy note:
Brain files are local only. Never commit `~/.claude/brain/` or `~/.claude/projects/*/brain/` to git.
Add to .gitignore: `.claude/`

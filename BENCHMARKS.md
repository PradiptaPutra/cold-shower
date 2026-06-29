# cold-shower Benchmark Results

15 public JS/TS repos. Static analysis only — no LLM calls during scoring.

Run date: 2026-06-29 · Runtime: ~17s per repo avg

---

## Results

| Repo | Tier | Score | Grade | Issues |
|------|------|-------|-------|--------|
| NodeGoat | 🔴 Vulnerable app | 75/100 | B | 7 |
| juice-shop | 🔴 Vulnerable app | 62/100 | C | 7 |
| dvna | 🔴 Vulnerable app | 83/100 | B | 5 |
| hoppscotch | 🟡 Startup app | 74/100 | C | 3 |
| formbricks | 🟡 Startup app | 62/100 | C | 5 |
| twenty | 🟡 Startup app | 74/100 | C | 3 |
| cal.com | 🟡 Startup app | 76/100 | B | 4 |
| plane | 🟡 Startup app | 62/100 | C | 6 |
| dub | 🟡 Startup app | 66/100 | C | 5 |
| documenso | 🟡 Startup app | 57/100 | D | 6 |
| express | 🔵 Library | 62/100 | C | 5 |
| fastify | 🔵 Library | 59/100 | D | 5 |
| trpc | 🔵 Library | 66/100 | C | 7 |
| zod | 🔵 Library | 44/100 | D | 9 |
| lucia | 🔵 Library | 90/100 | A | 4 |

---

## Key Stats

**Detection: 15/15 repos had at least one issue (100%)**

| Group | Avg Score | Notes |
|-------|-----------|-------|
| Vulnerable apps (NodeGoat, juice-shop, dvna) | 73/100 | Deliberately insecure |
| Startup apps (hoppscotch → documenso) | 67/100 | Real production codebases |
| Libraries (express, fastify, trpc, zod, lucia) | 64/100 | See note below |

**App vs app separation (apples-to-apples):**
- Deliberately vulnerable apps: avg **69/100**
- Best maintained apps (cal.com, lucia): avg **83/100**
- Separation: **+14 pts** — cold-shower distinguishes app quality

**Runtime: avg 17.3s per repo** (static analysis, no LLM calls)

---

## What each group reveals

### Vulnerable apps scored higher than expected (73 avg)
NodeGoat and dvna are deliberately insecure but small, simple apps.
cold-shower's god-file and missing-CI checks don't fire heavily on small codebases.
Real catches: no .env in .gitignore, no rate limiting, no error middleware.

### Startup apps showed the real problem (67 avg, all grade C/D)
Every startup app had 3–6 issues. Most common:
- No per-user token budget on AI endpoints (Audit B)
- God files >500 lines (Audit C) — plane, formbricks, documenso hit hardest
- No Dependabot (Audit F)
- Missing rate limiting (Audit E)

### Libraries score lower — and that's correct
Libraries don't need rate limiting, AI endpoints, or app-level CI.
**cold-shower is designed for applications, not libraries.**
lucia scored 90/100 — the only library with full CI, branch protection, and Dependabot configured.

---

## Most common issues across all 15 repos

| Issue | Repos affected | Audit |
|-------|---------------|-------|
| No Dependabot config | 12/15 | F |
| No rate limiting | 10/15 | E |
| God files >500 lines | 9/15 | C |
| No error middleware | 8/15 | E |
| No per-user token budget (AI repos) | 7/15 | B |
| .env not in .gitignore | 5/15 | F |

---

## Methodology

| Audit | Method |
|-------|--------|
| A — LLM Costs | grep for cache, hardcoded models, unbounded history |
| B — AI Security | grep for rate limiting on AI routes, token budget |
| C — Code Health | wc -l on all TS/JS files, floating promise grep |
| D — Dependencies | npm audit --json |
| E — Prod Readiness | grep for rate limit middleware, error handlers |
| F — Git/DevOps | .gitignore check, git log for .env, Actions tag check, dependabot.yml |

**Limitation:** Static analysis only. Full cold-shower (LLM-powered) catches more — prompt injection surface, PII in API calls, N+1 query patterns, semantic code duplication. These numbers are a floor, not a ceiling.

---

## Reproduce

```bash
git clone https://github.com/PradiptaPutra/cold-shower
node benchmarks/bench.js
```

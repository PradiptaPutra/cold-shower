# cold-shower

> Reality check for vibe-coded apps. Audits what AI-generated code actually breaks in production.

**Claude Code skill** — installs once, auto-triggers on keywords, never needs manual invocation.

---

## What it does

Runs 6 parallel audits on your codebase and outputs a **Vibe Score (0–100)** with ordered fix sprints.

| Audit | What it finds |
|-------|--------------|
| **A — LLM Costs** | Runaway spend, missing semantic cache, wrong model routing in your app |
| **B — AI Security** | Prompt injection in your endpoints, PII leakage, per-user cost abuse |
| **C — Code Health** | God files, circular deps, duplicated logic, floating promises |
| **D — Dependencies** | Unused packages, CVEs, archived libs, semantic duplicates |
| **E — Prod Readiness** | N+1 queries, connection pool exhaustion, no rate limits |
| **F — Git/DevOps** | `.env` committed, unpinned Actions, no CI, no branch protection |

Scores: **90+ = A**, **75–89 = B**, **60–74 = C**, **40–59 = D**, **<40 = F**

Tracks Vibe Score history in `.cold-shower/score-history.json` — see improvement sprint-over-sprint.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/PradiptaPutra/cold-shower/main/install.sh | bash
```

Installs the skill + wires SessionStart and UserPromptSubmit hooks into `~/.claude/settings.json`. Idempotent — safe to run multiple times.

---

## How it activates

**You never need to type `/cold-shower`.**

It fires automatically when you describe a problem:

| You type | cold-shower activates |
|----------|----------------------|
| `"my OpenAI bill jumped to $400"` | LLM cost audit |
| `"app went down on Product Hunt"` | Emergency + prod readiness |
| `"this codebase is a mess"` | Code health + dep audit |
| `"about to deploy"` | Full pre-deploy gate |
| `"I committed my .env by accident"` | Sprint 0.5: rotate + scrub history |
| `"re-audit"` | Re-runs audit, compares to last score |

Or call it directly: `/cold-shower`

---

## Example output

```
╔══════════════════════════════════════════════════════════╗
║  COLD SHOWER — myapp — 2026-06-29                       ║
╚══════════════════════════════════════════════════════════╝

VIBE SCORE: 75/100  Grade: B
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[A] LLM COSTS      — 1 issue (no semantic cache)
[B] AI SECURITY    — 2 issues (no PII scrubbing, no token budget)
[C] CODE HEALTH    — 20 god files | 2.9% dup | 0 floating promises
[D] DEPENDENCIES   — 18 moderate CVEs (dev-only) | 0 critical
[E] PROD READINESS — CLEAN
[F] GIT/DEVOPS     — 4 issues (unpinned Actions, no typecheck, no Dependabot)

🟢 QUICK WINS (15 min)
  npx pinact .github/workflows/*.yml
  Add tsc --noEmit to CI
  Add .github/dependabot.yml
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Which sprint? (1=DevOps, 2=LLM cache, 3=token budget, 4=god component surgery)
```

---

## Fix sprints

Each sprint generates real working code — not instructions.

| Sprint | Time | What it generates |
|--------|------|-------------------|
| **0.5** | 15 min | Rotate exposed secrets + `git filter-repo` history scrub |
| **1** | 30 min | Dead dep removal + `knip.json` config |
| **2** | 2 hr | Async error fixes + rate limiting |
| **3** | 2 hr | Connection pool fix + N+1 query detection |
| **4** | 4 hr | `lib/llm-cache.ts` + `lib/llm-router.ts` + `lib/llm-client.ts` |
| **5** | 1 day | God component extraction playbook |
| **6** | 1 hr | `ci.yml` + `dependabot.yml` + `src/env.ts` + branch protection |

---

## What this covers that no other skill does

- **Your app's LLM bill** — audits spend inside your codebase, not just Claude usage
- **AI endpoint security** — OWASP LLM Top 10 applied to your own endpoints
- **Git secrets emergency** — Sprint 0.5 fires before everything else if `.env` is committed
- **Vibe Score history** — track improvement over time, not just a one-time snapshot
- **Pre-deploy gate** — triggers on "about to deploy", catches problems before they ship
- **Real generated code** — Sprint 4 outputs drop-in TypeScript files, not a todo list

---

## Claude Code only

Uses Claude Code's `SessionStart` + `UserPromptSubmit` hooks — the auto-trigger system is Claude Code native. Works in any Claude Code session across all your projects after one install.

---

## Built by

[PradiptaPutra](https://github.com/PradiptaPutra) — built while vibe coding [PahamHukum](https://github.com/PradiptaPutra/hukumai), an Indonesian legal AI app.

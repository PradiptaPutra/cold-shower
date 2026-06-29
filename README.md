<div align="center">

# 🚿 cold-shower

**Reality check for vibe-coded apps.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Install](https://img.shields.io/badge/install-curl%20%7C%20bash-brightgreen)](#install)

*Audits what AI-generated code actually breaks in production.*
*Installs once. Auto-triggers. Never needs a manual command.*

</div>

---

## 🔍 What it does

Runs **6 parallel audits** and outputs a **Vibe Score (0–100)** with ordered fix sprints.

| # | Audit | What it catches |
|---|-------|----------------|
| 🤑 | **LLM Costs** | Runaway spend, missing semantic cache, wrong model routing |
| 🔐 | **AI Security** | Prompt injection, PII leakage, per-user cost abuse |
| 🧹 | **Code Health** | God files, circular deps, duplicate logic, floating promises |
| 📦 | **Dependencies** | Unused packages, CVEs, archived libs, semantic duplicates |
| 🚀 | **Prod Readiness** | N+1 queries, connection pool exhaustion, no rate limits |
| 🛡️ | **Git/DevOps** | `.env` committed, unpinned Actions, no CI, no branch protection |

**Scores:** 90+ = A &nbsp;|&nbsp; 75–89 = B &nbsp;|&nbsp; 60–74 = C &nbsp;|&nbsp; 40–59 = D &nbsp;|&nbsp; <40 = F

Saves Vibe Score to `.cold-shower/score-history.json` — track improvement sprint over sprint.

---

## ⚡ Install

```bash
curl -fsSL https://raw.githubusercontent.com/PradiptaPutra/cold-shower/main/install.sh | bash
```

Installs the skill + wires `SessionStart` and `UserPromptSubmit` hooks into `~/.claude/settings.json`. Idempotent — safe to re-run.

---

## 🤖 How it activates

**You never type `/cold-shower`.**

It fires automatically when you describe the problem:

| You say | What triggers |
|---------|--------------|
| `"my OpenAI bill jumped to $400"` | 🤑 LLM cost audit |
| `"app went down on Product Hunt"` | 🚨 Emergency + prod readiness |
| `"this codebase is a mess"` | 🧹 Code health + deps |
| `"about to deploy"` | 🛡️ Full pre-deploy gate |
| `"I committed my .env by accident"` | 🔴 Sprint 0.5: rotate + scrub history |
| `"re-audit"` | 📊 Re-runs audit, compares to last score |

Or call it directly: `/cold-shower`

---

## 📊 Example output

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
[E] PROD READINESS — ✅ CLEAN
[F] GIT/DEVOPS     — 4 issues (unpinned Actions, no typecheck, no Dependabot)

🔴 CRITICAL — None

🟡 HIGH
  [C] AppShell.tsx 1768 lines — auth+routing+sidebar+chat all in one
  [B] No PII scrubbing — raw user text sent to OpenAI

🟢 QUICK WINS (15 min)
  npx pinact .github/workflows/*.yml
  Add tsc --noEmit to CI
  Add .github/dependabot.yml
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Which sprint? (1=DevOps, 2=LLM cache, 3=token budget, 4=god component surgery)
```

---

## 🏃 Fix sprints

Each sprint generates **real working code** — not a todo list.

| Sprint | Time | Generates |
|--------|------|-----------|
| **0.5** 🔴 | 15 min | Secret rotation + `git filter-repo` history scrub |
| **1** | 30 min | Dead dep removal + `knip.json` config |
| **2** | 2 hr | Async error fixes + rate limiting |
| **3** | 2 hr | Connection pool fix + N+1 query detection |
| **4** | 4 hr | `lib/llm-cache.ts` + `lib/llm-router.ts` + `lib/llm-client.ts` |
| **5** | 1 day | God component extraction playbook |
| **6** | 1 hr | `ci.yml` + `dependabot.yml` + `src/env.ts` + branch protection |

> Sprint 0.5 fires automatically before everything else if `.env` is committed to git.

After any sprint: type `re-audit` to re-run and see if Vibe Score improved.

---

## 🎯 What no other skill covers

- **Your app's LLM bill** — audits spend inside your codebase, not just your Claude usage
- **AI endpoint security** — OWASP LLM Top 10 applied to *your* endpoints
- **Git secrets emergency** — detects committed `.env` and triggers immediate rotation sprint
- **Vibe Score history** — track score changes across time, not just a one-time snapshot
- **Pre-deploy gate** — auto-triggers on "about to deploy" before problems reach production
- **Real generated code** — Sprint 4 outputs drop-in TypeScript files you can use immediately

---

## 📋 Requirements

- [Claude Code](https://claude.ai/code) (skill uses native `SessionStart` + `UserPromptSubmit` hooks)
- Node.js (for hook scripts)
- `gh` CLI — optional, enables branch protection check in Audit F

> Works across all your projects after one install — no per-project setup.

---

<div align="center">

MIT License &nbsp;·&nbsp; [Issues](https://github.com/PradiptaPutra/cold-shower/issues) &nbsp;·&nbsp; [PradiptaPutra](https://github.com/PradiptaPutra)

</div>

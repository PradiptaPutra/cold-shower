<div align="center">

<img src="assets/logo.png" width="180" alt="cold-shower"/>

# cold-shower

**The reality check your vibe-coded app didn't ask for.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Version](https://img.shields.io/badge/version-2.0-brightgreen)](#)
[![Install](https://img.shields.io/badge/install-curl%20%7C%20bash-orange)](#-install)

*One install. Three modes. Auto-triggers. No commands to memorize.*

</div>

---

## 🥶 Why this exists

> **65%** of vibe-coded production apps have at least one security vulnerability.
> **45%** of AI-generated code fails basic security checks.
> **2x** more secrets get leaked in AI-assisted commits vs human-written code.

You shipped fast. Claude helped. But nobody audited what came out.

**cold-shower does.**

---

## ⚡ Three modes, one skill

```
┌─────────────────────────────────────────────────────────────┐
│                        cold-shower                          │
├──────────────┬──────────────────────┬───────────────────────┤
│  🔍 AUDIT   │     📋 PLAN-GATE     │      🧠 RECALL        │
│             │                      │                        │
│ 6 parallel  │ Structured plan      │ Persistent second      │
│ audits →    │ BEFORE any code.     │ brain across all       │
│ Vibe Score  │ Blocks edits via     │ sessions. Replaces     │
│ 0–100       │ PreToolUse hook      │ Obsidian for devs.     │
│             │ until APPROVED.      │                        │
│ "audit me"  │ "implement X"        │ "remember this"        │
└─────────────┴──────────────────────┴───────────────────────-┘
```

---

## 🚿 Install

```bash
curl -fsSL https://raw.githubusercontent.com/PradiptaPutra/cold-shower/main/install.sh | bash
```

Done. Works on every project you open from that moment forward.

**What the installer wires:**

| Hook | Event | Does |
|------|-------|------|
| `activate.js` | `SessionStart` | Injects skill + loads brain memories |
| `trigger.js` | `UserPromptSubmit` | Detects intent, routes to correct mode |
| `gate.js` | `PreToolUse` | Blocks edits until plan approved |
| `capture.js` | `Stop` | Suggests memories to save at session end |

Idempotent — safe to re-run for updates.

---

## 🤖 You never type a command

| You say... | Mode | What happens |
|-----------|------|-------------|
| `"audit my codebase"` | 🔍 | Full 6-audit health check → Vibe Score |
| `"is this ready to deploy?"` | 🔍 | Pre-deploy gate scan |
| `"my LLM bill is insane"` | 🔍 | Cost audit → caching + routing fixes |
| `"app crashed on Product Hunt"` | 🔍 | Emergency mode → 5-min triage |
| `"re-audit"` | 🔍 | Re-runs, compares to last score |
| `"implement stripe payments"` | 📋 | Structured plan → blocks edits until APPROVED |
| `"fix this bug"` | 📋 | Plan first, then implementation |
| `"I committed my .env"` | 🔴 | Rotate secrets + scrub git history |
| `"remember this decision"` | 🧠 | Saves to brain with WHY + date |
| `"what did we decide about auth"` | 🧠 | Searches brain files |

---

## 📊 Audit output

```
╔══════════════════════════════════════════════════════════════╗
║  🚿 COLD SHOWER — myapp — 2026-06-29                        ║
╚══════════════════════════════════════════════════════════════╝

📊 Last score: 45/100 (D) on 2026-06-15 — let's see if it improved.

VIBE SCORE: 71/100  Grade: C  ▲ +26 from last audit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[A] LLM COSTS      — ✅ CLEAN
[B] AI SECURITY    — 1 issue  (no per-user token budget)
[C] CODE HEALTH    — 3 god files | 2.9% dup | 0 floating promises
[D] DEPENDENCIES   — 18 moderate CVEs (dev-only) | 0 critical
[E] PROD READINESS — ✅ CLEAN
[F] GIT/DEVOPS     — 2 issues (no Dependabot, no branch protection)

🔴 CRITICAL — None

🟡 HIGH
  [B] No per-user token budget — one user can drain your OpenAI key
  [C] AppShell.tsx 1768 lines — auth+routing+sidebar+chat all in one

🟢 QUICK WINS (15 min)
  Add .github/dependabot.yml
  Set branch protection on main
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score saved. History: 2 entries. Type re-audit after next sprint.
```

---

## 🔍 What each audit catches

| # | Audit | Key checks |
|---|-------|-----------|
| 🤑 **A — LLM Costs** | Missing semantic cache, hardcoded expensive model, no conversation history trim |
| 🔐 **B — AI Security** | Prompt injection in your endpoints, PII sent to OpenAI, no per-user budget, jailbreak surface |
| 🧹 **C — Code Health** | God files >500 lines, circular deps, duplicate logic >10%, floating promises |
| 📦 **D — Dependencies** | Unused packages (knip), CVEs (npm audit), archived libs, semantic duplicates |
| 🚀 **E — Prod Readiness** | N+1 queries, connection pool exhaustion, no rate limits, missing indexes |
| 🛡️ **F — Git/DevOps** | `.env` committed, unpinned Actions, no CI, no branch protection, workflow injection |

**Audit F alone is worth the install.** CVE-2025-30066 (March 2025): a floating `@v4` Action tag got rewritten — 23,000 repos exposed. Audit F catches this.

---

## 📋 Plan-gate — no more AI slop

Every time you say "implement X" or "fix X", cold-shower generates a structured plan **before writing a single line**:

```markdown
## Plan: Add Stripe payments

### Files to Touch
| File                  | Change        |
|-----------------------|---------------|
| src/checkout/Form.tsx | Add Stripe UI |
| src/api/payments.ts   | New endpoint  |

### Files NOT to Touch
| File                    | Reason                        |
|-------------------------|-------------------------------|
| src/auth/middleware.ts  | Fragile — race condition #234 |

### Pre-Mortem
"Most likely failure: webhook arrives before order row exists."

### Rollback
Revert 3 files. No migration needed.
```

→ **"Type `APPROVED` to proceed."**

The `PreToolUse` hook physically blocks all `Edit`/`Write` calls until you type APPROVED.
**No other Claude Code skill enforces planning at the hook level.**

---

## 🧠 Recall — second brain without Obsidian

| | Obsidian | cold-shower recall |
|--|---------|-------------------|
| Setup | Separate app + vault + MCP config | Included in `curl \| bash` |
| Capture | Manual note-taking | `"remember this"` or auto-suggested |
| Token cost | **~7M tokens** (full vault scan) | **~100 tokens** (grep) |
| Anti-regression | ❌ | ✅ Warns before touching fragile files |
| Survives context loss | Manually | Automatically |

```
~/.claude/brain/preferences.md              ← global preferences
~/.claude/projects/myapp/brain/
  decisions.md  ← "chose Supabase — Prisma 380KB kills edge cold start"
  avoid.md      ← "don't touch auth — race condition, fixed 3 times"
  bugs.md       ← "N+1 in getUserList, fixed 2026-05-01, regression-prone"
  context.md    ← domain knowledge, user base, compliance requirements
```

Before editing any file in `avoid.md`:
```
RECALL WARNING: auth/middleware.ts marked fragile (2026-05-01).
Reason: race condition in token refresh. Proceed carefully.
```

---

## 🏃 Fix sprints

Each sprint generates **working code files** — not a todo list.

| Sprint | Time | What gets generated |
|--------|------|-------------------|
| **0.5** 🔴 | 15 min | Secret rotation + `git filter-repo` history scrub |
| **1** | 30 min | Dep cleanup + `knip.json` |
| **2** | 2 hr | Rate limiting + async error handling |
| **3** | 2 hr | Connection pool fix + N+1 detection |
| **4** | 4 hr | `lib/llm-cache.ts` + `lib/llm-router.ts` + `lib/llm-client.ts` |
| **5** | 1 day | God component extraction playbook |
| **6** | 1 hr | `ci.yml` + `dependabot.yml` + `src/env.ts` + branch protection |

Sprint 0.5 fires **before everything else** if `.env` is committed. First action: rotate all secrets.

After any sprint → type `re-audit` → score compared to previous run automatically.

---

## 🆚 vs other top skills

| | 🪨 caveman (~78k ⭐) | 🐴 ponytail (~66k ⭐) | 🧊 cold-shower |
|--|-----|-----|-----|
| **What it changes** | How Claude *talks* | What Claude *builds* | What you *already built* |
| **When it acts** | During session | During coding | Retrospective + pre-deploy |
| **Hook enforcement** | ❌ soft | ❌ soft | ✅ PreToolUse hard block |
| **Generates fix code** | ❌ | ❌ | ✅ real TS/JS files |
| **Persistent memory** | ❌ | ❌ | ✅ survives sessions |
| **Score over time** | ❌ | ❌ | ✅ history + trend |
| **Multi-platform** | ✅ 30+ | ✅ 16+ | Claude Code |

> caveman fixes verbosity. ponytail fixes over-engineering. cold-shower fixes what's already in production.
> Install all three — they don't overlap.

---

## 🎯 Stats that make this real

- **GitClear 2024:** AI code averages 12.3% duplication — triple human baseline. cold-shower Audit C catches this.
- **Escape.tech:** 65% of 1,400 vibe-coded apps have a security issue. Audit B catches the common patterns.
- **GitGuardian 2026:** AI-assisted commits have 2x the secret leak rate vs human code. Audit F catches committed secrets.
- **CVE-2025-30066:** Floating `@v4` tag rewritten → 23,000 repos exposed. Audit F flags all unpinned Actions.
- **Veracode 2026:** 45% of AI code from 100+ LLMs fails security checks. Audits B + D cover the main failure modes.

---

## 📋 Requirements

- [Claude Code](https://claude.ai/code) — skill uses native hook system
- Node.js 18+
- `gh` CLI — optional, enables branch protection check in Audit F

---

## 🗺️ Roadmap

- [ ] Benchmarks: 15-repo study (Juice Shop, NodeGoat, real vibe-coded apps)
- [ ] Cursor `.cursorrules` port for wider reach
- [ ] `cold-shower diff` — scan only PR-changed files

---

<div align="center">

MIT &nbsp;·&nbsp; [Issues](https://github.com/PradiptaPutra/cold-shower/issues) &nbsp;·&nbsp; [PradiptaPutra](https://github.com/PradiptaPutra)

</div>

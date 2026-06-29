#!/usr/bin/env bash
set -euo pipefail

SKILLS_DIR="$HOME/.claude/skills"
HOOKS_DIR="$HOME/.claude/hooks"
SETTINGS="$HOME/.claude/settings.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing cold-shower..."

mkdir -p "$SKILLS_DIR/cold-shower"
mkdir -p "$HOOKS_DIR"

cp "$SCRIPT_DIR/skills/cold-shower/SKILL.md" "$SKILLS_DIR/cold-shower/SKILL.md"
echo "✓ Skill installed"

cp "$SCRIPT_DIR/hooks/activate.js" "$HOOKS_DIR/cold-shower-activate.js"
cp "$SCRIPT_DIR/hooks/trigger.js" "$HOOKS_DIR/cold-shower-trigger.js"
echo "✓ Hooks copied"

node - <<EOF
const fs = require('fs')
const settingsPath = '$SETTINGS'
const hooksDir = '$HOOKS_DIR'

let settings = {}
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) } catch {}
settings.hooks = settings.hooks || {}

settings.hooks.SessionStart = settings.hooks.SessionStart || []
const sessionHook = { hooks: [{ type: 'command', command: 'node "' + hooksDir + '/cold-shower-activate.js"', timeout: 5 }] }
if (!JSON.stringify(settings.hooks.SessionStart).includes('cold-shower-activate')) {
  settings.hooks.SessionStart.push(sessionHook)
}

settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit || []
const promptHook = { hooks: [{ type: 'command', command: 'node "' + hooksDir + '/cold-shower-trigger.js"', timeout: 10 }] }
if (!JSON.stringify(settings.hooks.UserPromptSubmit).includes('cold-shower-trigger')) {
  settings.hooks.UserPromptSubmit.push(promptHook)
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
console.log('✓ Hooks wired into settings.json')
EOF

echo ""
echo "cold-shower installed."
echo ""
echo "Usage:"
echo "  /cold-shower               — run manually"
echo "  Or just describe the problem — auto-activates on keywords like:"
echo "  'my LLM bill is too high', 'audit my codebase', 'app crashed under traffic'"

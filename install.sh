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

cp "$SCRIPT_DIR/hooks/gate.js" "$HOOKS_DIR/cold-shower-gate.js"
cp "$SCRIPT_DIR/hooks/capture.js" "$HOOKS_DIR/cold-shower-capture.js"
echo "✓ New hooks copied (gate + capture)"

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

settings.hooks.PreToolUse = settings.hooks.PreToolUse || []
const gateHook = { hooks: [{ type: 'command', command: 'node "' + hooksDir + '/cold-shower-gate.js"', timeout: 5 }] }
if (!JSON.stringify(settings.hooks.PreToolUse).includes('cold-shower-gate')) {
  settings.hooks.PreToolUse.push(gateHook)
}

settings.hooks.Stop = settings.hooks.Stop || []
const captureHook = { hooks: [{ type: 'command', command: 'node "' + hooksDir + '/cold-shower-capture.js"', timeout: 10 }] }
if (!JSON.stringify(settings.hooks.Stop).includes('cold-shower-capture')) {
  settings.hooks.Stop.push(captureHook)
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
console.log('✓ Hooks wired into settings.json')
EOF

mkdir -p "$HOME/.claude/brain"
echo "✓ Brain directories created"

echo ""
echo "cold-shower v2 installed."
echo ""
echo "Three modes — all auto-trigger:"
echo "  🔍 Audit:    'audit my codebase', 'about to deploy', 're-audit'"
echo "  📋 Plan:     'implement X', 'add X', 'fix X', 'refactor X'"
echo "  🧠 Recall:   'remember this', 'what did we decide', '/recall'"
echo ""
echo "Or call directly: /cold-shower"

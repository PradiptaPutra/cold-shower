#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const cmd = process.argv[2] || 'help'
const HOME = os.homedir()
const SKILLS_DIR = path.join(HOME, '.claude', 'skills', 'cold-shower')
const HOOKS_DIR = path.join(HOME, '.claude', 'hooks')
const BRAIN_DIR = path.join(HOME, '.claude', 'brain')
const SETTINGS = path.join(HOME, '.claude', 'settings.json')
const PKG_ROOT = path.join(__dirname, '..')

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

function wireHook(settings, event, hookFile, label) {
  settings.hooks = settings.hooks || {}
  settings.hooks[event] = settings.hooks[event] || []
  const command = `node "${path.join(HOOKS_DIR, hookFile)}"`
  const timeout = hookFile.includes('capture') ? 10 : 5
  const hook = { hooks: [{ type: 'command', command, timeout }] }
  if (!JSON.stringify(settings.hooks[event]).includes(label)) {
    settings.hooks[event].push(hook)
  }
}

function install() {
  console.log('\n🧊 Installing cold-shower v2...\n')

  copyFile(
    path.join(PKG_ROOT, 'skills', 'cold-shower', 'SKILL.md'),
    path.join(SKILLS_DIR, 'SKILL.md')
  )
  console.log('✓ Skill installed')

  const hooks = [
    ['activate.js', 'cold-shower-activate.js'],
    ['trigger.js',  'cold-shower-trigger.js'],
    ['gate.js',     'cold-shower-gate.js'],
    ['capture.js',  'cold-shower-capture.js'],
  ]
  hooks.forEach(([src, dest]) => copyFile(path.join(PKG_ROOT, 'hooks', src), path.join(HOOKS_DIR, dest)))
  console.log('✓ Hooks copied')

  let settings = {}
  try { settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) } catch {}
  wireHook(settings, 'SessionStart',     'cold-shower-activate.js', 'cold-shower-activate')
  wireHook(settings, 'UserPromptSubmit', 'cold-shower-trigger.js',  'cold-shower-trigger')
  wireHook(settings, 'PreToolUse',       'cold-shower-gate.js',     'cold-shower-gate')
  wireHook(settings, 'Stop',             'cold-shower-capture.js',  'cold-shower-capture')
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2))
  console.log('✓ Hooks wired into ~/.claude/settings.json')

  fs.mkdirSync(BRAIN_DIR, { recursive: true })
  console.log('✓ Brain directory created\n')

  console.log(`cold-shower v2 installed. Open a new Claude Code session to activate.

Three modes — all auto-trigger:
  🔍 Audit:   "audit my codebase", "about to deploy", "re-audit"
  📋 Plan:    "implement X", "add X", "fix X", "refactor X"
  🧠 Recall:  "remember this", "what did we decide", "/recall"
`)
}

function update() {
  console.log('\n🧊 Updating cold-shower...\n')
  copyFile(
    path.join(PKG_ROOT, 'skills', 'cold-shower', 'SKILL.md'),
    path.join(SKILLS_DIR, 'SKILL.md')
  )
  const hooks = [
    ['activate.js', 'cold-shower-activate.js'],
    ['trigger.js',  'cold-shower-trigger.js'],
    ['gate.js',     'cold-shower-gate.js'],
    ['capture.js',  'cold-shower-capture.js'],
  ]
  hooks.forEach(([src, dest]) => {
    try { copyFile(path.join(PKG_ROOT, 'hooks', src), path.join(HOOKS_DIR, dest)) } catch {}
  })
  console.log('✓ Updated. Restart Claude Code session to apply.')
}

function uninstall() {
  console.log('\n🧊 Uninstalling cold-shower...\n')
  try { fs.rmSync(SKILLS_DIR, { recursive: true }) } catch {}
  const hookDest = ['cold-shower-activate.js','cold-shower-trigger.js','cold-shower-gate.js','cold-shower-capture.js']
  hookDest.forEach(f => { try { fs.unlinkSync(path.join(HOOKS_DIR, f)) } catch {} })
  try {
    let s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'))
    ;['SessionStart','UserPromptSubmit','PreToolUse','Stop'].forEach(event => {
      if (s.hooks?.[event]) {
        s.hooks[event] = s.hooks[event].filter(h => !JSON.stringify(h).includes('cold-shower'))
      }
    })
    fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2))
  } catch {}
  console.log('✓ cold-shower removed.')
}

function help() {
  console.log(`
🧊 cold-shower v2 — Reality check for vibe-coded apps

Usage:
  npx cold-shower install     Install skill + wire all 4 hooks
  npx cold-shower update      Update to latest version
  npx cold-shower uninstall   Remove everything

github.com/PradiptaPutra/cold-shower
`)
}

const commands = { install, update, uninstall, help }
;(commands[cmd] || help)()

#!/usr/bin/env node
// SessionStart hook — injects cold-shower skill into every Claude Code session.
// User never needs to type /cold-shower — Claude already knows it and offers it.

const fs = require('fs')
const path = require('path')

const locations = [
  process.env.CLAUDE_PLUGIN_ROOT
    ? path.join(process.env.CLAUDE_PLUGIN_ROOT, 'skills', 'cold-shower', 'SKILL.md')
    : null,
  path.join(__dirname, '..', 'skills', 'cold-shower', 'SKILL.md'),
  path.join(process.env.HOME || '', '.claude', 'skills', 'cold-shower', 'SKILL.md'),
].filter(Boolean)

const skillPath = locations.find(p => { try { return fs.existsSync(p) } catch { return false } })
if (!skillPath) process.exit(0)

process.stdout.write(fs.readFileSync(skillPath, 'utf8'))

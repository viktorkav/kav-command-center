# Kav Command Center

An Obsidian plugin that serves as a **personal command center** for content creators. Built for managing a YouTube channel's day-to-day operations entirely within Obsidian: editorial pipeline, partnership tracking, daily tasks, analytics, and Gmail inbox — with data automation via [Claude Code](https://docs.anthropic.com/en/docs/claude-code) slash commands running in an integrated terminal.

## What it does

5 dashboard tabs rendered from vault data:

- **OVERVIEW** — metrics strip (context window %, YouTube subs/views), latest upload with thumbnail + stats, Gmail inbox brief, daily tasks with click-to-toggle
- **HOJE** (Today) — video of the day (D-1 publishing logic), daily tasks, pending partnership actions, next 7 days
- **CANAL** (Channel) — last published video, editorial pipeline (draft/published counts), pending cuts, top videos by retention
- **COMERCIAL** (Commercial) — partnership kanban summary, pending processes split by "waiting on me" vs "waiting on them", open drafts, next event
- **PAUTAS** (Content Ideas) — incubating ideas, active specs, plans in execution, short-term radar preview

A **skill bar** at the bottom provides one-click access to slash commands: plan today, inbox brief, draft partnership responses, refresh data, and more.

## Architecture

The plugin itself is **read-only** — it only parses markdown/JSON files and renders cards. Data is fetched by external slash commands (`~/.claude/commands/*.md`) that:

1. Query external sources (Gmail via MCP, YouTube API, Google Calendar)
2. Write structured JSON to the vault (`Analytics/_inbox.json`, `_socials.json`, etc.)
3. The plugin's file watcher detects changes and re-renders cards automatically

This means the plugin works without any API keys or network access — it just reads files.

### Auto-init flow

When the Command Center opens, it can automatically:
1. Open an integrated terminal (polyipseity Terminal plugin)
2. Start a CLI session
3. Capture the session ID for context tracking
4. Check data freshness (8h gate) and queue `/refresh-cards` if stale

## Prerequisites

- [Obsidian](https://obsidian.md) (desktop only)
- [Terminal plugin](https://github.com/polyipseity/obsidian-terminal) (for integrated terminal)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed
- Slash commands in `~/.claude/commands/` that write the expected JSON schemas (you'll need to create these for your own workflow)

## Setup

```bash
cd .obsidian/plugins/kav-command-center
npm install
npm run build
```

In Obsidian: Cmd+R to reload, enable "Kav Command Center" in Community Plugins, then Cmd+P > "Kav: Open Command Center".

## Development

```bash
npm run dev          # esbuild watch mode
npm test             # vitest unit tests
npm run test:watch   # vitest watch mode
npm run build        # production build
```

Use the [Hot Reload](https://github.com/pjeby/hot-reload) plugin for live development. Cmd+R forces a full reload.

## Vault structure

The plugin expects a specific folder layout (configurable in settings):

```
Vault/
├── Daily Notes/         # One note per day with ## Tarefas do Dia section
├── Roteiros/            # Video scripts in dated folders: "YYYY-MM-DD Title 🟢"
├── Parcerias/           # Partnership tracking
│   ├── processos-pendentes.md
│   ├── kanban-parcerias.md
│   └── drafts/
├── Analytics/           # YouTube Analytics CSVs + JSON data files
│   ├── _inbox.json      # Written by /update-inbox
│   ├── _socials.json    # Written by /update-socials
│   └── _context.json    # Written by /update-metrics
├── Producao/            # Editorial planning
│   ├── pautas/
│   ├── specs/
│   └── plans/
└── Eventos/             # Event coverage folders
```

## Key design decisions

- **Timestamps via Bash, never generated** — prevents incorrect timestamps from breaking freshness gates
- **Render mutex** — serialized async rendering prevents race-condition card duplication
- **File watcher with debounce** — 80ms debounce coalesces rapid events
- **Freshness gate (8h)** — skips data refresh if JSONs are recent enough

## License

MIT

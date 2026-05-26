# CLAUDE.md — Kav Command Center

Developer reference for the Kav Command Center Obsidian plugin. Read this before making changes.

---

## 1. Goal

Internal dashboard for a YouTube channel, built as a custom Obsidian plugin. 5 tabs (OVERVIEW + Hoje + Canal + Comercial + Pautas) showing: video publishing status, pending partnerships, daily tasks, latest upload, Gmail inbox summary, session context.

**Core principle:** the plugin is read-only + render-only. Data automation lives in external **slash commands** (`~/.claude/commands/*.md`) that run in the integrated terminal and write JSON to the vault. The plugin reads those JSONs and renders cards.

---

## 2. Architecture — data flow

```
Terminal (xterm.js) running CLI session
    |
    | skill bar paste OR auto-init paste
    v
Slash commands in ~/.claude/commands/*.md
  - /refresh-cards (orchestrator)
  - /update-inbox  (Gmail MCP -> JSON)
  - /update-socials (YouTube API -> JSON)
  - /plan-today    (Gmail+Calendar+Daily -> daily.md)
  - /update-metrics (Node script -> JSON)
    |
    | write
    v
JSONs in vault
  - Analytics/_inbox.json
  - Analytics/_socials.json
  - Analytics/_context.json
  - Daily Notes/{today}.md
    |
    | file watcher (vault.on modify/create)
    v
Plugin (this directory)
  - src/view.ts    -- ItemView + file watcher + render mutex
  - src/panels/*   -- overview/hoje/canal/comercial/pautas
  - src/data/*     -- parsers (JSON and markdown)
  - src/lib/*      -- helpers (terminal, dom, date)
  - src/skills/*   -- skill bar buttons
```

---

## 3. File structure

```
src/
├── view.ts              ItemView, tabs, file watcher, render mutex
├── settings.ts          KCCSettings + PluginSettingTab
├── lib/
│   ├── date.ts          todayISO, addDays, daysUntil, parseFolderDate
│   ├── dom.ts           makeFileLink, makeUrlLink
│   └── terminal.ts      findActiveTerminalTextarea, dispatchEnter,
│                         pasteAndEnter, ensureClaudeRunning
├── data/
│   ├── roteiros.ts      parse Roteiros/ folders + frontmatter
│   ├── daily.ts         parse Daily Notes/{today}.md + toggleDailyTask
│   ├── processos.ts     parse partnership processes markdown
│   ├── analytics.ts     parse YouTube Analytics CSVs (papaparse, PT-BR + EN)
│   ├── kanban.ts        parse Obsidian Kanban board
│   ├── pautas.ts        list Producao/{pautas,specs,plans}/
│   ├── eventos.ts       scan Eventos/ for upcoming events
│   ├── metrics.ts       loadContext, loadSocials, loadInbox
│   └── latestUpload.ts  cross-reference Roteiros + _socials.json latestVideo
├── panels/
│   ├── overview.ts      grid layout (metrics strip + upload/tasks + inbox)
│   ├── hoje.ts          video of the day, tasks, processes, next 7 days
│   ├── canal.ts         last published, pipeline, cuts, top videos
│   ├── comercial.ts     kanban, processes, drafts, next event
│   └── pautas.ts        list pautas/specs/plans + radar
└── skills/
    └── bar.ts           10 buttons + paste-to-terminal logic
test/
└── data/ + lib/         vitest unit tests
```

---

## 4. Key design decisions

| Decision | Why |
|---|---|
| **Individual throttles per command** | /update-inbox 1h, /update-socials 4h. Prevents waste on repeated opens. |
| **8h freshness gate** | Before dispatching /refresh-cards, plugin checks `lastPullISO` age. Skips if data is recent. |
| **Timestamps via Bash, never generated** | Always `date -u +%Y-%m-%dT%H:%M:%S.000Z` to prevent incorrect timestamps. |
| **getJsonAge rejects future timestamps** | Defense in depth against bad timestamp data. |
| **Session pin file** | `~/.claude/scripts/_kcc-active-session.txt`. Prevents context bar flip-flopping between concurrent sessions. |
| **Render mutex** | view.ts has renderInFlight + pendingRender. Prevents race-condition card duplication from concurrent async renders. |

---

## 5. Auto-init flow

Triggered in `view.ts` `onOpen()` when `settings.autoStartClaude` is enabled:

1. Check if terminal already open -> skip if so
2. Find Terminal plugin command (resilient to plugin-id variants)
3. Execute command to open terminal at vault root
4. Snapshot existing sessions
5. Paste start command into terminal
6. Poll for new .jsonl session file (max 30s)
7. Pin sessionId + refresh metrics
8. Check freshness gate -> optionally queue /refresh-cards

---

## 6. Code conventions

- **Type assertions**: use `"extension" in f` (file) or `"children" in f` (folder), then `as TFile` / `as TFolder`. No `as any`.
- **Reads**: `app.vault.cachedRead(file as TFile)` — not `read`.
- **Writes**: `app.vault.modify(file, newContent)` with exact regex match.
- **Click handlers**: `makeFileLink(el, app, path)` or `makeUrlLink(el, url)`.
- **File watcher**: never call `renderPanel()` directly from event handler — use `scheduleRender()` which debounces + serializes.

---

## 7. Testing

```bash
npm test            # vitest run
npm run test:watch  # vitest watch
npm run build       # esbuild production
npm run dev         # esbuild watch
```

Parsers in `src/data/` have unit tests in `test/data/`. View and panels are smoke-tested manually (Obsidian runtime dependency).

---

## 8. Customization

The plugin is designed around a specific vault structure (Roteiros/, Daily Notes/, Parcerias/, Analytics/, etc.) but folder names are configurable via settings. To adapt for your own vault:

1. Update folder names in plugin settings
2. Ensure your markdown files follow the expected formats (see parsers in `src/data/`)
3. Create your own slash commands in `~/.claude/commands/` that write the expected JSON schemas
4. Adapt the skill bar buttons in `src/skills/bar.ts`

import type { App, TFile } from "obsidian";
import { Notice } from "obsidian";
import type { KCCSettings } from "../settings";
import { loadContext, loadSocials, loadInbox } from "../data/metrics";
import { getLatestUpload } from "../data/latestUpload";
import { parseDaily, toggleDailyTask } from "../data/daily";
import { todayISO } from "../lib/date";
import { makeFileLink, makeUrlLink } from "../lib/dom";

// ─── Bar Card (Token Burn / Context) ──────────────────────────────────────────

function renderBarCard(
  container: HTMLElement,
  opts: {
    headerLabel: string;
    emptyMsg: string;
    percent?: number;
    current?: number;
    max?: number;
    projection?: number;
    lastPullAgo?: string;
  }
) {
  const card = container.createDiv({ cls: "kcc-bar-card" });

  // Corner bracket decorators
  card.createDiv({ cls: "kcc-corner kcc-corner-tl" });
  card.createDiv({ cls: "kcc-corner kcc-corner-tr" });
  card.createDiv({ cls: "kcc-corner kcc-corner-bl" });
  card.createDiv({ cls: "kcc-corner kcc-corner-br" });

  // Header row
  const hdr = card.createDiv({ cls: "kcc-bar-header" });
  hdr.createSpan({ cls: "kcc-bar-header-label", text: opts.headerLabel });
  if (opts.lastPullAgo) {
    hdr.createSpan({ cls: "kcc-bar-header-pull", text: `last pull ${opts.lastPullAgo} ago` });
  }

  if (opts.percent === undefined) {
    card.createDiv({ cls: "kcc-bar-empty kcc-muted", text: opts.emptyMsg });
    return;
  }

  // Main row: percent | bar | numbers
  const body = card.createDiv({ cls: "kcc-bar-body" });

  // Big percent
  const pct = opts.percent ?? 0;
  body.createDiv({ cls: "kcc-bar-pct", text: `${Math.round(pct)}%` });

  // Bar section
  const barWrap = body.createDiv({ cls: "kcc-bar-wrap" });
  const barTrack = barWrap.createDiv({ cls: "kcc-bar-track" });
  const fill = barTrack.createDiv({ cls: "kcc-bar-fill" });
  fill.style.width = `${Math.min(pct, 100)}%`;

  // Tick marks
  const ticks = barWrap.createDiv({ cls: "kcc-bar-ticks" });
  const max = opts.max ?? 1;
  ["0", formatShort(max * 0.25), formatShort(max * 0.5), formatShort(max * 0.75), formatShort(max)].forEach((t) => {
    ticks.createSpan({ text: t });
  });

  // Right numbers
  const nums = body.createDiv({ cls: "kcc-bar-nums" });
  nums.createDiv({ text: `${formatShort(opts.current ?? 0)} / ${formatShort(max)}` });
  if (opts.projection !== undefined) {
    nums.createDiv({ cls: "kcc-muted", text: `→ ${formatShort(opts.projection)} proj` });
  }
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

// ─── Social Cards ─────────────────────────────────────────────────────────────

interface SocialCardDef {
  label: string;
  cls: string;
  value: number | undefined;
  delta: number | undefined;
  icon: string;
}

function renderSocialGrid(
  container: HTMLElement,
  cards: SocialCardDef[]
) {
  const grid = container.createDiv({ cls: "kcc-social-grid" });
  for (const c of cards) {
    const card = grid.createDiv({ cls: `kcc-social-card ${c.cls}` });

    // Live dot
    card.createDiv({ cls: "kcc-live-dot" });

    // Label
    card.createDiv({ cls: "kcc-social-label", text: c.label });

    // Number row
    const numRow = card.createDiv({ cls: "kcc-social-num-row" });
    if (c.value !== undefined) {
      numRow.createSpan({ cls: "kcc-social-value", text: formatShort(c.value) });
      if (c.delta !== undefined) {
        const sign = c.delta >= 0 ? "▲" : "▼";
        const deltaCls = c.delta >= 0 ? "kcc-delta-up" : "kcc-delta-down";
        numRow.createSpan({ cls: `kcc-social-delta ${deltaCls}`, text: ` ${sign} ${Math.abs(c.delta).toFixed(1)}%` });
      }
    } else {
      numRow.createSpan({ cls: "kcc-social-value kcc-muted", text: "—" });
    }

    // Brand icon (text placeholder — no logo rendering)
    card.createDiv({ cls: "kcc-social-icon", text: c.icon });
  }
}

// ─── Inbox Card ────────────────────────────────────────────────────────────────

async function renderInboxCard(container: HTMLElement, app: App) {
  const inbox = await loadInbox(app);
  const card = container.createDiv({ cls: "kcc-card kcc-inbox-card" });

  if (!inbox || inbox.threads.length === 0) {
    const hdr = card.createDiv({ cls: "kcc-inbox-header" });
    hdr.createSpan({ cls: "kcc-inbox-title", text: "INBOX BRIEF" });
    card.createDiv({ cls: "kcc-muted", text: "Sem dados. Rodar /update-inbox." });
    return;
  }

  const hdr = card.createDiv({ cls: "kcc-inbox-header" });
  hdr.createSpan({
    cls: "kcc-inbox-title",
    text: `INBOX BRIEF · ${inbox.threads.length} AGUARDANDO ATENÇÃO`,
  });
  if (inbox.lastPullAgo) {
    hdr.createSpan({ cls: "kcc-bar-header-pull", text: `last pull ${inbox.lastPullAgo}` });
  }

  const list = card.createDiv({ cls: "kcc-inbox-list" });
  const top = inbox.threads.slice(0, 5);
  for (const t of top) {
    const row = list.createDiv({ cls: "kcc-inbox-row kcc-clickable" });
    makeUrlLink(row, t.url);

    const left = row.createDiv({ cls: "kcc-inbox-left" });
    left.createSpan({ cls: "kcc-inbox-sender", text: t.sender });
    left.createSpan({ cls: "kcc-inbox-subject kcc-muted", text: ` · ${t.subject}` });

    row.createSpan({ cls: "kcc-inbox-age kcc-muted", text: formatAgeShort(t.ageHours) });
  }
}

function formatAgeShort(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

// ─── Latest Upload ─────────────────────────────────────────────────────────────

function formatAge(hours: number): string {
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.round(hours / 24);
  return `${days}d atrás`;
}

// ─── Daily Tasks ──────────────────────────────────────────────────────────────

interface DailyTaskItem {
  text: string;
  done: boolean;
}

function summarizeTask(text: string, maxWords: number = 6): string {
  // Strip common markdown emphasis to avoid wasting word-budget on ** or _.
  const clean = text.replace(/\*\*|__|`/g, "").trim();
  const words = clean.split(/\s+/);
  if (words.length <= maxWords) return clean;
  return words.slice(0, maxWords).join(" ") + "…";
}

function renderDailyTasks(
  container: HTMLElement,
  tasks: DailyTaskItem[],
  app: App,
  dailyFilePath: string,
  refresh: () => void
) {
  const card = container.createDiv({ cls: "kcc-card kcc-tasks-card" });

  const hdr = card.createDiv({ cls: "kcc-tasks-header" });
  hdr.createSpan({ cls: "kcc-tasks-title", text: "TAREFAS DO DIA" });
  const done = tasks.filter((t) => t.done).length;
  hdr.createSpan({ cls: "kcc-tasks-count kcc-muted", text: `${done}/${tasks.length}` });

  // Mini progress bar
  const prog = card.createDiv({ cls: "kcc-progress-bar-wrap" });
  const progFill = prog.createDiv({ cls: "kcc-progress-bar" });
  const pct = tasks.length > 0 ? (done / tasks.length) * 100 : 0;
  progFill.style.width = `${pct}%`;

  if (tasks.length === 0) {
    card.createDiv({ cls: "kcc-muted", text: "Sem tarefas na daily de hoje." });
    return;
  }

  // One per line. Summarized to ≤6 words for at-a-glance scanning.
  // Hover shows full task text via title attribute.
  const list = card.createDiv({ cls: "kcc-tasks-list" });
  for (const t of tasks) {
    const row = list.createDiv({ cls: "kcc-task-row kcc-clickable" });
    row.title = t.text; // full text on hover

    const cb = row.createSpan({ cls: "kcc-task-cb", text: t.done ? "☑" : "☐" });
    const lbl = row.createSpan({
      cls: "kcc-task-label" + (t.done ? " kcc-task-done" : ""),
      text: summarizeTask(t.text),
    });

    const taskText = t.text;
    row.onclick = async (e) => {
      e.preventDefault();
      const ok = await toggleDailyTask(app, dailyFilePath, taskText);
      if (ok) {
        refresh(); // debounced via scheduleRender — file watcher might fire too, but mutex serializes
      } else {
        new Notice(`Tarefa não encontrada: ${taskText.slice(0, 50)}`);
      }
    };

    // Avoid TS unused warning
    void cb;
    void lbl;
  }
}

// ─── Main renderOverview ──────────────────────────────────────────────────────

export async function renderOverview(
  container: HTMLElement,
  app: App,
  settings: KCCSettings,
  refresh: () => void
) {
  container.empty();

  // ── Grid layout per Victor's spec:
  //   Row 1: STRIP (1w × 1h, full width)
  //   Row 2: UPLOAD (1w × 1h, full width)
  //   Row 3: INBOX (0.5w × 1h)    |  TASKS (0.5w × 2h, spans rows 3-4)
  //   Row 4: SCHEDULE (0.5w × 1h) |  TASKS continues
  const grid = container.createDiv({ cls: "kcc-overview-grid" });

  const [ctx, socials, upload] = await Promise.all([
    loadContext(app),
    loadSocials(app),
    getLatestUpload(app, settings),
  ]);
  renderMetricsStrip(grid, app, ctx, socials);
  renderLatestUploadCard(grid, app, upload);
  await renderInboxCard(grid, app);

  const today = todayISO();
  const dailyPath = `${settings.dailyNotesFolder}/${today}.md`;
  const dailyFile = app.vault.getAbstractFileByPath(dailyPath);
  let tasks: DailyTaskItem[] = [];
  if (dailyFile && "extension" in dailyFile) {
    try {
      const content = await app.vault.cachedRead(dailyFile as TFile);
      const parsed = parseDaily(content);
      tasks = parsed.tasks;
    } catch {
      // leave empty
    }
  }
  renderDailyTasks(grid, tasks, app, dailyPath, refresh);
}

// ─── Compact Metrics Strip ────────────────────────────────────────────────────

function renderMetricsStrip(
  container: HTMLElement,
  _app: App,
  ctx: Awaited<ReturnType<typeof loadContext>>,
  socials: Awaited<ReturnType<typeof loadSocials>>
) {
  const strip = container.createDiv({ cls: "kcc-metrics-strip" });

  // ── CONTEXT ──
  const ctxItem = strip.createDiv({ cls: "kcc-metric-item" });
  ctxItem.createSpan({ cls: "kcc-metric-label", text: "CTX" });
  if (ctx) {
    const pct = Math.round(ctx.percent ?? 0);
    ctxItem.createSpan({ cls: "kcc-metric-value", text: `${pct}%` });
    const sess = ctx.sessionId && ctx.sessionId !== "—" ? ctx.sessionId.slice(0, 6) : "—";
    ctxItem.createSpan({ cls: "kcc-metric-sub kcc-muted", text: `sess:${sess}` });
  } else {
    ctxItem.createSpan({ cls: "kcc-metric-value kcc-muted", text: "—" });
  }

  strip.createDiv({ cls: "kcc-metric-divider" });

  // ── YT SUBS ──
  const subsItem = strip.createDiv({ cls: "kcc-metric-item" });
  subsItem.createSpan({ cls: "kcc-metric-label", text: "YT SUBS" });
  if (socials?.youtubeSubs?.value !== undefined) {
    subsItem.createSpan({
      cls: "kcc-metric-value",
      text: formatShort(socials.youtubeSubs.value),
    });
    if (socials.youtubeSubs.delta !== undefined && socials.youtubeSubs.delta !== null) {
      const d = socials.youtubeSubs.delta;
      subsItem.createSpan({
        cls: `kcc-metric-delta ${d >= 0 ? "up" : "down"}`,
        text: `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}%`,
      });
    }
  } else {
    subsItem.createSpan({ cls: "kcc-metric-value kcc-muted", text: "—" });
  }

  strip.createDiv({ cls: "kcc-metric-divider" });

  // ── YT VIEWS ──
  const viewsItem = strip.createDiv({ cls: "kcc-metric-item" });
  viewsItem.createSpan({ cls: "kcc-metric-label", text: "YT VIEWS" });
  if (socials?.youtubeViews?.value !== undefined) {
    viewsItem.createSpan({
      cls: "kcc-metric-value",
      text: formatShort(socials.youtubeViews.value),
    });
    if (socials.youtubeViews.delta !== undefined && socials.youtubeViews.delta !== null) {
      const d = socials.youtubeViews.delta;
      viewsItem.createSpan({
        cls: `kcc-metric-delta ${d >= 0 ? "up" : "down"}`,
        text: `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}%`,
      });
    }
  } else {
    viewsItem.createSpan({ cls: "kcc-metric-value kcc-muted", text: "—" });
  }

  // (Latest upload moved to its own card below the strip — too much info
  // for a single inline item to convey clearly.)
}

// ─── Latest Upload Card (with thumbnail) ──────────────────────────────────────

function renderLatestUploadCard(
  container: HTMLElement,
  app: App,
  upload: Awaited<ReturnType<typeof getLatestUpload>>
) {
  const card = container.createDiv({ cls: "kcc-card kcc-upload-card" });
  card.createEl("h3", { text: "▶ ÚLTIMO VÍDEO PUBLICADO" });

  if (!upload) {
    card.createDiv({
      cls: "kcc-muted",
      text: "Sem vídeo encontrado. Rodar /update-socials.",
    });
    return;
  }

  const body = card.createDiv({ cls: "kcc-upload-body" });

  // ── Thumbnail ──
  if (upload.thumbnailUrl) {
    const thumbWrap = body.createDiv({ cls: "kcc-upload-thumb-wrap" });
    const img = thumbWrap.createEl("img", {
      cls: "kcc-upload-thumb",
      attr: { src: upload.thumbnailUrl, alt: upload.title },
    });
    if (upload.mainFile) {
      makeFileLink(img, app, upload.mainFile);
    } else if (upload.url) {
      makeUrlLink(img, upload.url);
    }
  }

  // ── Info column ──
  const info = body.createDiv({ cls: "kcc-upload-info" });

  const titleEl = info.createDiv({ cls: "kcc-upload-title", text: upload.title });
  if (upload.mainFile) {
    makeFileLink(titleEl, app, upload.mainFile);
  } else if (upload.url) {
    makeUrlLink(titleEl, upload.url);
  }

  // Date line
  const dateLine: string[] = [];
  if (upload.publishedAt) {
    const [y, m, d] = upload.publishedAt.split("-");
    dateLine.push(`Publicado em ${d}/${m}/${y}`);
  }
  dateLine.push(`${formatAge(upload.ageHours)}`);
  info.createDiv({ cls: "kcc-upload-meta kcc-muted", text: dateLine.join(" · ") });

  // Stats grid (views / likes / comments / like%)
  const stats = info.createDiv({ cls: "kcc-upload-stats-grid" });

  function addStat(label: string, value: string) {
    const cell = stats.createDiv({ cls: "kcc-upload-stat" });
    cell.createDiv({ cls: "kcc-upload-stat-val", text: value });
    cell.createDiv({ cls: "kcc-upload-stat-lbl kcc-muted", text: label });
  }

  if (upload.views !== undefined) {
    addStat("views", upload.views.toLocaleString("pt-BR"));
  }
  if (upload.likes !== undefined) {
    addStat("likes", upload.likes.toLocaleString("pt-BR"));
  }
  if (upload.comments !== undefined) {
    addStat("comments", upload.comments.toLocaleString("pt-BR"));
  }
  if (upload.likes !== undefined && upload.views !== undefined && upload.views > 0) {
    const ratio = (upload.likes / upload.views) * 100;
    addStat("like%", `${ratio.toFixed(2)}%`);
  }
}

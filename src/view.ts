import { ItemView, WorkspaceLeaf, TAbstractFile } from "obsidian";
import type KavCommandCenter from "../main";
import { renderOverview } from "./panels/overview";
import { renderHoje } from "./panels/hoje";
import { renderCanal } from "./panels/canal";
import { renderComercial } from "./panels/comercial";
import { renderPautas } from "./panels/pautas";
import { renderSkillBar } from "./skills/bar";
import { ensureClaudeRunning } from "./lib/terminal";
import { todayISO } from "./lib/date";

export const VIEW_TYPE_KCC = "kav-command-center-view";

type TabId = "overview" | "hoje" | "canal" | "comercial" | "pautas";

const TAB_LABELS: Record<TabId, string> = {
  overview: "OVERVIEW",
  hoje: "HOJE",
  canal: "CANAL",
  comercial: "COMERCIAL",
  pautas: "PAUTAS",
};

export class KavCommandCenterView extends ItemView {
  private activeTab: TabId;
  private panelContainer!: HTMLElement;
  private plugin: KavCommandCenter;

  // Mutex pattern to prevent concurrent renderPanel() calls from racing.
  // When file watcher + checkbox click + tab switch fire near-simultaneously,
  // the async render functions interleave and produce duplicated cards.
  private renderInFlight: Promise<void> | null = null;
  private pendingRender = false;
  private renderDebounceTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: KavCommandCenter) {
    super(leaf);
    this.plugin = plugin;
    this.activeTab = plugin.settings.defaultTab;
  }

  getViewType() { return VIEW_TYPE_KCC; }
  getDisplayText() { return "Kav Command Center"; }
  getIcon() { return "layout-dashboard"; }

  async onOpen() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("kcc-root");

    // Header: KAV OS wordmark + right controls
    const header = root.createDiv({ cls: "kcc-header" });
    header.createDiv({ cls: "kcc-wordmark", text: "KAV OS" });
    const headerRight = header.createDiv({ cls: "kcc-header-right" });
    headerRight.createSpan({ cls: "kcc-live-pill", text: "LIVE" });
    const refreshBtn = headerRight.createEl("button", {
      cls: "kcc-header-refresh",
      text: "↻",
    });
    refreshBtn.onclick = () => this.renderPanel();

    // Tab bar — 5 tabs with bracket-on-active style
    const tabBar = root.createDiv({ cls: "kcc-tab-bar" });
    (Object.keys(TAB_LABELS) as TabId[]).forEach((id) => {
      const btn = tabBar.createEl("button", {
        cls: `kcc-tab ${id === this.activeTab ? "is-active" : ""}`,
        text: TAB_LABELS[id],
      });
      btn.dataset.tabId = id;
      btn.onclick = () => this.switchTab(id);
    });

    // Panel container
    this.panelContainer = root.createDiv({ cls: "kcc-panel-container" });

    // Skill bar (12 buttons + refresh) — visible on all tabs
    const skillBar = root.createDiv({ cls: "kcc-skill-bar" });
    renderSkillBar(skillBar, this.app, () => this.renderPanel());

    // File watcher: any data JSON or daily note change → re-render panel.
    // Debounced + serialized to prevent race-condition card duplication when
    // multiple events fire in quick succession (e.g. checkbox click + file watcher).
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (this.isWatchedPath(file.path)) this.scheduleRender();
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (this.isWatchedPath(file.path)) this.scheduleRender();
      })
    );

    await this.renderPanel();

    // Auto-init Claude in integrated terminal at vault root (if no terminal up).
    // Fire-and-forget — doesn't block UI. After pin+metrics refresh, re-renders
    // the panel so the CONTEXT bar shows the fresh session immediately.
    if (this.plugin.settings.autoStartClaude) {
      ensureClaudeRunning(
        this.app,
        this.plugin.settings.claudeStartCommand,
        {
          autoUpdateInboxOnStart: this.plugin.settings.autoUpdateInboxOnStart,
          autoPlanTodayIfEmpty: this.plugin.settings.autoPlanTodayIfEmpty,
          dailyNotesFolder: this.plugin.settings.dailyNotesFolder,
          onReady: () => this.renderPanel(),
        }
      ).catch((e) => console.error("[KCC] autoStartClaude failed:", e));
    }
  }

  async switchTab(id: TabId) {
    this.activeTab = id;
    this.containerEl.querySelectorAll(".kcc-tab").forEach((el) => {
      el.classList.toggle("is-active", (el as HTMLElement).dataset.tabId === id);
    });
    await this.renderPanel();
  }

  /** Debounced + serialized re-render. Coalesces rapid-fire trigger events
   *  (file watcher + checkbox click + tab switch) into a single render. */
  scheduleRender(delayMs: number = 80) {
    if (this.renderDebounceTimer !== null) {
      window.clearTimeout(this.renderDebounceTimer);
    }
    this.renderDebounceTimer = window.setTimeout(() => {
      this.renderDebounceTimer = null;
      this.renderPanel();
    }, delayMs);
  }

  /** Serial-guarded renderPanel. If another render is in flight, the new one
   *  queues for after — preventing concurrent renders from duplicating cards
   *  via interleaved async appends to the same container. */
  renderPanel(): Promise<void> {
    if (this.renderInFlight) {
      this.pendingRender = true;
      return this.renderInFlight;
    }
    this.renderInFlight = this._doRender().finally(() => {
      this.renderInFlight = null;
      if (this.pendingRender) {
        this.pendingRender = false;
        this.renderPanel();
      }
    });
    return this.renderInFlight;
  }

  private async _doRender() {
    this.panelContainer.empty();
    const refresh = () => this.scheduleRender();
    switch (this.activeTab) {
      case "overview":
        await renderOverview(this.panelContainer, this.app, this.plugin.settings, refresh);
        break;
      case "hoje":
        await renderHoje(this.panelContainer, this.app, this.plugin.settings, refresh);
        break;
      case "canal":
        await renderCanal(this.panelContainer, this.app, this.plugin.settings);
        break;
      case "comercial":
        await renderComercial(this.panelContainer, this.app, this.plugin.settings);
        break;
      case "pautas":
        await renderPautas(this.panelContainer, this.app, this.plugin.settings);
        break;
    }
  }

  async onClose() {}

  private isWatchedPath(p: string): boolean {
    const dnf = this.plugin.settings.dailyNotesFolder;
    const today = todayISO();
    return (
      p === "Analytics/_inbox.json"
      || p === "Analytics/_context.json"
      || p === "Analytics/_socials.json"
      || p === `${dnf}/${today}.md`
    );
  }
}

import type { App, TFolder, TFile } from "obsidian";
import type { KCCSettings } from "../settings";
import { listRoteiros } from "../data/roteiros";
import { parseAnalyticsCSV, topByRetention, formatDuration } from "../data/analytics";
import { getLatestUpload } from "../data/latestUpload";
import { makeFileLink, makeUrlLink } from "../lib/dom";

export async function renderCanal(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  container.empty();
  await renderLastPublished(container, app, settings);
  await renderPipeline(container, app, settings);
  await renderCortesPendentes(container, app);
  await renderTopVideos(container, app, settings);
}

async function renderLastPublished(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: "Último publicado" });

  const upload = await getLatestUpload(app, settings);
  if (!upload) {
    card.createEl("p", {
      cls: "kcc-muted",
      text: "Sem dados do YouTube. Rodar /update-socials.",
    });
    return;
  }

  const titleEl = card.createEl("p", { text: `🟢 ${upload.title}` });
  if (upload.mainFile) {
    makeFileLink(titleEl, app, upload.mainFile);
  } else if (upload.url) {
    makeUrlLink(titleEl, upload.url);
  }

  const statsParts: string[] = [];
  if (upload.views !== undefined) statsParts.push(`${upload.views.toLocaleString("pt-BR")} views`);
  if (upload.likes !== undefined) statsParts.push(`${upload.likes.toLocaleString("pt-BR")} likes`);
  if (upload.comments !== undefined) statsParts.push(`${upload.comments} comments`);
  statsParts.push(formatAge(upload.ageHours));

  card.createEl("p", { cls: "kcc-muted", text: statsParts.join(" · ") });
}

function formatAge(hours: number): string {
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.round(hours / 24);
  return `${days}d atrás`;
}

async function renderPipeline(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: "Pipeline editorial" });

  const roteiros = await listRoteiros(app, settings.roteirosFolder);
  const yellow = roteiros.filter((r) => r.status === "rascunho");
  const green30d = roteiros
    .filter((r) => r.status === "postado")
    .filter((r) => withinLast30Days(r.date));

  card.createEl("p", { text: `🟡 em rascunho (${yellow.length}):` });
  if (yellow.length > 0) {
    const ul = card.createEl("ul");
    for (const r of yellow.slice(0, 5)) {
      const li = ul.createEl("li");
      const span = li.createEl("span", { text: `${r.date} · ${r.title}` });
      if (r.mainFile) makeFileLink(span, app, r.mainFile);
    }
    if (yellow.length > 5) {
      card.createEl("p", { cls: "kcc-muted", text: `…e mais ${yellow.length - 5}` });
    }
  }

  card.createEl("p", { text: `🟢 publicados últimos 30d: ${green30d.length}` });
}

function withinLast30Days(iso: string): boolean {
  const now = new Date();
  const dt = new Date(iso + "T00:00:00Z");
  const diffDays = Math.round((now.getTime() - dt.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays <= 30;
}

async function renderCortesPendentes(container: HTMLElement, app: App) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: "Cortes pendentes" });

  const statusFile = app.vault.getAbstractFileByPath("Cortes/_status.md");
  if (!statusFile || !("extension" in statusFile)) {
    card.createEl("p", {
      cls: "kcc-muted",
      text: "Sem snapshot. Rodar /cortes-status pra atualizar.",
    });
    return;
  }

  const content = await app.vault.cachedRead(statusFile as TFile);
  const m = content.match(/lives pendentes:\s*(\d+)/i);
  if (m) {
    card.createEl("p", { text: `${m[1]} live(s) sem cortes publicados.` });
  } else {
    card.createEl("p", {
      cls: "kcc-muted",
      text: "Snapshot presente — abrir Cortes/_status.md.",
    });
  }
}

async function renderTopVideos(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: "Top 5 vídeos (por retenção)" });

  const folder = app.vault.getAbstractFileByPath(settings.analyticsFolder);
  if (!folder || !("children" in folder)) {
    card.createEl("p", {
      cls: "kcc-muted",
      text: `Pasta ${settings.analyticsFolder}/ não encontrada.`,
    });
    return;
  }

  const csvFile = (folder as TFolder).children.find(
    (c) =>
      "extension" in c &&
      (c as TFile).extension === "csv" &&
      c.name !== "video_titles.csv"
  );

  if (!csvFile) {
    card.createEl("p", { cls: "kcc-muted", text: `Sem CSVs em ${settings.analyticsFolder}/.` });
    return;
  }

  const content = await app.vault.cachedRead(csvFile as TFile);
  const rows = parseAnalyticsCSV(content);

  if (rows.length === 0) {
    card.createEl("p", { cls: "kcc-muted", text: "CSV sem dados válidos." });
    return;
  }

  const top = topByRetention(rows, 5);
  const ol = card.createEl("ol");
  for (const r of top) {
    ol.createEl("li", {
      text: `${r.title} · APV ${formatDuration(r.avgViewDurationSec)} · CTR ${r.ctrPct.toFixed(1)}%`,
    });
  }
}

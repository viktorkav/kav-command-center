import type { App, TFile } from "obsidian";
import { Notice } from "obsidian";
import type { KCCSettings } from "../settings";
import { todayISO, addDays, daysUntil } from "../lib/date";
import { listRoteiros, findVideoOfDay, findUpcoming } from "../data/roteiros";
import { parseDaily, toggleDailyTask } from "../data/daily";
import { parseProcessos } from "../data/processos";
import { makeFileLink, makeUrlLink } from "../lib/dom";

export async function renderHoje(
  container: HTMLElement,
  app: App,
  settings: KCCSettings,
  refresh: () => void
) {
  container.empty();
  const today = todayISO();
  const tomorrow = addDays(today, 1);

  const header = container.createDiv({ cls: "kcc-card" });
  header.createEl("h3", { text: `Hoje · ${formatDateBR(today)}` });

  await renderVideoOfDay(container, app, settings, tomorrow);
  await renderTasks(container, app, settings, today, refresh);
  await renderProcessos(container, app, settings);
  await renderUpcoming(container, app, settings, today);
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

async function renderVideoOfDay(
  container: HTMLElement,
  app: App,
  settings: KCCSettings,
  publishDate: string
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: `📹 Vídeo do dia (publica ${formatDateBR(publishDate)})` });

  const roteiros = await listRoteiros(app, settings.roteirosFolder);
  const found = findVideoOfDay(roteiros, publishDate);

  if (!found) {
    card.createEl("p", { cls: "kcc-warn", text: "Nenhum roteiro encontrado pra essa data." });
    return;
  }

  const statusEmoji = found.status === "postado" ? "🟢" : "🟡";
  // Clickable title — opens the roteiro file
  const titleEl = card.createEl("p", { text: `${statusEmoji} ${found.title} · status: ${found.status}` });
  if (found.mainFile) {
    makeFileLink(titleEl, app, found.mainFile);
  }
}

async function renderTasks(
  container: HTMLElement,
  app: App,
  settings: KCCSettings,
  today: string,
  refresh: () => void
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: `✅ Tarefas (daily ${today})` });

  const path = `${settings.dailyNotesFolder}/${today}.md`;
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || !("extension" in file)) {
    card.createEl("p", { cls: "kcc-muted", text: `Daily note não encontrada em ${path}` });
    return;
  }

  const content = await app.vault.cachedRead(file as TFile);
  const parsed = parseDaily(content);

  if (parsed.tasks.length === 0) {
    card.createEl("p", { cls: "kcc-muted", text: "Sem tarefas listadas." });
    return;
  }

  const ul = card.createEl("ul");
  for (const t of parsed.tasks) {
    const li = ul.createEl("li");
    li.style.cursor = "pointer";
    li.addClass("kcc-clickable");

    li.createEl("span", { text: t.done ? "☑ " : "☐ " });
    const txt = li.createEl("span", { text: t.text });
    if (t.done) txt.style.textDecoration = "line-through";

    const taskText = t.text;
    li.onclick = async (e) => {
      e.preventDefault();
      const ok = await toggleDailyTask(app, path, taskText);
      if (ok) {
        refresh();
      } else {
        new Notice(`Tarefa não encontrada: ${taskText}`);
      }
    };
  }
}

async function renderProcessos(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: "📌 Processos pendentes (top 5)" });

  const path = `${settings.parceriasFolder}/processos-pendentes.md`;
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || !("extension" in file)) {
    card.createEl("p", { cls: "kcc-muted", text: `Arquivo não encontrado: ${path}` });
    return;
  }

  const content = await app.vault.cachedRead(file as TFile);
  const parsed = parseProcessos(content);
  const top = parsed.aguardandoMinhaAcao.slice(0, 5);

  if (top.length === 0) {
    card.createEl("p", { cls: "kcc-muted", text: "Nada aguardando sua ação." });
    return;
  }

  const ul = card.createEl("ul");
  for (const p of top) {
    const li = ul.createEl("li");

    // If there's a threadUrl, make the whole <li> clickable
    if (p.threadUrl) {
      makeUrlLink(li, p.threadUrl);
    }

    li.createEl("strong", { text: p.partner });
    li.createEl("span", { text: ` · ${p.action}` });
    if (p.threadUrl) {
      li.createEl("span", { text: " " });
      const a = li.createEl("a", { text: "[thread]", href: p.threadUrl });
      a.setAttr("target", "_blank");
    }
  }
}

async function renderUpcoming(
  container: HTMLElement,
  app: App,
  settings: KCCSettings,
  today: string
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: "📅 Próximos 7 dias" });

  const roteiros = await listRoteiros(app, settings.roteirosFolder);
  const upcoming = findUpcoming(roteiros, today, 7);

  if (upcoming.length === 0) {
    card.createEl("p", { cls: "kcc-muted", text: "Nada agendado nos próximos 7 dias." });
    return;
  }

  const ul = card.createEl("ul");
  for (const r of upcoming) {
    const d = daysUntil(today, r.date);
    const label = d === 0 ? "hoje" : d === 1 ? "amanhã" : `+${d}d`;
    const li = ul.createEl("li");
    const span = li.createEl("span", { text: `${formatDateBR(r.date)} (${label}) · ${r.title}` });
    // Make clickable if there's a main file
    if (r.mainFile) {
      makeFileLink(span, app, r.mainFile);
    }
  }
}

import type { App, TFolder, TFile } from "obsidian";
import type { KCCSettings } from "../settings";
import { parseProcessos } from "../data/processos";
import { parseKanban } from "../data/kanban";
import { nextEvento } from "../data/eventos";
import { makeFileLink } from "../lib/dom";

export async function renderComercial(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  container.empty();
  await renderKanban(container, app, settings);
  await renderProcessos(container, app, settings);
  await renderDrafts(container, app, settings);
  await renderProxEvento(container, app, settings);
}

async function renderKanban(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: "Kanban (resumo)" });

  const path = `${settings.parceriasFolder}/kanban-parcerias.md`;
  const f = app.vault.getAbstractFileByPath(path);
  if (!f || !("extension" in f)) {
    card.createEl("p", { cls: "kcc-muted", text: `Não encontrado: ${path}` });
    return;
  }

  const content = await app.vault.cachedRead(f as TFile);
  const parsed = parseKanban(content);

  if (parsed.columns.length === 0) {
    card.createEl("p", { cls: "kcc-muted", text: "Nenhuma coluna no kanban." });
    return;
  }

  const ul = card.createEl("ul");
  for (const col of parsed.columns) {
    ul.createEl("li", { text: `${col.name}: ${col.count}` });
  }
}

async function renderProcessos(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  const path = `${settings.parceriasFolder}/processos-pendentes.md`;
  const f = app.vault.getAbstractFileByPath(path);
  if (!f || !("extension" in f)) {
    const card = container.createDiv({ cls: "kcc-card" });
    card.createEl("h3", { text: "Aguardando minha ação" });
    card.createEl("p", { cls: "kcc-muted", text: `Não encontrado: ${path}` });
    return;
  }

  const content = await app.vault.cachedRead(f as TFile);
  const parsed = parseProcessos(content);

  // Card: Aguardando minha ação
  const c1 = container.createDiv({ cls: "kcc-card" });
  c1.createEl("h3", { text: "Aguardando minha ação" });
  if (parsed.aguardandoMinhaAcao.length === 0) {
    c1.createEl("p", { cls: "kcc-ok", text: "Nada pendente." });
  } else {
    const ul = c1.createEl("ul");
    for (const p of parsed.aguardandoMinhaAcao) {
      const li = ul.createEl("li");
      li.createEl("strong", { text: p.partner });
      li.createEl("span", { text: ` · ${p.action}` });
      if (p.threadUrl) {
        const a = li.createEl("a", { text: " [thread]", href: p.threadUrl });
        a.setAttr("target", "_blank");
      }
    }
  }

  // Card: Aguardando terceiros
  const c2 = container.createDiv({ cls: "kcc-card" });
  c2.createEl("h3", { text: "Aguardando terceiros" });
  if (parsed.aguardandoTerceiros.length === 0) {
    c2.createEl("p", { cls: "kcc-muted", text: "Vazio." });
  } else {
    const ul = c2.createEl("ul");
    for (const p of parsed.aguardandoTerceiros) {
      const li = ul.createEl("li");
      li.createEl("strong", { text: p.partner });
      li.createEl("span", { text: ` · ${p.action}` });
      if (p.threadUrl) {
        const a = li.createEl("a", { text: " [thread]", href: p.threadUrl });
        a.setAttr("target", "_blank");
      }
    }
  }
}

async function renderDrafts(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: "Drafts abertos" });

  const draftsPath = `${settings.parceriasFolder}/drafts`;
  const f = app.vault.getAbstractFileByPath(draftsPath);
  if (!f || !("children" in f)) {
    card.createEl("p", { cls: "kcc-muted", text: "Pasta drafts/ não encontrada." });
    return;
  }

  const drafts = (f as TFolder).children.filter(
    (c) => "extension" in c && (c as TFile).extension === "md"
  );
  card.createEl("p", {
    text: `${drafts.length} arquivo(s) em ${settings.parceriasFolder}/drafts/`,
  });

  if (drafts.length > 0) {
    const ul = card.createEl("ul");
    for (const d of drafts) {
      const li = ul.createEl("li");
      const span = li.createEl("span", { text: d.name });
      makeFileLink(span, app, (d as TFile).path);
    }
  }
}

async function renderProxEvento(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: "Próximo evento" });

  const ev = await nextEvento(app, settings.eventosFolder);
  if (!ev) {
    card.createEl("p", { cls: "kcc-muted", text: "Nenhum evento agendado." });
    return;
  }

  const daysLabel = ev.daysAway === 0
    ? "hoje"
    : ev.daysAway === 1
    ? "amanhã"
    : `em ${ev.daysAway}d`;

  const evNameEl = card.createEl("p", { text: `${ev.name} · ${ev.date ?? "data indefinida"} · ${daysLabel}` });
  makeFileLink(evNameEl, app, ev.folderPath);

  const folderPath = ev.folderPath;
  const link = card.createEl("a", { text: "abrir pasta", href: "#" });
  link.onclick = (e) => {
    e.preventDefault();
    app.workspace.openLinkText(folderPath, "");
  };
}

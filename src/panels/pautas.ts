import type { App } from "obsidian";
import type { KCCSettings } from "../settings";
import { listPautas, type PautaFile } from "../data/pautas";
import { makeFileLink } from "../lib/dom";

export async function renderPautas(
  container: HTMLElement,
  app: App,
  settings: KCCSettings
) {
  container.empty();
  const data = await listPautas(app, settings.producaoFolder);

  renderList(container, "💡 Em incubação", data.pautas, app);
  renderList(container, "📋 Specs ativos", data.specs, app);
  renderList(container, "🛠 Plans em execução", data.plans, app);

  if (data.radarPreview) {
    const card = container.createDiv({ cls: "kcc-card" });
    card.createEl("h3", { text: "Radar curto prazo (preview)" });
    const pre = card.createEl("pre");
    pre.style.fontSize = "12px";
    pre.style.whiteSpace = "pre-wrap";
    pre.setText(data.radarPreview);
  }
}

function renderList(
  container: HTMLElement,
  title: string,
  files: PautaFile[],
  app: App
) {
  const card = container.createDiv({ cls: "kcc-card" });
  card.createEl("h3", { text: title });

  if (files.length === 0) {
    card.createEl("p", { cls: "kcc-muted", text: "Vazio." });
    return;
  }

  const ul = card.createEl("ul");
  for (const f of files) {
    const li = ul.createEl("li");
    const span = li.createEl("span", { text: f.name });
    makeFileLink(span, app, f.path);
  }
}

import type { App, TFolder, TFile } from "obsidian";
import { parseFolderDate, daysUntil, todayISO } from "../lib/date";

export interface EventoSummary {
  name: string;
  folderPath: string;
  date: string | null;
  daysAway: number | null;
}

export async function nextEvento(
  app: App,
  eventosFolder: string
): Promise<EventoSummary | null> {
  const root = app.vault.getAbstractFileByPath(eventosFolder);
  if (!root || !("children" in root)) return null;

  const today = todayISO();
  const candidates: EventoSummary[] = [];

  for (const child of (root as TFolder).children) {
    if (!("children" in child)) continue;

    // Try exact YYYY-MM-DD prefix first, then probe plano-campanha, then year-only fallback
    const date =
      parseFolderDate(child.name) ??
      (await resolveEventDate(app, child as TFolder));
    if (!date) continue;

    const days = daysUntil(today, date);
    if (days < 0) continue;

    candidates.push({
      name: child.name,
      folderPath: child.path,
      date,
      daysAway: days,
    });
  }

  candidates.sort((a, b) => (a.daysAway ?? 0) - (b.daysAway ?? 0));
  return candidates[0] ?? null;
}

// Probe the event folder for a plano-campanha-*.md file and extract the event
// start date from its frontmatter. Falls back to YYYY-12-31 (year extracted
// from folder name) so the event stays "future" within its own year rather than
// defaulting to YYYY-01-01 which would put it in the past mid-year.
async function resolveEventDate(
  app: App,
  folder: TFolder
): Promise<string | null> {
  // 1. Look for a plano-campanha-*.md file inside the folder
  const planFile = folder.children.find(
    (f) =>
      "extension" in f &&
      f.name.startsWith("plano-campanha-") &&
      (f as TFile).extension === "md"
  ) as TFile | undefined;

  if (planFile) {
    const content = await app.vault.cachedRead(planFile);

    // Extract janela-evento directly from raw frontmatter body — parseFrontmatter's
    // key regex ([a-zA-Z_]+) doesn't handle hyphens, so we scan the raw text instead.
    const fmBlock = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmBlock) {
      const body = fmBlock[1];

      // janela-evento: "2026-06-05 a 2026-06-11 (Los Angeles)" — extract first date
      const janelaLine = body.match(/^janela-evento:\s*(.+)$/m);
      if (janelaLine) {
        const dateMatch = janelaLine[1].match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) return dateMatch[1];
      }

      // Fallback: use the `data` field if it's a valid YYYY-MM-DD
      const dataLine = body.match(/^data:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
      if (dataLine) return dataLine[1];
    }
  }

  // 2. Final fallback: year from folder name + -12-31 (keeps event future within year)
  const yearMatch = folder.name.match(/(\d{4})/);
  if (!yearMatch) return null;
  return `${yearMatch[1]}-12-31`;
}

import type { App, TFile } from "obsidian";

export interface DailyTask {
  text: string;
  done: boolean;
}

export interface ParsedDaily {
  tasks: DailyTask[];
  notes: string;
}

export function parseDaily(md: string): ParsedDaily {
  return {
    tasks: extractTasks(md),
    notes: extractSection(md, /^##\s+📝\s+Notas do Dia\s*$/m),
  };
}

// ─── extractTasks ─────────────────────────────────────────────────────────────
// Collects all checkbox lines within ## ✅ Tarefas do Dia, including those
// nested inside ### sub-headers (real vault format as of 2026-05-17).

function extractTasks(md: string): DailyTask[] {
  const section = extractSection(md, /^##\s+✅\s+Tarefas do Dia\s*$/m);
  const lines = section.split("\n");
  const out: DailyTask[] = [];
  const re = /^[\-\*]\s+\[([ xX])\]\s+(.+)$/;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    out.push({ text: m[2].trim(), done: m[1].toLowerCase() === "x" });
  }
  return out;
}

// ─── toggleDailyTask ──────────────────────────────────────────────────────────
// Toggles a checkbox in the daily note file for the given task text.
// Returns true if the line was found and modified, false otherwise.

export async function toggleDailyTask(
  app: App,
  dailyFilePath: string,
  taskText: string
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(dailyFilePath);
  if (!file || !("extension" in file)) return false;
  const content = await app.vault.read(file as TFile);
  const escapedText = taskText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lineRe = new RegExp(`^([\\-\\*])\\s+\\[([\\sxX])\\]\\s+${escapedText}$`, "m");
  const match = content.match(lineRe);
  if (!match) return false;
  const wasDone = match[2].toLowerCase() === "x";
  const newCheckbox = wasDone ? "[ ]" : "[x]";
  const newLine = `${match[1]} ${newCheckbox} ${taskText}`;
  const newContent = content.replace(lineRe, newLine);
  await app.vault.modify(file as TFile, newContent);
  return true;
}

// ─── extractSection ───────────────────────────────────────────────────────────
// Extracts the content between a matched ## header and the next ## header.
// ### sub-headers inside the section are kept (tasks within them are collected).

function extractSection(md: string, headerRe: RegExp): string {
  const lines = md.split("\n");
  let inSection = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (headerRe.test(line)) {
      inSection = true;
      continue;
    }
    // Stop at the next H2 (## ...) — but NOT at H3+ (### ...)
    if (inSection && /^##\s/.test(line)) break;
    if (inSection) collected.push(line);
  }
  return collected.join("\n").trim();
}

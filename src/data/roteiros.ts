import { parseFolderDate, addDays } from "../lib/date";
// listRoteiros uses Obsidian types — imported as type-only to avoid runtime error in tests
import type { App, TFolder, TFile } from "obsidian";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoteiroStatus = "postado" | "rascunho";

export interface ParsedFolder {
  date: string;
  title: string;
  status: RoteiroStatus;
}

export interface Frontmatter {
  tags?: string[];
  status?: string;
  data?: string;
  [k: string]: unknown;
}

export interface RoteiroEntry extends ParsedFolder {
  folderPath: string;
  mainFile: string | null;
}

// ─── parseFolderName ──────────────────────────────────────────────────────────
// Handles both orderings documented in CLAUDE.md:
//   "2026-05-12 Titulo Curto 🟢"   (emoji at end)
//   "2026-04-05 🟢 Gemma 26B"      (emoji after date)

export function parseFolderName(name: string): ParsedFolder | null {
  const date = parseFolderDate(name);
  if (!date) return null;

  const hasGreen = name.includes("🟢");
  const status: RoteiroStatus = hasGreen ? "postado" : "rascunho";

  const title = name
    .replace(date, "")
    .replace("🟢", "")
    .replace("🟡", "")
    .replace(/\s+/g, " ")
    .trim();

  return { date, title, status };
}

// ─── parseFrontmatter ─────────────────────────────────────────────────────────
// Minimal YAML parser — handles:
//   tags: [a, b]            (inline array)
//   tags:\n  - a\n  - b    (block list)
//   key: value              (scalar)

export function parseFrontmatter(md: string): Frontmatter {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const body = m[1];
  const out: Frontmatter = {};

  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Scalar or inline array: "key: value" or "key: [a, b]"
    const inline = line.match(/^([a-zA-Z_]+):\s*(.+)$/);
    if (inline) {
      const key = inline[1];
      const val: string = inline[2].trim();
      if (val.startsWith("[") && val.endsWith("]")) {
        const arr = val
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        (out as Record<string, unknown>)[key] = arr;
      } else {
        (out as Record<string, unknown>)[key] = val;
      }
      i++;
      continue;
    }

    // Block list:  "key:\n  - item"
    const listHeader = line.match(/^([a-zA-Z_]+):\s*$/);
    if (listHeader) {
      const key = listHeader[1];
      const items: string[] = [];
      i++;
      while (i < lines.length && lines[i].startsWith("  - ")) {
        items.push(lines[i].slice(4).trim());
        i++;
      }
      (out as Record<string, unknown>)[key] = items;
      continue;
    }

    i++;
  }

  return out;
}

// ─── Vault helpers (integration — NOT unit tested) ───────────────────────────

export async function listRoteiros(
  app: App,
  roteirosFolderName: string
): Promise<RoteiroEntry[]> {
  const root = app.vault.getAbstractFileByPath(roteirosFolderName);
  if (!root || !("children" in root)) return [];
  const folder = root as TFolder;
  const out: RoteiroEntry[] = [];
  for (const child of folder.children) {
    if (!("children" in child)) continue;
    const parsed = parseFolderName(child.name);
    if (!parsed) continue;
    const main = (child as TFolder).children.find(
      (f) =>
        "extension" in f &&
        f.name.startsWith("r-") &&
        (f as TFile).extension === "md"
    );
    out.push({
      ...parsed,
      folderPath: child.path,
      mainFile: main ? (main as TFile).path : null,
    });
  }
  return out;
}

// ─── Pure query helpers ───────────────────────────────────────────────────────

export function findVideoOfDay(
  roteiros: RoteiroEntry[],
  publishDate: string
): RoteiroEntry | null {
  return roteiros.find((r) => r.date === publishDate) ?? null;
}

export function findUpcoming(
  roteiros: RoteiroEntry[],
  fromISO: string,
  daysAhead: number
): RoteiroEntry[] {
  const ceiling = addDays(fromISO, daysAhead);
  return roteiros
    .filter((r) => r.date >= fromISO && r.date <= ceiling)
    .sort((a, b) => a.date.localeCompare(b.date));
}

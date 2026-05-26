import type { App, TFile } from "obsidian";

export interface BarMetric {
  percent: number;       // 0-100
  current: number;
  max: number;
  projection?: number;
  lastPullAgo?: string;  // e.g. "21m"
}

export interface SocialMetric {
  value: number;
  delta?: number;        // percent change
}

export interface SocialBundle {
  youtubeSubs?: SocialMetric;
  youtubeViews?: SocialMetric;
  instagram?: SocialMetric;
  tiktok?: SocialMetric;
}

async function readJsonFile<T>(app: App, path: string): Promise<T | null> {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f || !("extension" in f)) return null;
  try {
    const raw = await app.vault.cachedRead(f as TFile);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function loadTokenBurn(app: App): Promise<BarMetric | null> {
  return readJsonFile<BarMetric>(app, "Analytics/_token-burn.json");
}

export async function loadContext(app: App): Promise<BarMetric | null> {
  return readJsonFile<BarMetric>(app, "Analytics/_context.json");
}

export async function loadSocials(app: App): Promise<SocialBundle | null> {
  return readJsonFile<SocialBundle>(app, "Analytics/_socials.json");
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

export interface InboxThread {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  ageHours: number;
  url: string;
  labels?: string[];
}

export interface InboxBundle {
  threads: InboxThread[];
  totalThreadsSearched?: number;
  lastPullISO?: string;
  lastPullAgo?: string;
}

export async function loadInbox(app: App): Promise<InboxBundle | null> {
  return readJsonFile<InboxBundle>(app, "Analytics/_inbox.json");
}

import type { App, TFolder, TFile } from "obsidian";
import type { KCCSettings } from "../settings";
import { listRoteiros } from "./roteiros";
import { parseAnalyticsCSV } from "./analytics";
import { todayISO, daysUntil } from "../lib/date";
import { loadSocials } from "./metrics";

export interface LatestUpload {
  title: string;
  mainFile: string | null;
  views?: number;
  likes?: number;
  comments?: number;
  ageHours: number;
  url?: string;
  thumbnailUrl?: string;
  publishedAt?: string; // YYYY-MM-DD
}

export async function getLatestUpload(
  app: App,
  settings: KCCSettings
): Promise<LatestUpload | null> {
  const today = todayISO();
  const roteiros = await listRoteiros(app, settings.roteirosFolder);

  // Filter: must be postado AND date <= today (exclude scheduled future)
  const published = roteiros
    .filter((r) => r.status === "postado" && r.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));

  // --- YouTube cross-check via _socials.json latestVideo ---
  const socials = await loadSocials(app);
  const ytVideo = (socials as (typeof socials & { latestVideo?: { id: string; title: string; publishedAt: string; url: string; views: number; likes: number; comments: number; thumbnailUrl?: string } }) | null)?.latestVideo;

  if (ytVideo) {
    const ytTitleLower = ytVideo.title.toLowerCase();
    // Try to match against a local roteiro
    const matched = published.find(
      (r) =>
        r.title.toLowerCase().includes(ytTitleLower) ||
        ytTitleLower.includes(r.title.toLowerCase())
    );

    // Calculate age from publishedAt ISO string
    const pubDate = ytVideo.publishedAt.slice(0, 10); // "YYYY-MM-DD"
    const ageDays = daysUntil(pubDate, today);
    const ageHours = ageDays * 24;

    const common = {
      views: ytVideo.views,
      likes: ytVideo.likes,
      comments: ytVideo.comments,
      ageHours,
      url: ytVideo.url,
      thumbnailUrl: ytVideo.thumbnailUrl,
      publishedAt: pubDate,
    };
    if (matched) {
      return {
        title: matched.title,
        mainFile: matched.mainFile,
        ...common,
      };
    } else {
      return {
        title: ytVideo.title,
        mainFile: null,
        ...common,
      };
    }
  }

  // --- No YouTube data: fall back to local roteiros + CSV stats ---
  if (published.length === 0) return null;

  const latest = published[0];
  const ageDays = daysUntil(latest.date, today);
  const ageHours = ageDays * 24;

  // Try to find stats from Analytics CSV
  const folder = app.vault.getAbstractFileByPath(settings.analyticsFolder);
  if (!folder || !("children" in folder)) {
    return { title: latest.title, mainFile: latest.mainFile, ageHours };
  }

  const csvFile = (folder as TFolder).children.find(
    (c) =>
      "extension" in c &&
      (c as TFile).extension === "csv" &&
      c.name !== "video_titles.csv"
  );

  if (!csvFile) {
    return { title: latest.title, mainFile: latest.mainFile, ageHours };
  }

  try {
    const content = await app.vault.cachedRead(csvFile as TFile);
    const rows = parseAnalyticsCSV(content);
    const titleLower = latest.title.toLowerCase();
    const match = rows.find(
      (r) =>
        r.title.toLowerCase().includes(titleLower) ||
        titleLower.includes(r.title.toLowerCase())
    );

    if (match) {
      return {
        title: latest.title,
        mainFile: latest.mainFile,
        views: match.views,
        ageHours,
      };
    }
  } catch {
    // fall through
  }

  return { title: latest.title, mainFile: latest.mainFile, ageHours };
}

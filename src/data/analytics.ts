import Papa from "papaparse";

export interface AnalyticsRow {
  title: string;
  views: number;
  avgViewDurationSec: number;
  ctrPct: number;
}

// Real vault uses PT-BR column names from YouTube Analytics export.
// Fallback chain covers both PT-BR and EN exports.
function pickField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return "";
}

export function parseAnalyticsCSV(csv: string): AnalyticsRow[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .map((row) => {
      // PT-BR: "Título do vídeo" is the human title; "Conteúdo" is the video ID — NOT a title
      // EN: "Video" holds the title directly
      const title =
        pickField(row, "Título do vídeo", "Video", "Content", "Title") ||
        "";

      const viewsRaw = pickField(row, "Visualizações", "Views");
      const durationRaw = pickField(
        row,
        "Duração média da visualização",
        "Average view duration",
        "Duração média"
      );
      const ctrRaw = pickField(
        row,
        "Taxa de cliques de impressões (%)",
        "Impressions click-through rate (%)",
        "CTR (%)",
        "CTR",
        "Taxa de cliques"
      );

      return {
        title,
        views: parseInt(viewsRaw.replace(/[^\d]/g, ""), 10) || 0,
        avgViewDurationSec: parseDuration(durationRaw || "0:00"),
        ctrPct: parseFloat(ctrRaw) || 0,
      };
    })
    // Filter out the aggregate "Total" row (empty title) and any blank-title rows
    .filter((row) => row.title !== "" && row.title !== "Total");
}

function parseDuration(s: string): number {
  const parts = s.split(":").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function topByRetention(rows: AnalyticsRow[], n: number): AnalyticsRow[] {
  return [...rows]
    .sort((a, b) => b.avgViewDurationSec - a.avgViewDurationSec)
    .slice(0, n);
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

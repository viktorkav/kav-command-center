import { describe, it, expect } from "vitest";
import { parseAnalyticsCSV, topByRetention, formatDuration } from "../../src/data/analytics";

// Real vault CSV uses PT-BR headers:
//   Conteúdo, Título do vídeo, Visualizações, Duração média da visualização,
//   Taxa de cliques de impressões (%)
// The real CSV also contains a "Total" row as the first data row — parser must skip it.
// This sample mirrors real headers exactly.
const SAMPLE_CSV_PTBR = `Conteúdo,Título do vídeo,Horário de publicação do vídeo,Duração,Duração média da visualização,Porcentagem visualizada média (%),CPM (USD),RPM (USD),Visualizações,Taxa de cliques de impressões (%)
Total,,,,0:04:52,25.45,1.78,1.664,1005597,4.68
abc123,Gemma E2B,,482,0:04:32,,,,18500,9.4
xyz456,Slay the Spire,,619,0:05:12,,,,12300,11.0
def789,Home Lab,,572,0:03:45,,,,8700,7.2`;

// Also verify the plan's assumed EN headers still work (fallback chain)
const SAMPLE_CSV_EN = `Video,Views,Average view duration,Impressions click-through rate (%)
Gemma E2B,18500,4:32,9.4
Slay the Spire,12300,5:12,11.0
Home Lab,8700,3:45,7.2`;

describe("parseAnalyticsCSV (PT-BR headers)", () => {
  it("parses rows into typed objects using PT-BR columns", () => {
    const r = parseAnalyticsCSV(SAMPLE_CSV_PTBR);
    // Total row must be skipped
    expect(r).toHaveLength(3);
    expect(r[0].title).toBe("Gemma E2B");
    expect(r[0].views).toBe(18500);
    expect(r[0].avgViewDurationSec).toBe(4 * 60 + 32);
    expect(r[0].ctrPct).toBeCloseTo(9.4);
  });

  it("skips the Total aggregate row", () => {
    const r = parseAnalyticsCSV(SAMPLE_CSV_PTBR);
    const titles = r.map((row) => row.title);
    expect(titles).not.toContain("Total");
    expect(titles).not.toContain("");
  });

  it("falls back to 0 for missing numeric fields", () => {
    const csv = `Conteúdo,Título do vídeo,Visualizações,Duração média da visualização,Taxa de cliques de impressões (%)
abc,Missing Vals,,0:00,`;
    const r = parseAnalyticsCSV(csv);
    expect(r[0].views).toBe(0);
    expect(r[0].ctrPct).toBe(0);
  });
});

describe("parseAnalyticsCSV (EN headers fallback)", () => {
  it("parses EN-header CSV using fallback chain", () => {
    const r = parseAnalyticsCSV(SAMPLE_CSV_EN);
    expect(r).toHaveLength(3);
    expect(r[0].title).toBe("Gemma E2B");
    expect(r[0].views).toBe(18500);
    expect(r[0].avgViewDurationSec).toBe(4 * 60 + 32);
    expect(r[0].ctrPct).toBeCloseTo(9.4);
  });
});

describe("topByRetention", () => {
  it("returns top N sorted by avg view duration desc", () => {
    const rows = parseAnalyticsCSV(SAMPLE_CSV_EN);
    const top = topByRetention(rows, 2);
    expect(top.map((r) => r.title)).toEqual(["Slay the Spire", "Gemma E2B"]);
  });

  it("returns all rows when n >= rows.length", () => {
    const rows = parseAnalyticsCSV(SAMPLE_CSV_EN);
    expect(topByRetention(rows, 10)).toHaveLength(3);
  });
});

describe("formatDuration", () => {
  it("formats seconds as M:SS", () => {
    expect(formatDuration(272)).toBe("4:32");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(9)).toBe("0:09");
  });
});

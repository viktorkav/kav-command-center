import { describe, it, expect } from "vitest";
import {
  parseFolderName,
  parseFrontmatter,
  findVideoOfDay,
  findUpcoming,
  type RoteiroStatus,
  type RoteiroEntry,
} from "../../src/data/roteiros";

// ─── Task 2.2: parseFolderName ────────────────────────────────────────────────

describe("parseFolderName", () => {
  it("parses emoji-at-end format 🟢 (postado)", () => {
    // Real vault format: "2026-05-12 Diablo-Review 🟢"
    const r = parseFolderName("2026-05-12 Diablo-Review 🟢");
    expect(r).toEqual({
      date: "2026-05-12",
      title: "Diablo-Review",
      status: "postado" as RoteiroStatus,
    });
  });

  it("parses emoji-at-end format 🟡 (rascunho)", () => {
    // Real vault format: "2026-05-18 GTR 3 Pro 🟡"
    const r = parseFolderName("2026-05-18 GTR 3 Pro 🟡");
    expect(r).toEqual({
      date: "2026-05-18",
      title: "GTR 3 Pro",
      status: "rascunho" as RoteiroStatus,
    });
  });

  it("parses emoji-in-middle format 🟡 (rascunho) — CLAUDE.md documents this variant", () => {
    // CLAUDE.md example: "2026-04-05 🟢 Gemma 26B"
    const r = parseFolderName("2026-04-05 🟡 Titulo Curto");
    expect(r).toEqual({
      date: "2026-04-05",
      title: "Titulo Curto",
      status: "rascunho" as RoteiroStatus,
    });
  });

  it("parses emoji-in-middle format 🟢 (postado)", () => {
    const r = parseFolderName("2026-04-05 🟢 Gemma 26B");
    expect(r).toEqual({
      date: "2026-04-05",
      title: "Gemma 26B",
      status: "postado" as RoteiroStatus,
    });
  });

  it("returns null when no date prefix", () => {
    expect(parseFolderName("sem data 🟢")).toBeNull();
  });

  it("defaults to rascunho when no emoji", () => {
    const r = parseFolderName("2026-05-18 Titulo");
    expect(r?.status).toBe("rascunho");
  });
});

// ─── Task 2.2: parseFrontmatter ───────────────────────────────────────────────

describe("parseFrontmatter", () => {
  it("extracts tags, status, data", () => {
    const md = `---
tags:
  - roteiro
  - ai
status: postado
data: 2026-05-12
---

# conteúdo`;
    const fm = parseFrontmatter(md);
    expect(fm).toEqual({
      tags: ["roteiro", "ai"],
      status: "postado",
      data: "2026-05-12",
    });
  });

  it("returns empty object when no frontmatter", () => {
    expect(parseFrontmatter("# só conteúdo")).toEqual({});
  });

  it("handles single-line tags array", () => {
    const md = `---
tags: [roteiro, ai]
---`;
    expect(parseFrontmatter(md).tags).toEqual(["roteiro", "ai"]);
  });
});

// ─── Task 2.3: findVideoOfDay + findUpcoming ──────────────────────────────────

const sample: RoteiroEntry[] = [
  {
    date: "2026-05-12",
    title: "Diablo-Review",
    status: "postado",
    folderPath: "Roteiros/2026-05-12 Diablo-Review 🟢",
    mainFile: "Roteiros/2026-05-12 Diablo-Review 🟢/r-diablo-review.md",
  },
  {
    date: "2026-05-18",
    title: "GTR 3 Pro",
    status: "rascunho",
    folderPath: "Roteiros/2026-05-18 GTR 3 Pro 🟡",
    mainFile: null,
  },
  {
    date: "2026-05-25",
    title: "MiniMax",
    status: "rascunho",
    folderPath: "Roteiros/2026-05-25 MiniMax 🟡",
    mainFile: null,
  },
];

describe("findVideoOfDay", () => {
  it("returns roteiro with matching date", () => {
    expect(findVideoOfDay(sample, "2026-05-18")?.title).toBe("GTR 3 Pro");
  });
  it("returns null when no match", () => {
    expect(findVideoOfDay(sample, "2026-05-19")).toBeNull();
  });
});

describe("findUpcoming", () => {
  it("returns roteiros within window sorted by date", () => {
    const r = findUpcoming(sample, "2026-05-17", 7);
    expect(r.map((x) => x.date)).toEqual(["2026-05-18"]);
  });
  it("respects upper bound inclusive (8 days from 05-17 = 05-25)", () => {
    const r = findUpcoming(sample, "2026-05-17", 8);
    expect(r.map((x) => x.date)).toEqual(["2026-05-18", "2026-05-25"]);
  });
});

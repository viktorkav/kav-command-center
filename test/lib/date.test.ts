import { describe, it, expect } from "vitest";
import { todayISO, addDays, parseFolderDate, daysUntil } from "../../src/lib/date";

describe("date helpers", () => {
  it("todayISO returns YYYY-MM-DD for now", () => {
    const r = todayISO();
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("addDays adds N days", () => {
    expect(addDays("2026-05-17", 1)).toBe("2026-05-18");
    expect(addDays("2026-05-31", 1)).toBe("2026-06-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("parseFolderDate extracts YYYY-MM-DD prefix", () => {
    expect(parseFolderDate("2026-05-18 Titulo Curto 🟢")).toBe("2026-05-18");
    expect(parseFolderDate("2026-05-18 🟡 Outro Titulo")).toBe("2026-05-18");
    expect(parseFolderDate("sem data")).toBeNull();
  });

  it("daysUntil returns diff in days", () => {
    expect(daysUntil("2026-05-17", "2026-05-17")).toBe(0);
    expect(daysUntil("2026-05-17", "2026-05-20")).toBe(3);
    expect(daysUntil("2026-05-20", "2026-05-17")).toBe(-3);
  });
});

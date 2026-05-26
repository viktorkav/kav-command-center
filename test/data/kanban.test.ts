import { describe, it, expect } from "vitest";
import { parseKanban } from "../../src/data/kanban";

// Obsidian Kanban plugin board format:
//   - kanban-plugin: board (not "basic")
//   - Columns: "## Emoji ColumnName"
//   - Items: "- [ ] CardText" (unchecked) or "- [x] CardText" (checked)
//   - Footer: "%% kanban:settings ..." — parser must stop here

const SAMPLE = `---

kanban-plugin: board

---

## 📥 Proposta Recebida

- [ ] Brand Alpha
- [ ] Brand Beta


## 🤝 Em Negociacao

- [ ] Partner One
- [ ] Partner Two
- [ ] Partner Three


## ✅ Fechado

- [ ] MegaCorp


## 🎬 Em Producao

- [ ] CoolBrand — video gravado


## 💰 Pago

- [x] OldPartner — $500 via PayPal


## ❌ Recusado / Encerrado

- [ ] PastDeal — encerrado


%% kanban:settings
\`\`\`
{"kanban-plugin":"board"}
\`\`\`
%%`;

describe("parseKanban", () => {
  it("returns counts per column with emoji-prefixed names", () => {
    const r = parseKanban(SAMPLE);
    const names = r.columns.map((c) => c.name);
    expect(names).toContain("📥 Proposta Recebida");
    expect(names).toContain("🤝 Em Negociacao");
    expect(names).toContain("🎬 Em Producao");
  });

  it("counts cards correctly per column", () => {
    const r = parseKanban(SAMPLE);
    const byName = Object.fromEntries(r.columns.map((c) => [c.name, c]));
    expect(byName["📥 Proposta Recebida"].count).toBe(2);
    expect(byName["🤝 Em Negociacao"].count).toBe(3);
    expect(byName["✅ Fechado"].count).toBe(1);
    expect(byName["🎬 Em Producao"].count).toBe(1);
    expect(byName["❌ Recusado / Encerrado"].count).toBe(1);
  });

  it("includes card text in cards array", () => {
    const r = parseKanban(SAMPLE);
    const prod = r.columns.find((c) => c.name === "🎬 Em Producao");
    expect(prod?.cards[0]).toBe("CoolBrand — video gravado");
  });

  it("counts checked [x] cards as regular cards", () => {
    const r = parseKanban(SAMPLE);
    const pago = r.columns.find((c) => c.name === "💰 Pago");
    expect(pago?.count).toBe(1);
    expect(pago?.cards[0]).toContain("OldPartner");
  });

  it("stops parsing at %% kanban:settings block", () => {
    const r = parseKanban(SAMPLE);
    const colNames = r.columns.map((c) => c.name);
    expect(colNames.some((n) => n.includes("kanban:settings"))).toBe(false);
  });
});

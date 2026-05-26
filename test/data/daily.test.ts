import { describe, it, expect } from "vitest";
import { parseDaily } from "../../src/data/daily";

const SAMPLE = `---
tags: [daily-note]
data: 2026-05-17
dia: domingo
---

# Domingo, 17/05/2026

## ✅ Tarefas do Dia

- [ ] Gravar segmento 2 do video de amanha
- [x] Responder parceiro A
- [ ] Render do corte r-clip-x

## 📝 Notas do Dia

Algumas observacoes soltas.

## 🤝 Tracker de Colaboracoes

- Partner B: draft 2 enviado
`;

const SAMPLE_NESTED = `---
tags: [daily-note]
data: 2026-05-17
dia: Domingo
---

# Domingo, 17/05/2026

## ✅ Tarefas do Dia

### 🔴 Bola com Victor
- [x] Terminar roteiro + enviar pro editor
- [ ] Responder contato do Partner C

### 🟡 Outros
- [ ] Tirar fotos do setup

## 📝 Notas do Dia

- **Video do dia** (logica D-1): **Brand X** agendado pra 08:00.
- **Brand Y** — bola com agencia.

## 🤝 Tracker de Colaboracoes

- Partner D: aguardando briefing
`;

describe("parseDaily — flat tasks", () => {
  it("returns tasks with checked state", () => {
    const r = parseDaily(SAMPLE);
    expect(r.tasks).toEqual([
      { text: "Gravar segmento 2 do video de amanha", done: false },
      { text: "Responder parceiro A", done: true },
      { text: "Render do corte r-clip-x", done: false },
    ]);
  });

  it("returns notes section text", () => {
    const r = parseDaily(SAMPLE);
    expect(r.notes).toContain("Algumas observacoes");
  });

  it("returns empty tasks when section absent", () => {
    const r = parseDaily("# so titulo");
    expect(r.tasks).toEqual([]);
    expect(r.notes).toBe("");
  });

  it("handles uppercase X in checkbox", () => {
    const r = parseDaily("## ✅ Tarefas do Dia\n\n- [X] Feito");
    expect(r.tasks[0]?.done).toBe(true);
  });
});

describe("parseDaily — nested subsections", () => {
  it("collects tasks from all ### subsections within ## Tarefas do Dia", () => {
    const r = parseDaily(SAMPLE_NESTED);
    expect(r.tasks).toHaveLength(3);
    expect(r.tasks[0]).toEqual({
      text: "Terminar roteiro + enviar pro editor",
      done: true,
    });
    expect(r.tasks[1]).toEqual({ text: "Responder contato do Partner C", done: false });
    expect(r.tasks[2]).toEqual({ text: "Tirar fotos do setup", done: false });
  });

  it("does not leak tasks from ## sections after Tarefas do Dia", () => {
    const r = parseDaily(SAMPLE_NESTED);
    expect(r.tasks).toHaveLength(3);
  });

  it("returns notes from nested daily note", () => {
    const r = parseDaily(SAMPLE_NESTED);
    expect(r.notes).toContain("Brand X");
  });
});

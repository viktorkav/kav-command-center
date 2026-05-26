import { describe, it, expect } from "vitest";
import { parseProcessos } from "../../src/data/processos";

// Sample uses the real vault structure:
//   ## 🎬 Entregas de conteúdo ativas
//     ### 🔴 Partner (Contact) — description  ← urgency via 🔴 in subheader
//       - **Gmail**: [thread](url)
//       - **🔴 Bola com Victor**: action text
//
//   ## 🤝 Parcerias em negociação / aguardando terceiros
//     ### Partner (Contact) — description

const SAMPLE = `---
tags: [memoria-viva]
---

# Processos Pendentes

## 🎬 Entregas de conteúdo ativas

### 🔴 Acme Corp (Alice) — publicado 11/05 — Alice aguarda resposta
- **Contato**: Alice — alice@example.com
- **Gmail**: [\`aabbccdd11223344\`](https://mail.google.com/mail/u/0/#all/aabbccdd11223344)
- **🔴 Bola com Victor**: Alice aguarda resposta desde 16/05 07:34.

### ✅ BetaTech (Bob) — agendado seg 18/05 08:00
- **Gmail**: [\`eeff00112233aabb\`](https://mail.google.com/mail/u/0/#all/eeff00112233aabb)
- **Status**: ✅ agendado pra publicacao seg 18/05

---

## 🤝 Parcerias em negociação / aguardando terceiros

### GammaStore (Carlos Mendes) — loja de acessorios
- **Status atual**: ✅ aguardando terceiros
- **Gmail**: [thread](https://mail.google.com/mail/u/0/#inbox/xyz789)

### 🟡 DeltaTools (Diana) — aguardando resposta
- **Status**: aguardando retorno

---

## 📥 Novos inbounds aguardando triagem

### 🟡 EpsilonApp (Eve) — editor de video online
- **Recebido**: 29/04 08:40
`;

describe("parseProcessos", () => {
  it("aguardandoMinhaAcao: finds 🔴 items in Entregas ativas", () => {
    const r = parseProcessos(SAMPLE);
    expect(r.aguardandoMinhaAcao).toHaveLength(1);
    expect(r.aguardandoMinhaAcao[0].partner).toBe("Acme Corp (Alice)");
  });

  it("aguardandoMinhaAcao item includes threadUrl from Gmail bullet", () => {
    const r = parseProcessos(SAMPLE);
    const item = r.aguardandoMinhaAcao[0];
    expect(item.threadUrl).toContain("aabbccdd11223344");
  });

  it("aguardandoMinhaAcao item includes action text from 🔴 Bola bullet", () => {
    const r = parseProcessos(SAMPLE);
    expect(r.aguardandoMinhaAcao[0].action).toContain("Alice aguarda resposta");
  });

  it("aguardandoMinhaAcao: ✅ items (no 🔴) are NOT included", () => {
    const r = parseProcessos(SAMPLE);
    const partners = r.aguardandoMinhaAcao.map((x) => x.partner);
    expect(partners).not.toContain("BetaTech (Bob)");
  });

  it("aguardandoTerceiros: includes items from negociação section", () => {
    const r = parseProcessos(SAMPLE);
    expect(r.aguardandoTerceiros).toHaveLength(2);
    expect(r.aguardandoTerceiros.map((x) => x.partner)).toContain(
      "GammaStore (Carlos Mendes)"
    );
  });

  it("aguardandoTerceiros: does NOT include Novos inbounds items", () => {
    const r = parseProcessos(SAMPLE);
    const partners = r.aguardandoTerceiros.map((x) => x.partner);
    expect(partners).not.toContain("EpsilonApp (Eve)");
  });

  it("returns empty lists when sections are absent", () => {
    const r = parseProcessos("# Nada aqui");
    expect(r.aguardandoMinhaAcao).toHaveLength(0);
    expect(r.aguardandoTerceiros).toHaveLength(0);
  });
});

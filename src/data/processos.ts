// Expected format of processos-pendentes.md:
//
//   ## 🎬 Entregas de conteúdo ativas
//     ### 🔴 Partner (Contact) — description
//       - **Gmail**: [`threadId`](url)
//       - **🔴 Bola com Victor**: action text
//     ### ✅ Partner — description
//       ...
//
//   ## 🤝 Parcerias em negociação / aguardando terceiros
//     ### Partner (Contact) — description
//       - **Gmail**: [thread](url)
//
// Mapping:
//   aguardandoMinhaAcao → ### items with 🔴 in their header line (within Entregas ativas)
//   aguardandoTerceiros → ### items under "🤝 Parcerias em negociação / aguardando terceiros"

export interface ProcessoItem {
  partner: string;
  action: string;
  threadUrl: string | null;
  rawLine: string;
}

export interface ParsedProcessos {
  aguardandoMinhaAcao: ProcessoItem[];
  aguardandoTerceiros: ProcessoItem[];
}

// Section header regexes matching the real file
const SEC_ENTREGAS = /^##\s+🎬\s+Entregas de conteúdo ativas\s*$/m;
const SEC_TERCEIROS =
  /^##\s+🤝\s+Parcerias em negociação \/ aguardando terceiros\s*$/m;

export function parseProcessos(md: string): ParsedProcessos {
  return {
    aguardandoMinhaAcao: parseEntregasUrgentes(md),
    aguardandoTerceiros: parseSubItems(md, SEC_TERCEIROS),
  };
}

// ─── aguardandoMinhaAcao ──────────────────────────────────────────────────────
// Parse ### sub-items within "Entregas de conteúdo ativas" that have 🔴 in header.

function parseEntregasUrgentes(md: string): ProcessoItem[] {
  const section = extractH2Section(md, SEC_ENTREGAS);
  if (!section) return [];
  return parseH3ItemsWhere(section, (headerLine) => headerLine.includes("🔴"));
}

// ─── aguardandoTerceiros ──────────────────────────────────────────────────────
// Parse all ### sub-items under "Parcerias em negociação / aguardando terceiros".

function parseSubItems(md: string, sectionRe: RegExp): ProcessoItem[] {
  const section = extractH2Section(md, sectionRe);
  if (!section) return [];
  return parseH3ItemsWhere(section, () => true);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract text content between a matched ## header and the next ## header (or EOF).
 * Returns null if header not found.
 */
function extractH2Section(md: string, headerRe: RegExp): string | null {
  const lines = md.split("\n");
  let inSection = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (headerRe.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s/.test(line)) break;
    if (inSection) collected.push(line);
  }
  return inSection ? collected.join("\n") : null;
}

/**
 * Within a section, parse each ### sub-item block.
 * For each block: extract partner name from ### line, find Gmail thread URL,
 * find action text from 🔴 Bola bullet.
 */
function parseH3ItemsWhere(
  section: string,
  predicate: (headerLine: string) => boolean
): ProcessoItem[] {
  const lines = section.split("\n");
  const out: ProcessoItem[] = [];

  let currentHeader: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentHeader === null) return;
    if (predicate(currentHeader)) {
      const item = buildItem(currentHeader, currentLines);
      if (item) out.push(item);
    }
    currentHeader = null;
    currentLines = [];
  };

  for (const line of lines) {
    if (/^###\s/.test(line)) {
      flush();
      currentHeader = line;
    } else if (currentHeader !== null) {
      currentLines.push(line);
    }
  }
  flush();

  return out;
}

/**
 * Build a ProcessoItem from a ### block.
 *   partner  → extracted from header after "### [emoji] Name — ..."
 *   action   → text from "- **🔴 Bola com Victor**: ..." bullet; falls back to header tail
 *   threadUrl → first markdown link URL in a **Gmail**: bullet
 */
function buildItem(
  headerLine: string,
  bodyLines: string[]
): ProcessoItem | null {
  const partner = extractPartnerName(headerLine);
  if (!partner) return null;

  const threadUrl = extractGmailUrl(bodyLines);
  const action = extractAction(bodyLines, headerLine);

  return { partner, action, threadUrl, rawLine: headerLine };
}

/**
 * Extract partner name from "### [emoji?] PartnerName — rest of description"
 * Strips leading ###, status emojis (🔴 ✅ 🟢 🟡), and everything after " — ".
 */
function extractPartnerName(headerLine: string): string | null {
  let s = headerLine.replace(/^###\s+/, "");
  // Strip leading status emojis (may be multiple characters wide)
  s = s.replace(/^[\u{1F534}\u{2705}\u{1F7E2}\u{1F7E1}]\s+/u, "");
  // Take only the part before " — " (the description separator)
  const sep = s.indexOf(" — ");
  if (sep !== -1) s = s.slice(0, sep);
  s = s.trim();
  return s.length > 0 ? s : null;
}

/**
 * Find first markdown link URL in a **Gmail** bullet line.
 * Matches: - **Gmail**: [`id`](url)  or  - **Gmail**: [text](url)
 */
function extractGmailUrl(bodyLines: string[]): string | null {
  const gmailRe = /\*\*Gmail\*\*.*\]\(([^)]+)\)/;
  for (const line of bodyLines) {
    const m = line.match(gmailRe);
    if (m) return m[1];
  }
  return null;
}

/**
 * Extract action text:
 * 1. From "- **🔴 Bola com Victor**: <action>" bullet if present.
 * 2. From "- **Bola com Victor**: <action>" (without 🔴).
 * 3. Falls back to the header line tail (after " — ").
 */
function extractAction(bodyLines: string[], headerLine: string): string {
  const bolaRe = /\*\*[🔴\s]*Bola com Victor\*\*[:\s]+(.+)$/i;
  for (const line of bodyLines) {
    const m = line.match(bolaRe);
    if (m) return m[1].trim();
  }
  // Fallback: use description tail from header
  const sep = headerLine.indexOf(" — ");
  if (sep !== -1) return headerLine.slice(sep + 3).trim();
  return headerLine.replace(/^###\s+/, "").trim();
}

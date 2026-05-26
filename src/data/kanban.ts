export interface KanbanColumn {
  name: string;
  count: number;
  cards: string[];
}

export interface ParsedKanban {
  columns: KanbanColumn[];
}

// Obsidian Kanban plugin format (board variant):
//   - Frontmatter: kanban-plugin: board
//   - Columns: "## ColumnName" (may contain emojis)
//   - Cards:   "- [ ] text" or "- [x] text" (checked cards in e.g. "Pago" column)
//   - Footer:  "%% kanban:settings\n```\n...\n```\n%%" — stop parsing here
export function parseKanban(md: string): ParsedKanban {
  const lines = md.split("\n");
  const cols: KanbanColumn[] = [];
  let current: KanbanColumn | null = null;
  // Match both unchecked "- [ ]" and checked "- [x]" / "- [X]" cards
  const cardRe = /^[\-\*]\s+\[[\sxX]\]\s+(.+)$/;

  for (const line of lines) {
    // Stop at the Obsidian kanban metadata block
    if (line.startsWith("%%")) break;

    const hdr = line.match(/^##\s+(.+)$/);
    if (hdr) {
      current = { name: hdr[1].trim(), count: 0, cards: [] };
      cols.push(current);
      continue;
    }

    if (current) {
      const card = line.match(cardRe);
      if (card) {
        current.cards.push(card[1].trim());
        current.count++;
      }
    }
  }

  return { columns: cols };
}

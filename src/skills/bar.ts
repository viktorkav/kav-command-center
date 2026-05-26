import { Notice } from "obsidian";
import {
  findActiveTerminalTextarea,
  pasteToTextarea,
  dispatchEnter,
} from "../lib/terminal";

export interface SkillButton {
  label: string;
  command: string;
  /** If true, paste without auto-Enter. User reviews + hits Enter manually.
   *  Use for destructive commands (e.g. /clear). */
  noAutoEnter?: boolean;
}

export const DEFAULT_SKILLS: SkillButton[] = [
  { label: "🌅 PLAN TODAY",      command: "/plan-today" },
  { label: "📥 INBOX BRIEF",     command: "/inbox-brief" },
  { label: "💬 DRAFT",           command: "/draft" },
  { label: "🎬 SGF",             command: "/sgf" },
  { label: "✂️ CORTES",          command: "/cortes" },
  { label: "📊 WEEKLY",          command: "/weekly-review" },
  { label: "📊 USAGE",           command: "/usage" },
  { label: "🔄 REFRESH",         command: "/refresh-cards" },
  { label: "🧼 CLEAR",           command: "/clear",   noAutoEnter: true },
  { label: "📦 COMPACT",         command: "/compact", noAutoEnter: true },
];

async function sendToTerminal(
  text: string,
  btn: HTMLElement,
  autoEnter: boolean
): Promise<void> {
  const textarea = findActiveTerminalTextarea();

  if (!textarea) {
    await navigator.clipboard.writeText(text);
    new Notice(
      `Nenhum terminal aberto. Texto no clipboard:  ${text}`,
      5000
    );
    return;
  }

  const dispatched = await pasteToTextarea(textarea, text);

  if (autoEnter) {
    setTimeout(() => dispatchEnter(textarea), 80);
  }

  btn.addClass("kcc-pulsing");
  setTimeout(() => btn.removeClass("kcc-pulsing"), 200);

  if (!dispatched) {
    new Notice(`Paste bloqueado · Cmd+V manual:  ${text}`, 5000);
  }
}

/**
 * Renders the skill bar into `container`.
 * Click: paste + auto-Enter (except for noAutoEnter buttons like CLEAR).
 * Alt-click: paste without Enter (any button).
 * Cmd/Ctrl-click: prepends `cd && claude && ` for a fresh shell.
 */
export function renderSkillBar(
  container: HTMLElement,
  app: unknown,
  _onRefresh: () => void
): void {
  const vaultRoot = ((app as any).vault?.adapter?.basePath as string) ?? "~";

  DEFAULT_SKILLS.forEach(({ label, command, noAutoEnter }) => {
    const btn = container.createEl("button", {
      cls: "kcc-skill-btn",
      text: label,
    });

    btn.onclick = (evt: MouseEvent) => {
      const text =
        evt.metaKey || evt.ctrlKey
          ? `cd "${vaultRoot}" && claude && ${command}`
          : command;
      const autoEnter = !evt.altKey && !noAutoEnter;

      sendToTerminal(text, btn, autoEnter);
    };
  });

  // Standalone refresh button removed — file watcher in view.ts re-renders
  // panels automatically when JSON/daily files change. 🔄 REFRESH skill button
  // covers "force re-fetch via /refresh-cards".
}

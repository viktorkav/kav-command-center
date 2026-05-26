// Shared helpers for talking to the integrated xterm.js terminal pane
// (polyipseity Terminal plugin uses xterm.js, so we target the standard
// .xterm-helper-textarea — works regardless of plugin command IDs).

import { Notice } from "obsidian";

const XTERM_TEXTAREA_SELECTOR = ".xterm-helper-textarea";

export function findActiveTerminalTextarea(): HTMLTextAreaElement | null {
  const all = document.querySelectorAll<HTMLTextAreaElement>(XTERM_TEXTAREA_SELECTOR);
  if (all.length === 0) return null;
  for (const t of Array.from(all)) {
    const rect = t.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const leaf = t.closest(".workspace-leaf");
    if (leaf && !leaf.classList.contains("mod-hidden")) return t;
  }
  return all[0];
}

export function dispatchEnter(textarea: HTMLTextAreaElement): void {
  const init = {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  };
  textarea.dispatchEvent(new KeyboardEvent("keydown", init));
  textarea.dispatchEvent(new KeyboardEvent("keyup", init));
}

export async function pasteToTextarea(
  textarea: HTMLTextAreaElement,
  text: string
): Promise<boolean> {
  await navigator.clipboard.writeText(text);
  textarea.focus();
  const dt = new DataTransfer();
  dt.setData("text/plain", text);
  return textarea.dispatchEvent(
    new ClipboardEvent("paste", {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    })
  );
}

export async function pasteAndEnter(
  textarea: HTMLTextAreaElement,
  text: string,
  enterDelayMs = 80
): Promise<boolean> {
  const ok = await pasteToTextarea(textarea, text);
  if (!ok) return false;
  await new Promise((r) => setTimeout(r, enterDelayMs));
  dispatchEnter(textarea);
  return true;
}

// ─── Auto-init: spawn integrated terminal + start claude ────────────────────

function findIntegratedTerminalCommandId(app: unknown): string | null {
  const commands = (app as { commands?: { commands?: Record<string, unknown> } })
    .commands?.commands;
  if (!commands) return null;
  const ids = Object.keys(commands);
  return (
    ids.find(
      (id) => /terminal/i.test(id) && /integrated/i.test(id) && /root/i.test(id)
    ) ??
    ids.find((id) => /terminal/i.test(id) && /integrated/i.test(id)) ??
    null
  );
}

async function waitForTerminalTextarea(maxMs: number): Promise<HTMLTextAreaElement | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const t = findActiveTerminalTextarea();
    if (t) return t;
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

function getVaultRoot(app: unknown): string {
  return ((app as any).vault?.adapter?.basePath as string) ?? "";
}

function vaultPathToClaudeProjectSlug(vaultPath: string): string {
  return "-" + vaultPath.replace(/\//g, "-");
}

function listSessionFiles(vaultPath: string): string[] {
  try {
    const nodeRequire = (globalThis as any).require as NodeRequire;
    if (!nodeRequire) return [];
    const fs = nodeRequire("fs");
    const os = nodeRequire("os");
    const path = nodeRequire("path");
    const slug = vaultPathToClaudeProjectSlug(vaultPath);
    const projectDir = path.join(os.homedir(), ".claude/projects", slug);
    return fs.readdirSync(projectDir).filter((f: string) => f.endsWith(".jsonl"));
  } catch {
    return [];
  }
}

function writeActiveSessionPin(sessionId: string): void {
  try {
    const nodeRequire = (globalThis as any).require as NodeRequire;
    if (!nodeRequire) return;
    const fs = nodeRequire("fs");
    const os = nodeRequire("os");
    const path = nodeRequire("path");
    const pinPath = path.join(os.homedir(), ".claude/scripts/_kcc-active-session.txt");
    fs.mkdirSync(path.dirname(pinPath), { recursive: true });
    fs.writeFileSync(pinPath, sessionId);
  } catch {
    // Pin is a nice-to-have; failure shouldn't break auto-init.
  }
}

async function refreshMetricsScript(): Promise<void> {
  try {
    const nodeRequire = (globalThis as any).require as NodeRequire;
    if (!nodeRequire) return;
    const { exec } = nodeRequire("child_process");
    const os = nodeRequire("os");
    const path = nodeRequire("path");
    const scriptPath = path.join(os.homedir(), ".claude/scripts/update-metrics.js");
    return new Promise<void>((resolve) => {
      exec(`QUIET=1 node "${scriptPath}"`, () => resolve());
    });
  } catch {
    // ignore
  }
}

const FRESHNESS_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function getJsonAge(absolutePath: string): number | null {
  try {
    const nodeRequire = (globalThis as any).require as NodeRequire;
    if (!nodeRequire) return null;
    const fs = nodeRequire("fs");
    const raw = fs.readFileSync(absolutePath, "utf8");
    const data = JSON.parse(raw);
    if (!data.lastPullISO) return null;
    const age = Date.now() - new Date(data.lastPullISO).getTime();
    if (isNaN(age) || age < 0) return null;
    return age;
  } catch {
    return null;
  }
}

function dailyHasZeroTasks(vaultRoot: string, dailyNotesFolder: string): boolean {
  try {
    const nodeRequire = (globalThis as any).require as NodeRequire;
    if (!nodeRequire) return false;
    const fs = nodeRequire("fs");
    const path = nodeRequire("path");
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const file = path.join(vaultRoot, dailyNotesFolder, `${iso}.md`);
    if (!fs.existsSync(file)) return true;
    const content: string = fs.readFileSync(file, "utf8");
    return !/^\s*[\-\*]\s+\[[ xX]\]\s+\S/m.test(content);
  } catch {
    return false;
  }
}

export interface EnsureClaudeRunningOpts {
  autoUpdateInboxOnStart?: boolean;
  autoPlanTodayIfEmpty?: boolean;
  dailyNotesFolder?: string;
  onReady?: () => void;
}

export async function ensureClaudeRunning(
  app: unknown,
  startCommand: string,
  opts: EnsureClaudeRunningOpts = {}
): Promise<void> {
  if (findActiveTerminalTextarea()) return;

  const cmdId = findIntegratedTerminalCommandId(app);
  if (!cmdId) {
    new Notice(
      "Terminal plugin not detected. Open an integrated terminal manually.",
      6000
    );
    return;
  }

  const vaultRoot = getVaultRoot(app);
  const sessionsBefore = new Set(listSessionFiles(vaultRoot));

  (app as { commands: { executeCommandById: (id: string) => boolean } }).commands.executeCommandById(cmdId);

  const textarea = await waitForTerminalTextarea(3000);
  if (!textarea) {
    new Notice("Terminal did not initialize within 3s.", 4000);
    return;
  }

  await new Promise((r) => setTimeout(r, 500));
  await pasteAndEnter(textarea, startCommand);

  let pinned = false;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    const sessionsAfter = listSessionFiles(vaultRoot);
    const newFile = sessionsAfter.find((f) => !sessionsBefore.has(f));
    if (newFile) {
      const sessionId = newFile.replace(/\.jsonl$/, "");
      writeActiveSessionPin(sessionId);
      pinned = true;
      break;
    }
  }

  if (pinned) {
    await refreshMetricsScript();
  }
  opts.onReady?.();

  const inboxPath = `${vaultRoot}/Analytics/_inbox.json`;

  let needsRefresh = false;
  if (opts.autoUpdateInboxOnStart) {
    const age = getJsonAge(inboxPath);
    if (age === null || age > FRESHNESS_MAX_AGE_MS) needsRefresh = true;
  }
  if (opts.autoPlanTodayIfEmpty && opts.dailyNotesFolder
      && dailyHasZeroTasks(vaultRoot, opts.dailyNotesFolder)) {
    needsRefresh = true;
  }

  if (!needsRefresh) {
    console.log("[KCC] Overview data fresh (<8h) and daily has tasks — skipping /refresh-cards.");
    return;
  }

  const queue = ["/refresh-cards"];
  console.log(`[KCC] auto-init queueing:`, queue);

  (async () => {
    for (const cmd of queue) {
      const ta = findActiveTerminalTextarea();
      if (!ta) {
        console.warn("[KCC] terminal textarea disappeared mid-queue at:", cmd);
        break;
      }
      await pasteAndEnter(ta, cmd);
      console.log(`[KCC] sent → ${cmd}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  })();
}

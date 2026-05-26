/**
 * DOM click helpers — used across panels for consistent click-to-open behaviour.
 */

/** Opens a vault file in the workspace when element is clicked. */
export function makeFileLink(
  el: HTMLElement,
  app: { workspace: { openLinkText: (path: string, sourcePath: string) => void } },
  filePath: string | null | undefined
): void {
  if (!filePath) return;
  el.style.cursor = "pointer";
  el.addClass("kcc-clickable");
  el.onclick = (e) => {
    e.preventDefault();
    app.workspace.openLinkText(filePath, "");
  };
}

/** Opens an external URL in a new browser tab when element is clicked. */
export function makeUrlLink(
  el: HTMLElement,
  url: string | null | undefined
): void {
  if (!url) return;
  el.style.cursor = "pointer";
  el.addClass("kcc-clickable");
  el.onclick = (e) => {
    e.preventDefault();
    window.open(url, "_blank");
  };
}

import type { App, TFolder, TFile } from "obsidian";

export interface PautaFile {
  name: string;
  path: string;
}

export interface PautasOverview {
  pautas: PautaFile[];
  specs: PautaFile[];
  plans: PautaFile[];
  radarPreview: string | null;
}

export async function listPautas(
  app: App,
  producaoFolder: string
): Promise<PautasOverview> {
  return {
    pautas: listMdFiles(app, `${producaoFolder}/pautas`),
    specs: listMdFiles(app, `${producaoFolder}/specs`),
    plans: listMdFiles(app, `${producaoFolder}/plans`),
    radarPreview: await readPreview(
      app,
      `${producaoFolder}/radar-curto-prazo.md`,
      10
    ),
  };
}

function listMdFiles(app: App, folderPath: string): PautaFile[] {
  const f = app.vault.getAbstractFileByPath(folderPath);
  if (!f || !("children" in f)) return [];
  return (f as TFolder).children
    .filter((c) => "extension" in c && (c as TFile).extension === "md")
    .map((c) => ({ name: c.name, path: (c as TFile).path }));
}

async function readPreview(
  app: App,
  path: string,
  lines: number
): Promise<string | null> {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f || !("extension" in f)) return null;
  const content = await app.vault.cachedRead(f as TFile);
  return content.split("\n").slice(0, lines).join("\n");
}

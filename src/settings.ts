import { App, PluginSettingTab, Setting } from "obsidian";
import type KavCommandCenter from "../main";

export interface KCCSettings {
  defaultTab: "overview" | "hoje" | "canal" | "comercial" | "pautas";
  dailyNotesFolder: string;
  roteirosFolder: string;
  parceriasFolder: string;
  producaoFolder: string;
  analyticsFolder: string;
  eventosFolder: string;
  refreshOnFocus: boolean;
  autoStartClaude: boolean;
  claudeStartCommand: string;
  autoUpdateInboxOnStart: boolean;
  autoPlanTodayIfEmpty: boolean;
}

export const DEFAULT_SETTINGS: KCCSettings = {
  defaultTab: "overview",
  dailyNotesFolder: "Daily Notes",
  roteirosFolder: "Roteiros",
  parceriasFolder: "Parcerias",
  producaoFolder: "Produção",
  analyticsFolder: "Analytics",
  eventosFolder: "Eventos",
  refreshOnFocus: true,
  autoStartClaude: true,
  claudeStartCommand: "claude --dangerously-skip-permissions",
  autoUpdateInboxOnStart: true,
  autoPlanTodayIfEmpty: true,
};

export class KCCSettingTab extends PluginSettingTab {
  plugin: KavCommandCenter;

  constructor(app: App, plugin: KavCommandCenter) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Kav Command Center" });

    new Setting(containerEl)
      .setName("Painel ativo ao abrir")
      .addDropdown((d) =>
        d
          .addOptions({
            overview: "Overview",
            hoje: "Hoje",
            canal: "Canal",
            comercial: "Comercial",
            pautas: "Pautas",
          })
          .setValue(this.plugin.settings.defaultTab)
          .onChange(async (v) => {
            this.plugin.settings.defaultTab = v as KCCSettings["defaultTab"];
            await this.plugin.saveSettings();
          })
      );

    const folders: Array<[keyof KCCSettings, string]> = [
      ["dailyNotesFolder", "Daily notes folder"],
      ["roteirosFolder", "Roteiros folder"],
      ["parceriasFolder", "Parcerias folder"],
      ["producaoFolder", "Produção folder"],
      ["analyticsFolder", "Analytics folder"],
      ["eventosFolder", "Eventos folder"],
    ];

    for (const [key, label] of folders) {
      new Setting(containerEl).setName(label).addText((t) =>
        t.setValue(this.plugin.settings[key] as string).onChange(async (v) => {
          this.plugin.settings = { ...this.plugin.settings, [key]: v };
          await this.plugin.saveSettings();
        })
      );
    }

    new Setting(containerEl)
      .setName("Refresh on focus")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.refreshOnFocus).onChange(async (v) => {
          this.plugin.settings.refreshOnFocus = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Auto-start Claude on open")
      .setDesc("Ao abrir o Command Center, spawna terminal integrado na raiz da vault e roda o comando abaixo. Não faz nada se já tiver um terminal aberto.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoStartClaude).onChange(async (v) => {
          this.plugin.settings.autoStartClaude = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Claude start command")
      .setDesc("Comando rodado no terminal após init (ex: `claude`, `claude --resume`).")
      .addText((t) =>
        t.setValue(this.plugin.settings.claudeStartCommand).onChange(async (v) => {
          this.plugin.settings.claudeStartCommand = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Auto /update-inbox on startup")
      .setDesc("Roda /update-inbox no terminal após init (throttle 1h). Popula o card INBOX automaticamente.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoUpdateInboxOnStart).onChange(async (v) => {
          this.plugin.settings.autoUpdateInboxOnStart = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Auto /plan-today (SE daily vazia)")
      .setDesc("Roda /plan-today no startup APENAS se a daily de hoje não tem nenhuma checkbox. Safeguard contra sobrescrever edits manuais.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoPlanTodayIfEmpty).onChange(async (v) => {
          this.plugin.settings.autoPlanTodayIfEmpty = v;
          await this.plugin.saveSettings();
        })
      );
  }
}

import { Plugin } from "obsidian";
import { KavCommandCenterView, VIEW_TYPE_KCC } from "./src/view";
import { DEFAULT_SETTINGS, KCCSettings, KCCSettingTab } from "./src/settings";

export default class KavCommandCenter extends Plugin {
  settings!: KCCSettings;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_KCC, (leaf) => new KavCommandCenterView(leaf, this));

    this.addCommand({
      id: "open-command-center",
      name: "Open Command Center",
      callback: () => this.activateView(),
    });

    this.addRibbonIcon("layout-dashboard", "Kav Command Center", () => {
      this.activateView();
    });

    this.addSettingTab(new KCCSettingTab(this.app, this));
  }

  async onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_KCC)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE_KCC, active: true });
    }
    workspace.revealLeaf(leaf);
  }
}

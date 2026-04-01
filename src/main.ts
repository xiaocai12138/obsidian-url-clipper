// src/main.ts

import { MarkdownView, Notice, Plugin } from "obsidian";
import { registerCommands } from "./commands/registerCommands";
import { UrlClipperSettingTab } from "./settings/UrlClipperSettingTab";
import { DEFAULT_SETTINGS, UrlClipperSettings } from "./types";

export default class UrlClipperPlugin extends Plugin {
  settings!: UrlClipperSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(
      new UrlClipperSettingTab(this.app, this, this.settings, () => this.saveSettings())
    );
    registerCommands(this);
    this.log("Plugin loaded");
  }

  onunload() {
    this.log("Plugin unloaded");
  }

  async loadSettings() {
    const saved = (await this.loadData()) as Partial<UrlClipperSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved ?? {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  log(message: string, data?: unknown) {
    if (!this.settings?.debug) return;
    if (data !== undefined) {
      console.debug(`[url-clipper] ${message}`, data);
    } else {
      console.debug(`[url-clipper] ${message}`);
    }
  }

  getActiveMarkdownView(): MarkdownView | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view ?? null;
  }

  notice(msg: string) {
    new Notice(msg);
  }
}

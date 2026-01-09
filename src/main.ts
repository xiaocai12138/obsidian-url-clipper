// src/main.ts

import { Plugin, Notice, MarkdownView } from "obsidian";
import { registerCommands } from "./commands/registerCommands";
import { UrlClipperSettings, DEFAULT_SETTINGS } from "./types";

export default class UrlClipperPlugin extends Plugin {
  settings!: UrlClipperSettings;

  async onload() {
    await this.loadSettings();
    registerCommands(this);
    this.log("Plugin loaded");
  }

  onunload() {
    this.log("Plugin unloaded");
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  log(message: string, data?: any) {
    if (!this.settings?.debug) return;
    if (data !== undefined) {
      console.log(`[url-clipper] ${message}`, data);
    } else {
      console.log(`[url-clipper] ${message}`);
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

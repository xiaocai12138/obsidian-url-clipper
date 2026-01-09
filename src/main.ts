import { Notice, Plugin, MarkdownView } from "obsidian";
import { DEFAULT_SETTINGS, UrlClipperSettings } from "./types";
import { ClipModal } from "./ui/ClipModal";
import { UrlClipperSettingTab } from "./settings/UrlClipperSettingTab";

export default class UrlClipperPlugin extends Plugin {
  settings: UrlClipperSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "clip-url-to-current-note",
      name: "剪藏链接到当前笔记（插入到光标处）",
      callback: () => {
        const mv = this.getActiveMarkdownView();
        if (!mv) {
          new Notice("请先打开一个 Markdown 笔记。");
          return;
        }
        new ClipModal(this.app, this.settings, mv).open();
      },
    });

    this.addSettingTab(new UrlClipperSettingTab(this.app, this.settings, async () => {
      await this.saveSettings();
    }));
  }

  onunload() {}

  private getActiveMarkdownView(): MarkdownView | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView) ?? null;
  }

  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  private async saveSettings() {
    await this.saveData(this.settings);
  }
}

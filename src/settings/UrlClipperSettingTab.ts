// src/settings/UrlClipperSettingTab.ts

import { App, PluginSettingTab, Setting } from "obsidian";
import type { ExtractMode, UrlClipperSettings } from "../types";

export class UrlClipperSettingTab extends PluginSettingTab {
  private settings: UrlClipperSettings;
  private save: () => Promise<void>;

  constructor(app: App, settings: UrlClipperSettings, save: () => Promise<void>) {
    // PluginSettingTab 的第二个参数必须是 plugin 实例；这里我们不依赖它的成员，所以用占位即可
    // 如果你更严格想传真实 plugin，我下面也给了替代写法。
    super(app, {} as any);

    this.settings = settings;
    this.save = save;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "URL Clipper 设置" });

    new Setting(containerEl)
      .setName("默认提取模式")
      .setDesc("自动：智能提取正文；CSS：按 CSS 选择器；XPath：按 XPath。")
      .addDropdown((dd) => {
        dd.addOption("auto", "自动（智能提取）");
        dd.addOption("css", "CSS 选择器");
        dd.addOption("xpath", "XPath");
        dd.setValue(this.settings.defaultMode);
        dd.onChange(async (v) => {
          this.settings.defaultMode = v as ExtractMode;
          await this.save();
        });
      });

    new Setting(containerEl)
      .setName("图片下载并本地化")
      .setDesc("开启后会下载网页中的图片到 Obsidian 附件目录，并替换为本地路径。")
      .addToggle((tg) => {
        tg.setValue(this.settings.downloadImages);
        tg.onChange(async (v) => {
          this.settings.downloadImages = v;
          await this.save();
        });
      });

    new Setting(containerEl)
      .setName("图片文件名前缀")
      .setDesc("例如：csdn 或 blog。最终文件名：前缀-时间戳.png")
      .addText((t) => {
        t.setValue(this.settings.imagePrefix);
        t.onChange(async (v) => {
          this.settings.imagePrefix = v.trim();
          await this.save();
        });
      });

    new Setting(containerEl)
      .setName("调试日志")
      .setDesc("开启后会在控制台输出详细日志，方便排查选择器/图片下载问题。")
      .addToggle((tg) => {
        tg.setValue(this.settings.debug);
        tg.onChange(async (v) => {
          this.settings.debug = v;
          await this.save();
        });
      });
  }
}

// src/settings/UrlClipperSettingTab.ts

import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { ExtractMode, UrlClipperSettings } from "../types";

function normalizeHeadingPrefix(value: string, fallback: string): string {
  const v = value.trim();
  return v || fallback;
}

export class UrlClipperSettingTab extends PluginSettingTab {
  private settings: UrlClipperSettings;
  private save: () => Promise<void>;

  constructor(app: App, plugin: Plugin, settings: UrlClipperSettings, save: () => Promise<void>) {
    super(app, plugin);
    this.settings = settings;
    this.save = save;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("URL Clipper 设置").setHeading();

    new Setting(containerEl)
      .setName("默认提取模式")
      .setDesc("自动模式会智能提取正文；CSS 和 XPath 使用你指定的路径。")
      .addDropdown((dd) => {
        dd.addOption("auto", "自动（智能提取）");
        dd.addOption("css", "CSS 选择器");
        dd.addOption("xpath", "XPath");
        dd.setValue(this.settings.defaultMode);
        dd.onChange(async (value) => {
          this.settings.defaultMode = value as ExtractMode;
          await this.save();
        });
      });

    new Setting(containerEl)
      .setName("下载并本地化图片")
      .setDesc("将剪藏内容中的图片下载到你的 Vault 附件目录。")
      .addToggle((tg) => {
        tg.setValue(this.settings.downloadImages);
        tg.onChange(async (value) => {
          this.settings.downloadImages = value;
          await this.save();
        });
      });

    new Setting(containerEl)
      .setName("图片文件名前缀")
      .setDesc("可选：为下载后的图片文件名增加统一前缀。")
      .addText((t) => {
        t.setValue(this.settings.imagePrefix);
        t.onChange(async (value) => {
          this.settings.imagePrefix = value.trim();
          await this.save();
        });
      });

    new Setting(containerEl)
      .setName("调试日志")
      .setDesc("在开发者控制台输出详细调试日志。")
      .addToggle((tg) => {
        tg.setValue(this.settings.debug);
        tg.onChange(async (value) => {
          this.settings.debug = value;
          await this.save();
        });
      });

    new Setting(containerEl)
      .setName("显示结果弹窗")
      .setDesc("剪藏成功或失败后显示结果通知弹窗。")
      .addToggle((tg) => {
        tg.setValue(this.settings.showResultNotice);
        tg.onChange(async (value) => {
          this.settings.showResultNotice = value;
          await this.save();
        });
      });

    new Setting(containerEl).setName("标题格式").setHeading();

    new Setting(containerEl)
      .setName("一级标题前缀")
      .setDesc("用于 HTML h1，默认 #")
      .addText((t) => {
        t.setPlaceholder("#");
        t.setValue(this.settings.headingLevel1Prefix);
        t.onChange(async (value) => {
          this.settings.headingLevel1Prefix = normalizeHeadingPrefix(value, "#");
          await this.save();
        });
      });

    new Setting(containerEl)
      .setName("二级标题前缀")
      .setDesc("用于 HTML h2，默认 ##")
      .addText((t) => {
        t.setPlaceholder("##");
        t.setValue(this.settings.headingLevel2Prefix);
        t.onChange(async (value) => {
          this.settings.headingLevel2Prefix = normalizeHeadingPrefix(value, "##");
          await this.save();
        });
      });

    new Setting(containerEl)
      .setName("三级标题前缀")
      .setDesc("用于 HTML h3，默认 ###")
      .addText((t) => {
        t.setPlaceholder("###");
        t.setValue(this.settings.headingLevel3Prefix);
        t.onChange(async (value) => {
          this.settings.headingLevel3Prefix = normalizeHeadingPrefix(value, "###");
          await this.save();
        });
      });
  }
}

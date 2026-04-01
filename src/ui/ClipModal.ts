// src/ui/ClipModal.ts

import { App, MarkdownView, Modal, Notice, Setting } from "obsidian";
import { clipAndInsertToCursor, PickerSelectionSnapshot } from "../core/clipper";
import { ExtractMode, UrlClipperSettings } from "../types";
import { PickerModal } from "./PickerModal";

export class ClipModal extends Modal {
  private settings: UrlClipperSettings;
  private mv: MarkdownView;

  private urlInput!: HTMLInputElement;
  private modeSelect!: HTMLSelectElement;

  private contentPathLabel!: HTMLDivElement;
  private contentPathRow!: HTMLDivElement;
  private contentPathInput!: HTMLInputElement;
  private pickBtn!: HTMLButtonElement;

  private pickerSnapshot: PickerSelectionSnapshot | null = null;

  constructor(app: App, settings: UrlClipperSettings, mv: MarkdownView) {
    super(app);
    this.settings = settings;
    this.mv = mv;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    this.setTitle("剪藏链接到当前笔记");

    new Setting(contentEl)
      .setName("链接地址")
      .addText((t) => {
        this.urlInput = t.inputEl;
        t.setPlaceholder("https://...");
        this.urlInput.addEventListener("input", () => {
          this.pickerSnapshot = null;
        });
      });

    new Setting(contentEl)
      .setName("提取模式")
      .setDesc("自动：智能提取正文；CSS：按 CSS 选择器提取；XPath：按 XPath 提取。")
      .addDropdown((dd) => {
        this.modeSelect = dd.selectEl;
        dd.addOption("auto", "自动（智能提取）");
        dd.addOption("css", "CSS 选择器（点选生成）");
        dd.addOption("xpath", "XPath");
        dd.setValue(this.settings.defaultMode);
        dd.onChange(() => this.refreshContentPathUi());
      });

    this.contentPathLabel = contentEl.createDiv({ cls: "url-clipper-label" });
    this.contentPathLabel.setText("正文路径（仅在 CSS/XPath 模式需要）");

    this.contentPathRow = contentEl.createDiv({ cls: "url-clipper-row" });
    this.contentPathInput = this.contentPathRow.createEl("input", {
      type: "text",
      cls: "url-clipper-input",
      attr: { placeholder: "点击“选择正文区域”后自动填入" },
    });

    this.pickBtn = contentEl.createEl("button", {
      text: "选择正文区域",
      cls: "mod-cta",
    });
    this.pickBtn.onclick = () => this.openPicker();

    const btns = contentEl.createDiv({ cls: "url-clipper-buttons" });

    const insertBtn = btns.createEl("button", { text: "插入" });
    insertBtn.addClass("mod-cta");
    insertBtn.onclick = async () => {
      const url = (this.urlInput.value || "").trim();
      if (!url) {
        new Notice("请输入链接地址。");
        return;
      }

      const mode = (this.modeSelect.value as ExtractMode) || "auto";
      const path = (this.contentPathInput.value || "").trim();
      if ((mode === "css" || mode === "xpath") && !path) {
        new Notice("请先选择正文区域。");
        return;
      }

      await clipAndInsertToCursor(
        this.app,
        this.settings,
        url,
        mode,
        path,
        this.mv,
        this.pickerSnapshot ?? undefined
      );
      this.close();
    };

    const cancelBtn = btns.createEl("button", { text: "取消" });
    cancelBtn.onclick = () => this.close();

    this.refreshContentPathUi();
    this.applyStyles();
  }

  private refreshContentPathUi() {
    const mode = this.modeSelect?.value as ExtractMode;
    const show = mode === "css" || mode === "xpath";
    this.contentPathLabel.style.display = show ? "" : "none";
    this.contentPathRow.style.display = show ? "" : "none";
    this.pickBtn.style.display = show ? "" : "none";

    if (!show) {
      this.contentPathInput.value = "";
      this.pickerSnapshot = null;
    }
  }

  private openPicker() {
    const url = (this.urlInput.value || "").trim();
    if (!url) {
      new Notice("请先输入链接地址，再选择正文区域。");
      return;
    }

    const mode = this.modeSelect.value as ExtractMode;
    const pickerMode: "css" | "xpath" = mode === "xpath" ? "xpath" : "css";

    new PickerModal(this.app, this.settings, url, pickerMode, (picked) => {
      this.contentPathInput.value = pickerMode === "css" ? picked.css || "" : picked.xpath || "";

      this.pickerSnapshot = {
        html: picked.html || "",
        title: picked.title,
        pageUrl: picked.pageUrl,
        css: picked.css || "",
        xpath: picked.xpath || "",
      };

      if (this.settings.debug) {
        console.debug("[url-clipper] 已保存选择器快照", {
          hasHtml: Boolean(this.pickerSnapshot.html),
          css: this.pickerSnapshot.css,
          xpath: this.pickerSnapshot.xpath,
          pageUrl: this.pickerSnapshot.pageUrl,
        });
      }
    }).open();
  }

  private applyStyles() {
    const style = document.createElement("style");
    style.textContent = `
.url-clipper-label{ margin-top: 12px; font-weight: 600; }
.url-clipper-row{ display:flex; gap:8px; align-items:center; }
.url-clipper-input{ width: 100%; }
.url-clipper-buttons{ display:flex; justify-content:flex-end; gap:8px; margin-top: 16px; }
`;
    this.contentEl.appendChild(style);
  }

  onClose() {
    this.contentEl.empty();
  }
}

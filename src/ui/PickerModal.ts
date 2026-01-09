// src/ui/PickerModal.ts

import { App, Modal, Notice } from "obsidian";
import { UrlClipperSettings } from "../types";
import { buildPickerInjectedScript } from "../picker/injectedPicker";

export type PickResult = { css: string; xpath: string };
type PickState = { css: string; xpath: string; ts: number; reason?: string } | null;

export class PickerModal extends Modal {
  private settings: UrlClipperSettings;
  private url: string;
  private mode: "css" | "xpath";
  private onPicked: (res: PickResult) => void;

  private urlInput!: HTMLInputElement;
  private statusEl!: HTMLDivElement;

  private cssInput!: HTMLInputElement;
  private xpathInput!: HTMLInputElement;

  private webviewEl: any = null;

  private pickingEnabled = true;
  private isFullscreen = false;

  private pickedCss = "";
  private pickedXpath = "";

  private pollTimer: number | null = null;
  private lastPickTs = 0;
  private lastHoverTs = 0;

  constructor(
    app: App,
    settings: UrlClipperSettings,
    url: string,
    mode: "css" | "xpath",
    onPicked: (res: PickResult) => void
  ) {
    super(app);
    this.settings = settings;
    this.url = url;
    this.mode = mode;
    this.onPicked = onPicked;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // ✅ 关键：让 contentEl 成为“有高度的 flex column”
    contentEl.addClass("picker-root");

    this.setTitle("选择正文区域");

    // 统一打标记（宽高样式控制）
    this.modalEl.addClass("url-clipper-pickerwide");

    const top = contentEl.createDiv({ cls: "picker-top" });

    const left = top.createDiv({ cls: "picker-top-left" });
    this.urlInput = left.createEl("input", { type: "text" });
    this.urlInput.value = this.url;

    const right = top.createDiv({ cls: "picker-top-right" });

    const fullBtn = right.createEl("button", { text: "全屏" });
    fullBtn.onclick = () => {
      this.toggleFullscreen();
      fullBtn.textContent = this.isFullscreen ? "退出全屏" : "全屏";
    };

    const togglePickBtn = right.createEl("button", { text: "停止选择" });
    togglePickBtn.onclick = async () => {
      this.pickingEnabled = !this.pickingEnabled;
      togglePickBtn.textContent = this.pickingEnabled ? "停止选择" : "继续选择";

      await this.injectPicker(this.pickingEnabled);
      if (this.pickingEnabled) this.startPolling();
      else this.stopPolling();
    };

    this.statusEl = contentEl.createDiv({ cls: "picker-status" });
    this.setStatus("已进入选择模式：双击页面元素即可确认。");

    const webWrap = contentEl.createDiv({ cls: "picker-webwrap" });

    const webview = document.createElement("webview") as any;
    this.webviewEl = webview;
    webview.setAttribute("partition", "persist:url-clipper");
    webview.setAttribute("allowpopups", "true");
    webview.setAttribute("webpreferences", "contextIsolation=no, sandbox=no");
    webview.setAttribute("src", this.url);
    webWrap.appendChild(webview);

    const pathBox = contentEl.createDiv({ cls: "picker-pathbox" });

    const cssRow = pathBox.createDiv({ cls: "picker-pathrow" });
    cssRow.createEl("div", { text: "CSS 路径：" });
    this.cssInput = cssRow.createEl("input", { type: "text" });
    this.cssInput.readOnly = true;

    const xpRow = pathBox.createDiv({ cls: "picker-pathrow" });
    xpRow.createEl("div", { text: "XPath 路径：" });
    this.xpathInput = xpRow.createEl("input", { type: "text" });
    this.xpathInput.readOnly = true;

    const btns = contentEl.createDiv({ cls: "picker-buttons" });

    const cancelBtn = btns.createEl("button", { text: "取消" });
    cancelBtn.onclick = () => this.close();

    const okBtn = btns.createEl("button", { text: "确定" });
    okBtn.addClass("mod-cta");
    okBtn.onclick = () => {
      if (!this.pickedCss && !this.pickedXpath) {
        new Notice("请先在页面中双击选择一个区域。");
        return;
      }
      this.onPicked({ css: this.pickedCss, xpath: this.pickedXpath });
      this.close();
    };

    this.bindWebviewEvents();
    this.applyStyles();

    // ✅ 初始化：宽度*2 + 高度*3（都带上限）
    requestAnimationFrame(() => {
      this.applyInitialDoubleWidth();
      this.applyInitialTripleHeight();
    });
  }

  private setStatus(text: string) {
    this.statusEl.setText(`提示：${text}`);
  }

  private bindWebviewEvents() {
    this.webviewEl?.addEventListener("did-finish-load", async () => {
      await this.injectPicker(true);
      this.startPolling();
    });

    this.webviewEl?.addEventListener("console-message", (e: any) => {
      console.log("[url-clipper][webview]", e?.message);
    });
  }

  private async injectPicker(enable: boolean) {
    if (!this.webviewEl) return;
    const js = buildPickerInjectedScript(enable);
    await this.webviewEl.executeJavaScript(js, true);
  }

  private startPolling() {
    if (this.pollTimer != null) return;

    this.pollTimer = window.setInterval(async () => {
      if (!this.webviewEl || !this.pickingEnabled) return;

      const hover: PickState = await this.webviewEl.executeJavaScript(
        "window.__URL_CLIPPER_LAST_HOVER__ || null",
        true
      );
      if (hover && hover.ts > this.lastHoverTs) {
        this.lastHoverTs = hover.ts;
        this.cssInput.value = hover.css || "";
        this.xpathInput.value = hover.xpath || "";
      }

      const pick: PickState = await this.webviewEl.executeJavaScript(
        "window.__URL_CLIPPER_LAST_PICK__ || null",
        true
      );
      if (pick && pick.ts > this.lastPickTs) {
        this.lastPickTs = pick.ts;
        this.pickedCss = pick.css || "";
        this.pickedXpath = pick.xpath || "";
        this.cssInput.value = this.pickedCss;
        this.xpathInput.value = this.pickedXpath;
      }
    }, 120);
  }

  private stopPolling() {
    if (this.pollTimer != null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) this.modalEl.addClass("url-clipper-fullscreen");
    else this.modalEl.removeClass("url-clipper-fullscreen");
  }

  private applyInitialDoubleWidth() {
    const modal = this.modalEl as HTMLElement;
    if (!modal) return;

    const rect = modal.getBoundingClientRect();
    const cur = rect.width;
    if (!cur || cur < 200) return;

    const doubled = cur * 2;
    const max = Math.floor(window.innerWidth * 0.96);
    const target = Math.min(Math.floor(doubled), max);

    modal.style.width = `${target}px`;
    modal.style.maxWidth = "none";
    modal.style.minWidth = `${Math.min(target, 800)}px`;

    console.log("[url-clipper][ui] init width doubled", { cur, target, max });
  }

  // ✅ 新增：高度 * 3
  private applyInitialTripleHeight() {
    const modal = this.modalEl as HTMLElement;
    if (!modal) return;

    const rect = modal.getBoundingClientRect();
    const cur = rect.height;
    if (!cur || cur < 200) return;

    const tripled = cur * 3;
    const max = Math.floor(window.innerHeight * 0.96);
    const target = Math.min(Math.floor(tripled), max);

    modal.style.height = `${target}px`;
    modal.style.maxHeight = "none";
    modal.style.minHeight = `${Math.min(target, 520)}px`;

    console.log("[url-clipper][ui] init height tripled", { cur, target, max });
  }

  private applyStyles() {
    const style = document.createElement("style");
    style.textContent = `
/* ✅ 默认直接给很高，避免 JS 没跑时高度仍然很矮 */
.url-clipper-pickerwide .modal{
  height: 90vh !important;
  max-height: 96vh !important;
}

/* ✅ 确保 modal-content 继承高度，否则 webview 会被压扁 */
.url-clipper-pickerwide .modal-content{
  height: 100% !important;
  max-height: none !important;
}

/* ✅ contentEl 必须是“有高度的 flex column” */
.url-clipper-pickerwide .picker-root{
  height: 100% !important;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 顶部 */
.picker-top{ display:flex; gap:10px; align-items:center; flex: 0 0 auto; }
.picker-top-left{ flex:1; min-width:0; }
.picker-top-left input{ width:100%; }
.picker-top-right{ display:flex; gap:8px; }
.picker-status{ margin:8px 0 10px; opacity:.85; flex: 0 0 auto; }

/* ✅ webview：吃掉剩余高度 */
.picker-webwrap{
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
}
.picker-webwrap webview{
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
}

/* 路径区 */
.picker-pathbox{
  flex: 0 0 auto;
  margin-top: 10px;
  display:flex;
  flex-direction:column;
  gap:10px;
  width: 100%;
}
.picker-pathrow{
  display:flex;
  align-items:center;
  gap:12px;
  width: 100%;
  flex-wrap: nowrap;
}
.picker-pathrow > div{
  width: 110px;
  flex: 0 0 110px;
  white-space: nowrap;
  opacity:.85;
}
.picker-pathrow input{
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  max-width: none;
  box-sizing: border-box;
  font-family: var(--font-monospace);
  font-size: 12px;
  white-space: nowrap;
}

/* 按钮区 */
.picker-buttons{
  flex: 0 0 auto;
  display:flex;
  justify-content:flex-end;
  gap:8px;
  margin-top: 12px;
  padding-bottom: 2px;
}

/* 全屏 */
.url-clipper-fullscreen.modal{
  width: 98vw !important;
  height: 96vh !important;
  max-width: 98vw !important;
  max-height: 96vh !important;
}
`;
    this.contentEl.appendChild(style);
  }

  onClose() {
    this.stopPolling();
    this.contentEl.empty();
  }
}

// src/core/clipper.ts

import { App, MarkdownView, Notice, TFile, requestUrl } from "obsidian";
import TurndownService from "turndown";
import { ExtractMode, UrlClipperSettings, log, tsNow } from "../types";

/**
 * 解析 HTML 为 Document（DOMParser）
 */
function parseHtml(html: string, baseUrl: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 设置 base，方便相对路径解析
  let base = doc.querySelector("base");
  if (!base) {
    base = doc.createElement("base");
    doc.head?.prepend(base);
  }
  base.setAttribute("href", baseUrl);

  return doc;
}

/**
 * auto 模式：<article>/<main> 优先，否则“最大文本块”
 */
function extractAuto(doc: Document): Element | null {
  const article = doc.querySelector("article");
  if (article) return article;

  const main = doc.querySelector("main");
  if (main) return main;

  const candidates = Array.from(doc.querySelectorAll("div, section, body")) as Element[];

  let best: Element | null = null;
  let bestLen = 0;

  for (const el of candidates) {
    const cls = (el.getAttribute("class") || "").toLowerCase();
    if (
      cls.includes("nav") ||
      cls.includes("menu") ||
      cls.includes("sidebar") ||
      cls.includes("footer") ||
      cls.includes("header")
    ) {
      continue;
    }

    const text = (el.textContent || "").trim();
    const len = text.length;
    if (len > bestLen) {
      bestLen = len;
      best = el;
    }
  }

  return best;
}

function extractByCss(doc: Document, selector: string): Element | null {
  if (!selector.trim()) return null;
  return doc.querySelector(selector.trim());
}

function extractByXpath(doc: Document, xpath: string): Element | null {
  const xp = xpath.trim();
  if (!xp) return null;

  try {
    const res = doc.evaluate(
      xp,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    const node = res.singleNodeValue;
    if (node && node.nodeType === Node.ELEMENT_NODE) return node as Element;
    return null;
  } catch {
    return null;
  }
}

function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });

  td.addRule("pre", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      const pre = node as HTMLElement;
      const code = pre.querySelector("code");
      const text = (code ? code.textContent : pre.textContent) || "";
      return `\n\n\`\`\`\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
    },
  });

  return td.turndown(html);
}

function guessImageExt(url: string): string {
  const u = url.toLowerCase();
  const m = u.match(/\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i);
  if (m && m[1]) {
    const ext = m[1].toLowerCase().replace("jpeg", "jpg");
    return ext;
  }
  return "png";
}

async function ensureParentFolder(app: App, path: string) {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return;
  const folder = path.slice(0, idx);
  try {
    await app.vault.createFolder(folder);
  } catch {
    // ignore
  }
}

async function getAttachmentPathForImage(app: App, activeFile: TFile, filename: string) {
  return await app.fileManager.getAvailablePathForAttachment(filename, activeFile.path);
}

async function downloadImageToVault(
  app: App,
  settings: UrlClipperSettings,
  activeFile: TFile,
  imgUrl: string
): Promise<string | null> {
  const cleanUrl = (imgUrl.split("#")[0] ?? imgUrl).trim();
  if (!cleanUrl) return null;

  const ext = guessImageExt(cleanUrl);
  const prefix = (settings.imagePrefix || "").trim();
  const name = `${prefix}${prefix ? "-" : ""}${tsNow()}.${ext}`;

  const vaultPath = await getAttachmentPathForImage(app, activeFile, name);
  await ensureParentFolder(app, vaultPath);

  try {
    const res = await requestUrl({
      url: cleanUrl,
      method: "GET",
      headers: {
        "User-Agent": "Obsidian-Url-Clipper",
        Accept: "*/*",
      },
    });

    if (res.status >= 400) {
      log(settings.debug, "图片下载失败（HTTP）", cleanUrl, res.status);
      return null;
    }

    const data = res.arrayBuffer as ArrayBuffer;
    await app.vault.createBinary(vaultPath, data);

    log(settings.debug, "图片已保存到 vault:", vaultPath, "from", cleanUrl);
    return vaultPath;
  } catch (e: any) {
    log(settings.debug, "图片下载失败（异常）", cleanUrl, e?.message || e);
    return null;
  }
}

async function localizeImagesInElement(
  app: App,
  settings: UrlClipperSettings,
  el: Element,
  pageUrl: string,
  activeFile: TFile
): Promise<void> {
  const imgs = Array.from(el.querySelectorAll("img"));
  if (!imgs.length) return;

  for (const imgEl of imgs) {
    const raw = (imgEl.getAttribute("src") ?? "").trim();
    if (!raw) continue;

    if (raw.startsWith("data:") || raw.startsWith("blob:")) continue;

    let absUrl = "";
    try {
      absUrl = new URL(raw, pageUrl).toString();
    } catch {
      continue;
    }

    const vaultPath = await downloadImageToVault(app, settings, activeFile, absUrl);
    if (!vaultPath) continue;

    imgEl.setAttribute("src", vaultPath);
  }
}

/**
 * 对外暴露的核心剪藏入口
 */
export async function clipAndInsertToCursor(
  app: App,
  settings: UrlClipperSettings,
  url: string,
  mode: ExtractMode,
  contentPath: string,
  markdownView: MarkdownView
) {
  const activeFile = markdownView.file;
  if (!activeFile) {
    new Notice("当前笔记未保存到文件，无法写入图片附件。请先保存。");
    return;
  }

  log(settings.debug, "开始剪藏:", { url, mode, contentPath });

  let html = "";
  try {
    const res = await requestUrl({ url, method: "GET" });
    if (res.status >= 400) {
      new Notice(`请求失败：HTTP ${res.status}`);
      return;
    }
    html = res.text;
  } catch (e: any) {
    new Notice(`请求失败：${e?.message || e}`);
    return;
  }

  const doc = parseHtml(html, url);

  let el: Element | null = null;
  if (mode === "auto") el = extractAuto(doc);
  else if (mode === "css") el = extractByCss(doc, contentPath);
  else el = extractByXpath(doc, contentPath);

  if (!el) {
    new Notice("未找到正文区域。请使用 CSS/XPath 选择模式指定正文。");
    return;
  }

  if (settings.downloadImages) {
    await localizeImagesInElement(app, settings, el, url, activeFile);
  }

  const title = (doc.querySelector("title")?.textContent || "").trim();
  const header = ["", `> 来源：${title ? title + " - " : ""}${url}`, ""].join("\n");
  const md = header + htmlToMarkdown(el.outerHTML).trimEnd() + "\n\n";

  const editor = markdownView.editor;
  editor.replaceRange(md, editor.getCursor());

  new Notice("剪藏完成：已插入到当前光标位置。");
}

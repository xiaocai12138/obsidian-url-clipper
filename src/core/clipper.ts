// src/core/clipper.ts

import { App, MarkdownView, Notice, TFile, requestUrl } from "obsidian";
import TurndownService from "turndown";
import { ExtractMode, UrlClipperSettings, log, tsNow } from "../types";

type PageFetchResult =
  | {
      ok: true;
      html: string;
      usedUrl: string;
      attemptedUrls: string[];
    }
  | {
      ok: false;
      status?: number;
      message: string;
      attemptedUrls: string[];
    };

interface ImageLocalizationStats {
  total: number;
  localized: number;
  skipped: number;
  failed: number;
}

export interface PickerSelectionSnapshot {
  html: string;
  title?: string;
  pageUrl?: string;
  css?: string;
  xpath?: string;
}

function notifyResult(settings: UrlClipperSettings, message: string) {
  if (settings.showResultNotice) {
    new Notice(message);
  }
}

function reportSuccess(settings: UrlClipperSettings, message: string, details?: Record<string, unknown>) {
  console.debug("[url-clipper] success:", message, details ?? {});
  log(settings.debug, "clip success", message, details ?? {});
  notifyResult(settings, message);
}

function reportFailure(settings: UrlClipperSettings, message: string, details?: Record<string, unknown>) {
  console.error("[url-clipper] failure:", message, details ?? {});
  log(settings.debug, "clip failure", message, details ?? {});
  notifyResult(settings, message);
}

function parseHtml(html: string, baseUrl: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  let base = doc.querySelector("base");
  if (!base) {
    base = doc.createElement("base");
    doc.head?.prepend(base);
  }
  base.setAttribute("href", baseUrl);

  return doc;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function stripTrackingParams(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const removeKeys = new Set(["spm", "from", "source", "sharefrom", "share_to"]);

    for (const key of Array.from(parsed.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (removeKeys.has(lower) || lower.startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function buildCandidatePageUrls(rawUrl: string): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const push = (value: string) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  push(rawUrl);
  push(stripTrackingParams(rawUrl));

  try {
    const parsed = new URL(rawUrl);
    const csdnSubdomain = parsed.hostname.match(/^([^.]+)\.blog\.csdn\.net$/i);

    if (csdnSubdomain && csdnSubdomain[1]) {
      const author = csdnSubdomain[1];
      const canonical = new URL(`https://blog.csdn.net/${author}${parsed.pathname}`);
      canonical.search = "";
      canonical.hash = "";
      push(canonical.toString());
      push(stripTrackingParams(canonical.toString()));
    }
  } catch {
    // ignore URL parse failures
  }

  return candidates;
}

function buildPageRequestHeaders(targetUrl: string): Record<string, string> {
  let referer = "https://www.google.com/";
  try {
    const parsed = new URL(targetUrl);
    referer = `${parsed.protocol}//${parsed.host}/`;
  } catch {
    // keep fallback referer
  }

  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Referer: referer,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
}

async function fetchPageHtmlWithFallback(
  settings: UrlClipperSettings,
  rawUrl: string
): Promise<PageFetchResult> {
  const candidates = buildCandidatePageUrls(rawUrl);
  let lastStatus: number | undefined;
  let lastMessage = "";

  for (const candidate of candidates) {
    try {
      log(settings.debug, "fetch candidate", candidate);
      const res = await requestUrl({
        url: candidate,
        method: "GET",
        headers: buildPageRequestHeaders(candidate),
      });

      if (res.status < 400 && res.text.trim()) {
        if (candidate !== rawUrl) {
          log(settings.debug, "fetch succeeded via fallback url", {
            requested: rawUrl,
            used: candidate,
          });
        }
        return { ok: true, html: res.text, usedUrl: candidate, attemptedUrls: candidates };
      }

      lastStatus = res.status;
      lastMessage = `HTTP ${res.status}`;
      log(settings.debug, "fetch failed by status", { candidate, status: res.status });
    } catch (error: unknown) {
      lastMessage = getErrorMessage(error);
      const statusMatch = lastMessage.match(/status\s+(\d{3})/i);
      if (statusMatch?.[1]) {
        const code = Number(statusMatch[1]);
        if (!Number.isNaN(code)) lastStatus = code;
      }
      log(settings.debug, "fetch threw exception", { candidate, error: lastMessage });
    }
  }

  return {
    ok: false,
    status: lastStatus,
    message: lastMessage || "unknown error",
    attemptedUrls: candidates,
  };
}

function extractAuto(doc: Document): Element | null {
  const article = doc.querySelector("article");
  if (article) return article;

  const main = doc.querySelector("main");
  if (main) return main;

  const candidates = Array.from(doc.querySelectorAll("div, section, body"));

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

    const len = (el.textContent || "").trim().length;
    if (len > bestLen) {
      bestLen = len;
      best = el;
    }
  }

  return best;
}

function extractByCss(doc: Document, selector: string): Element | null {
  const s = selector.trim();
  if (!s) return null;
  return doc.querySelector(s);
}

function evaluateFirstElementByXpath(doc: Document, xpath: string): Element | null {
  try {
    const res = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const node = res.singleNodeValue;
    if (node instanceof Element) return node;
    return null;
  } catch {
    return null;
  }
}

function buildXpathCandidates(xpath: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  push(xpath);

  if (xpath.startsWith("/body")) {
    push(`/html[1]${xpath}`);
  }
  if (xpath.startsWith("/") && !xpath.startsWith("/html")) {
    push(`/html[1]${xpath}`);
  }
  if (xpath.startsWith("/html/")) {
    push(xpath.replace(/^\/html\//, "/html[1]/"));
  }

  const bodyPath = xpath.match(/^\/body(?:\[\d+\])?(\/.*)$/);
  if (bodyPath && bodyPath[1]) {
    push(`//body${bodyPath[1]}`);
  }

  const tailTag = xpath.match(/\/([a-zA-Z][\w-]*)(?:\[\d+\])?$/);
  if (tailTag && tailTag[1]) {
    push(`//${tailTag[1]}`);
  }

  return candidates;
}

function extractByXpath(doc: Document, xpath: string): Element | null {
  const xp = xpath.trim();
  if (!xp) return null;

  for (const candidate of buildXpathCandidates(xp)) {
    const matched = evaluateFirstElementByXpath(doc, candidate);
    if (matched) return matched;
  }

  return null;
}

function escapeTableCell(text: string): string {
  return text.replace(/\r?\n+/g, "<br>").replace(/\|/g, "\\|").trim();
}

function buildMarkdownTable(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (!rows.length) return "";

  const toCells = (row: HTMLTableRowElement): string[] => {
    const cells = Array.from(row.cells);
    return cells.map((cell) => escapeTableCell(cell.textContent || ""));
  };

  let headerCells: string[] = [];
  let dataRows: HTMLTableRowElement[] = [];

  const theadRow = table.querySelector("thead tr");
  if (theadRow instanceof HTMLTableRowElement) {
    headerCells = toCells(theadRow);
    dataRows = rows.filter((row) => row !== theadRow);
  } else {
    const firstRow = rows[0];
    if (!firstRow) return "";
    headerCells = toCells(firstRow);
    dataRows = rows.slice(1);
  }

  const columnCount = Math.max(
    headerCells.length,
    ...dataRows.map((row) => row.cells.length),
    1
  );

  while (headerCells.length < columnCount) headerCells.push("");
  const separator = new Array(columnCount).fill("---");

  const lines = [
    `| ${headerCells.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
  ];

  for (const row of dataRows) {
    const cells = toCells(row);
    while (cells.length < columnCount) cells.push("");
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return lines.join("\n");
}

function resolveHeadingPrefix(settings: UrlClipperSettings, level: number): string {
  if (level === 1) return settings.headingLevel1Prefix.trim() || "#";
  if (level === 2) return settings.headingLevel2Prefix.trim() || "##";
  if (level === 3) return settings.headingLevel3Prefix.trim() || "###";
  return "#".repeat(level);
}

function detectHeadingLevelShift(html: string): number {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  if (!headings.length) return 0;

  let minLevel = 7;
  for (const heading of headings) {
    const level = Number(heading.tagName.charAt(1));
    if (level >= 1 && level <= 6 && level < minLevel) {
      minLevel = level;
    }
  }

  if (minLevel > 1 && minLevel <= 6) {
    return minLevel - 1;
  }
  return 0;
}

function normalizeMarkdown(md: string, settings: UrlClipperSettings): string {
  let output = md.replace(/\r\n/g, "\n");

  // Keep section titles stable: "# 2. xxx" instead of "# 2\\. xxx"
  output = output.replace(/^(#{1,6}\s+)(\d+)\\\.\s+/gm, (_m, prefix: string, num: string) => {
    return `${prefix}${num}. `;
  });

  // Fallback: if an isolated line becomes "2\\. 标题", promote it to H1.
  const level1Prefix = resolveHeadingPrefix(settings, 1);
  output = output.replace(
    /(^|\n\n)(\d+)\\\.\s+([^\n]+)(?=\n\n|$)/g,
    (_m, pre: string, num: string, title: string) => `${pre}${level1Prefix} ${num}. ${title}`
  );

  return output;
}

function htmlToMarkdown(html: string, settings: UrlClipperSettings): string {
  const td = new TurndownService({
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });
  const headingShift = detectHeadingLevelShift(html);

  td.addRule("pre", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      const pre = node as HTMLElement;
      const code = pre.querySelector("code");
      const text = (code ? code.textContent : pre.textContent) || "";
      return `\n\n\`\`\`\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
    },
  });

  td.addRule("heading", {
    filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
    replacement: (content, node) => {
      const rawLevel = Number(node.nodeName.charAt(1)) || 1;
      const level = Math.max(1, rawLevel - headingShift);
      const clean = content.replace(/\n+/g, " ").replace(/\\\./g, ".").trim();
      const prefix = resolveHeadingPrefix(settings, level);
      return `\n\n${prefix} ${clean}\n\n`;
    },
  });

  td.addRule("table", {
    filter: (node) => node.nodeName === "TABLE",
    replacement: (_content, node) => {
      const table = node as HTMLTableElement;
      const markdownTable = buildMarkdownTable(table);
      if (!markdownTable) return "\n\n";
      return `\n\n${markdownTable}\n\n`;
    },
  });

  return normalizeMarkdown(td.turndown(html), settings);
}

function guessImageExt(url: string): string {
  const u = url.toLowerCase();
  const m = u.match(/\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i);
  if (m && m[1]) {
    return m[1].toLowerCase().replace("jpeg", "jpg");
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
  return app.fileManager.getAvailablePathForAttachment(filename, activeFile.path);
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
      log(settings.debug, "image download failed", { url: cleanUrl, status: res.status });
      return null;
    }

    await app.vault.createBinary(vaultPath, res.arrayBuffer as ArrayBuffer);
    return vaultPath;
  } catch (error: unknown) {
    log(settings.debug, "image download threw", {
      url: cleanUrl,
      error: getErrorMessage(error),
    });
    return null;
  }
}

async function localizeImagesInElement(
  app: App,
  settings: UrlClipperSettings,
  el: Element,
  pageUrl: string,
  activeFile: TFile
): Promise<ImageLocalizationStats> {
  const imgs = Array.from(el.querySelectorAll("img"));
  const stats: ImageLocalizationStats = {
    total: imgs.length,
    localized: 0,
    skipped: 0,
    failed: 0,
  };

  for (const imgEl of imgs) {
    const raw = (imgEl.getAttribute("src") ?? "").trim();
    if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) {
      stats.skipped += 1;
      continue;
    }

    let absUrl = "";
    try {
      absUrl = new URL(raw, pageUrl).toString();
    } catch {
      stats.skipped += 1;
      continue;
    }

    const vaultPath = await downloadImageToVault(app, settings, activeFile, absUrl);
    if (!vaultPath) {
      stats.failed += 1;
      continue;
    }

    imgEl.setAttribute("src", vaultPath);
    stats.localized += 1;
  }

  return stats;
}

export async function clipAndInsertToCursor(
  app: App,
  settings: UrlClipperSettings,
  url: string,
  mode: ExtractMode,
  contentPath: string,
  markdownView: MarkdownView,
  pickerSnapshot?: PickerSelectionSnapshot
) {
  const activeFile = markdownView.file;
  if (!activeFile) {
    reportFailure(settings, "剪藏失败：当前笔记未保存，无法写入图片附件。", { url, mode });
    return;
  }

  console.debug("[url-clipper] start clip", { url, mode, contentPath });
  log(settings.debug, "start clip", { url, mode, contentPath });

  let picked: Element | null = null;
  let title = "";
  let sourceFetchUrl = url;
  let attempts: string[] = [];
  const canUseSnapshot = mode !== "auto" && Boolean(pickerSnapshot?.html?.trim());

  if (canUseSnapshot && pickerSnapshot) {
    const snapshotUrl = (pickerSnapshot.pageUrl || url).trim();
    const snapshotDoc = parseHtml(pickerSnapshot.html, snapshotUrl);
    picked = snapshotDoc.body.firstElementChild ?? snapshotDoc.body;
    title = (pickerSnapshot.title || "").trim();
    sourceFetchUrl = snapshotUrl;
    attempts = ["picker-snapshot"];
    log(settings.debug, "using picker snapshot html", {
      mode,
      contentPath,
      snapshotUrl,
      css: pickerSnapshot.css,
      xpath: pickerSnapshot.xpath,
      htmlLength: pickerSnapshot.html.length,
    });
  } else {
    const fetched = await fetchPageHtmlWithFallback(settings, url);
    if (!fetched.ok) {
      const message =
        fetched.status === 521
          ? "剪藏失败：HTTP 521（站点拒绝连接），已尝试备用地址。"
          : fetched.status
            ? `剪藏失败：HTTP ${fetched.status}`
            : `剪藏失败：${fetched.message}`;

      reportFailure(settings, message, {
        url,
        mode,
        attempts: fetched.attemptedUrls,
        error: fetched.message,
      });
      return;
    }

    const doc = parseHtml(fetched.html, fetched.usedUrl);
    if (mode === "auto") picked = extractAuto(doc);
    else if (mode === "css") picked = extractByCss(doc, contentPath);
    else picked = extractByXpath(doc, contentPath);
    title = (doc.querySelector("title")?.textContent || "").trim();
    sourceFetchUrl = fetched.usedUrl;
    attempts = fetched.attemptedUrls;
  }

  if (!picked) {
    reportFailure(settings, "剪藏失败：未找到正文区域，请调整 CSS/XPath 后重试。", {
      url,
      mode,
      contentPath,
      fetchUrl: sourceFetchUrl,
      usedSnapshot: canUseSnapshot,
    });
    return;
  }

  let imageStats: ImageLocalizationStats = {
    total: 0,
    localized: 0,
    skipped: 0,
    failed: 0,
  };
  if (settings.downloadImages) {
    imageStats = await localizeImagesInElement(app, settings, picked, sourceFetchUrl, activeFile);
  }

  const header = ["", `> 来源：${title ? `${title} - ` : ""}${url}`, ""].join("\n");
  const md = `${header}${htmlToMarkdown(picked.outerHTML, settings).trimEnd()}\n\n`;

  const editor = markdownView.editor;
  editor.replaceRange(md, editor.getCursor());

  const contentLength = (picked.textContent || "").trim().length;
  const successMessage =
    settings.downloadImages
      ? `剪藏成功：模式=${mode}，正文字符≈${contentLength}，图片本地化=${imageStats.localized}/${imageStats.total}`
      : `剪藏成功：模式=${mode}，正文字符≈${contentLength}`;

  reportSuccess(settings, successMessage, {
    url,
    mode,
    contentPath,
    fetchUrl: sourceFetchUrl,
    attempts,
    usedSnapshot: canUseSnapshot,
    contentLength,
    imageStats,
  });
}

// src/types.ts

export type ExtractMode = "auto" | "css" | "xpath";

export interface UrlClipperSettings {
  defaultMode: ExtractMode;
  contentPath: string;
  downloadImages: boolean;
  imagePrefix: string;
  debug: boolean;
}

export const DEFAULT_SETTINGS: UrlClipperSettings = {
  defaultMode: "auto",
  contentPath: "",
  downloadImages: true,
  imagePrefix: "",
  debug: true,
};

/**
 * 统一调试日志输出
 */
export function log(debug: boolean, ...args: any[]) {
  if (debug) {
    console.log("[url-clipper]", ...args);
  }
}

/**
 * 生成时间戳：yyyyMMdd-HHmmss-SSS
 * 用于文件名 / 调试标识
 */
export function tsNow(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => `${n}`.padStart(w, "0");

  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-` +
    `${pad(d.getMilliseconds(), 3)}`
  );
}

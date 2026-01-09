// src/types.ts

export type ExtractMode = "auto" | "css" | "xpath";

export interface UrlClipperSettings {
  defaultMode: ExtractMode;
  // 仅当 mode=css/xpath 时使用
  contentPath: string;
  // 图片本地化
  downloadImages: boolean;
  // 图片文件名前缀
  imagePrefix: string;
  // 是否输出调试日志
  debug: boolean;
}

export const DEFAULT_SETTINGS: UrlClipperSettings = {
  defaultMode: "auto",
  contentPath: "",
  downloadImages: true,
  imagePrefix: "",
  debug: true,
};

export function log(debug: boolean, ...args: any[]) {
  if (debug) console.log("[url-clipper]", ...args);
}

/**
 * 生成时间戳：yyyyMMdd-HHmmss-SSS
 */
export function tsNow() {
  const d = new Date();
  const pad = (n: number, w = 2) => `${n}`.padStart(w, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(
      d.getMilliseconds(),
      3
    )}`
  );
}

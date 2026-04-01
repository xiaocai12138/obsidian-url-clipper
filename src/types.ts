// src/types.ts

export type ExtractMode = "auto" | "css" | "xpath";

export interface UrlClipperSettings {
  defaultMode: ExtractMode;
  contentPath: string;
  downloadImages: boolean;
  imagePrefix: string;
  debug: boolean;
  showResultNotice: boolean;
  headingLevel1Prefix: string;
  headingLevel2Prefix: string;
  headingLevel3Prefix: string;
}

export const DEFAULT_SETTINGS: UrlClipperSettings = {
  defaultMode: "auto",
  contentPath: "",
  downloadImages: true,
  imagePrefix: "",
  debug: true,
  showResultNotice: true,
  headingLevel1Prefix: "#",
  headingLevel2Prefix: "##",
  headingLevel3Prefix: "###",
};

export function log(debug: boolean, ...args: unknown[]) {
  if (debug) {
    console.debug("[url-clipper]", ...args);
  }
}

export function tsNow(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => `${n}`.padStart(w, "0");

  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-` +
    `${pad(d.getMilliseconds(), 3)}`
  );
}

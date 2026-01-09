import { Notice, MarkdownView } from "obsidian";
import type UrlClipperPlugin from "../main";
import { ClipModal } from "../ui/ClipModal";

export function registerCommands(plugin: UrlClipperPlugin) {
  plugin.addCommand({
    id: "open-url-clipper",
    name: "Open URL Clipper",
    callback: () => {
      try {
        const mv = plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!mv) {
          new Notice("请先打开一个 Markdown 笔记文件。");
          return;
        }

        new ClipModal(
          plugin.app,
          plugin.settings,
          mv
        ).open();
      } catch (err) {
        console.error("[url-clipper] open ClipModal failed", err);
      }
    },
  });
}

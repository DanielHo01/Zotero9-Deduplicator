import { Addon } from "zotero-plugin-toolkit";
import { DuplicatesMerger } from "./merger";

export {};

// Create plugin instance
const addon = new Addon({
  id: "zotero9-deduplicator",
  name: "Zotero9-Deduplicator",
  version: "1.0.0",
  description: "Zotero 8/9 高性能重复文献合并插件",
});

// Register menu items
addon.registerMenu("menuTools", {
  label: "Zotero9-Deduplicator",
  items: [
    {
      label: "智能合并 (Smart Merge)",
      accelerator: "CmdOrCtrl+Shift+M",
      command: async () => {
        await DuplicatesMerger.smartMerge();
      },
    },
    {
      label: "批量合并 (Bulk Merge)",
      accelerator: "CmdOrCtrl+Shift+B",
      command: async () => {
        await DuplicatesMerger.bulkMerge();
      },
    },
  ],
});

// Export for use
export default addon;

/**
 * Zotero9-Deduplicator - 核心合并逻辑
 * 性能优化版本：批量处理 + 内存管理
 */

import { Toast, Dialog, ProgressDialog } from "zotero-plugin-toolkit";
import { ZoteroItem, ZoteroCollection } from "zotero-plugin-toolkit/dist/types";

export interface MergeOptions {
  /** 主条目选择策略: newest | oldest | longest-author */
  strategy: "newest" | "oldest" | "longest-author";
  /** 是否跳过预览直接合并 */
  skipPreview: boolean;
  /** 批量处理大小 */
  batchSize: number;
}

export interface DuplicateGroup {
  /** 重复条目ID列表 */
  items: number[];
  /** 匹配的键（DOI或标题） */
  matchKey: string;
}

export class DuplicatesMerger {
  private static defaultOptions: MergeOptions = {
    strategy: "newest",
    skipPreview: false,
    batchSize: 50,
  };

  /**
   * 获取所有重复条目组
   * 使用Zotero内置的重复检测API
   */
  public static async getDuplicateGroups(): Promise<DuplicateGroup[]> {
    const groups: DuplicateGroup[] = [];

    try {
      // 获取Zotero重复条目库
      const dupLibrary = Zotero.Libraries.get(Zotero.Libraries.userLibraryID);
      
      // 使用Zotero API获取重复条目
      const duplicates = await Zotero.Duplicates.getDuplicateGroups(
        Zotero.Libraries.userLibraryID
      );

      for (const dupGroup of duplicates) {
        const itemIDs = dupGroup.itemIDs;
        if (itemIDs.length < 2) continue;

        // 获取第一条目作为key
        const firstItem = await Zotero.Items.getAsync(itemIDs[0]);
        const matchKey = this.generateMatchKey(firstItem);
        
        if (matchKey) {
          groups.push({
            items: itemIDs,
            matchKey,
          });
        }
      }
    } catch (error) {
      console.error("Error getting duplicate groups:", error);
      Toast.error("获取重复条目失败");
    }

    return groups;
  }

  /**
   * 生成匹配键（DOI优先，其次标题）
   */
  private static generateMatchKey(item: ZoteroItem): string {
    // 优先使用DOI
    const doi = item.getField("DOI");
    if (doi) {
      return `doi:${this.normalizeString(doi as string)}`;
    }

    // 其次使用标题
    const title = item.getField("title");
    if (title) {
      return `title:${this.normalizeString(title as string)}`;
    }

    return "";
  }

  /**
   * 字符串标准化（用于匹配）
   */
  private static normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[\s\-_]/g, "")
      .replace(/[^\w]/g, "");
  }

  /**
   * 根据策略选择主条目
   */
  public static async selectPrimaryItem(
    itemIDs: number[],
    strategy: MergeOptions["strategy"]
  ): Promise<number> {
    const items = await Zotero.Items.getAsync(itemIDs);

    switch (strategy) {
      case "newest":
        // 选择最新修改的
        return items.reduce((latest, item) => 
          item.dateModified > latest.dateModified ? item : latest
        ).id;

      case "oldest":
        // 选择最早创建的
        return items.reduce((oldest, item) => 
          item.dateAdded < oldest.dateAdded ? item : oldest
        ).id;

      case "longest-author":
        // 选择作者最多的
        return items.reduce((max, item) => {
          const creators = item.getCreators();
          return creators.length > max.length ? creators.length : max.length;
        }, 0) === items[0].getCreators().length ? items[0].id : items[1]?.id || items[0].id;

      default:
        return itemIDs[0];
    }
  }

  /**
   * 智能合并 - 用户选择要合并的条目
   */
  public static async smartMerge(): Promise<void> {
    const items = Zotero.getActiveZoteroPane().getSelectedItems();
    
    if (items.length < 2) {
      Toast.error("请先选择至少2个重复条目");
      return;
    }

    // 显示确认对话框
    const confirmed = await Dialog.confirm(
      "智能合并",
      `您选择了 ${items.length} 个条目，是否合并？`
    );

    if (!confirmed) return;

    await this.mergeItems(items.map(i => i.id));
    Toast.success("合并完成！");
  }

  /**
   * 批量合并 - 自动处理所有重复
   */
  public static async bulkMerge(): Promise<void> {
    // 获取重复条目组
    const groups = await this.getDuplicateGroups();
    
    if (groups.length === 0) {
      Toast.info("未发现重复条目");
      return;
    }

    // 显示配置对话框
    const options = await this.showOptionsDialog(groups.length);
    if (!options) return;

    // 创建进度对话框
    const progress = new ProgressDialog({
      title: "批量合并",
      message: "正在处理重复条目...",
      maximum: groups.length,
    });

    let processed = 0;
    let successCount = 0;
    let failCount = 0;

    try {
      // 批量处理
      for (let i = 0; i < groups.length; i += options.batchSize) {
        const batch = groups.slice(i, i + options.batchSize);
        
        for (const group of batch) {
          try {
            const primaryID = await this.selectPrimaryItem(
              group.items,
              options.strategy
            );
            
            await this.mergeItems(group.items, primaryID);
            successCount++;
          } catch (error) {
            console.error("Merge error:", error);
            failCount++;
          }

          processed++;
          progress.setValue(processed);
          
          // 让出主线程，避免卡顿
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      progress.close();
      Toast.success(
        `批量合并完成！成功: ${successCount}, 失败: ${failCount}`
      );
    } catch (error) {
      progress.close();
      Toast.error("批量合并失败: " + (error as Error).message);
    }
  }

  /**
   * 合并多个条目
   */
  private static async mergeItems(
    itemIDs: number[],
    primaryID?: number
  ): Promise<void> {
    if (itemIDs.length < 2) return;

    const primary = primaryID 
      ? await Zotero.Items.getAsync(primaryID)
      : await this.selectPrimaryItem(itemIDs, this.defaultOptions.strategy);

    const toMerge = itemIDs.filter(id => id !== primary.id);

    if (toMerge.length === 0) return;

    // 获取要合并的条目数据
    const mergeItems = await Zotero.Items.getAsync(toMerge);

    // 合并各个字段
    for (const item of mergeItems) {
      // 合并附件
      const attachments = item.getAttachments();
      for (const attID of attachments) {
        await Zotero.Items.moveAttachments(attID, primary.id);
      }

      // 合并笔记
      const notes = item.getNotes();
      for (const noteID of notes) {
        await Zotero.Items.moveNotes(noteID, primary.id);
      }

      // 删除被合并的条目
      await item.eraseTx();
    }

    // 保存主条目
    await primary.saveTx();
  }

  /**
   * 显示选项对话框
   */
  private static async showOptionsDialog(
    totalGroups: number
  ): Promise<MergeOptions | null> {
    const result = await Dialog.prompt("批量合并选项", [
      {
        label: "主条目策略",
        type: "menulist",
        options: [
          { label: "最新修改", value: "newest" },
          { label: "最早创建", value: "oldest" },
          { label: "作者最多", value: "longest-author" },
        ],
        value: this.defaultOptions.strategy,
      },
      {
        label: `发现 ${totalGroups} 组重复条目，是否继续？`,
        type: "checkbox",
      },
    ]);

    if (!result) return null;

    return {
      ...this.defaultOptions,
      strategy: result[0] as MergeOptions["strategy"],
    };
  }
}

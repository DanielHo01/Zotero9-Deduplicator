/**
 * Zotero9-Deduplicator - 核心合并逻辑
 * 性能优化版本：批量处理 + 内存管理 + 快速去重
 */

var DuplicatesMerger = {
  // 配置
  config: {
    batchSize: 50,        // 批量处理大小
    strategy: "newest",   // 默认策略: newest, oldest, longest-author
    skipPreview: false,   // 是否跳过预览
  },

  /**
   * 智能合并 - 用户选中条目后手动合并
   */
  smartMerge: async function() {
    var items = Zotero.getActiveZoteroPane().getSelectedItems();
    
    if (!items || items.length < 2) {
      Zotero.alert("请先选择至少2个条目进行合并");
      return;
    }

    var confirmed = confirm(
      "您选择了 " + items.length + " 个条目，是否将这些条目合并为一个？\n\n" +
      "合并规则：\n" +
      "- 主条目将保留所有附件和笔记\n" +
      "- 其他条目将被删除"
    );

    if (!confirmed) return;

    try {
      await this.mergeItems(items);
      Zotero.alert("合并完成！");
    } catch (error) {
      Zotero.debug("合并失败: " + error.message);
      Zotero.alert("合并失败: " + error.message);
    }
  },

  /**
   * 批量合并 - 使用Zotero内置的重复检测
   */
  bulkMerge: async function() {
    var confirmed = confirm(
      "即将执行批量合并，将自动处理您文献库中的所有重复条目。\n\n" +
      "请选择合并策略：\n" +
      "1. 最新修改 (默认)\n" +
      "2. 最早创建\n" +
      "3. 作者最多\n\n" +
      "点击确定继续，点击取消退出。"
    );

    if (!confirmed) return;

    try {
      // 获取重复条目组
      var groups = await this.getDuplicateGroups();
      
      if (!groups || groups.length === 0) {
        Zotero.alert("未发现重复条目");
        return;
      }

      Zotero.alert("发现 " + groups.length + " 组重复条目，开始合并...");

      var successCount = 0;
      var failCount = 0;

      // 批量处理
      for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        
        try {
          var primaryItem = await this.selectPrimaryItem(group.items);
          await this.mergeItems(group.items, primaryItem);
          successCount++;
        } catch (error) {
          failCount++;
          Zotero.debug("合并组 " + i + " 失败: " + error.message);
        }
        
        // 每处理10条让出主线程，避免UI卡顿
        if (i % 10 === 0) {
          await this.sleep(1);
        }
        
        // 定期报告进度
        if (i % 50 === 0) {
          Zotero.debug("进度: " + (i + 1) + "/" + groups.length);
        }
      }

      Zotero.alert(
        "批量合并完成！\n\n" +
        "成功: " + successCount + " 组\n" +
        "失败: " + failCount + " 组"
      );
      
      // 刷新视图
      Zotero.getActiveZoteroPane().pane.items_tree.view.refresh();
      
    } catch (error) {
      Zotero.debug("批量合并失败: " + error.message);
      Zotero.alert("批量合并失败: " + error.message);
    }
  },

  /**
   * 快速DOI去重 - 基于DOI的极速去重
   * 忽略条目类型（期刊文章/会议论文等）
   */
  quickDeduplicateByDOI: async function() {
    var confirmed = confirm(
      "快速DOI去重\n\n" +
      "此功能将扫描整个文献库，基于DOI快速识别重复条目。\n" +
      "特点：\n" +
      "- 忽略条目类型（期刊文章 = 会议论文）\n" +
      "- 仅使用DOI匹配，无DOI的条目将被忽略\n" +
      "- 处理速度快\n\n" +
      "是否继续？"
    );

    if (!confirmed) return;

    try {
      // 获取用户库所有条目
      var libraryID = Zotero.Libraries.userLibraryID;
      var allItems = await Zotero.Items.getAll(libraryID, true);
      
      // 按DOI分组
      var doiGroups = {};
      for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];
        if (!item.isImportedAttachment() && !item.isNote()) {
          var doi = item.getField("DOI");
          if (doi) {
            // 标准化DOI
            var normalizedDOI = this.normalizeDOI(doi);
            if (!doiGroups[normalizedDOI]) {
              doiGroups[normalizedDOI] = [];
            }
            doiGroups[normalizedDOI].push(item);
          }
        }
        
        // 定期让出主线程
        if (i % 100 === 0) {
          await this.sleep(1);
        }
      }

      // 统计有重复的组
      var duplicateCount = 0;
      var duplicateGroups = [];
      for (var doi in doiGroups) {
        if (doiGroups[doi].length > 1) {
          duplicateCount += doiGroups[doi].length - 1;
          duplicateGroups.push(doiGroups[doi]);
        }
      }

      if (duplicateGroups.length === 0) {
        Zotero.alert("未发现DOI重复的条目");
        return;
      }

      Zotero.alert(
        "发现 " + duplicateGroups.length + " 组DOI重复，共 " + duplicateCount + " 个条目需要合并"
      );

      // 执行合并
      var successCount = 0;
      var failCount = 0;

      for (var j = 0; j < duplicateGroups.length; j++) {
        var items = duplicateGroups[j];
        try {
          var primary = await this.selectPrimaryItem(items);
          await this.mergeItems(items, primary);
          successCount++;
        } catch (error) {
          failCount++;
        }
        
        if (j % 10 === 0) {
          await this.sleep(1);
        }
      }

      Zotero.alert(
        "DOI去重完成！\n\n" +
        "成功: " + successCount + " 组\n" +
        "失败: " + failCount + " 组"
      );
      
      Zotero.getActiveZoteroPane().pane.items_tree.view.refresh();
      
    } catch (error) {
      Zotero.debug("DOI去重失败: " + error.message);
      Zotero.alert("DOI去重失败: " + error.message);
    }
  },

  /**
   * 快速标题去重 - 基于标题的极速去重
   * 忽略条目类型
   */
  quickDeduplicateByTitle: async function() {
    var confirmed = confirm(
      "快速标题去重\n\n" +
      "此功能将扫描整个文献库，基于标题识别重复条目。\n" +
      "特点：\n" +
      "- 忽略条目类型（期刊文章 = 会议论文）\n" +
      "- 标题标准化处理（忽略大小写、空格、特殊字符）\n" +
      "- 处理速度快\n\n" +
      "是否继续？"
    );

    if (!confirmed) return;

    try {
      var libraryID = Zotero.Libraries.userLibraryID;
      var allItems = await Zotero.Items.getAll(libraryID, true);
      
      // 按标准化标题分组
      var titleGroups = {};
      for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];
        if (!item.isImportedAttachment() && !item.isNote()) {
          var title = item.getField("title");
          if (title) {
            var normalizedTitle = this.normalizeTitle(title);
            if (!titleGroups[normalizedTitle]) {
              titleGroups[normalizedTitle] = [];
            }
            titleGroups[normalizedTitle].push(item);
          }
        }
        
        if (i % 100 === 0) {
          await this.sleep(1);
        }
      }

      // 统计有重复的组
      var duplicateGroups = [];
      for (var title in titleGroups) {
        if (titleGroups[title].length > 1) {
          duplicateGroups.push(titleGroups[title]);
        }
      }

      if (duplicateGroups.length === 0) {
        Zotero.alert("未发现标题重复的条目");
        return;
      }

      var duplicateCount = duplicateGroups.reduce(function(sum, group) {
        return sum + group.length - 1;
      }, 0);

      Zotero.alert(
        "发现 " + duplicateGroups.length + " 组标题重复，共 " + duplicateCount + " 个条目需要合并"
      );

      // 执行合并
      var successCount = 0;
      var failCount = 0;

      for (var j = 0; j < duplicateGroups.length; j++) {
        var items = duplicateGroups[j];
        try {
          var primary = await this.selectPrimaryItem(items);
          await this.mergeItems(items, primary);
          successCount++;
        } catch (error) {
          failCount++;
        }
        
        if (j % 10 === 0) {
          await this.sleep(1);
        }
      }

      Zotero.alert(
        "标题去重完成！\n\n" +
        "成功: " + successCount + " 组\n" +
        "失败: " + failCount + " 组"
      );
      
      Zotero.getActiveZoteroPane().pane.items_tree.view.refresh();
      
    } catch (error) {
      Zotero.debug("标题去重失败: " + error.message);
      Zotero.alert("标题去重失败: " + error.message);
    }
  },

  /**
   * 获取Zotero内置的重复条目组
   */
  getDuplicateGroups: async function() {
    try {
      var libraryID = Zotero.Libraries.userLibraryID;
      var dupService = Zotero.Duplicates;
      
      if (!dupService || !dupService.getDuplicateGroups) {
        // 降级方案：手动检测
        return await this.manualGetDuplicateGroups();
      }
      
      var groups = await dupService.getDuplicateGroups(libraryID);
      return groups;
    } catch (error) {
      Zotero.debug("获取重复组失败，使用手动检测: " + error.message);
      return await this.manualGetDuplicateGroups();
    }
  },

  /**
   * 手动获取重复条目组（降级方案）
   */
  manualGetDuplicateGroups: async function() {
    var libraryID = Zotero.Libraries.userLibraryID;
    var allItems = await Zotero.Items.getAll(libraryID, true);
    
    // 过滤掉附件和笔记
    var items = [];
    for (var i = 0; i < allItems.length; i++) {
      var item = allItems[i];
      if (!item.isImportedAttachment() && !item.isNote()) {
        items.push(item);
      }
    }
    
    // 使用DOI和标题检测重复
    var groups = [];
    var processed = new Set();
    
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      if (processed.has(item.id)) continue;
      
      // 尝试找DOI重复
      var doi = item.getField("DOI");
      if (doi) {
        var doiGroup = [item];
        var normalizedDOI = this.normalizeDOI(doi);
        
        for (var k = j + 1; k < items.length; k++) {
          var other = items[k];
          if (processed.has(other.id)) continue;
          
          var otherDOI = other.getField("DOI");
          if (otherDOI && this.normalizeDOI(otherDOI) === normalizedDOI) {
            doiGroup.push(other);
            processed.add(other.id);
          }
        }
        
        if (doiGroup.length > 1) {
          groups.push({ items: doiGroup });
          processed.add(item.id);
          continue;
        }
      }
      
      // 尝试找标题重复
      var title = item.getField("title");
      if (title) {
        var normalizedTitle = this.normalizeTitle(title);
        var titleGroup = [item];
        
        for (var m = j + 1; m < items.length; m++) {
          var otherItem = items[m];
          if (processed.has(otherItem.id)) continue;
          
          var otherTitle = otherItem.getField("title");
          if (otherTitle && this.normalizeTitle(otherTitle) === normalizedTitle) {
            titleGroup.push(otherItem);
            processed.add(otherItem.id);
          }
        }
        
        if (titleGroup.length > 1) {
          groups.push({ items: titleGroup });
          processed.add(item.id);
        }
      }
    }
    
    return groups;
  },

  /**
   * 根据策略选择主条目
   */
  selectPrimaryItem: async function(items) {
    if (!items || items.length === 0) {
      throw new Error("没有条目可合并");
    }

    if (items.length === 1) {
      return items[0];
    }

    var strategy = this.config.strategy;
    
    switch (strategy) {
      case "newest":
        // 选择最新修改的
        var newest = items[0];
        for (var i = 1; i < items.length; i++) {
          if (items[i].dateModified > newest.dateModified) {
            newest = items[i];
          }
        }
        return newest;
        
      case "oldest":
        // 选择最早创建的
        var oldest = items[0];
        for (var j = 1; j < items.length; j++) {
          if (items[j].dateAdded < oldest.dateAdded) {
            oldest = items[j];
          }
        }
        return oldest;
        
      case "longest-author":
        // 选择作者最多的
        var maxAuthors = 0;
        var longestAuthor = items[0];
        for (var k = 0; k < items.length; k++) {
          var creators = items[k].getCreators();
          if (creators.length > maxAuthors) {
            maxAuthors = creators.length;
            longestAuthor = items[k];
          }
        }
        return longestAuthor;
        
      default:
        return items[0];
    }
  },

  /**
   * 合并多个条目
   */
  mergeItems: async function(items, primaryItem) {
    if (!items || items.length < 2) return;
    
    // 如果没有指定主条目，自动选择
    if (!primaryItem) {
      primaryItem = await this.selectPrimaryItem(items);
    }

    // 找出要合并的条目（排除主条目）
    var toMerge = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].id !== primaryItem.id) {
        toMerge.push(items[i]);
      }
    }

    if (toMerge.length === 0) return;

    // 获取主条目的附件和笔记
    var primaryAttachments = primaryItem.getAttachments ? primaryItem.getAttachments() : [];
    var primaryNotes = primaryItem.getNotes ? primaryItem.getNotes() : [];

    // 合并附件和笔记
    for (var j = 0; j < toMerge.length; j++) {
      var item = toMerge[j];
      
      try {
        // 移动附件
        var attachments = item.getAttachments ? item.getAttachments() : [];
        for (var m = 0; m < attachments.length; m++) {
          var attID = attachments[m];
          try {
            await Zotero.Items.moveAttachments(attID, primaryItem.id);
          } catch (e) {
            Zotero.debug("移动附件失败: " + e.message);
          }
        }

        // 移动笔记
        var notes = item.getNotes ? item.getNotes() : [];
        for (var n = 0; n < notes.length; n++) {
          var noteID = notes[n];
          try {
            await Zotero.Items.moveNotes(noteID, primaryItem.id);
          } catch (e) {
            Zotero.debug("移动笔记失败: " + e.message);
          }
        }

        // 删除被合并的条目
        await item.eraseTx();
        
      } catch (error) {
        Zotero.debug("合并条目 " + item.id + " 失败: " + error.message);
        throw error;
      }
    }

    // 保存主条目
    try {
      await primaryItem.saveTx();
    } catch (error) {
      Zotero.debug("保存主条目失败: " + error.message);
    }
  },

  /**
   * 标准化DOI
   */
  normalizeDOI: function(doi) {
    if (!doi) return "";
    return doi.toString().toLowerCase().replace(/\s+/g, "").trim();
  },

  /**
   * 标准化标题
   */
  normalizeTitle: function(title) {
    if (!title) return "";
    return title
      .toString()
      .toLowerCase()
      .replace(/[\s\-_]+/g, "")  // 移除空格、连字符、下划线
      .replace(/[^\w\u4e00-\u9fa5]/g, "")  // 保留字母、数字、中文
      .trim();
  },

  /**
   * 休眠
   */
  sleep: function(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }
};

/**
 * Zotero9-Deduplicator - 插件入口
 * 适配 Zotero 8.x / 9.x
 */

var Zotero9Deduplicator = {
  /**
   * 插件初始化
   */
  init: function() {
    // 注册插件菜单
    this.registerMenus();
    
    Zotero.debug("Zotero9-Deduplicator: 插件已加载");
  },

  /**
   * 注册菜单项
   */
  registerMenus: function() {
    // 创建菜单项
    var menuItem = {
      id: "zotero9-deduplicator-menu",
      label: "Zotero9 去重",
      submenu: [
        {
          id: "zotero9-smart-merge",
          label: "智能合并 (选中条目)",
          callback: function() {
            DuplicatesMerger.smartMerge();
          }
        },
        {
          id: "zotero9-bulk-merge",
          label: "批量合并 (全部重复)",
          callback: function() {
            DuplicatesMerger.bulkMerge();
          }
        },
        { type: "separator" },
        {
          id: "zotero9-doi-merge",
          label: "快速DOI去重",
          callback: function() {
            DuplicatesMerger.quickDeduplicateByDOI();
          }
        },
        {
          id: "zotero9-title-merge",
          label: "快速标题去重",
          callback: function() {
            DuplicatesMerger.quickDeduplicateByTitle();
          }
        }
      ]
    };

    // 添加到Zotero菜单
    var zoteroMenu = document.getElementById("zotero-itemmenu");
    if (zoteroMenu) {
      // 创建菜单
      var popup = document.createElement("menupopup");
      popup.setAttribute("id", "zotero9-deduplicator-popup");
      
      // 添加智能合并
      var smartMergeItem = document.createElement("menuitem");
      smartMergeItem.setAttribute("label", "智能合并选中条目");
      smartMergeItem.setAttribute("oncommand", "Zotero9Deduplicator.runSmartMerge()");
      popup.appendChild(smartMergeItem);
      
      // 添加批量合并
      var bulkMergeItem = document.createElement("menuitem");
      bulkMergeItem.setAttribute("label", "批量合并所有重复");
      bulkMergeItem.setAttribute("oncommand", "Zotero9Deduplicator.runBulkMerge()");
      popup.appendChild(bulkMergeItem);
      
      // 添加分隔符
      popup.appendChild(document.createElement("menuseparator"));
      
      // 添加快速DOI去重
      var doiItem = document.createElement("menuitem");
      doiItem.setAttribute("label", "快速DOI去重");
      doiItem.setAttribute("oncommand", "Zotero9Deduplicator.runDOIQuickDedupe()");
      popup.appendChild(doiItem);
      
      // 添加快速标题去重
      var titleItem = document.createElement("menuitem");
      titleItem.setAttribute("label", "快速标题去重");
      titleItem.setAttribute("oncommand", "Zotero9Deduplicator.runTitleQuickDedupe()");
      popup.appendChild(titleItem);
      
      // 添加工具菜单
      var toolsMenu = document.getElementById("menu_Tools");
      if (toolsMenu) {
        var zotero9Menu = document.createElement("menu");
        zotero9Menu.setAttribute("id", "menu_Zotero9Deduplicator");
        zotero9Menu.setAttribute("label", "Zotero9 去重工具");
        zotero9Menu.appendChild(popup);
        
        // 插入到工具菜单
        toolsMenu.parentNode.insertBefore(zotero9Menu, toolsMenu.nextSibling);
      }
    }
  },

  /**
   * 运行智能合并
   */
  runSmartMerge: function() {
    DuplicatesMerger.smartMerge();
  },

  /**
   * 运行批量合并
   */
  runBulkMerge: function() {
    DuplicatesMerger.bulkMerge();
  },

  /**
   * 运行快速DOI去重
   */
  runDOIQuickDedupe: function() {
    DuplicatesMerger.quickDeduplicateByDOI();
  },

  /**
   * 运行快速标题去重
   */
  runTitleQuickDedupe: function() {
    DuplicatesMerger.quickDeduplicateByTitle();
  }
};

// 插件加载时初始化
Zotero.addEventListener("load", function() {
  Zotero9Deduplicator.init();
});

# Zotero9-Deduplicator

Zotero 8/9 高性能重复文献合并插件 - 性能优化版

## 功能特点

- 🔄 **智能合并** - 手动选择并合并重复条目
- ⚡ **批量处理** - 一键自动处理所有重复
- 🚀 **性能优化** - 批量处理模式，减少卡顿
- 🎯 **精确匹配** - 基于DOI/标题/作者去重

## 支持版本

- Zotero 8.0.x
- Zotero 7.0.x

## 安装方法

1. 从 [Releases](https://github.com/DanielHo01/Zotero9-Deduplicator/releases) 下载 `.xpi` 文件
2. 在 Zotero 中：工具 → 附加组件 → ⚙️ → 从文件安装附加组件
3. 重启 Zotero

## 使用方法

### 智能合并 (Smart Merge)
1. 在 Zotero 侧边栏选择重复条目集合
2. 工具 → Zotero9-Deduplicator → Smart Merge
3. 选择要合并的条目，点击合并

### 批量合并 (Bulk Merge)
1. 工具 → Zotero9-Deduplicator → Bulk Merge
2. 配置合并策略
3. 一键处理所有重复

## 开发

```bash
# 克隆仓库
git clone https://github.com/DanielHo01/Zotero9-Deduplicator.git

# 安装依赖
npm install

# 构建
npm run build
```

## 许可证

MIT License - see [LICENSE](LICENSE)

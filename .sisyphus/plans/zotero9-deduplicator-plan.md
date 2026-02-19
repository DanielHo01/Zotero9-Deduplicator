# Zotero9-Deduplicator 开发计划

## 项目概述

- **目标**: 为 Zotero 8.x 开发高性能重复文献合并插件
- **版本**: Zotero 8.0.3 (64-bit)
- **基础**: 基于 frangoud/ZoteroDuplicatesMerger 彻底重构

## 核心目标

### Phase 1: 基础功能 + Z8兼容
- [ ] 创建GitHub仓库并设置remote
- [ ] 适配Zotero 8插件manifest格式
- [ ] 使用zotero-plugin-toolkit简化开发
- [ ] 保留Smart Merge功能
- [ ] 保留Bulk Merge功能

### Phase 2: 性能优化
- [ ] 批量处理模式（50条/批）
- [ ] 后台Worker处理
- [ ] 内存及时释放
- [ ] 进度条节流更新
- [ ] 异步非阻塞处理

### Phase 3: 增强功能（后续）
- [ ] DOI快速去重模式
- [ ] 标题去重（忽略类型）
- [ ] 可配置的匹配规则

## 技术栈

- **插件框架**: zotero-plugin-toolkit
- **清单格式**: manifest.json (v3)
- **UI**: HTML + Web Components
- **目标版本**: Zotero 8.0.x

## 等待用户输入

- [ ] GitHub仓库URL: 待用户提供

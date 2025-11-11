# DSL 统一查询系统开发文档

## 📋 文档说明

本文档记录 DSL 统一查询系统的开发进度、实现细节和开发计划。

**文档状态**: 🟢 开发中  
**最后更新**: 2025-01-XX  
**维护者**: 开发团队

> 📖 **详细实现文档**: 请参考 [IMPLEMENTATION.md](./IMPLEMENTATION.md) - 包含完整的代码结构、API 映射、实现细节等

---

## 🎯 项目概述

DSL 统一查询系统旨在为 Mini Wolverine 提供一套统一的查询语法，将 `fetch_by_code`、`fetch_by_time` 和公式查询统一为同一套 DSL 语法。

### 核心特性

- ✅ **统一语法**: 三种查询类型使用同一套语法
- ✅ **实时验证**: 输入时自动验证语法
- ✅ **独立 Tab**: 不干扰现有代码结构
- ✅ **保存查询**: 支持保存和加载常用查询

---

## 📊 开发进度

### Phase 1: 核心解析器（MVP）✅ 已完成

**状态**: ✅ 已完成  
**完成时间**: 2025-01-XX

#### 已完成功能

- [x] **DSL Parser 核心解析器** (`frontend-vue/src/utils/dslParser.ts`)
  - [x] 基础语法解析（手写递归下降解析器）
  - [x] 支持 `ft:`, `fc:`, `fm:` 三种查询类型
  - [x] Namespace 解析（`global::`, `private::`）
  - [x] Revision 解析（`@数字`）
  - [x] 市场代码解析（`[market:code]`）
  - [x] 粒度解析（支持单位格式和纯数字）
  - [x] 时间格式解析（ISO、时间戳、相对时间）
  - [x] 选项参数解析（`fields:`, `namespace:`, `+subscribe` 等）
  - [x] 语法验证和错误提示

- [x] **类型定义** (`frontend-vue/src/types/dsl.ts`)
  - [x] `QueryAST` - 查询抽象语法树
  - [x] `QueryOptions` - 查询选项
  - [x] `ParseError` - 解析错误
  - [x] `QueryResult` - 查询结果
  - [x] `SavedQuery` - 保存的查询

- [x] **DSL Query Tab 组件** (`frontend-vue/src/components/DSLQueryTab.vue`)
  - [x] DSL 输入框（实时语法验证）
  - [x] 快捷操作按钮（Execute, Clear, Copy, Validate, Save As）
  - [x] 语法帮助面板
  - [x] 保存查询功能（localStorage）
  - [x] 查询历史列表
  - [x] 结果展示区域（基础）

- [x] **集成到 TabSection**
  - [x] 添加 "DSL Query" tab
  - [x] 不干扰现有代码结构
  - [x] 独立运行

#### 测试验证

- [x] 基本查询语法解析测试
- [x] Namespace 解析测试
- [x] 时间格式解析测试
- [x] 错误提示测试
- [x] 完整 DSL 解析测试
  - [x] `fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02` ✅ 通过
  - [x] 所有字段正确解析（namespace, revision, granularity, timeRange）✅ 通过

#### 已知问题

- [x] ~~`rest` 变量被声明为 `const` 导致无法重新赋值~~ ✅ 已修复
- [x] ~~ISO 日期时区问题（本地时间 vs UTC）~~ ✅ 已修复（统一使用 UTC）

---

### Phase 2: 查询执行 🔄 进行中

**状态**: 🔄 进行中  
**开始时间**: 2025-01-XX  
**预计时间**: 1 周

#### 进行中功能

- [x] **Query Executor 实现** (`frontend-vue/src/utils/dslExecutor.ts`)
  - [x] Query AST → 后端 API 参数转换
  - [x] 时间格式转换（统一为时间戳）
  - [x] 粒度格式转换（统一为秒数）
  - [x] Namespace 转换（`global` / `private`）
  - [x] 路由到现有 API
    - [x] `fetch_by_code` WebSocket 消息
    - [x] `fetch_by_time` WebSocket 消息
    - [x] `calculate_formula` WebSocket 消息
  - [x] 错误处理
    - [x] 网络错误处理
    - [x] 后端错误响应处理
    - [x] 超时处理
  - [x] 结果格式统一
    - [x] 统一为 `QueryResult` 格式
    - [x] 字段映射和转换
  - [x] 响应处理机制（通过 watch lastMessage）
  - [x] 集成到 DSLQueryTab 组件

#### 已完成功能（最新）

- [x] **自动 Fields 补充**
  - [x] 从 schema 缓存获取所有 fields
  - [x] 未指定 fields 时自动补充
  - [x] 支持 namespace 和 revision 匹配
- [x] **RequestId 匹配优化**
  - [x] `fetch_by_code` 只根据 requestId 匹配
  - [x] 后端返回 requestId 支持
- [x] **消息格式统一**
  - [x] `fetch_by_time` 使用与 watchlist 相同的格式
  - [x] 使用 `params` 对象包装参数

#### 待测试功能

- [ ] 端到端测试 `fetch_by_code` 查询
- [ ] 测试 `fetch_by_time` 查询
- [ ] 测试 `formula` 查询
- [ ] 测试错误处理
- [ ] 测试超时处理
- [ ] 测试自动 fields 补充功能

#### 技术细节

**API 映射规则**:

```typescript
// 1. fetch_by_code (fc:)
{
  type: 'fetch_by_code',
  market: string,
  code: string,
  fromTime: number,        // Unix timestamp (秒)
  toTime: number,          // Unix timestamp (秒)
  granularity: number,     // 秒数
  fields?: string[],
  metaName: string,        // 指标名称
  namespace: 'global' | 'private',
  revision: number         // -1 表示最新
}

// 2. fetch_by_time (ft:)
// 注意: 后端可能使用 fetchByTime 方法，需要确认具体参数格式
{
  type: 'fetch_by_time',
  market: string,
  code: string,
  time: number,            // Unix timestamp (秒)
  granularity: number,
  metaName: string,
  namespace: 'global' | 'private',
  revision: number
}

// 3. formula (fm:)
{
  type: 'calculate_formula',
  uuid: string,            // 公式 UUID（需要先注册）
  market: string,
  code: string,
  fromTime: number,        // Unix timestamp (毫秒)
  toTime: number,          // Unix timestamp (毫秒)
  granularity: number,     // 秒数
  isRealTime: boolean      // 是否实时订阅
}
```

**时间格式转换**:
- DSL 中的时间格式统一转换为 Unix 时间戳
- `fetch_by_code`: 使用秒级时间戳
- `fetch_by_time`: 使用秒级时间戳
- `formula`: 使用毫秒级时间戳（注意差异）

#### 待确认事项

- [ ] `fetch_by_time` 的具体参数格式（需确认后端实现）
- [ ] 公式查询的 UUID 获取方式（注册流程）
- [ ] WebSocket 消息格式完全确认
- [ ] 错误响应格式确认

---

### Phase 3: UI 集成 🔄 待开始

**状态**: 🔄 待开始  
**预计时间**: 2-3 周

#### 待实现功能

- [ ] **DSL 输入框增强**
  - [ ] 语法高亮（可选，使用 Monaco Editor 或 CodeMirror）
  - [ ] 自动补全提示（可选）
  - [ ] 快捷键支持（`Ctrl+Enter` 执行，`Ctrl+K` 清除）

- [ ] **查询结果展示**
  - [ ] Table 视图
    - [ ] 可排序、筛选、分页
    - [ ] 支持列宽调整、列显示/隐藏
    - [ ] 导出为 CSV 或 JSON
    - [ ] 实时数据更新时高亮显示新行
  - [ ] Chart 视图
    - [ ] 支持多种图表类型（K线图、折线图、柱状图）
    - [ ] 交互式缩放、平移
    - [ ] 数据点悬停显示详细信息
    - [ ] 支持多指标叠加显示（公式查询）
    - [ ] 导出为 PNG 图片
  - [ ] 视图切换（Table ↔ Chart）

- [ ] **实时订阅功能**
  - [ ] 订阅状态显示
  - [ ] 数据自动更新
  - [ ] 新数据高亮
  - [ ] 暂停/停止订阅

- [ ] **Save As 功能增强**
  - [ ] 编辑已保存的查询
  - [ ] 查询使用统计
  - [ ] 查询搜索和排序

---

### Phase 4: 高级功能（可选）⏸️ 待定

**状态**: ⏸️ 待定  
**预计时间**: 按需

#### 可选功能

- [ ] 批量查询支持
- [ ] 条件筛选
- [ ] 查询模板
- [ ] 查询历史记录（已包含在 Phase 3）

---

## 📁 文件结构

```
frontend-vue/
├── src/
│   ├── types/
│   │   └── dsl.ts                    # DSL 类型定义 ✅
│   ├── utils/
│   │   ├── dslParser.ts             # DSL 解析器 ✅
│   │   └── dslExecutor.ts           # DSL 执行器 ⏳ (待实现)
│   └── components/
│       └── DSLQueryTab.vue          # DSL Query Tab 组件 ✅
```

---

## 🔧 技术栈

### 已使用

- **前端框架**: Vue 3 (Composition API)
- **语言**: TypeScript
- **解析器**: 手写递归下降解析器
- **存储**: localStorage (保存查询)

### 待选择

- **代码编辑器**: Monaco Editor 或 CodeMirror（语法高亮）
- **图表库**: ECharts、Chart.js 或 Recharts（数据可视化）

---

## 🐛 已知问题

### 已修复

- [x] ~~`rest` 变量被声明为 `const` 导致无法重新赋值~~ ✅ 已修复

### 待解决

- [ ] 暂无

---

## 📝 开发日志

### 2025-01-XX: Phase 1 完成

**完成内容**:
- 实现了 DSL Parser 核心解析器
- 创建了 DSL Query Tab 组件
- 集成到 TabSection，添加独立 tab
- 实现了基本的语法验证和错误提示
- 实现了查询保存功能（localStorage）

**测试结果**:
- ✅ 基本查询语法解析正常
- ✅ Namespace 解析正常
- ✅ 时间格式解析正常
- ✅ 错误提示正常
- ✅ 完整 DSL 解析测试通过

**下一步**:
- 开始 Phase 2: 实现 Query Executor
- 连接后端 API，实现实际查询功能

---

### 2025-01-XX: Phase 2 开始

**完成内容**:
- 实现了 Query Executor (`frontend-vue/src/utils/dslExecutor.ts`)
- 实现了 Query AST → 后端 API 参数转换
- 实现了三种查询类型的消息发送
- 实现了响应处理机制（通过 watch lastMessage）
- 实现了结果格式统一转换
- 集成到 DSLQueryTab 组件

**实现细节**:
- 使用 Promise 模式处理异步查询
- 通过 watch lastMessage 监听响应
- 支持 requestId 匹配和类型匹配（当后端不返回 requestId 时）
- 保存原始 AST 用于构建结果

**已完成（最新）**:
- [x] 自动 fields 补充功能
- [x] RequestId 匹配机制优化
- [x] 消息格式统一（与 watchlist 一致）

**待测试**:
- [ ] 端到端测试 `fetch_by_code` 查询
- [ ] 测试 `fetch_by_time` 查询
- [ ] 测试 `formula` 查询
- [ ] 测试错误处理
- [ ] 测试超时处理
- [ ] 测试自动 fields 补充功能

---

## 📝 小公式查询实现计划

### 待实现功能

- [ ] **公式列表缓存**
  - [ ] 在 `dataStore` 中添加 `formulaList` 状态
  - [ ] 实现公式列表查询和缓存逻辑
  - [ ] 支持手动刷新公式列表
  - [ ] 在 DSL 组件初始化时自动加载公式列表

- [ ] **公式查询流程**
  - [ ] 解析 DSL 中的公式名称
  - [ ] 从缓存中查找公式信息（`formulaId`、`sourceCode`）
  - [ ] 实现 `register_formula` 消息发送和响应处理
  - [ ] 实现 `calculate_formula` 消息发送和响应处理
  - [ ] 处理公式计算结果（`data` 和 `displayConfiguration`）

- [ ] **错误处理**
  - [ ] 公式不存在时的错误提示
  - [ ] 注册失败时的错误处理
  - [ ] 计算失败时的错误处理

### 标准流程参考

详细的小公式查询标准流程请参考 [UNIFIED_QUERY_DSL_DESIGN.md](./UNIFIED_QUERY_DSL_DESIGN.md#-小公式查询标准流程) 文档。

## 🚀 下一步计划

### 短期（1-2 周）

1. **实现 Query Executor** (Phase 2)
   - 实现 `fetch_by_code` 查询
   - 确认并实现 `fetch_by_time` 查询
   - 实现 `formula` 查询
   - 处理查询结果并统一格式

2. **测试和调试**
   - 端到端测试
   - 错误处理测试
   - 性能测试

### 中期（2-4 周）

1. **UI 集成** (Phase 3)
   - 实现 Table/Chart 视图
   - 实现实时订阅功能
   - 增强 Save As 功能

2. **用户体验优化**
   - 语法高亮（可选）
   - 自动补全（可选）
   - 快捷键支持

### 长期（按需）

1. **高级功能** (Phase 4)
   - 批量查询
   - 条件筛选
   - 查询模板

---

## 📚 相关文档

- [UNIFIED_QUERY_DSL_DESIGN.md](./UNIFIED_QUERY_DSL_DESIGN.md) - DSL 设计文档
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - **实现文档**（代码结构、API 映射、实现细节）
- [BACKEND_API_REFERENCE.md](../BACKEND_API_REFERENCE.md) - 后端 API 参考
- [FORMULA_COMPLETE_WORKFLOW_CN.md](../FORMULA_COMPLETE_WORKFLOW_CN.md) - 公式完整工作流程

---

## 🔗 相关代码

- `frontend-vue/src/utils/dslParser.ts` - DSL 解析器实现
- `frontend-vue/src/components/DSLQueryTab.vue` - DSL Query Tab 组件
- `frontend-vue/src/types/dsl.ts` - DSL 类型定义

---

## 📝 更新日志

| 日期 | 版本 | 更新内容 | 作者 |
|------|------|---------|------|
| 2025-01-XX | 0.1.0 | Phase 1 完成：核心解析器和基础 UI | 开发团队 |

---

**文档维护**: 本文档将随着开发进展持续更新。所有重要的开发决策和进度都应记录在此文档中。


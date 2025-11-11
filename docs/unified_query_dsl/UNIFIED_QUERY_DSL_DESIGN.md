# 统一查询 DSL 设计文档

## 📋 文档说明

本文档记录 Mini Wolverine 统一查询 DSL（Domain Specific Language）的设计、实现和演进过程。该 DSL 旨在统一指标查询、公式查询和订阅功能，提供简洁、易用的查询接口。

**文档状态**: 🟢 开发中  
**最后更新**: 2025-01-XX  
**维护者**: 开发团队

**相关文档**: 
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发进度和实现细节

---

## 🎯 设计目标

### 核心目标

1. **统一接口**: 将 `fetch_by_code`、`fetch_by_time`、公式查询统一为同一套语法
2. **简洁易用**: 一行 DSL 替代多行配置，降低使用门槛
3. **直接查询**: 每次查询直接刷新，不依赖缓存
4. **可扩展性**: 语法易于扩展新功能（批量查询、条件筛选等）
5. **双向转换**: 支持 DSL ↔ UI 表单双向转换

### 使用场景

- ✅ **快速查询**: 命令行、脚本中的快速数据查询
- ✅ **批量查询**: 多指标对比、批量数据获取
- ✅ **配置保存**: 收藏常用查询、分享查询配置
- ✅ **API 调用**: REST/GraphQL API 中的查询参数
- ✅ **模板化**: 使用变量模板化查询语句

---

## 📐 语法设计

### 语法规范

#### 基本结构

```
<query_type>:[<namespace>::]<indicator_or_formula>[@revision][market:code] | <granularity> | <time_range> | <options>
```

**Namespace 支持**:
- 格式: `<namespace>::` 前缀，用于指定命名空间
- 可选: 如果不指定，默认使用 `global`
- 支持值: `global` 或 `private`
- 示例: `fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02`

**注意**: 名称/别名不包含在 DSL 语法中，通过 UI 的 `saveAs` 功能单独管理，与 DSL 语义分开存储。

#### 语法元素说明

| 元素 | 符号 | 说明 | 示例 |
|------|------|------|------|
| 查询类型 | `ft:` / `fc:` / `fm:` | fetch_by_time / fetch_by_code / formula | `fc:` |
| Namespace | `<namespace>::` | 可选，命名空间前缀 | `global::` / `private::` |
| 指标/公式名 | 字符串 | 指标名称或公式名称 | `SampleQuote` / `Ma` |
| Revision | `@数字` | 版本号，可选（默认最新） | `@0` / `@-1` |
| 市场代码 | `[market:code]` | 方括号包裹，冒号分隔 | `[CZCE:ap<00>]` |
| 粒度 | 数字+单位 或 纯数字（秒） | 时间粒度 | `1m` / `1h` / `1d` / `86400` |
| 时间范围 | `from..to` | 双点表示范围 | `2025-01-01..2025-01-02` |
| 选项 | `+option` | 加号前缀表示启用 | `+subscribe` / `+real` |

### 查询类型

#### 1. Fetch by Time (`ft:`)

**用途**: 查询特定时间点的数据（单时间点）

**语法**:
```
ft:[<namespace>::]<indicator>[@revision][market:code] | <granularity> | <time>
```

**示例**:
```
# 基本查询（默认 global namespace）
ft:SampleQuote@0[CZCE:ap<00>] | 1m | 2025-01-01

# 指定 global namespace
ft:global::SampleQuote@0[CZCE:ap<00>] | 1m | 2025-01-01

# 指定 private namespace
ft:private::SampleQuote@0[CZCE:ap<00>] | 1m | 2025-01-01

# 查询最新数据（使用 now）
ft:SampleQuote@0[CZCE:ap<00>] | 1h | now

# 查询指定时间戳（毫秒级，推荐）
ft:SampleQuote@0[CZCE:ap<00>] | 1d | 1762310700000

# 使用纯数字粒度（秒数）
ft:SampleQuote@0[CZCE:ap<00>] | 86400 | 1762310700000
```

#### 2. Fetch by Code (`fc:`)

**用途**: 查询时间范围内的历史数据

**语法**:
```
fc:[<namespace>::]<indicator>[@revision][market:code] | <granularity> | <from>..<to> | [options]
```

**示例**:
```
# 基本查询（默认 global namespace）
fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02

# 指定 global namespace
fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02

# 指定 private namespace
fc:private::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02

# 查询到当前时间
fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..now

# 使用毫秒级时间戳
fc:SampleQuote@0[CZCE:ap<00>] | 1h | 1762310700000..1762397100000

# 使用纯数字粒度（秒数）
fc:SampleQuote@0[CZCE:ap<00>] | 3600 | 2025-01-01..2025-01-02

# 带字段筛选
fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02 | fields:open,close,high,low

# 注意: namespace 可以通过指标名前缀指定，也可以通过选项参数指定（选项参数优先级更高）
fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02 | namespace:private
```

#### 3. Formula Query (`fm:`)

**用途**: 查询公式计算结果，支持实时订阅

**语法**:
```
fm:<formula_name>[market:code] | <granularity> | <from>..<to> | [options]
```

**示例**:
```
# 公式查询（历史数据）
fm:Ma[CZCE:ap<00>] | 5m | 2025-01-01..2025-01-02

# 公式查询 + 实时订阅
fm:Ma[CZCE:ap<00>] | 5m | 2025-01-01..now | +subscribe

# 公式查询（使用公式 ID）
fm:Ma@-222[CZCE:ap<00>] | 5m | 2025-01-01..now | +subscribe

# 公式查询 + 指定字段
fm:Ma[CZCE:ap<00>] | 5m | 2025-01-01..now | fields:macd,macd_diff | +subscribe
```

### 时间格式

#### 支持的格式

| 格式 | 示例 | 说明 |
|------|------|------|
| ISO 日期 | `2025-01-01` | 标准日期格式 |
| ISO 日期时间 | `2025-01-01T10:00:00` | 带时间的日期 |
| Unix 时间戳（秒） | `1704067200` | 秒级时间戳 |
| Unix 时间戳（毫秒） | `1762310700000` | 毫秒级时间戳（推荐） |
| 相对时间 | `now` | 当前时间 |
| 相对时间 | `-1d` | 1天前 |
| 相对时间 | `-7d` | 7天前 |

**注意**: 所有输入的时间格式在规范化后都会转换为毫秒级时间戳（如 `1762310700000`）

#### 时间范围表示

- `from..to`: 时间范围（双点分隔）
- `time`: 单时间点（用于 fetch_by_time）

**示例**:
```
# 日期范围
2025-01-01..2025-01-02

# 精确时间范围
2025-01-01T00:00:00..2025-01-02T23:59:59

# 时间戳范围（秒级）
1704067200..1704153600

# 时间戳范围（毫秒级，推荐）
1762310700000..1762397100000

# 混合格式
2025-01-01..1762397100000

# 相对时间
2025-01-01..now
-7d..now
```

**规范化后**: 所有时间格式都会转换为毫秒级时间戳格式
```
1762310700000..1762397100000
```

### 粒度格式

粒度支持两种格式：

#### 1. 带单位格式

| 单位 | 符号 | 秒数 | 示例 |
|------|------|------|------|
| 秒 | `s` | 1 | `60s` |
| 分钟 | `m` | 60 | `1m` / `5m` / `15m` |
| 小时 | `h` | 3600 | `1h` / `4h` |
| 天 | `d` | 86400 | `1d` / `7d` |
| 周 | `w` | 604800 | `1w` |
| 月 | `M` | 2592000 | `1M` |

#### 2. 纯数字格式（秒数）

直接使用秒数，无需单位。

**示例**:
```
# 带单位格式
1m      # 1分钟 (60秒)
5m      # 5分钟 (300秒)
1h      # 1小时 (3600秒)
1d      # 1天 (86400秒)

# 纯数字格式（秒数）
60      # 60秒 (等同于 1m)
300     # 300秒 (等同于 5m)
3600    # 3600秒 (等同于 1h)
86400   # 86400秒 (等同于 1d)
```

### 选项参数

#### 通用选项

| 选项 | 语法 | 说明 | 示例 |
|------|------|------|------|
| 字段筛选 | `fields:field1,field2` | 指定返回字段 | `fields:open,close,high,low` |
| Namespace | `namespace:global\|private` | 指定命名空间 | `namespace:private` |
| Revision | `revision:数字` | 指定版本（覆盖 @revision） | `revision:-1` |

#### 公式专用选项

| 选项 | 语法 | 说明 | 示例 |
|------|------|------|------|
| 实时订阅 | `+subscribe` 或 `+real` | 启用实时数据推送 | `+subscribe` |
| 公式 ID | `formulaId:数字` | 指定公式 ID | `formulaId:-222` |

---

## 🏗️ 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│  前端层 (Vue/React) - 完整实现                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  DSL 输入框   │  │  UI 表单      │  │  结果展示    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                   │             │
│         └──────────┬───────┴──────────────────┘             │
│                    │                                         │
│         ┌──────────▼──────────┐                            │
│         │  DSL Parser          │                            │
│         │  (语法解析器)        │                            │
│         └──────────┬───────────┘                            │
│                    │                                         │
│         ┌──────────▼──────────┐                            │
│         │  Query Executor     │                            │
│         │  (查询执行器)        │                            │
│         │  - 查询路由          │                            │
│         │  - 调用后端 API      │                            │
│         └──────────┬───────────┘                            │
│                    │                                         │
└────────────────────┼─────────────────────────────────────────┘
                     │ WebSocket / HTTP
┌────────────────────▼─────────────────────────────────────────┐
│  后端层 (Node.js) - 仅提供查询 API                           │
│  ┌──────────────┐                                            │
│  │  WASM Layer  │  (WASM 处理和 Caitlyn 连接)               │
│  └──────┬───────┘                                            │
│         │                                                     │
│         └──────────┬──────────────────┘                     │
│                    │                                         │
│         ┌──────────▼──────────┐                            │
│         │  Query Router        │                            │
│         │  (路由到具体实现)     │                            │
│         └──────────┬───────────┘                            │
│                    │                                         │
│    ┌───────────────┼───────────────┐                       │
│    │               │               │                       │
│ ┌──▼──┐      ┌─────▼─────┐    ┌───▼───┐                   │
│ │fetch│      │fetch_by_  │    │formula│                   │
│ │by_  │      │code       │    │query  │                   │
│ │time │      └───────────┘    └───────┘                   │
│ └─────┘                                                 │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. DSL Parser（语法解析器）

**职责**:
- 解析 DSL 字符串
- 验证语法正确性
- 转换为内部查询对象

**输入**: DSL 字符串  
**输出**: Query AST (Abstract Syntax Tree)

**示例**:
```javascript
// 输入
"fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02"
"fc:private::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02"
"fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02"  // 默认 global

// 输出
{
  type: 'fetch_by_code',
  namespace: 'global',  // 或 'private'，默认 'global'
  indicator: 'SampleQuote',
  revision: 0,
  market: 'CZCE',
  code: 'ap<00>',
  granularity: 3600,  // 1h in seconds
  from: '2025-01-01',
  to: '2025-01-02',
  options: {},
  dsl: 'fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02'
}

// 注意: 名称/别名不包含在 Query AST 中，通过 saveAs 功能单独存储
```

#### 2. Query Executor（查询执行器 - 前端）

**职责**:
- 执行查询请求（直接调用后端 API）
- 处理订阅
- 返回查询结果

**输入**: Query AST  
**输出**: 查询结果或订阅 ID

**工作流程**:
1. 根据 Query AST 确定查询类型
2. 调用对应的后端 API（fetch_by_time、fetch_by_code、formula）
3. 处理查询结果
4. 返回查询结果或订阅 ID

**注意**: 每次查询都直接刷新，不依赖缓存

**API 映射规则**:

```typescript
// Query AST → 后端 WebSocket 消息映射

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

#### 3. 后端 Query Router（查询路由）

**职责**:
- 接收前端查询请求（已解析的参数）
- 根据查询类型路由到具体实现
- `fetch_by_time` → `fetchByTime()`
- `fetch_by_code` → `fetchByCode()`
- `formula` → `executeFormula()`

**注意**: 后端不处理 DSL 解析，只负责执行具体的查询操作

---

## 🎨 UI 集成设计

### 双向转换

#### DSL → UI 表单

```javascript
// DSL 输入
"fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02"
"fc:private::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02"
"fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02"  // 默认 global

// 转换为表单
{
  namespace: 'global',  // 从前缀解析，或默认 'global'
  indicator: 'SampleQuote',
  revision: 0,
  market: 'CZCE',
  code: 'ap<00>',
  granularity: '1h',
  fromDate: '2025-01-01',
  toDate: '2025-01-02',
  queryType: 'fetch_by_code',
  dsl: 'fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02'
}
```

#### UI 表单 → DSL

```javascript
// 表单输入
{
  namespace: 'global',  // 或 'private'
  indicator: 'SampleQuote',
  revision: 0,
  market: 'CZCE',
  code: 'ap<00>',
  granularity: '1h',
  fromDate: '2025-01-01',
  toDate: '2025-01-02',
  queryType: 'fetch_by_code'
}

// 转换为 DSL（包含 namespace 前缀）
"fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02"

// 如果 namespace 是 'global'，可以省略前缀（默认）
"fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02"
```

**注意**: 名称/别名不包含在 DSL 中，通过 `saveAs` 功能单独保存和管理。

### UI 组件设计

#### 1. DSL 输入框（主界面）

**布局设计**:
```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔍 DSL Query Builder                                                │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ Query DSL                                                      │ │
│ │ ┌───────────────────────────────────────────────────────────┐ │ │
│ │ │ fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..  │ │ │
│ │ │                                                             │ │ │
│ │ └───────────────────────────────────────────────────────────┘ │ │
│ │ [💡 Syntax Help] [📋 Examples]                                │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ Quick Actions                                                  │ │
│ │ [▶ Execute] [🗑️ Clear] [📋 Copy] [✓ Validate] [💾 Save As]  │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ 📚 Saved Queries (3)                                           │ │
│ │ ┌───────────────────────────────────────────────────────────┐ │ │
│ │ │ • AP主力1小时  [Load] [Edit] [Delete]                      │ │ │
│ │ │ • MACD指标    [Load] [Edit] [Delete]                      │ │ │
│ │ │ • 铜主力日线  [Load] [Edit] [Delete]                      │ │ │
│ │ └───────────────────────────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**功能说明**:
- **DSL 输入框**: 
  - 多行文本输入，支持语法高亮（可选）
  - 实时语法验证提示（错误时显示红色下划线）
  - 自动补全提示（输入时显示可能的选项）
  - 支持快捷键：`Ctrl+Enter` 执行，`Ctrl+K` 清除
  
- **Quick Actions**:
  - **Execute**: 执行查询，显示加载状态
  - **Clear**: 清空输入框
  - **Copy**: 复制当前 DSL 到剪贴板
  - **Validate**: 验证语法，显示错误信息
  - **Save As**: 弹出保存对话框

- **Saved Queries**:
  - 显示已保存的查询列表（按名称显示）
  - 点击名称或 Load 按钮加载对应的 DSL
  - 支持编辑和删除操作
  - 显示最后使用时间

#### Save As 功能设计

**存储结构**:
```typescript
// 查询保存记录（存储在 IndexedDB 或 localStorage）
interface SavedQuery {
  id: string;           // 唯一标识
  name: string;         // 用户定义的别名/名称
  dsl: string;          // DSL 查询语句
  createdAt: number;    // 创建时间戳
  updatedAt: number;    // 更新时间戳
  lastUsedAt?: number;  // 最后使用时间
  usageCount?: number;  // 使用次数
}
```

**Save As 对话框设计**:
```
┌─────────────────────────────────────────────┐
│ 💾 Save Query                                │
├─────────────────────────────────────────────┤
│                                             │
│ Query Name:                                 │
│ ┌─────────────────────────────────────────┐ │
│ │ ap_main_1h______________________________ │ │
│ └─────────────────────────────────────────┘ │
│ ℹ️ Only letters, numbers, underscore, hyphen │
│                                             │
│ Preview DSL:                                │
│ ┌─────────────────────────────────────────┐ │
│ │ fc:global::SampleQuote@0[CZCE:ap<00>] | │ │
│ │ 1h | 2025-01-01..2025-01-02             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│         [Cancel]        [💾 Save]          │
└─────────────────────────────────────────────┘
```

**工作流程**:
1. 用户在 DSL 输入框中输入查询语句
2. 点击 "Save As" 按钮
3. 弹出对话框，显示 DSL 预览
4. 输入别名/名称（仅支持英文、数字、下划线、连字符）
5. 实时验证名称格式
6. 点击 Save 保存，将 DSL 和名称分开保存到存储中
7. 在查询历史列表中显示（按名称显示，支持搜索和排序）

**注意**: DSL 语义和名称完全分开存储，名称不影响 DSL 语法解析和执行。

#### 2. 查询结果展示区

**布局设计**:
```
┌─────────────────────────────────────────────────────────────────────┐
│ 📊 Query Results                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Query: fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..  │
│ Status: ✅ Success | Records: 24 | Time: 2025-01-15 10:30:25        │
├─────────────────────────────────────────────────────────────────────┤
│ View Mode: [📋 Table] [📈 Chart] [⚙️ Settings]                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ Table View                                                     │ │
│ │ ┌─────┬──────────┬──────┬──────┬──────┬──────┬────────┐      │ │
│ │ │ Time │ Open    │ High │ Low  │ Close│ Vol  │ Change │      │ │
│ │ ├─────┼──────────┼──────┼──────┼──────┼──────┼────────┤      │ │
│ │ │ ... │ ...     │ ... │ ... │ ... │ ... │ ...    │      │ │
│ │ └─────┴──────────┴──────┴──────┴──────┴──────┴────────┘      │ │
│ │ [Sort] [Filter] [Export CSV] [Export JSON]                  │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ OR                                                                  │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ Chart View                                                     │ │
│ │ ┌───────────────────────────────────────────────────────────┐ │ │
│ │ │                                                             │ │ │
│ │ │        📈 Candlestick Chart                                │ │ │
│ │ │                                                             │ │ │
│ │ │                                                             │ │ │
│ │ └───────────────────────────────────────────────────────────┘ │ │
│ │ Chart Type: [Candlestick ▼] [Line] [Bar]                      │ │
│ │ [Zoom In] [Zoom Out] [Reset] [Export PNG]                     │ │
│ └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**功能说明**:
- **查询信息栏**: 显示当前查询的 DSL、执行状态、记录数、执行时间
- **视图切换**: Table 和 Chart 两种视图无缝切换
- **Table 视图**:
  - 可排序、筛选、分页
  - 支持列宽调整、列显示/隐藏
  - 导出为 CSV 或 JSON
  - 实时数据更新时高亮显示新行
  
- **Chart 视图**:
  - 支持多种图表类型（K线图、折线图、柱状图）
  - 交互式缩放、平移
  - 数据点悬停显示详细信息
  - 支持多指标叠加显示（公式查询）
  - 导出为 PNG 图片

#### 3. 语法帮助面板（可选）

**设计**:
```
┌─────────────────────────────────────────┐
│ 💡 DSL Syntax Help                       │
├─────────────────────────────────────────┤
│                                         │
│ Query Types:                            │
│ • ft: - Fetch by Time                   │
│ • fc: - Fetch by Code                   │
│ • fm: - Formula Query                   │
│                                         │
│ Examples:                               │
│ ┌─────────────────────────────────────┐ │
│ │ fc:global::SampleQuote@0[CZCE:ap<00>]│ │
│ │ | 1h | 2025-01-01..2025-01-02      │ │
│ └─────────────────────────────────────┘ │
│ [Copy Example]                          │
│                                         │
│ Quick Reference:                        │
│ • Namespace: global:: or private::     │
│ • Granularity: 1m, 1h, 1d, or 3600     │
│ • Time: ISO date, timestamp, or now   │
│                                         │
│ [Close]                                 │
└─────────────────────────────────────────┘
```

#### 4. 实时订阅状态指示器

**设计**:
```
┌─────────────────────────────────────────┐
│ 🔴 Live Subscription                    │
├─────────────────────────────────────────┤
│ Query: fm:Ma[CZCE:ap<00>] | 5m | ...  │
│ Status: ✅ Connected                     │
│ Updates: 3 new records in last minute  │
│ [⏸ Pause] [⏹ Stop]                    │
└─────────────────────────────────────────┘
```

#### 5. 错误提示和验证反馈

**设计**:
```
┌─────────────────────────────────────────┐
│ ❌ Syntax Error                          │
├─────────────────────────────────────────┤
│ Invalid namespace format at position 5 │
│                                         │
│ Expected: global:: or private::       │
│ Found: global:                         │
│                                         │
│ [Show in Editor] [View Documentation]   │
└─────────────────────────────────────────┘
```

**UI/UX 最佳实践建议**:

1. **响应式设计**:
   - 支持桌面端和移动端自适应
   - 移动端使用抽屉式面板替代侧边栏
   - 触摸友好的按钮尺寸（最小 44x44px）

2. **性能优化**:
   - 大量数据使用虚拟滚动（Table 视图）
   - 图表数据采样显示（超过 1000 点自动采样）
   - 防抖处理用户输入（DSL 验证）

3. **用户体验**:
   - 加载状态：显示骨架屏或进度条
   - 错误处理：友好的错误提示，提供修复建议
   - 快捷键支持：`Ctrl+Enter` 执行，`Esc` 关闭对话框
   - 自动保存：定期保存草稿到 localStorage

4. **可访问性**:
   - 支持键盘导航
   - ARIA 标签和语义化 HTML
   - 颜色对比度符合 WCAG 标准
   - 屏幕阅读器支持

5. **主题支持**:
   - 支持明暗主题切换
   - 可自定义颜色方案
   - 保存用户偏好设置

#### 2. 表单模式（可选）

保留现有的表单界面，支持 DSL 和表单两种模式切换。

#### 3. 结果展示

统一的 Table/Chart 组件，支持：
- 表格视图
- 图表视图（K线图、折线图等）
- 数据导出

---

## 📊 统一展示组件

### Table/Chart 组件设计

#### 功能需求

1. **数据源统一**: 支持指标数据和公式数据
2. **视图切换**: Table ↔ Chart 无缝切换
3. **实时更新**: 订阅数据自动更新
4. **交互功能**: 排序、筛选、导出

#### 组件接口

```typescript
interface UnifiedDataViewerProps {
  // 数据源（统一格式）
  data: QueryResult;
  
  // 配置
  config: {
    viewType: 'table' | 'chart';
    chartType?: 'line' | 'candlestick' | 'bar';
    fields?: string[];
    realTime?: boolean;
  };
  
  // 回调
  onDataUpdate?: (data: QueryResult) => void;
  onExport?: (format: 'json' | 'csv') => void;
}
```

#### 数据格式统一

```typescript
interface QueryResult {
  // 查询信息
  query: {
    dsl: string;    // DSL 语句
    type: 'indicator' | 'formula';
  };
  
  // 注意: 名称/别名通过 saveAs 功能单独存储，不包含在 QueryResult 中
  
  // 元数据
  metadata: {
    type: 'indicator' | 'formula';
    indicator?: string;
    formula?: string;
    market: string;
    code: string;
    granularity: number;
    timeRange: {
      from: string;
      to: string;
    };
  };
  
  // 数据记录
  records: Array<{
    timestamp: number;
    time: string;  // ISO format
    [field: string]: any;  // 动态字段
  }>;
  
  // 显示配置（公式专用）
  displayConfig?: {
    lines?: Array<{
      name: string;
      color: string;
      thickness: number;
    }>;
  };
}
```

---

## 🚀 实现计划

### Phase 1: 核心解析器（MVP）

**优先级**: 🔴 高  
**预计时间**: 1-2 周

- [ ] DSL Parser 实现
  - [ ] 基础语法解析（正则表达式或 PEG 解析器）
  - [ ] 支持 `ft:`, `fc:`, `fm:` 三种查询类型
  - [ ] Namespace 解析（`global::`, `private::`）
  - [ ] Revision 解析（`@数字`）
  - [ ] 市场代码解析（`[market:code]`）
  - [ ] 粒度解析（支持单位格式和纯数字）
  - [ ] 时间格式解析（ISO、时间戳、相对时间）
  - [ ] 选项参数解析（`fields:`, `namespace:`, `+subscribe` 等）
- [ ] 语法验证和错误提示
  - [ ] 必需字段验证
  - [ ] 格式验证（时间、粒度等）
  - [ ] 友好的错误提示（位置、建议）

**技术选型建议**:
- **解析器**: 推荐使用 PEG.js 或手写递归下降解析器
- **语言**: TypeScript（前端）
- **测试**: Jest 或 Vitest

### Phase 2: 查询执行

**优先级**: 🔴 高  
**预计时间**: 1 周

- [ ] Query Executor 实现
  - [ ] Query AST → 后端 API 参数转换
  - [ ] 时间格式转换（统一为时间戳）
  - [ ] 粒度格式转换（统一为秒数）
  - [ ] Namespace 转换（`global` / `private`）
- [ ] 路由到现有 API
  - [ ] `fetch_by_code` WebSocket 消息
  - [ ] `fetch_by_time` WebSocket 消息（需确认后端支持）
  - [ ] `calculate_formula` WebSocket 消息
- [ ] 错误处理
  - [ ] 网络错误处理
  - [ ] 后端错误响应处理
  - [ ] 超时处理
- [ ] 结果格式统一
  - [ ] 统一为 `QueryResult` 格式
  - [ ] 字段映射和转换

### Phase 3: UI 集成

**优先级**: 🟡 中  
**预计时间**: 2-3 周

- [ ] DSL 输入框组件
  - [ ] 多行文本输入
  - [ ] 语法高亮（可选，使用 Monaco Editor 或 CodeMirror）
  - [ ] 实时语法验证
  - [ ] 自动补全提示（可选）
  - [ ] 快捷键支持
- [ ] DSL ↔ UI 双向转换
  - [ ] DSL → 表单字段解析
  - [ ] 表单字段 → DSL 生成
- [ ] Save As 功能
  - [ ] 保存对话框
  - [ ] IndexedDB 或 localStorage 存储
  - [ ] 查询历史列表
- [ ] 统一的 Table/Chart 组件
  - [ ] Table 视图（排序、筛选、分页）
  - [ ] Chart 视图（K线图、折线图）
  - [ ] 视图切换
- [ ] 实时数据更新
  - [ ] 订阅状态显示
  - [ ] 数据自动更新
  - [ ] 新数据高亮

### Phase 4: 高级功能（可选）

**优先级**: 🟢 低  
**预计时间**: 按需

- [ ] 批量查询支持
- [ ] 条件筛选
- [ ] 查询模板
- [ ] 查询历史记录（已包含在 Phase 3）

---

## ✅ 开发准备检查清单

在开始开发前，请确认：

### 技术栈确认
- [ ] 前端框架选择（Vue 3 或 React）
- [ ] 解析器库选择（PEG.js、手写解析器等）
- [ ] 代码编辑器组件（Monaco Editor、CodeMirror 等，可选）
- [ ] 图表库选择（ECharts、Chart.js、Recharts 等）

### 后端 API 确认
- [ ] `fetch_by_time` 的具体参数格式（需确认后端实现）
- [ ] 公式查询的 UUID 获取方式（注册流程）
- [ ] WebSocket 消息格式完全确认
- [ ] 错误响应格式确认

### 开发环境
- [ ] 开发环境搭建完成
- [ ] 测试数据准备
- [ ] 调试工具配置

### 文档补充（开发过程中）
- [ ] API 映射详细文档
- [ ] 错误码定义
- [ ] 性能优化指南

---

## 📝 示例集合

### 指标查询示例

```bash
# 1. 基本查询（日线数据）
fc:SampleQuote@0[SHFE:cu2501] | 1d | 2025-01-01..2025-01-31

# 2. 分钟线数据
fc:SampleQuote@0[DCE:i2501] | 5m | 2025-01-01..now

# 5. 指定字段
fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02 | fields:open,close,high,low,volume

# 6. 单时间点查询
ft:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01T10:00:00

# 7. 使用毫秒级时间戳
ft:SampleQuote@0[CZCE:ap<00>] | 1h | 1762310700000

# 8. 最新数据
ft:SampleQuote@0[CZCE:ap<00>] | 1h | now

# 9. 使用纯数字粒度（秒数）
fc:SampleQuote@0[CZCE:ap<00>] | 86400 | 2025-01-01..2025-01-31
ft:SampleQuote@0[CZCE:ap<00>] | 3600 | 1762310700000
```

### 公式查询示例

```bash
# 1. 公式历史数据
fm:Ma[CZCE:ap<00>] | 5m | 2025-01-01..2025-01-02

# 2. 公式 + 实时订阅
fm:Ma[CZCE:ap<00>] | 5m | 2025-01-01..now | +subscribe

# 3. 指定公式 ID
fm:Ma@-222[CZCE:ap<00>] | 5m | 2025-01-01..now | +subscribe

# 4. MACD 指标
fm:MACD[SHFE:cu2501] | 1h | 2025-01-01..now | +subscribe

# 5. 使用纯数字粒度（秒数）
fm:Ma[CZCE:ap<00>] | 300 | 2025-01-01..2025-01-02
```

### 复杂查询示例

```bash
# 1. 多字段 + 命名空间（通过前缀指定）
fc:private::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02 | fields:open,close

# 1b. 多字段 + 命名空间（通过选项参数指定）
fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..2025-01-02 | fields:open,close | namespace:private

# 2. 公式 + 字段筛选
fm:Ma[CZCE:ap<00>] | 5m | 2025-01-01..now | fields:macd,macd_diff | +subscribe

# 3. 相对时间范围
fc:SampleQuote@0[CZCE:ap<00>] | 1h | -7d..now

# 4. 使用毫秒级时间戳范围
fc:SampleQuote@0[CZCE:ap<00>] | 1h | 1762310700000..1762397100000

# 5. 混合时间格式（ISO 日期 + 毫秒级时间戳）
fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-01-01..1762397100000
```

---

## 🔍 语法验证规则

### 必需字段

| 查询类型 | 必需字段 |
|---------|---------|
| `ft:` | indicator, market, code, granularity, time |
| `fc:` | indicator, market, code, granularity, from, to |
| `fm:` | formula, market, code, granularity, from, to |

### 验证规则

1. **查询类型**: 必须是 `ft:`, `fc:`, `fm:` 之一
2. **Namespace**: 可选，如果存在必须是 `global::` 或 `private::`，如果不指定则默认 `global`
3. **指标/公式名**: 非空字符串
4. **Revision**: 可选，如果存在必须是数字
5. **市场代码**: 格式 `[market:code]`，market 和 code 非空
6. **粒度**: 支持两种格式
   - 带单位：`数字+单位`，单位必须是 `s`, `m`, `h`, `d`, `w`, `M` 之一（如 `1h`, `5m`）
   - 纯数字：直接使用秒数（如 `3600`, `86400`）
7. **时间**: 必须是有效的时间格式或 `now`
8. **时间范围**: `from..to` 格式，from 和 to 都必须是有效时间

**注意**: 
- 名称/别名不参与 DSL 语法验证，通过 saveAs 功能单独管理
- Namespace 可以通过指标名前缀（`global::` 或 `private::`）或选项参数（`namespace:global` 或 `namespace:private`）指定，选项参数优先级更高

### 错误提示

```javascript
// 示例错误提示
{
  error: "Invalid DSL syntax",
  message: "Missing required field: granularity",
  position: 25,  // 错误位置
  suggestion: "Add granularity: | 1h |"
}
```

---

## 🔄 后续讨论记录

### 2025-01-XX: 初始设计

**讨论内容**:
- 确定了最终语法规范（混合风格）
- 明确了语法规范和设计目标
- 确定了架构设计和实现计划

**待解决问题**:
- [ ] 批量查询语法设计
- [ ] 条件筛选语法设计
- [ ] 查询模板语法设计

---

## 🔄 小公式查询标准流程

### 概述

小公式查询需要经过以下步骤：
1. **查询公式列表** - 从 Formula Management API 获取可用公式列表
2. **缓存公式列表** - DSL 组件缓存公式列表，避免重复查询
3. **注册公式** - 通过 WebSocket 注册公式，获取 UUID
4. **计算公式** - 使用 UUID 执行公式计算

### 数据依赖

DSL Query 组件在执行小公式查询时，依赖以下数据和服务：

#### 1. **数据存储 (dataStore)**
- **用途**: 缓存公式列表，避免重复 API 调用
- **数据结构**:
  ```typescript
  {
    formulaList: FormulaListItem[],
    formulaListLoading: boolean,
    formulaListLastFetched: number | null
  }
  ```
- **关键方法**:
  - `setFormulaList(formulas)`: 设置公式列表
  - `findFormulaByName(name)`: 根据名称查找公式（返回 `{ id, name, source_code, language_id }`）
  - `isFormulaListLoaded`: 计算属性，判断是否已加载

#### 2. **公式服务 (formulaService)**
- **用途**: 调用 Formula Management API 查询公式列表
- **API 端点**: `POST /api/formulas/query`
- **调用时机**: 组件 `onMounted` 时自动调用
- **请求参数**: `{ privateOnly: true }`（不限制 languageId）

#### 3. **WebSocket 任务服务 (websocketTaskService)**
- **用途**: 发送 WebSocket 任务并等待响应（Promise 封装）
- **关键方法**: `sendTask(message, options)`
- **使用场景**: 
  - 发送 `register_formula` 消息并等待 `register_formula_response`
  - 支持超时和重试机制

#### 4. **WebSocket 连接 (websocketStore)**
- **用途**: 管理 WebSocket 连接状态
- **依赖**: 确保 WebSocket 已连接才能发送消息

### 数据流

```
组件初始化 (onMounted)
  ↓
loadFormulaList()
  ↓
formulaService.queryFormulas({ privateOnly: true })
  ↓
dataStore.setFormulaList(formulas)
  ↓
[用户执行公式查询]
  ↓
dslExecutor.executeFormula(ast, requestId)
  ↓
dataStore.findFormulaByName(ast.formula)  // 从缓存查找
  ↓
websocketTaskService.sendTask(register_formula)  // 注册公式
  ↓
[获取 uuid]
  ↓
websocketStore.send(calculate_formula)  // 计算公式
  ↓
[处理 calculate_formula_response]
```

### 1. 查询公式列表

**API**: `POST /api/formulas/query`

**请求示例**:
```json
{
  "privateOnly": 1
}
```

**注意**: 查询公式列表时不限制 `languageId`，只要 `privateOnly: 1` 即可，这样可以查询所有私有公式（包括不同语言的公式）。

**响应示例**:
```json
{
  "success": true,
  "formulas": [
    {
      "id": 225,
      "name": "MACD",
      "source_code": "variable: SHORT=0;\nvariable: LONG=0;\n...",
      "language_id": 5,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

**实现要求**:
- DSL 组件在 `onMounted` 生命周期钩子中自动调用 `loadFormulaList()`
- 查询时只使用 `privateOnly: 1`，不限制 `languageId`，这样可以查询所有私有公式（包括不同语言的公式）
- 使用 `dataStore.setFormulaList()` 将查询结果缓存到 Pinia store
- 缓存数据结构：`formulaList: FormulaListItem[]`，包含所有可用公式的 `id`、`name`、`source_code`、`language_id` 等信息
- 通过 `dataStore.formulaListLoading` 和 `dataStore.isFormulaListLoaded` 管理加载状态
- 支持手动刷新缓存（重新调用 `loadFormulaList()`）

**数据依赖**:
- `formulaService`: 用于调用 API
- `dataStore`: 用于缓存和管理公式列表状态

### 2. 注册公式（Register Formula）

**WebSocket 消息类型**: `register_formula`

**请求消息**:
```json
{
  "type": "register_formula",
  "formulaId": 225,
  "sourceCode": "variable: SHORT=0;\nvariable: LONG=0;\nvariable: M=0;\nSHORT := 12;\nLONG := 26;\nM:=9;\nDIFF: EMA(CLOSE,SHORT) - EMA(CLOSE,LONG);\nDEA  : EMA(DIFF,M);\nMACD : 2*(DIFF-DEA);\nl: stickline(macd>0, 0, macd, 0, 0), colorff9c00;\nk: stickline(macd<=0, 0, macd, 0, 0), color2588ee;\n_macd: ema( macd, 1), colorff9c00, linethick1;\n_dea: ema(dea, 1), colorff0000, linethick1;\n_diff: ema(diff, 1), color0000ff, linethick1;\n\n",
  "languageId": 5,
  "requestId": "1"
}
```

**响应消息**:
```json
{
  "type": "register_formula_response",
  "success": true,
  "data": {
    "success": true,
    "uuid": "f632f072-891a-4bf7-afb8-80ed8230a2cd",
    "formulaId": 225
  },
  "requestId": "1"
}
```

**实现要求**:
- 在 `dslExecutor.executeFormula()` 中，调用 `dataStore.findFormulaByName(ast.formula)` 从缓存的公式列表中查找
- 如果公式不存在（返回 `null`），抛出错误：`Formula "${ast.formula}" not found. Please refresh formula list or check formula name.`
- 从查找结果中提取：
  - `formula.id` → `formulaId`
  - `formula.source_code` → `sourceCode`
  - `formula.language_id ?? 5` → `languageId`（使用 `??` 而不是 `||`，因为 0 是有效的 language_id）
- 使用 `websocketTaskService.sendTask()` 发送 `register_formula` 消息，并等待 `register_formula_response`
- 从响应中提取 `uuid`，用于后续计算步骤
- 注册成功后，缓存 `formulaId` → `uuid` 的映射关系（可选，因为每次查询都需要重新注册）

**数据依赖**:
- `dataStore.findFormulaByName()`: 从缓存中查找公式信息
- `websocketTaskService.sendTask()`: 发送注册消息并等待响应
- `websocketStore`: 确保 WebSocket 连接已建立

### 3. 计算公式（Calculate Formula）

**WebSocket 消息类型**: `calculate_formula`

**请求消息**:
```json
{
  "type": "calculate_formula",
  "uuid": "f632f072-891a-4bf7-afb8-80ed8230a2cd",
  "market": "CFFEX",
  "code": "IC<00>",
  "fromTime": 1762645920000,
  "toTime": 1762732320000,
  "granularity": 60,
  "isRealTime": false,
  "requestId": "2"
}
```

**响应消息**:
```json
{
  "type": "calculate_formula_response",
  "success": true,
  "data": {
    "success": true,
    "data": {
      "charts": [],
      "doodles": [],
      "parameters": [],
      "shapes": [],
      "displayConfiguration": {
        "l": {
          "line_style": "bar",
          "display": {"color": "#ff9c00"},
          "src": {
            "cond": "l_cond",
            "price1": "l_price1",
            "price2": "l_price2",
            "width": "l_width"
          },
          "name": "l"
        },
        "k": {
          "line_style": "bar",
          "display": {"color": "#2588ee"},
          "src": {
            "cond": "k_cond",
            "price1": "k_price1",
            "price2": "k_price2",
            "width": "k_width"
          },
          "name": "k"
        },
        "_macd": {
          "line_style": "polyline",
          "display": {"color": "#ff9c00", "width": 1, "opacity": "100%", "style": "solid"},
          "src": "_macd",
          "name": "_macd"
        },
        "_dea": {
          "line_style": "polyline",
          "display": {"color": "#ff0000", "width": 1, "opacity": "100%", "style": "solid"},
          "src": "_dea",
          "name": "_dea"
        },
        "_diff": {
          "line_style": "polyline",
          "display": {"color": "#0000ff", "width": 1, "opacity": "100%", "style": "solid"},
          "src": "_diff",
          "name": "_diff"
        }
      },
      "data": [],
      "metadata": {
        "totalCharts": 5,
        "totalDoodles": 0,
        "hasSourcecode": false
      }
    },
    "message": "Formula calculation completed successfully"
  },
  "requestId": "2"
}
```

**实现要求**:
- 使用注册步骤获取的 `uuid` 执行公式计算
- 时间参数使用毫秒级时间戳（与指标查询不同，指标查询使用秒级）
- 处理 `displayConfiguration` 用于图表展示
- 处理 `data` 数组用于表格展示

### 完整流程示例

**DSL 输入**:
```
fm:MACD[CFFEX:IC<00>] | 1m | 2025-11-10..2025-11-11
```

**执行流程**:
1. 解析 DSL，提取公式名称 `MACD`
2. 从缓存的公式列表中查找 `name === "MACD"` 的公式
3. 如果找到，获取 `formulaId` 和 `sourceCode`
4. 发送 `register_formula` 消息，获取 `uuid`
5. 等待 `register_formula_response`，提取 `uuid`
6. 发送 `calculate_formula` 消息，使用 `uuid` 和 DSL 中的其他参数
7. 等待 `calculate_formula_response`，处理结果数据
8. 返回统一的 `QueryResult` 格式

### 错误处理

- **公式不存在**: 提示用户公式未找到，建议检查公式名称或刷新公式列表
- **注册失败**: 提示注册失败原因，可能是 `sourceCode` 格式错误
- **计算失败**: 提示计算失败原因，可能是参数错误或公式执行错误

## 📚 参考资源

### 相关文档

- [BACKEND_API_REFERENCE.md](../BACKEND_API_REFERENCE.md) - 后端 API 参考
- [FORMULA_COMPLETE_WORKFLOW_CN.md](../FORMULA_COMPLETE_WORKFLOW_CN.md) - 公式完整工作流程
- [CAITLYN_FETCH_API_PARAMETERS.md](../CAITLYN_FETCH_API_PARAMETERS.md) - 查询 API 参数
- [../backend/FORMULA_API_USAGE.md](../../backend/FORMULA_API_USAGE.md) - Formula Management API 使用指南

### 相关代码

- `backend/src/server.js` - WebSocket 消息处理
- `backend/src/utils/CaitlynClientConnection.js` - WASM 客户端连接
- `frontend-vue/src/components/FormulaViewer.vue` - 公式查看器
- `frontend-vue/src/components/SchemaViewer.vue` - Schema 查看器

---

## 🎨 DSL 输入框 UX 优化方案

### 概述

当前 DSL 输入框是纯文本输入，用户需要手动输入完整的 DSL 语法。虽然语法相对简单，但可以利用已有的缓存数据（命令类型、指标/公式列表、粒度枚举、时间格式）来设计一个更友好的智能输入体验。

### 可用资源

#### 1. **基本命令缓存**
- `fc`: Fetch by Code（时间范围查询）
- `ft`: Fetch by Time（单时间点查询）
- `fm`: Formula Query（公式查询）

#### 2. **指标/小公式缓存**
- **指标列表** (`dataStore.schema`):
  - 结构: `schema[namespace][indicator][revision]`
  - 包含: `namespace` (global/private), `indicator` 名称, `revision` 版本号
  - 示例: `SampleQuote`, `KLine`, `TickData` 等

- **小公式列表** (`dataStore.formulaList`):
  - 结构: `FormulaListItem[]`
  - 包含: `id`, `name`, `source_code`, `language_id`
  - 示例: `MACD`, `RSI`, `testa` 等

#### 3. **粒度枚举**
支持的粒度格式：
- 单位格式: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`, `1w`, `1M`
- 纯数字（秒）: `60`, `300`, `900`, `3600`, `86400` 等

#### 4. **时间格式**
支持的时间格式：
- ISO 日期: `2025-11-05`
- ISO 日期时间: `2025-11-05T10:00:00Z`
- Unix 时间戳（秒）: `1730764800`
- Unix 时间戳（毫秒）: `1730764800000`
- 相对时间: `now`, `-7d`, `-1h`, `-30m`

### UX 设计方案

#### 方案 1: 智能自动补全（IntelliSense）

**核心思路**: 在用户输入时，根据当前光标位置和上下文，提供智能补全建议。

**实现要点**:

1. **命令类型补全**
   - 当输入框为空或光标在开头时，显示: `fc:`, `ft:`, `fm:`
   - 快捷键: `Tab` 或 `Enter` 选择

2. **Namespace 补全**
   - 输入 `fc:` 后，显示: `global::`, `private::`
   - 如果已输入 namespace，跳过此步骤

3. **指标/公式名补全**
   - 根据已输入的命令类型和 namespace，过滤候选列表:
     - `fc:` 或 `ft:` → 显示指标列表（从 `dataStore.schema` 获取）
     - `fm:` → 显示公式列表（从 `dataStore.formulaList` 获取）
   - 支持模糊搜索: 输入 `Sam` 时，显示 `SampleQuote`
   - 显示额外信息:
     - 指标: 显示 `namespace` 和 `revision`（如果有多个版本）
     - 公式: 显示 `language_id` 和 `description`（如果有）

4. **Revision 补全**
   - 输入指标名后，如果该指标有多个 revision，显示: `@0`, `@1`, `@-1` 等
   - 默认使用 `@0` 或 `@-1`（最新版本）

5. **Market:Code 补全**
   - 输入 `[` 后，显示市场列表（从 `dataStore.schema` 或 `dataStore.securities` 获取）
   - 输入市场后，显示该市场的代码列表
   - 支持模糊搜索代码名称

6. **粒度补全**
   - 输入 `|` 后，显示常用粒度选项:
     - `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`
     - 或显示: `60`, `300`, `900`, `3600`, `86400`
   - 支持输入自定义数字

7. **时间范围补全**
   - 输入第二个 `|` 后，显示时间格式建议:
     - 相对时间: `now`, `-7d`, `-1h`
     - 日期范围: `2025-11-05..2025-11-06`
     - 单时间点: `2025-11-05` 或 `now`

**UI 设计**:
```
┌─────────────────────────────────────────────────────┐
│ fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-11-05..  │
│                                                      │
│ [自动补全下拉框]                                      │
│ ┌────────────────────────────────────────────────┐ │
│ │ 📅 2025-11-05..2025-11-06                     │ │
│ │ 📅 2025-11-05..now                            │ │
│ │ 📅 now..now                                    │ │
│ │ 📅 -7d..now                                    │ │
│ └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 方案 2: 分段式输入助手（Step-by-Step Wizard）

**核心思路**: 将 DSL 输入分解为多个步骤，每个步骤提供选择界面。

**实现要点**:

1. **步骤 1: 选择查询类型**
   - 显示三个卡片: `fc: Fetch by Code`, `ft: Fetch by Time`, `fm: Formula Query`
   - 点击后自动填充到输入框

2. **步骤 2: 选择 Namespace（可选）**
   - 显示: `global::`, `private::`
   - 如果只有一个选项，自动选择

3. **步骤 3: 选择指标/公式**
   - 显示搜索框和列表
   - 根据查询类型过滤:
     - `fc/ft`: 显示指标列表（分组: global/private）
     - `fm`: 显示公式列表
   - 支持搜索和筛选

4. **步骤 4: 选择 Revision（可选）**
   - 如果指标有多个版本，显示版本选择器
   - 默认选择最新版本

5. **步骤 5: 选择 Market:Code**
   - 显示市场下拉框
   - 选择市场后，显示代码搜索框和列表
   - 支持代码名称搜索

6. **步骤 6: 选择粒度**
   - 显示常用粒度按钮: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`
   - 或输入自定义数字

7. **步骤 7: 选择时间范围**
   - 显示时间选择器（日期选择器 + 相对时间快捷按钮）
   - 支持: `now`, `-7d`, `-1h` 等快捷选项

**UI 设计**:
```
┌─────────────────────────────────────────────────────┐
│ DSL Query Builder                                    │
├─────────────────────────────────────────────────────┤
│ Step 1/7: Query Type                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ fc:      │ │ ft:      │ │ fm:      │           │
│ │ Fetch by │ │ Fetch by │ │ Formula  │           │
│ │ Code     │ │ Time     │ │ Query    │           │
│ └──────────┘ └──────────┘ └──────────┘           │
│                                                      │
│ [Next] [Cancel]                                     │
└─────────────────────────────────────────────────────┘
```

#### 方案 3: 混合模式（推荐）

**核心思路**: 结合方案 1 和方案 2 的优点，提供两种输入方式。

**实现要点**:

1. **默认模式: 智能自动补全**
   - 用户直接在文本框中输入
   - 实时显示补全建议
   - 支持 `Tab` 或 `Enter` 选择
   - 支持 `Ctrl+Space` 手动触发补全

2. **辅助模式: 可视化构建器**
   - 点击 "🔧 Builder" 按钮，切换到可视化构建器
   - 使用方案 2 的分段式输入
   - 构建完成后，自动填充到文本框
   - 可以继续在文本框中编辑

3. **智能提示**
   - 实时语法验证
   - 错误高亮显示
   - 悬停显示字段说明
   - 快捷键提示（`Ctrl+Space`, `Tab`, `Esc`）

4. **历史记录和模板**
   - 显示最近使用的查询
   - 保存常用查询为模板
   - 支持快速插入模板

**UI 设计**:
```
┌─────────────────────────────────────────────────────┐
│ 🔍 DSL Query Builder              [🔧 Builder] [📋]│
├─────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐ │
│ │ fc:SampleQuote@0[CZCE:ap<00>] | 1h | 2025-11-05│ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ [自动补全]                                           │
│ ┌────────────────────────────────────────────────┐ │
│ │ 📊 SampleQuote (global, @0)                    │ │
│ │ 📊 SampleQuote (private, @0)                   │ │
│ │ 📊 KLine (global, @0)                          │ │
│ └────────────────────────────────────────────────┘ │
│                                                      │
│ ✓ Valid DSL syntax                                  │
│ [▶ Execute] [🗑️ Clear] [💾 Save As]                │
└─────────────────────────────────────────────────────┘
```

### 技术实现建议

#### 1. **自动补全引擎**

```typescript
interface AutocompleteContext {
  cursorPosition: number
  currentText: string
  queryType?: 'fc' | 'ft' | 'fm'
  namespace?: 'global' | 'private'
  currentSegment: 'command' | 'namespace' | 'name' | 'revision' | 'market' | 'code' | 'granularity' | 'time'
}

class DSLAutocomplete {
  getSuggestions(context: AutocompleteContext): Suggestion[] {
    // 根据上下文返回补全建议
  }
  
  filterIndicators(namespace?: string): Indicator[] {
    // 从 dataStore.schema 过滤指标
  }
  
  filterFormulas(): FormulaListItem[] {
    // 从 dataStore.formulaList 过滤公式
  }
  
  getGranularityOptions(): string[] {
    return ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '3600', '86400']
  }
  
  getTimeSuggestions(): string[] {
    return ['now', '-7d', '-1h', '-30m', '2025-11-05', '2025-11-05..2025-11-06']
  }
}
```

#### 2. **实时语法解析**

- 使用现有的 `DSLParser` 进行实时解析
- 在用户输入时，每 300ms 解析一次（防抖）
- 显示解析错误和警告
- 高亮显示语法错误位置

#### 3. **上下文感知**

- 解析当前光标位置的上下文
- 根据已输入的内容，智能预测下一步输入
- 过滤不相关的补全建议

#### 4. **性能优化**

- 使用虚拟滚动处理大量指标/公式列表
- 缓存补全结果
- 延迟加载非关键数据

### 推荐方案

**推荐使用方案 3（混合模式）**，原因：

1. **灵活性**: 用户可以选择快速输入或可视化构建
2. **学习曲线**: 新手可以使用可视化构建器，熟练用户可以直接输入
3. **效率**: 自动补全减少输入错误，提高输入速度
4. **可扩展性**: 易于添加新功能和优化

### 实施优先级

1. **Phase 1（基础）**: 智能自动补全（命令、指标/公式、粒度、时间）
2. **Phase 2（增强）**: 可视化构建器
3. **Phase 3（优化）**: 历史记录、模板、快捷键优化

---

## 🔍 方案3可实施性评估

### 总体评估：✅ **具备可实施性，但需要分阶段实施**

方案3在技术上是可行的，但复杂度较高。建议采用渐进式实施策略，先实现核心功能，再逐步增强。

### 技术可行性分析

#### ✅ **优势（已具备的基础）**

1. **现有基础设施完善**
   - ✅ `DSLParser`: 已有完整的语法解析器，可用于实时验证
   - ✅ `dataStore`: 已有 schema 和 formulaList 缓存
   - ✅ `DSLQueryTab`: 已有基础 UI 组件，可以在此基础上扩展
   - ✅ Vue 3 响应式系统: 支持实时更新和状态管理

2. **技术栈成熟**
   - Vue 3 Composition API 支持复杂的组件逻辑
   - TypeScript 提供类型安全
   - 可以使用现有的 UI 组件库（如 Element Plus、Ant Design Vue）

3. **数据源完整**
   - 指标列表: `dataStore.schema` 已缓存
   - 公式列表: `dataStore.formulaList` 已缓存
   - 粒度枚举: 固定列表，易于实现
   - 时间格式: 固定格式，易于实现

#### ⚠️ **挑战（需要解决的技术难点）**

1. **光标位置解析（中等复杂度）**
   - **问题**: textarea 中光标位置的精确计算和上下文识别
   - **解决方案**: 
     - 使用 `textarea.selectionStart` 获取光标位置
     - 解析光标前的文本，识别当前所在的语法段
     - 可以使用正则表达式或状态机解析
   - **工作量**: 2-3 天

2. **上下文感知（中等复杂度）**
   - **问题**: 根据光标位置和已输入内容，智能判断当前应该补全什么
   - **解决方案**:
     - 实现一个 `DSLContextAnalyzer` 类
     - 解析光标前的文本，识别语法段（command、namespace、name 等）
     - 根据语法段类型返回相应的补全建议
   - **工作量**: 3-5 天

3. **自动补全 UI（中等复杂度）**
   - **问题**: 在 textarea 上方或下方显示补全下拉框，并正确定位
   - **解决方案**:
     - 使用 `position: absolute` 定位
     - 计算 textarea 光标位置的像素坐标（需要处理换行）
     - 使用 Vue 组件实现下拉框
   - **工作量**: 2-3 天

4. **性能优化（低-中等复杂度）**
   - **问题**: 大量指标/公式列表可能导致性能问题
   - **解决方案**:
     - 使用虚拟滚动（如 `vue-virtual-scroller`）
     - 实现防抖（debounce）减少解析频率
     - 缓存补全结果
   - **工作量**: 1-2 天

5. **可视化构建器（高复杂度）**
   - **问题**: 需要实现完整的向导式 UI
   - **解决方案**:
     - 创建独立的 `DSLBuilder.vue` 组件
     - 实现 7 步向导流程
     - 与主输入框双向同步
   - **工作量**: 5-7 天

### 分阶段实施建议

#### **Phase 1: 基础自动补全（推荐先实施）** ⭐⭐⭐

**目标**: 实现核心的智能补全功能，覆盖 80% 的使用场景

**实施内容**:
1. ✅ 命令类型补全（`fc:`, `ft:`, `fm:`）- **简单，1天**
2. ✅ 指标/公式名补全（基于 dataStore）- **中等，2-3天**
3. ✅ 粒度补全（固定列表）- **简单，0.5天**
4. ✅ 时间格式补全（固定列表）- **简单，0.5天**
5. ⚠️ 光标位置解析和上下文识别 - **中等，2-3天**
6. ⚠️ 自动补全 UI 组件 - **中等，2-3天**

**总工作量**: 约 8-11 天

**技术难点**:
- 光标位置解析需要精确处理 textarea 的换行和滚动
- 上下文识别需要解析 DSL 语法结构

**实施建议**:
- 可以先实现简单的"触发式补全"（输入特定字符时显示），再优化为"智能补全"
- 使用现有的 Vue 组件库（如 Element Plus 的 Autocomplete）作为基础

#### **Phase 2: 可视化构建器（可选）** ⭐⭐

**目标**: 为新手用户提供友好的向导式输入

**实施内容**:
1. 创建 `DSLBuilder.vue` 组件
2. 实现 7 步向导流程
3. 与主输入框双向同步

**总工作量**: 约 5-7 天

**技术难点**:
- 需要设计清晰的 UI/UX
- 需要处理复杂的表单状态管理

**实施建议**:
- 如果 Phase 1 的自动补全已经很好用，Phase 2 可以延后或简化
- 可以考虑先实现一个简化版的构建器（只包含核心步骤）

#### **Phase 3: 增强功能（可选）** ⭐

**目标**: 提升用户体验的附加功能

**实施内容**:
1. 历史记录（localStorage）
2. 模板管理
3. 快捷键优化
4. 语法高亮

**总工作量**: 约 3-5 天

### 简化版实施建议（如果时间有限）

如果觉得完整方案3太复杂，可以考虑**简化版**：

#### **简化版方案：基础自动补全 + 简单提示**

**实施内容**:
1. ✅ 命令类型提示（输入框为空时显示）
2. ✅ 指标/公式名补全（输入 `:` 后显示列表，支持搜索）
3. ✅ 粒度提示（输入 `|` 后显示常用选项）
4. ✅ 时间格式提示（输入第二个 `|` 后显示）
5. ✅ 实时语法验证（已有）

**总工作量**: 约 3-5 天

**优点**:
- 实现简单，快速见效
- 覆盖主要使用场景
- 可以后续逐步增强

### 最终建议

**推荐实施策略**:

1. **短期（1-2周）**: 实施**简化版方案**
   - 快速提升用户体验
   - 验证技术可行性
   - 收集用户反馈

2. **中期（2-4周）**: 实施**Phase 1（基础自动补全）**
   - 完善光标位置解析
   - 实现智能上下文感知
   - 优化 UI 体验

3. **长期（按需）**: 根据用户反馈决定是否实施 Phase 2 和 Phase 3
   - 如果自动补全已经很好用，可能不需要可视化构建器
   - 历史记录和模板可以作为增值功能

### 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 光标位置解析复杂 | 中 | 中 | 使用成熟的库或简化实现 |
| 性能问题（大量数据） | 低 | 低 | 使用虚拟滚动和缓存 |
| 用户体验不佳 | 中 | 低 | 分阶段实施，收集反馈 |
| 开发时间超预期 | 中 | 中 | 采用简化版先实施 |

### 结论

**方案3具备可实施性**，但建议：

1. ✅ **先实施简化版**，快速验证和迭代
2. ✅ **分阶段实施**，避免一次性投入过多
3. ✅ **根据用户反馈**决定是否需要完整功能
4. ✅ **优先解决核心痛点**（指标/公式名补全、粒度/时间提示）

如果团队有 1-2 周的开发时间，建议先实施简化版；如果有 3-4 周时间，可以实施完整的 Phase 1。

---

## 📊 票子（Market:Code）补全数据策略分析

### 问题背景

当前指标和小公式已经缓存到前端（`dataStore.schema` 和 `dataStore.formulaList`），但票子（securities）数据在 backend 中。对于 DSL 输入框的票子补全功能，需要决定数据获取策略。

### 当前状态

#### 已有基础设施

1. **前端数据存储**
   - `dataStore.securities`: 已有字段，类型为 `ref({})`
   - `dataStore.setSecurities()`: 已有设置方法
   - `SchemaViewer.vue` 中已经在使用 `securities` 数据进行补全

2. **后端 API**
   - `GET /api/securities`: 返回所有市场的票子数据
   - `GET /api/futures/search`: 支持搜索和过滤的票子查询接口
   - 后端通过 WebSocket `universe_seeds` 消息获取票子数据

3. **前端服务**
   - `seedService.getSecurities()`: 可以调用后端 API 获取票子数据
   - `Spotlight.vue` 中已有通过后端 API 搜索票子的实现

### 方案对比

#### 方案 A: 缓存到前端（类似指标/公式）

**实现方式**:
- 在 `DSLQueryTab` 组件初始化时，调用 `seedService.getSecurities()` 获取所有票子
- 使用 `dataStore.setSecurities()` 缓存到前端
- 补全时直接从 `dataStore.securities` 中搜索

**优点**:
- ✅ **补全速度快**: 本地搜索，无网络延迟
- ✅ **用户体验好**: 即时响应，流畅的补全体验
- ✅ **一致性**: 与指标/公式的处理方式一致
- ✅ **离线可用**: 数据缓存后，即使网络断开也能补全
- ✅ **减少服务器压力**: 不需要频繁请求后端

**缺点**:
- ⚠️ **数据量大**: 可能有数千个票子，占用内存（估计 100-500KB）
- ⚠️ **数据更新**: 票子可能变化，需要处理缓存失效
- ⚠️ **初始加载**: 首次加载需要等待 API 响应

**数据量估算**:
```
假设有 10 个市场，每个市场 100 个票子
每个票子: { code, name, market, category } ≈ 100 bytes
总计: 10 × 100 × 100 = 100KB
```

#### 方案 B: 直接查后端（按需查询）

**实现方式**:
- 用户输入 `[` 或市场代码时，调用后端 API 搜索
- 使用 `GET /api/futures/search?market=XXX&pattern=XXX`
- 实时返回搜索结果

**优点**:
- ✅ **数据最新**: 总是获取最新的票子数据
- ✅ **内存占用小**: 前端不缓存，只存储搜索结果
- ✅ **后端优化**: 可以利用后端的复杂搜索逻辑（模糊匹配、分页等）
- ✅ **按需加载**: 只加载用户需要的市场数据

**缺点**:
- ⚠️ **网络延迟**: 每次补全都需要网络请求（100-300ms）
- ⚠️ **用户体验**: 可能有明显的延迟感
- ⚠️ **服务器压力**: 频繁的 API 请求
- ⚠️ **离线不可用**: 网络断开时无法补全

#### 方案 C: 混合方案（推荐）⭐

**实现方式**:
- **默认**: 缓存常用市场的票子到前端（如用户最近使用的市场）
- **按需**: 如果缓存中没有，调用后端 API 获取
- **智能更新**: 定期刷新缓存或按需更新

**具体策略**:
1. **初始加载**: 加载所有市场列表（数据量小，约 10KB）
2. **市场选择**: 用户选择市场后，加载该市场的票子列表
3. **缓存策略**: 
   - 缓存最近使用的 3-5 个市场的票子
   - 使用 LRU（最近最少使用）策略管理缓存
   - 设置缓存过期时间（如 1 小时）
4. **搜索优化**: 
   - 如果缓存中有数据，本地搜索
   - 如果缓存中没有，调用后端 API 搜索

**优点**:
- ✅ **平衡性能**: 常用数据本地缓存，快速响应
- ✅ **数据新鲜**: 不常用的数据实时查询，保证最新
- ✅ **内存可控**: 只缓存常用数据，内存占用可控
- ✅ **用户体验**: 常用场景快速，不常用场景也能工作

**缺点**:
- ⚠️ **实现复杂度**: 需要管理缓存逻辑
- ⚠️ **缓存一致性**: 需要处理缓存更新

### 推荐方案

**推荐使用简化方案：只缓存市场列表，票子实时查询** ⭐

**实施策略**:
1. **市场列表**: 直接从 `dataStore.marketData` 中获取（已通过 WebSocket `markets_received` 消息缓存）
2. **票子实时查询**: 用户输入市场代码或选择市场后，调用 `GET /api/futures/search?market=XXX&pattern=XXX` 实时查询票子
3. **搜索优化**: 实现防抖（300ms），减少不必要的 API 请求

**实施内容**:
1. **市场列表**: 直接从 `dataStore.marketData` 中提取市场列表（无需额外 API 调用）
   - 数据结构: `{ global: { "DCE": {...}, "SHFE": {...} }, private: {...} }`
   - 提取逻辑: 遍历 `marketData.global` 和 `marketData.private`，获取市场代码和名称
2. 用户输入 `[` 时，显示市场列表补全（从 `dataStore.marketData` 读取）
3. 用户选择市场后，调用 `seedService.searchFutures({ market, pattern })` 实时查询票子
4. 实现搜索防抖，避免频繁请求

**工作量**: 约 1-2 天

**优点**: 
- ✅ **实现简单**: 不需要复杂的缓存管理逻辑
- ✅ **内存占用小**: 只缓存市场列表（约 1KB），不缓存票子数据
- ✅ **数据最新**: 票子数据总是最新的，无需处理缓存失效
- ✅ **按需加载**: 只加载用户需要的市场票子，节省带宽
- ✅ **用户体验**: 市场列表补全快速，票子查询有防抖优化

**缺点**:
- ⚠️ **网络延迟**: 票子查询需要网络请求（100-300ms），但可以通过防抖和加载状态优化体验
- ⚠️ **离线不可用**: 网络断开时无法查询票子（但市场列表可以补全）

**数据量估算**:
```
市场列表: 约 10-20 个市场，每个市场 { code, name } ≈ 50 bytes
总计: 20 × 50 = 1KB（非常小）
```

### 实现示例

```typescript
// 在 DSLQueryTab.vue 中
import { seedService } from '@/services/seedService'
import { useDataStore } from '@/stores/dataStore'

const dataStore = useDataStore()

// 从 dataStore.marketData 中提取市场列表（已缓存，无需额外 API 调用）
const availableMarkets = computed(() => {
  if (!dataStore.marketData) return []
  
  const markets: Array<{code: string, name: string, type: string}> = []
  
  // 从 global 命名空间提取市场
  if (dataStore.marketData.global) {
    Object.entries(dataStore.marketData.global).forEach(([code, market]: [string, any]) => {
      markets.push({
        code: code,
        name: market.name || code,
        type: 'global'
      })
    })
  }
  
  // 从 private 命名空间提取市场
  if (dataStore.marketData.private) {
    Object.entries(dataStore.marketData.private).forEach(([code, market]: [string, any]) => {
      markets.push({
        code: code,
        name: market.name || code,
        type: 'private'
      })
    })
  }
  
  return markets.sort((a, b) => a.code.localeCompare(b.code))
})

// 实时查询票子（用户输入市场代码时调用）
let searchTimeout: number | null = null
const searchSecurities = async (market: string, pattern: string = '') => {
  // 防抖处理
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  return new Promise((resolve) => {
    searchTimeout = setTimeout(async () => {
      try {
        const response = await seedService.searchFutures({
          market: market || undefined,
          pattern: pattern || undefined,
          limit: 50 // 限制返回数量
        })
        
        if (response.success && response.data) {
          resolve(response.data)
        } else {
          resolve([])
        }
      } catch (error) {
        console.error('Failed to search securities:', error)
        resolve([])
      }
    }, 300) // 300ms 防抖
  })
}

// 在 onMounted 中调用
onMounted(() => {
  loadMarkets()
})
```

### 补全流程

1. **市场补全**:
   - 用户输入 `[` 时，显示市场列表（从 `markets` 缓存读取）
   - 支持模糊搜索市场代码和名称
   - 用户选择市场后，自动填充 `[MARKET:`

2. **票子补全**:
   - 用户输入市场代码后（如 `[CZCE:`），调用 `searchSecurities('CZCE', '')` 查询该市场的所有票子
   - 用户继续输入票子代码时（如 `[CZCE:ap`），调用 `searchSecurities('CZCE', 'ap')` 进行模糊搜索
   - 显示搜索结果，支持按代码或名称搜索

3. **优化**:
   - 使用防抖减少 API 请求
   - 显示加载状态（loading indicator）
   - 缓存最近一次查询结果（可选，避免重复查询相同内容）

### 最终建议

**推荐实施策略**:

✅ **直接实施简化方案**（只缓存市场，票子实时查询）

**理由**:
1. **实现简单**: 不需要复杂的缓存管理，工作量约 1-2 天
2. **内存占用小**: 只缓存市场列表（约 1KB），不占用大量内存
3. **数据最新**: 票子数据总是最新的，无需处理缓存失效
4. **用户体验**: 市场列表补全快速，票子查询有防抖优化，体验良好
5. **可扩展**: 如果后续需要优化，可以添加结果缓存或按市场缓存

**实施步骤**:
1. 在 `DSLQueryTab` 组件中添加 `loadMarkets()` 方法
2. 在 `onMounted` 中调用 `loadMarkets()`
3. 实现市场补全逻辑（从 `markets` 缓存读取）
4. 实现票子查询逻辑（调用 `seedService.searchFutures()`）
5. 添加防抖和加载状态

---

## 📝 更新日志

| 日期 | 版本 | 更新内容 | 作者 |
|------|------|---------|------|
| 2025-01-XX | 1.0.0 | 初始设计文档 | 开发团队 |

---

**文档维护**: 本文档将随着设计讨论和实现进展持续更新。所有重要的设计决策和讨论都应记录在此文档中。


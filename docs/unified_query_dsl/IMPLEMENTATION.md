# DSL 统一查询系统实现文档

## 📋 文档说明

本文档详细记录 DSL 统一查询系统的实现细节、代码结构和技术实现。

**文档状态**: 🟢 持续更新  
**最后更新**: 2025-01-XX  
**维护者**: 开发团队

---

## 🏗️ 系统架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                   前端层 (Vue 3)                        │
├─────────────────────────────────────────────────────────┤
│  DSLQueryTab.vue                                        │
│    ├─ DSL 输入框（实时验证）                            │
│    ├─ 查询执行按钮                                      │
│    ├─ 保存查询功能                                      │
│    └─ 结果展示区域                                      │
│                                                          │
│  DSLParser (dslParser.ts)                                │
│    └─ DSL 字符串 → QueryAST                             │
│                                                          │
│  DSLExecutor (dslExecutor.ts)                           │
│    ├─ QueryAST → 后端 API 参数转换                      │
│    ├─ 自动补充 fields（从 schema 缓存）                │
│    ├─ WebSocket 消息发送                                │
│    └─ 响应处理和结果转换                                │
│                                                          │
│  DataStore (Pinia)                                      │
│    ├─ Schema 缓存（指标列表）                           │
│    │   └─ 用于自动补充 fields                           │
│    └─ FormulaList 缓存（小公式列表）                    │
│        └─ 用于公式查询时查找公式信息                     │
│                                                          │
│  FormulaService                                         │
│    └─ 查询公式列表 API                                  │
│                                                          │
│  WebSocketTaskService                                   │
│    └─ 发送 WebSocket 任务并等待响应                     │
└─────────────────────────────────────────────────────────┘
                          │
                          │ WebSocket
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 后端层 (Node.js)                        │
├─────────────────────────────────────────────────────────┤
│  server.js                                               │
│    ├─ fetch_by_code 处理                                │
│    ├─ fetch_by_time 处理                                │
│    └─ calculate_formula 处理                           │
│                                                          │
│  CaitlynWebSocketService                                 │
│    └─ WASM 连接池管理                                   │
└─────────────────────────────────────────────────────────┘
```

### 数据依赖关系

#### 公式查询的数据流

```
┌─────────────────────────────────────────────────────────┐
│ DSLQueryTab.vue (组件初始化)                            │
│   onMounted()                                           │
│     └─> loadFormulaList()                               │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ FormulaService                                          │
│   queryFormulas({ privateOnly: true })                  │
│     └─> POST /api/formulas/query                        │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ DataStore (Pinia)                                       │
│   setFormulaList(formulas)                              │
│   formulaList: FormulaListItem[]                        │
│   - id                                                   │
│   - name                                                 │
│   - source_code                                          │
│   - language_id                                          │
└─────────────────────────────────────────────────────────┘
                    │
                    │ [用户执行公式查询]
                    ▼
┌─────────────────────────────────────────────────────────┐
│ DSLExecutor.executeFormula()                            │
│   1. dataStore.findFormulaByName(ast.formula)           │
│      └─> 返回: { id, name, source_code, language_id }   │
│   2. websocketTaskService.sendTask(register_formula)     │
│      └─> 等待 register_formula_response                  │
│      └─> 提取 uuid                                       │
│   3. wsStore.send(calculate_formula)                    │
│      └─> 等待 calculate_formula_response                │
└─────────────────────────────────────────────────────────┘
```

#### 指标查询的数据流

```
┌─────────────────────────────────────────────────────────┐
│ DSLExecutor.execute()                                   │
│   enrichASTWithFields()                                 │
│     └─> getFieldsFromSchema()                           │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ DataStore.schema                                        │
│   schema[namespace][indicator][revision]                 │
│     └─> fields: string[]                                │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ DSLExecutor.executeFetchByCode/Time()                   │
│   wsStore.send(fetch_by_code/fetch_by_time)             │
│     └─> 等待响应并处理                                   │
└─────────────────────────────────────────────────────────┘
```

#### 关键依赖说明

1. **DSLQueryTab → DataStore**
   - 依赖: `formulaList`, `formulaListLoading`, `isFormulaListLoaded`
   - 操作: `setFormulaList()`, `findFormulaByName()`
   - 时机: 组件初始化时加载，查询时使用

2. **DSLQueryTab → FormulaService**
   - 依赖: `queryFormulas()` 方法
   - 操作: 调用 API 获取公式列表
   - 时机: `onMounted` 生命周期

3. **DSLExecutor → DataStore**
   - 依赖: `schema` (指标查询), `formulaList` (公式查询)
   - 操作: `getFieldsFromSchema()`, `findFormulaByName()`
   - 时机: 执行查询时

4. **DSLExecutor → WebSocketTaskService**
   - 依赖: `sendTask()` 方法
   - 操作: 发送 `register_formula` 并等待响应
   - 时机: 公式查询的注册步骤

5. **DSLExecutor → WebSocketStore**
   - 依赖: `send()` 方法, `lastMessage` 响应
   - 操作: 发送查询消息，监听响应
   - 时机: 所有查询类型

---

## 📁 文件结构

### 前端文件

```
frontend-vue/src/
├── types/
│   └── dsl.ts                    # DSL 相关类型定义
├── utils/
│   ├── dslParser.ts              # DSL 解析器
│   └── dslExecutor.ts             # DSL 执行器
├── components/
│   └── DSLQueryTab.vue           # DSL 查询界面组件
└── stores/
    └── dataStore.ts              # Schema 缓存（Pinia Store）
```

### 类型定义

**`frontend-vue/src/types/dsl.ts`**:

```typescript
export type QueryType = 'ft' | 'fc' | 'fm'
export type Namespace = 'global' | 'private'

export interface QueryAST {
  type: QueryType
  namespace: Namespace
  indicator?: string
  formula?: string
  revision?: number
  market: string
  code: string
  granularity: number        // 秒数
  time?: number              // Unix 时间戳（秒）
  from?: number              // Unix 时间戳（秒）
  to?: number                // Unix 时间戳（秒）
  options: QueryOptions
  originalDsl: string
}

export interface QueryOptions {
  fields?: string[]
  namespace?: Namespace
  revision?: number
  subscribe?: boolean
  realTime?: boolean
  formulaId?: string
}

export interface QueryResult {
  query: {
    dsl: string
    type: 'indicator' | 'formula'
  }
  metadata: {
    type: 'indicator' | 'formula'
    indicator?: string
    formula?: string
    market: string
    code: string
    namespace?: Namespace
    granularity: number
    revision?: number
    timeRange: {
      from: string
      to: string
    }
  }
  records: Array<{
    timestamp: number
    time: string
    [field: string]: any
  }>
  displayConfig?: {
    lines?: Array<{
      name: string
      color: string
      thickness: number
    }>
  }
}
```

---

## 🔧 核心组件实现

### 1. DSL Parser (`dslParser.ts`)

**功能**: 将 DSL 字符串解析为 QueryAST

**关键方法**:

- `parse(dsl: string)`: 主解析方法
- `parseQueryType(type: string)`: 解析查询类型
- `parseGranularity(granularity: string)`: 解析粒度（支持单位格式和纯数字）
- `parseTimeRange(range: string)`: 解析时间范围
- `parseTime(time: string)`: 解析时间（支持 ISO、时间戳、相对时间）
- `parseOptions(options: string)`: 解析选项参数

**支持的语法元素**:

- 查询类型: `ft:`, `fc:`, `fm:`
- Namespace: `global::`, `private::`
- Revision: `@数字`
- 市场代码: `[market:code]`
- 粒度: `1h`, `5m`, `3600`（支持单位格式和纯数字）
- 时间范围: `2025-01-01..2025-01-02`, `now..-7d`, `1762310700000..1762397100000`
- 选项: `fields:open,close`, `+subscribe`

**示例**:

```typescript
// 输入
const dsl = 'fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-11-05..2025-11-06'

// 输出
{
  type: 'fetch_by_code',
  namespace: 'global',
  indicator: 'SampleQuote',
  revision: 0,
  market: 'CZCE',
  code: 'ap<00>',
  granularity: 3600,
  from: 1730764800,
  to: 1730851200,
  options: {},
  originalDsl: 'fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-11-05..2025-11-06'
}
```

### 2. DSL Executor (`dslExecutor.ts`)

**功能**: 执行 DSL 查询，将 QueryAST 转换为后端 API 调用

**关键方法**:

- `execute(ast: QueryAST, options: ExecuteOptions)`: 执行查询（Promise）
- `enrichASTWithFields(ast: QueryAST)`: 自动补充 fields（从 schema 缓存）
- `getFieldsFromSchema(namespace, metaName, revision)`: 从 schema 获取所有 fields
- `executeFetchByCode(ast, requestId)`: 执行 fetch_by_code 查询
- `executeFetchByTime(ast, requestId)`: 执行 fetch_by_time 查询
- `executeFormula(ast, requestId)`: 执行公式查询
- `handleResponse(message)`: 处理 WebSocket 响应
- `convertToQueryResult(message, queryType, ast)`: 转换响应为 QueryResult 格式

**自动 Fields 补充**:

当 DSL 查询未指定 `fields` 时，自动从本地 schema 缓存中获取该指标的所有 fields：

```typescript
// 如果查询未指定 fields
fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-11-05..2025-11-06

// 自动从 schema 中获取所有 fields
// 例如: ['open', 'close', 'high', 'low', 'volume', 'turnover']
```

**RequestId 匹配机制**:

- `fetch_by_code`: **只根据 requestId 匹配**（后端保证返回 requestId）
- `fetch_by_time`: 优先使用 requestId，否则使用备用匹配
- `calculate_formula`: 优先使用 requestId，否则使用备用匹配

### 3. DSL Query Tab (`DSLQueryTab.vue`)

**功能**: DSL 查询界面组件

**主要功能**:

- DSL 输入框（实时语法验证）
- 快捷操作按钮（Execute, Clear, Copy, Validate, Save As）
- 语法帮助面板
- 保存查询功能（localStorage）
- 查询历史列表
- 结果展示区域

**状态管理**:

- `dslInput`: DSL 输入内容
- `parseError`: 解析错误信息
- `isValid`: 语法是否有效
- `isExecuting`: 是否正在执行
- `queryResult`: 查询结果
- `savedQueries`: 保存的查询列表

---

## 🔄 API 映射规则

### fetch_by_code

**DSL 格式**:
```
fc:[namespace::]indicator[@revision][market:code] | granularity | from..to
```

**前端发送**:
```json
{
  "type": "fetch_by_code",
  "market": "CZCE",
  "code": "ap<00>",
  "fromTime": 1730764800,
  "toTime": 1730851200,
  "granularity": 3600,
  "metaName": "SampleQuote",
  "namespace": "0",
  "revision": 0,
  "fields": ["open", "close", "high", "low", "volume"],
  "requestId": "dsl_1736123456789_abc123xyz"
}
```

**后端响应**:
```json
{
  "type": "fetch_by_code_response",
  "success": true,
  "data": {
    "records": [...]
  },
  "queryParams": {...},
  "requestId": "dsl_1736123456789_abc123xyz"
}
```

### fetch_by_time

**DSL 格式**:
```
ft:[namespace::]indicator[@revision][market:code] | granularity | time
```

**前端发送**:
```json
{
  "type": "fetch_by_time",
  "params": {
    "markets": ["CZCE"],
    "codes": ["ap<00>"],
    "timeTag": 1730764800,
    "granularity": 3600,
    "fields": ["open", "close"],
    "metaName": "SampleQuote",
    "namespace": "0",
    "revision": 0
  },
  "requestId": "dsl_1736123456789_abc123xyz"
}
```

**后端响应**:
```json
{
  "type": "fetch_by_time_response",
  "success": true,
  "data": {
    "records": [...]
  },
  "queryParams": {...},
  "requestId": "dsl_1736123456789_abc123xyz"
}
```

### Formula Query

**DSL 格式**:
```
fm:[namespace::]formula[@revision][market:code] | granularity | from..to | +subscribe
```

**完整流程**:

1. **查询公式列表**（组件初始化时）:
```typescript
// 在 DSLQueryTab.vue 的 onMounted 中
const loadFormulaList = async () => {
  const response = await formulaService.queryFormulas({
    privateOnly: true  // 不限制 languageId
  })
  dataStore.setFormulaList(response.formulas)
}
```

**API 请求**:
```json
POST /api/formulas/query
{
  "privateOnly": 1
}
```

**数据依赖**:
- `formulaService`: 调用 Formula Management API
- `dataStore.setFormulaList()`: 缓存公式列表到 Pinia store
- 缓存状态: `dataStore.formulaList`, `dataStore.formulaListLoading`, `dataStore.isFormulaListLoaded`

2. **注册公式**（获取 UUID）:
```typescript
// 在 dslExecutor.executeFormula() 中
const formula = dataStore.findFormulaByName(ast.formula)
if (!formula) {
  throw new Error(`Formula "${ast.formula}" not found`)
}

const registerMessage = {
  type: 'register_formula',
  formulaId: formula.id,
  sourceCode: formula.source_code,
  languageId: formula.language_id ?? 5,  // 使用 ?? 而不是 ||
  requestId: registerRequestId
}

const registerResponse = await websocketTaskService.sendTask(registerMessage, {
  timeout: 15000,
  retries: 1
})

const uuid = registerResponse.data.uuid
```

**WebSocket 消息**:
```json
{
  "type": "register_formula",
  "formulaId": 225,
  "sourceCode": "variable: SHORT=0;\n...",
  "languageId": 5,
  "requestId": "dsl_register_123"
}
```

**数据依赖**:
- `dataStore.findFormulaByName()`: 从缓存中查找公式信息（`id`, `source_code`, `language_id`）
- `websocketTaskService.sendTask()`: 发送消息并等待 `register_formula_response`
- `websocketStore`: 确保 WebSocket 连接已建立

3. **计算公式**（使用 UUID）:
```typescript
// 在 dslExecutor.executeFormula() 中
const calculateMessage = {
  type: 'calculate_formula',
  uuid: uuid,  // 从注册响应中获取
  market: ast.market,
  code: ast.code,
  fromTime: parseTime(ast.from) * 1000,  // 转换为毫秒
  toTime: parseTime(ast.to) * 1000,
  granularity: ast.granularity,
  isRealTime: ast.subscribe || false,
  requestId: requestId
}

wsStore.send(calculateMessage)
```

**WebSocket 消息**:
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
  "requestId": "dsl_calculate_456"
}
```

**数据依赖**:
- `uuid`: 从步骤 2 的注册响应中获取
- `wsStore.send()`: 发送计算消息
- `dslExecutor.handleResponse()`: 处理 `calculate_formula_response`

**响应处理**:
- `register_formula_response`: 提取 `data.uuid`，用于后续计算
- `calculate_formula_response`: 处理嵌套的 `data.data` 数组和 `displayConfiguration`，转换为统一的 `QueryResult` 格式

---

## 🔑 关键实现细节

### 1. 时间格式处理

**支持的输入格式**:
- ISO 日期: `2025-01-01`
- ISO 日期时间: `2025-01-01T10:00:00Z`
- Unix 时间戳（秒）: `1730764800`
- Unix 时间戳（毫秒）: `1730764800000`
- 相对时间: `now`, `-7d`, `-1h`

**处理逻辑**:
- 所有时间格式统一转换为秒级 Unix 时间戳
- ISO 日期/时间假设为 UTC（如果没有时区信息）
- 相对时间基于当前时间计算

### 2. Namespace 转换

**前端 → 后端**:
- `global` → `'0'` (字符串)
- `private` → `'1'` (字符串)

**后端处理**:
- `fetch_by_code`: 接收 `'0'` 或 `'1'`，转换为 `'global'` 或 `'private'` 字符串传递给 WASM
- `fetch_by_time`: 接收 `'0'` 或 `'1'`，转换为数字 `0` 或 `1` 传递给 WASM

### 3. RequestId 生成和匹配

**生成规则**:
```typescript
const requestId = `dsl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
```

**匹配规则**:
- `fetch_by_code`: **严格匹配**，必须有 requestId，否则不处理
- `fetch_by_time`: 优先使用 requestId，否则通过消息类型和参数匹配
- `calculate_formula`: 优先使用 requestId，否则通过消息类型和参数匹配

### 4. 自动 Fields 补充

**触发条件**:
- 查询类型为 `fetch_by_code` 或 `fetch_by_time`（不是公式查询）
- 未指定 `fields` 选项
- 有指标名称（`indicator`）

**实现流程**:
1. 检查 AST 是否已有 fields
2. 从 `dataStore.schema` 获取 schema 数据
3. 根据 namespace、metaName 和 revision 查找匹配的 meta
4. 如果未指定 revision，使用最新的（revision 最大的）
5. 提取所有 field names
6. 添加到 AST 的 `options.fields` 中

**示例**:
```typescript
// 输入 DSL（无 fields）
fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-11-05..2025-11-06

// 自动补充后
{
  ...ast,
  options: {
    fields: ['open', 'close', 'high', 'low', 'volume', 'turnover']
  }
}
```

### 5. 响应处理机制

**处理流程**:
1. 组件通过 `watch` 监听 `wsStore.lastMessage`
2. 调用 `dslExecutor.handleResponse(message)`
3. 根据消息类型匹配对应的处理函数
4. 通过 requestId 查找对应的 Promise resolver
5. 转换响应为 `QueryResult` 格式
6. 调用 `resolve(result)` 或 `reject(error)`

**错误处理**:
- 网络错误: 超时处理（默认 30 秒）
- 后端错误: 解析错误响应并 reject
- 解析错误: 返回 `ParseError` 对象

---

## 📝 代码示例

### 基本查询执行

```typescript
import { DSLParser } from '@/utils/dslParser'
import { dslExecutor } from '@/utils/dslExecutor'

// 解析 DSL
const parseResult = DSLParser.parse('fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-11-05..2025-11-06')

if ('error' in parseResult) {
  console.error('Parse error:', parseResult.message)
  return
}

// 执行查询
const result = await dslExecutor.execute(parseResult, {
  onSuccess: (result) => {
    console.log('Query success:', result)
  },
  onError: (error) => {
    console.error('Query failed:', error)
  },
  timeout: 30000
})

console.log('Records:', result.records)
```

### 从 Schema 获取 Fields

```typescript
// 在 dslExecutor 内部
const fields = this.getFieldsFromSchema('global', 'SampleQuote', 0)
// 返回: ['open', 'close', 'high', 'low', 'volume', 'turnover']
```

---

## 🐛 已知问题和限制

### 已解决的问题

- ✅ `rest` 变量被声明为 `const` 导致无法重新赋值
- ✅ ISO 日期时区问题（本地时间 vs UTC）
- ✅ Pinia 初始化前调用 store 的问题
- ✅ `fetch_by_code` 响应缺少 `requestId`

### 当前限制

- Schema 缓存仅在内存中，页面刷新后需要重新获取
- 公式列表缓存仅在内存中，页面刷新后需要重新获取
- 公式查询需要先注册公式（获取 UUID），每次查询都需要重新注册
- 超时时间固定为 30 秒，不可配置
- 公式查询的时间参数使用毫秒级时间戳（与指标查询的秒级不同）

---

## 🚀 后续优化方向

1. **持久化缓存**: 将 schema 缓存到 IndexedDB
2. **查询结果缓存**: 实现查询结果缓存（如果需要）
3. **批量查询**: 支持一次查询多个指标
4. **查询优化**: 自动合并相同参数的查询
5. **错误重试**: 实现自动重试机制
6. **性能监控**: 添加查询性能监控和统计

---

## 📚 相关文档

- [设计文档](./UNIFIED_QUERY_DSL_DESIGN.md) - DSL 语法设计和系统设计
- [开发文档](./DEVELOPMENT.md) - 开发进度和计划

---

## 🔗 相关代码文件

- `frontend-vue/src/utils/dslParser.ts` - DSL 解析器
- `frontend-vue/src/utils/dslExecutor.ts` - DSL 执行器
- `frontend-vue/src/components/DSLQueryTab.vue` - DSL 查询界面
- `frontend-vue/src/types/dsl.ts` - DSL 类型定义
- `frontend-vue/src/stores/dataStore.ts` - Schema 缓存
- `backend/src/server.js` - 后端 WebSocket 处理


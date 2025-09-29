# RequestId 统一化总结

## 更新概述

根据用户要求，将 WebSocket 任务服务统一使用 `requestId` 字段，与后端保持一致，简化了消息匹配逻辑。

## 核心改进

### 1. 统一字段命名

**更新前:**
- 前端发送: `seq` 字段
- 后端期望: `data.requestId`
- 后端响应: `requestId` 字段
- 匹配逻辑: 复杂的多字段匹配

**更新后:**
- 前端发送: `requestId` 字段
- 后端期望: `data.requestId`
- 后端响应: `requestId` 字段
- 匹配逻辑: 简单的直接匹配

### 2. 简化的消息格式

**发送消息:**
```json
{
  "type": "execute_formula",
  "market": "SHFE",
  "code": "rb2501",
  "requestId": "1"  // 简单的递增序列号
}
```

**响应消息:**
```json
{
  "type": "formula_execution_response",
  "success": true,
  "data": { ... },
  "requestId": "1"  // 直接匹配
}
```

### 3. 简化的匹配逻辑

**更新前:**
```typescript
// 复杂的多字段匹配
const seq = message.seq || message.requestId
let pendingTask = this.pendingTasks.value.get(seq)
if (!pendingTask) {
  // 额外的匹配逻辑...
}
```

**更新后:**
```typescript
// 简单的直接匹配
const requestId = message.requestId
const pendingTask = this.pendingTasks.value.get(requestId)
```

## 技术细节

### 1. 序列号生成

```typescript
// 生成简单的递增序列号
private generateSeq(): string {
  return (this.nextSeq++).toString()
}
```

### 2. 消息发送

```typescript
// 创建消息时只设置 requestId
originalMessage: { 
  ...message, 
  requestId: seq  // 统一使用 requestId
}
```

### 3. 任务管理

```typescript
// 使用 requestId 作为任务 key
this.pendingTasks.value.set(seq, pendingTask)

// 通过 requestId 查找任务
const pendingTask = this.pendingTasks.value.get(requestId)
```

## 解决的问题

### 1. 字段不匹配问题

**问题**: 前端使用 `seq`，后端使用 `requestId`，导致消息匹配失败

**解决**: 统一使用 `requestId` 字段

### 2. 匹配逻辑复杂

**问题**: 需要支持多种字段匹配方式，代码复杂

**解决**: 简化为单一字段直接匹配

### 3. 调试困难

**问题**: 多个字段名称容易混淆

**解决**: 统一字段名称，便于调试

## 优势

### 1. 一致性
- 前后端字段命名完全一致
- 减少字段映射的复杂性
- 降低出错概率

### 2. 简洁性
- 匹配逻辑简单直接
- 代码更易理解和维护
- 减少不必要的复杂性

### 3. 可靠性
- 单一匹配路径，减少出错可能
- 清晰的日志输出
- 更好的错误追踪

### 4. 性能
- 直接查找，无需额外循环
- 减少字符串处理开销
- 更高效的任务管理

## 文件变更

### 修改的文件
- `src/services/websocketTaskService.ts` - 统一使用 requestId
- `SIMPLE_SEQUENCE_UPDATE.md` - 更新文档
- `WEBSOCKET_CALLBACK_USAGE.md` - 更新使用说明

### 新增文件
- `REQUESTID_UNIFICATION_SUMMARY.md` - 统一化总结文档

## 向后兼容性

- ✅ 保持原有的 API 接口不变
- ✅ 保持原有的配置选项不变
- ✅ 保持原有的错误处理机制不变
- ✅ 只改变内部字段命名和匹配逻辑

## 测试验证

### 编译检查
- ✅ TypeScript 编译通过
- ✅ 无 linting 错误
- ✅ 类型安全

### 功能验证
- ✅ 序列号生成正确 (1, 2, 3, ...)
- ✅ 消息匹配逻辑简化
- ✅ 超时和重试机制正常
- ✅ 错误处理机制正常

## 使用示例

### 公式执行

```typescript
// 发送执行请求
const response = await websocketTaskService.sendTask({
  type: "execute_formula",
  market: "SHFE",
  code: "rb2501",
  fromTime: 1757750400000,
  toTime: 1758527940000,
  granularity: 86400,
  formulaCode: "ema5: ema(close, 5)...",
  formulaName: "builtin-ma",
  formulaId: -333
  // requestId 会自动生成为 "1"
}, {
  timeout: 30000,
  retries: 1,
  retryDelay: 3000
})
```

### 公式注册

```typescript
// 发送注册请求
const response = await websocketTaskService.sendTask({
  type: "register_formula",
  formulaId: -333,
  sourceCode: "ema5: ema(close, 5)...",
  languageId: 5
  // requestId 会自动生成为 "2"
}, {
  timeout: 15000,
  retries: 1,
  retryDelay: 2000
})
```

## 总结

这次更新成功地将 WebSocket 任务服务统一使用 `requestId` 字段，与后端保持完全一致。新的机制更加简洁、可靠，同时保持了完全的向后兼容性。统一化的字段命名和简化的匹配逻辑大大提升了代码的可维护性和调试友好性。

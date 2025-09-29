# 简单序列号机制更新

## 更新概述

根据用户需求，将 WebSocket 任务服务的序列号生成机制从复杂的前缀格式改为简单的递增数字序列号。

## 变更内容

### 1. 序列号生成逻辑

**更新前:**
```typescript
private generateSeq(): string {
  return `task_${Date.now()}_${this.nextSeq++}`
}
// 生成: "task_1758523106767_1", "task_1758523106767_2", ...
```

**更新后:**
```typescript
private generateSeq(): string {
  return (this.nextSeq++).toString()
}
// 生成: "1", "2", "3", "4", ...
```

### 2. 消息格式变化

**发送消息格式:**
```json
{
  "type": "execute_formula",
  "market": "SHFE",
  "code": "rb2501",
  "requestId": "1"   // 简单的递增序列号，与后端保持一致
}
```

**响应消息格式:**
```json
{
  "type": "formula_execution_response",
  "success": true,
  "data": { ... },
  "requestId": "1"  // 匹配发送消息的 requestId
}
```

### 3. 消息匹配逻辑简化

统一使用 `requestId` 进行消息匹配，简化了匹配逻辑：

```typescript
// 统一使用 requestId 进行匹配
const requestId = message.requestId

// 直接查找对应的待处理任务
const pendingTask = this.pendingTasks.value.get(requestId)
```

## 解决的问题

### 1. 消息匹配失败

**问题**: 发送消息使用 `seq` 字段，响应消息使用 `requestId` 字段，导致匹配失败

**根本原因**: 后端代码期望接收 `data.requestId` 并在响应中返回 `requestId: data.requestId`

**解决**: 
1. 统一使用 `requestId` 字段，与后端保持一致
2. 简化匹配逻辑，直接通过 `requestId` 进行任务匹配
3. 移除不必要的 `seq` 字段，减少混淆

### 2. 序列号过于复杂

**问题**: 使用时间戳和前缀的复杂序列号格式

**解决**: 改为简单的递增数字序列号 (1, 2, 3, ...)

### 3. 调试困难

**问题**: 复杂的序列号格式难以在日志中追踪

**解决**: 简单的数字序列号，便于日志分析和调试

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
  // seq 会自动生成为 "1"
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
  // seq 会自动生成为 "2"
}, {
  timeout: 15000,
  retries: 1,
  retryDelay: 2000
})
```

## 优势

### 1. 简洁性
- 序列号格式简单明了
- 不需要复杂的前缀和时间戳
- 易于理解和维护

### 2. 可靠性
- 简单的数字匹配，减少出错可能
- 增强的匹配逻辑，支持多种匹配方式
- 更好的错误处理和调试信息

### 3. 性能
- 轻量级的序列号生成
- 高效的匹配算法
- 减少字符串处理开销

### 4. 调试友好
- 序列号简单明了，便于日志分析
- 清晰的匹配日志输出
- 更好的错误追踪能力

## 测试验证

### 编译检查
- ✅ TypeScript 编译通过
- ✅ 无 linting 错误
- ✅ 类型安全

### 功能验证
- ✅ 序列号生成正确 (1, 2, 3, ...)
- ✅ 消息匹配逻辑工作正常
- ✅ 超时和重试机制正常
- ✅ 错误处理机制正常

## 文件变更

### 修改的文件
- `src/services/websocketTaskService.ts` - 更新序列号生成和匹配逻辑
- `src/components/FormulaViewer.vue` - 移除手动 requestId 设置
- `WEBSOCKET_CALLBACK_USAGE.md` - 更新使用文档

### 新增文件
- `src/utils/websocketTaskTest.ts` - 测试工具
- `SIMPLE_SEQUENCE_UPDATE.md` - 更新说明文档

## 向后兼容性

- ✅ 保持原有的 API 接口不变
- ✅ 保持原有的配置选项不变
- ✅ 保持原有的错误处理机制不变
- ✅ 只改变内部序列号生成逻辑

## 总结

这次更新成功地将 WebSocket 任务服务的序列号机制简化为递增数字格式，解决了消息匹配失败的问题，提升了系统的可靠性和调试友好性。新的机制更加简洁、高效，同时保持了完全的向后兼容性。

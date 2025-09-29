# WebSocket Callback 服务使用指南

## 概述

新的 WebSocket Callback 服务提供了类似 HTTP 请求-响应模式的 WebSocket 通信机制，大大提升了代码的可维护性和可读性。

## 核心特性

✅ **请求-响应模式** - 类似 HTTP 的 Promise-based API  
✅ **简单序列号** - 使用递增数字序列号 (1, 2, 3, ...) 进行消息匹配  
✅ **自动超时处理** - 可配置的超时时间和重试机制  
✅ **任务队列管理** - 自动管理待处理任务和回调  
✅ **错误处理** - 完善的错误处理和恢复机制  
✅ **内存管理** - 自动清理过期任务，防止内存泄漏  

## 架构组件

### 1. WebSocketTaskService (`src/services/websocketTaskService.ts`)

核心任务管理服务，负责：
- 维护待处理任务队列
- 处理请求-响应匹配
- 超时和重试管理
- 自动清理过期任务

### 2. 更新的 SubscriptionService

使用新的 callback 机制：
- 异步订阅/取消订阅
- 自动错误处理
- 超时保护

### 3. 重构的 FormulaViewer

使用新的 callback 服务：
- 异步公式注册
- 异步公式执行
- 更好的错误处理

## 使用方法

### 1. 基本任务发送

```typescript
import { websocketTaskService } from '@/services/websocketTaskService'

// 发送任务并等待响应
try {
  const response = await websocketTaskService.sendTask({
    type: 'register_formula',
    formulaId: 123,
    sourceCode: 'formula code...'
    // 不需要手动设置 requestId，服务会自动生成简单的递增序列号
  }, {
    timeout: 15000, // 15 秒超时
    retries: 1,     // 重试 1 次
    retryDelay: 2000 // 重试延迟 2 秒
  })

  if (response.success) {
    console.log('✅ 任务成功:', response.data)
  } else {
    console.error('❌ 任务失败:', response.error)
  }
} catch (error) {
  console.error('❌ 任务超时或网络错误:', error)
}
```

### 2. 订阅管理

```typescript
import { useSubscriptionStore } from '@/stores/subscriptionStore'

const subscriptionStore = useSubscriptionStore()

// 创建订阅
try {
  const subscriptionId = await subscriptionStore.subscribeToFormula(
    'SHFE',           // market
    'rb2501',         // code
    'builtin-macd',   // formula name
    'formula code...', // formula code
    86400,            // granularity
    'global'          // namespace
  )
  
  console.log('✅ 订阅创建成功:', subscriptionId)
} catch (error) {
  console.error('❌ 订阅失败:', error)
}

// 取消订阅
try {
  const success = await subscriptionStore.unsubscribeFromFormula(subscriptionId)
  if (success) {
    console.log('✅ 订阅取消成功')
  }
} catch (error) {
  console.error('❌ 取消订阅失败:', error)
}
```

### 3. 公式操作

```typescript
// 注册公式
const registerFormula = async () => {
  try {
    const response = await websocketTaskService.sendTask({
      type: "register_formula",
      formulaId: selectedFormula.value.id,
      sourceCode: formulaCode.value,
      languageId: 5
      // 序列号会自动生成：1, 2, 3, ...
    }, {
      timeout: 15000,
      retries: 1,
      retryDelay: 2000
    })

    if (response.success) {
      console.log('✅ 公式注册成功:', response.data.uuid)
    } else {
      console.error('❌ 公式注册失败:', response.error)
    }
  } catch (error) {
    console.error('❌ 注册超时:', error)
  }
}

// 执行公式
const executeFormula = async () => {
  try {
    const response = await websocketTaskService.sendTask({
      type: "execute_formula",
      market: queryParams.value.market,
      code: queryParams.value.code,
      fromTime: fromTimestamp,
      toTime: toTimestamp,
      granularity: parseInt(queryParams.value.granularity),
      formulaCode: formulaCode.value,
      formulaName: selectedFormula.value?.name
      // 序列号会自动生成：1, 2, 3, ...
    }, {
      timeout: 30000,
      retries: 1,
      retryDelay: 3000
    })

    if (response.success) {
      // 处理执行结果
      const data = response.data.records.data
      console.log('✅ 公式执行成功:', data.length, '条记录')
    } else {
      console.error('❌ 公式执行失败:', response.error)
    }
  } catch (error) {
    console.error('❌ 执行超时:', error)
  }
}
```

## 序列号机制

### 简单递增序列号

WebSocket 任务服务使用简单的递增数字序列号来匹配请求和响应：

```typescript
// 发送的消息
{
  "type": "execute_formula",
  "market": "SHFE",
  "code": "rb2501",
  "requestId": "1"  // 自动生成的简单序列号
}

// 接收的响应
{
  "type": "formula_execution_response",
  "success": true,
  "data": { ... },
  "requestId": "1"  // 匹配发送消息的 requestId
}
```

### 序列号生成规则

- **起始值**: 从 1 开始
- **递增方式**: 每次发送任务时自动递增 (1, 2, 3, 4, ...)
- **匹配逻辑**: 响应消息的 `requestId` 字段与发送消息的 `requestId` 字段匹配
- **自动生成**: 无需手动设置，服务自动管理

### 优势

- **简洁**: 不需要复杂的前缀和时间戳
- **可靠**: 简单的数字匹配，减少出错可能
- **高效**: 轻量级的序列号生成和匹配
- **易调试**: 序列号简单明了，便于日志分析

## 配置选项

### TaskOptions

```typescript
interface TaskOptions {
  timeout?: number    // 超时时间（毫秒），默认 30 秒
  retries?: number    // 重试次数，默认 0
  retryDelay?: number // 重试延迟（毫秒），默认 1000
}
```

### 推荐配置

```typescript
// 快速操作（如取消订阅）
{ timeout: 5000, retries: 1, retryDelay: 1000 }

// 标准操作（如注册公式）
{ timeout: 15000, retries: 1, retryDelay: 2000 }

// 长时间操作（如执行公式）
{ timeout: 30000, retries: 1, retryDelay: 3000 }
```

## 错误处理

### 常见错误类型

1. **超时错误** - 任务在指定时间内未收到响应
2. **网络错误** - WebSocket 连接断开
3. **业务错误** - 后端返回的业务逻辑错误
4. **重试耗尽** - 重试次数用完仍未成功

### 错误处理最佳实践

```typescript
try {
  const response = await websocketTaskService.sendTask(message, options)
  // 处理成功响应
} catch (error) {
  if (error.message.includes('timeout')) {
    // 处理超时
    console.error('请求超时，请检查网络连接')
  } else if (error.message.includes('cancelled')) {
    // 处理取消
    console.log('请求已取消')
  } else {
    // 处理其他错误
    console.error('请求失败:', error.message)
  }
}
```

## 性能优化

### 1. 合理设置超时时间

- 避免过长的超时时间导致用户等待
- 避免过短的超时时间导致正常请求失败

### 2. 适当使用重试机制

- 网络不稳定的场景可以增加重试次数
- 快速失败的操作可以减少重试次数

### 3. 及时清理任务

- 服务会自动清理过期任务
- 组件卸载时会自动取消所有待处理任务

## 迁移指南

### 从旧的消息监听模式迁移

**旧方式：**
```typescript
// 发送消息
wsStore.sendMessage({ type: 'register_formula', ...params })

// 监听响应
watch(() => wsStore.lastMessage, (message) => {
  if (message.type === 'register_formula_response') {
    // 处理响应
  }
})
```

**新方式：**
```typescript
// 直接发送并等待响应
try {
  const response = await websocketTaskService.sendTask({
    type: 'register_formula',
    ...params,
    requestId: `register_${Date.now()}`
  })
  // 处理响应
} catch (error) {
  // 处理错误
}
```

## 调试和监控

### 获取待处理任务统计

```typescript
const stats = websocketTaskService.getPendingTasksStats()
console.log('待处理任务:', stats)
```

### 取消特定任务

```typescript
const cancelled = websocketTaskService.cancelTask(seq)
if (cancelled) {
  console.log('任务已取消')
}
```

### 取消所有任务

```typescript
websocketTaskService.cancelAllTasks()
console.log('所有任务已取消')
```

## 总结

新的 WebSocket Callback 服务提供了：

- **更好的开发体验** - Promise-based API，类似 HTTP 请求
- **更强的可靠性** - 自动超时、重试和错误处理
- **更高的可维护性** - 清晰的请求-响应模式
- **更好的性能** - 自动内存管理和任务清理

这种设计模式使得 WebSocket 通信更加可预测和易于调试，大大提升了代码质量和开发效率。

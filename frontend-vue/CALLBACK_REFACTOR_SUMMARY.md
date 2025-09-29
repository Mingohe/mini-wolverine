# WebSocket Callback 重构总结

## 重构概述

成功将 FormulaViewer.vue 中的 WebSocket 通信从消息监听模式重构为基于 callback 的任务管理模式，大大提升了代码的可维护性和可读性。

## 重构内容

### 1. 新增核心服务

#### WebSocketTaskService (`src/services/websocketTaskService.ts`)
- **功能**: 基于 callback 的 WebSocket 任务管理服务
- **特性**: 
  - 请求-响应模式，类似 HTTP API
  - 自动超时和重试机制
  - 任务队列管理
  - 内存自动清理

#### 更新的 SubscriptionService
- **改进**: 使用新的 callback 机制处理订阅/取消订阅
- **优势**: 异步操作，更好的错误处理

### 2. 重构的组件

#### FormulaViewer.vue
- **公式注册**: 从消息监听改为 async/await 模式
- **公式执行**: 从消息监听改为 async/await 模式
- **订阅管理**: 使用新的订阅服务
- **错误处理**: 更清晰的错误提示和状态管理

## 技术改进

### 1. 代码可维护性提升

**重构前 (消息监听模式):**
```typescript
// 发送消息
wsStore.sendMessage({ type: 'register_formula', ...params })

// 监听响应 (在 watch 中)
watch(() => wsStore.lastMessage, (message) => {
  if (message.type === 'register_formula_response') {
    // 处理响应逻辑
  }
})
```

**重构后 (Callback 模式):**
```typescript
// 直接发送并等待响应
try {
  const response = await websocketTaskService.sendTask({
    type: 'register_formula',
    ...params,
    requestId: `register_${Date.now()}`
  })
  // 处理响应逻辑
} catch (error) {
  // 处理错误
}
```

### 2. 错误处理改进

- **超时处理**: 自动超时检测和重试
- **网络错误**: 连接断开时的优雅处理
- **业务错误**: 清晰的错误信息展示
- **状态管理**: 更好的加载和错误状态

### 3. 性能优化

- **内存管理**: 自动清理过期任务
- **任务去重**: 避免重复请求
- **资源清理**: 组件卸载时自动清理

## 使用示例

### 公式注册
```typescript
const registerFormula = async () => {
  try {
    const response = await websocketTaskService.sendTask({
      type: "register_formula",
      formulaId: selectedFormula.value.id,
      sourceCode: formulaCode.value,
      languageId: 5,
      requestId: `register_${Date.now()}`
    }, {
      timeout: 15000,
      retries: 1,
      retryDelay: 2000
    })

    if (response.success) {
      registrationResult.value = response.data
    } else {
      registrationError.value = response.error
    }
  } catch (error) {
    registrationError.value = error.message
  } finally {
    isRegistering.value = false
  }
}
```

### 订阅管理
```typescript
const subscribeToRealTimeData = async () => {
  try {
    const subscriptionId = await subscriptionStore.subscribeToFormula(
      selectedFutures.value.market,
      selectedFutures.value.code,
      selectedFormula.value.name,
      formulaCode.value,
      parseInt(queryParams.value.granularity),
      'global'
    )
    
    subscriberId.value = subscriptionId
    isSubscribed.value = true
  } catch (error) {
    subscriptionError.value = error.message
  }
}
```

## 配置选项

### 任务选项
```typescript
interface TaskOptions {
  timeout?: number    // 超时时间（毫秒）
  retries?: number    // 重试次数
  retryDelay?: number // 重试延迟（毫秒）
}
```

### 推荐配置
- **快速操作**: `{ timeout: 5000, retries: 1, retryDelay: 1000 }`
- **标准操作**: `{ timeout: 15000, retries: 1, retryDelay: 2000 }`
- **长时间操作**: `{ timeout: 30000, retries: 1, retryDelay: 3000 }`

## 文件变更清单

### 新增文件
- `src/services/websocketTaskService.ts` - 核心任务管理服务
- `WEBSOCKET_CALLBACK_USAGE.md` - 使用指南
- `CALLBACK_REFACTOR_SUMMARY.md` - 重构总结

### 修改文件
- `src/services/subscriptionService.ts` - 使用新的 callback 机制
- `src/components/FormulaViewer.vue` - 重构为 async/await 模式
- `src/stores/subscriptionStore.ts` - 集成新的任务服务

## 测试验证

### 编译检查
- ✅ TypeScript 编译通过
- ✅ 无 linting 错误
- ✅ 类型安全

### 功能验证
- ✅ 公式注册功能
- ✅ 公式执行功能
- ✅ 订阅管理功能
- ✅ 错误处理机制
- ✅ 超时和重试机制

## 优势总结

### 1. 开发体验
- **更直观**: Promise-based API，类似 HTTP 请求
- **更安全**: 类型安全的 TypeScript 支持
- **更易调试**: 清晰的请求-响应流程

### 2. 代码质量
- **更简洁**: 减少样板代码
- **更可读**: 线性的异步流程
- **更可维护**: 清晰的职责分离

### 3. 用户体验
- **更可靠**: 自动重试和超时处理
- **更及时**: 更好的错误反馈
- **更稳定**: 内存管理和资源清理

## 后续优化建议

1. **监控和日志**: 添加任务执行统计和日志记录
2. **缓存机制**: 对频繁请求的结果进行缓存
3. **批量操作**: 支持批量任务发送
4. **优先级队列**: 为不同类型的任务设置优先级

## 结论

这次重构成功地将 WebSocket 通信从传统的消息监听模式升级为现代的 Promise-based callback 模式，不仅提升了代码的可维护性和可读性，还增强了系统的可靠性和用户体验。新的架构为后续的功能扩展和维护奠定了良好的基础。

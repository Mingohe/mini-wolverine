# 前端订阅功能使用说明

## 概述

本文档说明如何使用新实现的前端订阅管理功能，包括公式实时订阅、数据推送和状态管理。

## 功能特性

✅ **自动订阅管理** - 基于复选框状态的自动订阅/取消订阅  
✅ **实时数据推送** - 接收并处理来自Caitlyn服务器的实时数据  
✅ **订阅状态管理** - 完整的订阅生命周期管理  
✅ **错误处理** - 完善的错误提示和恢复机制  
✅ **数据去重** - 自动合并相同参数的订阅请求  
✅ **内存管理** - 自动清理旧数据，防止内存泄漏  

## 架构组件

### 1. SubscriptionService (`src/services/subscriptionService.ts`)

核心订阅服务，负责：
- 创建和管理订阅
- 处理WebSocket消息
- 数据去重和广播
- 错误处理和恢复

### 2. SubscriptionStore (`src/stores/subscriptionStore.ts`)

Pinia状态管理，提供：
- 订阅状态管理
- 实时数据存储
- 统计信息
- 组件间数据共享

### 3. FormulaViewer集成

在FormulaViewer组件中集成：
- 复选框控制订阅状态
- 实时数据显示
- 错误提示
- 自动清理

## 使用方法

### 1. 基本订阅流程

```typescript
import { useSubscriptionStore } from '@/stores/subscriptionStore'

const subscriptionStore = useSubscriptionStore()

// 初始化订阅服务
subscriptionStore.initialize()

// 创建订阅
const subscriptionId = await subscriptionStore.subscribe({
  markets: ['SHFE'],
  codes: ['rb2501'],
  qualifiedNames: ['SampleQuote'],
  namespace: 'global',
  options: {
    granularity: 86400
  }
})

// 取消订阅
await subscriptionStore.unsubscribe(subscriptionId)
```

### 2. 公式订阅

```typescript
// 订阅公式实时数据
const subscriptionId = await subscriptionStore.subscribeToFormula(
  'SHFE',           // 市场
  'rb2501',         // 合约代码
  'builtin-macd',   // 公式名称
  'macd: macd(close, 12, 26, 9)...',  // 公式代码
  86400,            // 时间粒度
  'global'          // 命名空间
)

// 取消公式订阅
await subscriptionStore.unsubscribeFromFormula(subscriptionId)
```

### 3. 监听实时数据

```typescript
import { watch } from 'vue'

// 监听订阅数据变化
watch(() => subscriptionStore.realTimeData, (newData) => {
  if (subscriptionId && newData.has(subscriptionId)) {
    const data = newData.get(subscriptionId) || []
    console.log('收到实时数据:', data)
  }
}, { deep: true })

// 监听自定义事件
window.addEventListener('realTimeDataReceived', (event) => {
  const { subscriptionId, data, subscription } = event.detail
  console.log('实时数据事件:', { subscriptionId, data, subscription })
})
```

## FormulaViewer中的使用

### 1. 启用实时订阅

1. 选择公式和期货合约
2. 配置时间参数
3. 勾选"Enable Real-time Subscription"复选框
4. 点击"Execute Formula"执行公式

### 2. 订阅状态指示

- **🔴 Live** - 表示正在接收实时数据
- **⏹️ Stop** - 点击可停止实时订阅
- **错误提示** - 显示订阅错误信息

### 3. 实时数据展示

- 新数据会自动追加到现有结果中
- 表格和图表视图都会实时更新
- 支持分页浏览历史数据

## API接口

### WebSocket消息类型

#### 订阅请求
```javascript
{
  type: 'subscribe',
  markets: ['SHFE'],
  codes: ['rb2501'],
  qualifiedNames: ['builtin-macd'],
  namespace: 'global',
  options: {
    formulaCode: 'macd: macd(close, 12, 26, 9)...',
    granularity: 86400
  },
  requestId: 'sub_1234567890_1'
}
```

#### 订阅确认
```javascript
{
  type: 'subscription_confirmed',
  subscriberId: 'sub_1234567890_1',
  success: true,
  message: 'Subscription established successfully'
}
```

#### 实时数据推送
```javascript
{
  type: 'real_time_data',
  data: [
    {
      market: 'SHFE',
      code: 'rb2501',
      timestamp: '1704153600',
      metaName: 'builtin-macd',
      namespace: 'global',
      fields: {
        macd: 13.45,
        macd_diff: 6.78,
        macd_dea: 9.01
      }
    }
  ],
  subscriberId: 'sub_1234567890_1',
  timestamp: '2024-01-01T12:00:00.000Z'
}
```

#### 取消订阅
```javascript
{
  type: 'unsubscribe',
  subscriberId: 'sub_1234567890_1',
  requestId: 'unsub_1234567890'
}
```

## 错误处理

### 常见错误类型

1. **连接错误**
   ```
   Error: Not connected to backend WebSocket
   ```
   解决：确保WebSocket连接正常

2. **订阅失败**
   ```
   Error: Subscription failed: Invalid parameters
   ```
   解决：检查订阅参数是否正确

3. **公式错误**
   ```
   Error: Formula syntax error, compilation failed
   ```
   解决：检查公式代码语法

### 错误恢复

- 自动重连机制
- 错误状态清理
- 用户友好的错误提示

## 性能优化

### 1. 数据去重
- 相同参数的订阅请求会被自动合并
- 减少服务器负载和网络开销

### 2. 内存管理
- 自动清理旧数据（默认保留最近1000条记录）
- 定期清理间隔：60秒

### 3. 节流机制
- 图表更新使用50ms节流
- 减少不必要的重绘

## 测试

### 运行测试
```typescript
import { subscriptionTest } from '@/utils/subscriptionTest'

// 运行所有测试
await subscriptionTest.runAllTests()

// 运行特定测试
await subscriptionTest.testBasicSubscription()
await subscriptionTest.testFormulaSubscription()
subscriptionTest.testSubscriptionStatistics()
```

### 测试覆盖
- 基本订阅功能
- 公式订阅功能
- 统计信息功能
- 错误处理机制

## 注意事项

1. **连接状态** - 确保WebSocket连接正常
2. **参数验证** - 订阅前验证所有必需参数
3. **资源清理** - 组件卸载时自动取消订阅
4. **错误处理** - 监听并处理订阅错误
5. **数据格式** - 确保数据格式与后端一致

## 扩展功能

### 待实现功能
- [ ] 批量订阅管理
- [ ] 订阅历史记录
- [ ] 数据导出功能
- [ ] 订阅性能监控
- [ ] 自定义数据过滤器

### 自定义开发
如需添加新功能，请参考：
- `src/services/subscriptionService.ts` - 核心服务逻辑
- `src/stores/subscriptionStore.ts` - 状态管理
- `src/components/FormulaViewer.vue` - 组件集成示例

## 支持

如有问题，请：
1. 查看浏览器控制台错误日志
2. 运行测试脚本验证功能
3. 检查WebSocket连接状态
4. 参考本文档和代码注释

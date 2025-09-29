# 小公式订阅服务使用示例

## 概述

本文档提供了如何使用改进的 `formulaSubscriptionService` 的详细示例，展示了完整的公式订阅流程。

## 基本使用

### 1. 在组件中导入服务

```typescript
import { formulaSubscriptionService } from '@/services/formulaSubscriptionService'
import type { FormulaSubscriptionConfig } from '@/services/formulaSubscriptionService'
```

### 2. 初始化服务

```typescript
// 在组件的 onMounted 中初始化
onMounted(() => {
  // 初始化WebSocket消息处理
  const unwatch = formulaSubscriptionService.initializeWebSocketHandlers(wsStore)
  
  // 存储清理函数
  if (unwatch) {
    // 在组件销毁时调用 unwatch()
  }
})
```

### 3. 订阅公式

```typescript
const subscribeToFormula = async () => {
  try {
    const config: FormulaSubscriptionConfig = {
      formulaId: -222,                    // 公式ID
      formulaName: 'builtin-macd',        // 公式名称
      formulaCode: `variable: SHORT=0;
variable: LONG=0;
variable: M=0;
SHORT := 12;
LONG := 26;
M:=9;
DIFF: EMA(CLOSE,SHORT) - EMA(CLOSE,LONG);
DEA  : EMA(DIFF,M);
 MACD : 2*(DIFF-DEA);`,                   // 公式代码
      market: 'SHFE',                     // 市场代码
      code: 'CU2401',                     // 证券代码
      granularity: 86400,                 // 时间粒度（秒）
      namespace: 'global',                // 命名空间
      languageId: 5                       // 语言ID
    }

    const domain = [
      Date.now() - 30 * 24 * 60 * 60 * 1000,  // 30天前
      Date.now()                               // 现在
    ]

    // 定义数据回调函数
    const dataCallback = (result: any, seq: any) => {
      if (result.uuid) {
        console.log('订阅ID:', result.uuid)
      } else if (result.data) {
        console.log('收到推送数据:', result.data)
        // 处理推送数据
        handleFormulaData(result.data)
      }
    }

    // 执行完整订阅流程：注册 → 执行 → 订阅
    const subscribeUuid = await formulaSubscriptionService.subscribe(
      config, 
      domain, 
      dataCallback
    )

    console.log('公式订阅成功:', subscribeUuid)
    
    // 存储订阅ID用于后续管理
    formulaSubscriptions.value.set(config.formulaName, subscribeUuid)
    
  } catch (error) {
    console.error('公式订阅失败:', error)
  }
}
```

### 4. 监听实时数据

```typescript
// 监听公式实时数据事件
const handleFormulaRealTimeData = (event: CustomEvent) => {
  const { subscriptionId, data, subscription } = event.detail
  
  console.log('收到公式实时数据:', {
    subscriptionId,
    dataCount: data.length,
    subscription
  })
  
  // 处理数据
  data.forEach(record => {
    console.log('时间:', record.time_tag)
    console.log('字段:', record.fields)
  })
}

// 注册事件监听器
onMounted(() => {
  window.addEventListener('formulaRealTimeDataReceived', handleFormulaRealTimeData)
})

// 清理事件监听器
onUnmounted(() => {
  window.removeEventListener('formulaRealTimeDataReceived', handleFormulaRealTimeData)
})
```

### 5. 取消订阅

```typescript
const unsubscribeFormula = async (formulaName: string) => {
  try {
    const subscribeUuid = formulaSubscriptions.value.get(formulaName)
    if (subscribeUuid) {
      const success = await formulaSubscriptionService.unsubscribe(subscribeUuid)
      if (success) {
        formulaSubscriptions.value.delete(formulaName)
        console.log('公式订阅已取消:', formulaName)
      }
    }
  } catch (error) {
    console.error('取消订阅失败:', error)
  }
}
```

### 6. 批量取消所有订阅

```typescript
const unsubscribeAllFormulas = async () => {
  try {
    await formulaSubscriptionService.unsubscribeAllFormulas()
    formulaSubscriptions.value.clear()
    console.log('所有公式订阅已取消')
  } catch (error) {
    console.error('批量取消订阅失败:', error)
  }
}
```

## 在 FormulaViewer.vue 中的集成

### 1. 更新导入

```typescript
import { formulaSubscriptionService } from '../services/formulaSubscriptionService'
```

### 2. 修改订阅方法

```typescript
const subscribeToRealTimeData = async () => {
  if (!selectedFutures.value || !selectedFormula.value) {
    console.warn('⚠️ Cannot subscribe: missing futures or formula selection')
    return
  }

  try {
    subscriptionError.value = null
    
    const config: FormulaSubscriptionConfig = {
      formulaId: selectedFormula.value.id,
      formulaName: selectedFormula.value.name,
      formulaCode: formulaCode.value,
      market: selectedFutures.value.market,
      code: selectedFutures.value.code,
      granularity: parseInt(queryParams.value.granularity || "86400"),
      namespace: 'global',
      languageId: selectedFormula.value.language_id || 5
    }

    const domain = [
      new Date(queryParams.value.fromTime || "").getTime(),
      new Date(queryParams.value.toTime || "").getTime()
    ]

    const dataCallback = (result: any, seq: any) => {
      if (result.uuid) {
        subscriberId.value = result.uuid
        isSubscribed.value = true
        console.log(`📡 Formula subscription created: ${result.uuid}`)
      } else if (result.data) {
        // 处理推送数据
        handleFormulaPushData(result.data)
      }
    }

    const subscribeUuid = await formulaSubscriptionService.subscribe(
      config, 
      domain, 
      dataCallback
    )
    
    subscriberId.value = subscribeUuid
    isSubscribed.value = true
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Subscription failed'
    subscriptionError.value = errorMessage
    console.error('❌ Formula subscription failed:', errorMessage)
  }
}
```

### 3. 修改取消订阅方法

```typescript
const unsubscribe = async () => {
  if (!subscriberId.value) {
    console.warn('⚠️ No active subscription to cancel')
    return
  }

  try {
    subscriptionError.value = null
    
    const success = await formulaSubscriptionService.unsubscribe(subscriberId.value)
    
    if (success) {
      isSubscribed.value = false
      subscriberId.value = null
      console.log(`⏹️ Formula subscription cancelled: ${subscriberId.value}`)
    } else {
      throw new Error('Failed to cancel subscription')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unsubscription failed'
    subscriptionError.value = errorMessage
    console.error('❌ Formula unsubscription failed:', errorMessage)
  }
}
```

### 4. 添加生命周期管理

```typescript
onMounted(() => {
  // 初始化公式订阅服务
  const unwatch = formulaSubscriptionService.initializeWebSocketHandlers(wsStore)
  
  // 监听公式实时数据
  window.addEventListener('formulaRealTimeDataReceived', handleFormulaRealTimeData)
  
  // 存储清理函数
  if (unwatch) {
    // 在组件销毁时调用
  }
})

onUnmounted(async () => {
  // 清理事件监听器
  window.removeEventListener('formulaRealTimeDataReceived', handleFormulaRealTimeData)
  
  // 取消所有公式订阅
  if (formulaSubscriptions.value.size > 0) {
    try {
      await formulaSubscriptionService.unsubscribeAllFormulas()
    } catch (error) {
      console.error('Error cleaning up formula subscriptions:', error)
    }
  }
})
```

## 高级用法

### 1. 查询订阅状态

```typescript
// 获取所有活跃订阅
const activeSubscriptions = formulaSubscriptionService.getActiveFormulaSubscriptions()

// 根据公式名称查找订阅
const subscription = formulaSubscriptionService.findSubscriptionByFormulaName('builtin-macd')

// 根据市场代码查找订阅
const marketSubscriptions = formulaSubscriptionService.findSubscriptionsByMarket('SHFE', 'CU2401')
```

### 2. 获取订阅统计

```typescript
const statistics = formulaSubscriptionService.getStatistics()
console.log('订阅统计:', {
  total: statistics.total,
  active: statistics.active,
  pending: statistics.pending,
  error: statistics.error,
  cancelled: statistics.cancelled,
  totalDataReceived: statistics.totalDataReceived
})
```

### 3. 数据管理

```typescript
// 获取特定订阅的实时数据
const realTimeData = formulaSubscriptionService.getRealTimeData(subscribeUuid)

// 清理特定订阅的数据
formulaSubscriptionService.clearRealTimeData(subscribeUuid)

// 清理所有数据
formulaSubscriptionService.clearAllRealTimeData()

// 清理旧数据（保留最近1000条）
formulaSubscriptionService.cleanupOldData(1000)
```

## 错误处理

### 1. 注册失败

```typescript
try {
  const registeredUuid = await formulaSubscriptionService.registerFormula(config)
} catch (error) {
  if (error.message.includes('Formula registration failed')) {
    // 处理注册失败
    console.error('公式注册失败，请检查公式代码')
  }
}
```

### 2. 执行失败

```typescript
try {
  const executeResult = await formulaSubscriptionService.executeFormula(config, registeredUuid, domain)
} catch (error) {
  if (error.message.includes('Formula execution failed')) {
    // 处理执行失败
    console.error('公式执行失败，请检查参数')
  }
}
```

### 3. 订阅失败

```typescript
try {
  const subscribeUuid = await formulaSubscriptionService.subscribeFormula(config, registeredUuid, callback)
} catch (error) {
  if (error.message.includes('Formula subscription failed')) {
    // 处理订阅失败
    console.error('公式订阅失败，请检查网络连接')
  }
}
```

## 性能优化建议

1. **批量操作**: 对于多个公式，考虑批量注册和订阅
2. **数据清理**: 定期清理旧数据，避免内存泄漏
3. **错误重试**: 实现指数退避的重试机制
4. **状态监控**: 监控订阅状态，及时处理异常
5. **资源管理**: 确保组件销毁时正确清理所有资源

## 调试技巧

1. **启用详细日志**: 服务会输出详细的日志信息
2. **检查订阅状态**: 使用 `getStatistics()` 监控订阅状态
3. **验证数据格式**: 确保推送数据格式正确
4. **网络监控**: 检查WebSocket连接状态
5. **时序检查**: 确保注册 → 执行 → 订阅的顺序正确

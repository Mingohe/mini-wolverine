# 小公式数据显示完整流程文档

## 概述

本文档详细描述了在 Mini Wolverine 系统中显示小公式数据的完整流程，包括公式注册、数据计算和实时订阅三个核心步骤。

## 流程架构图

```
前端 (Vue)                   后端 (Node.js)                Caitlyn Server
    |                            |                            |
    | 1. 注册小公式               |                            |
    |--------------------------->| CMD_AT_REG_FORMULA         |
    |                            |--------------------------->|
    |                            |                            |
    | 2. 返回 UUID               |                            |
    |<---------------------------|<---------------------------|
    |                            |                            |
    | 3. 计算小公式数据           |                            |
    |--------------------------->| CMD_AT_CAL_FORMULA         |
    |                            |--------------------------->|
    |                            |                            |
    | 4. 返回计算结果             |                            |
    |<---------------------------|<---------------------------|
    |                            |                            |
    | 5. 订阅实时数据 (可选)      |                            |
    |--------------------------->| CMD_AT_SUBSCRIBE           |
    |                            |--------------------------->|
    |                            |                            |
    | 6. 接收实时推送             |                            |
    |<---------------------------|<---------------------------|
```

## 详细流程说明

### 第一步：小公式注册 (CMD_AT_REG_FORMULA)

#### 1.1 前端发起注册请求

**位置**: `frontend-vue/src/components/FormulaViewer.vue`

**触发时机**: 
- 用户选择小公式时
- 系统初始化时自动注册所有小公式

**请求参数**:
```javascript
{
  cmd: CMD_AT_REG_FORMULA,
  formula_id: formula.id,           // 小公式ID (如: -222, -333, -111)
  formula_source_code: formula.source_code,  // 小公式源代码
  formula_language_id: formula.language_id   // 语言ID (通常为5)
}
```

**示例数据**:
```javascript
// 来自 FormulaViewer.vue 的 mock 数据
const mockFormulas = [
  {
    id: -222,
    name: 'builtin-macd',
    type: 'Technical Indicator',
    uuid: '4e6d8864-cc52-4484-9dc9-e89cd4485348',
    language_id: 5,
    source_code: `macd: macd(close, 12, 26, 9), colorff9c00, linethick1;
macd_diff: macd(close, 12, 26, 9), color0000ff, linethick1;
macd_dea: macd(close, 12, 26, 9), colorF23456, linethick1;`,
    description: 'Calculate moving average over specified period'
  }
]
```

#### 1.2 后端处理注册请求

**位置**: `backend/src/server.js`

**处理逻辑**:
```javascript
case 'register_formula':
  try {
    const { formulaId, sourceCode, languageId } = data;
    const result = await caitlynService.registerFormula(formulaId, sourceCode, languageId);
    ws.send(JSON.stringify({
      type: 'register_formula_response',
      success: true,
      data: { uuid: result.uuid }
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'register_formula_response',
      success: false,
      error: error.message
    }));
  }
  break;
```

#### 1.3 Caitlyn Server 响应

**成功响应**:
```javascript
{
  type: 'register_formula_response',
  success: true,
  data: {
    uuid: 'generated-uuid-string'  // 新生成的UUID
  }
}
```

**失败响应**:
```javascript
{
  type: 'register_formula_response',
  success: false,
  error: 'Formula syntax error'  // 语法错误信息
}
```

### 第二步：小公式数据计算 (CMD_AT_CAL_FORMULA)

#### 2.1 前端发起计算请求

**位置**: `frontend-vue/src/components/FormulaViewer.vue`

**触发时机**: 
- 用户点击"Execute Formula"按钮
- 配置完成公式、时间范围、标的物后

**请求参数**:
```javascript
{
  type: "execute_formula",
  market: "SHFE",                    // 市场代码
  code: "rb2501",                    // 合约代码
  fromTime: 1704067200,              // 开始时间戳
  toTime: 1704153600,                // 结束时间戳
  granularity: 86400,                // 时间粒度(秒)
  formulaCode: "macd: macd(close, 12, 26, 9)...",  // 公式代码
  formulaName: "builtin-macd",       // 公式名称
  enableSubscription: true           // 是否启用实时订阅
}
```

#### 2.2 后端处理计算请求

**位置**: `backend/src/server.js`

**处理逻辑**:
```javascript
case 'execute_formula':
  try {
    const { market, code, fromTime, toTime, granularity, formulaCode, formulaName, enableSubscription } = data;
    
    // 1. 首先注册公式获取UUID
    const registerResult = await caitlynService.registerFormula(formulaName, formulaCode, 5);
    
    // 2. 使用UUID计算公式数据
    const result = await caitlynService.calculateFormula(
      registerResult.uuid, 
      market, 
      code, 
      fromTime, 
      toTime, 
      granularity
    );
    
    ws.send(JSON.stringify({
      type: 'formula_execution_response',
      success: true,
      data: result
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'formula_execution_response',
      success: false,
      error: error.message
    }));
  }
  break;
```

#### 2.3 数据计算参数

**CMD_AT_CAL_FORMULA 参数**:
```javascript
{
  cmd: CMD_AT_CAL_FORMULA,
  uuid: "formula-uuid",              // 注册时获得的UUID
  market: "SHFE",                    // 市场
  code: "rb2501",                    // 合约代码
  granularity: 86400,                // 时间粒度
  begin_time: 1704067200,            // 开始时间戳
  end_time: 1704153600,              // 结束时间戳
  is_real_time: false                // 是否为实时计算
}
```

#### 2.4 计算结果响应

**成功响应**:
```javascript
{
  type: 'formula_execution_response',
  success: true,
  data: {
    records: [
      {
        timestamp: "1704067200",
        fields: {
          macd: 12.34,
          macd_diff: 5.67,
          macd_dea: 8.90
        }
      }
      // ... 更多记录
    ],
    message: "Formula executed successfully"
  }
}
```

### 第三步：实时数据订阅 (CMD_AT_SUBSCRIBE)

#### 3.1 前端发起订阅请求

**位置**: `frontend-vue/src/components/FormulaViewer.vue`

**触发时机**: 
- 用户勾选"Enable Real-time Subscription"
- 公式执行成功后自动订阅

**订阅参数**:
```javascript
{
  type: "subscribe",
  markets: ["SHFE"],                 // 市场列表
  codes: ["rb2501"],                 // 合约代码列表
  qualifiedNames: ["builtin-macd"],  // 公式名称列表
  namespace: 'global',               // 命名空间
  options: {
    formulaCode: "macd: macd(close, 12, 26, 9)...",
    granularity: 86400
  },
  requestId: `formula_${Date.now()}`
}
```

#### 3.2 后端处理订阅请求

**位置**: `backend/src/server.js`

**处理逻辑**:
```javascript
case 'subscribe':
  try {
    const { markets, codes, qualifiedNames, namespace, options } = data;
    
    // 创建订阅
    const subscriptionResult = await caitlynService.subscribe(
      markets, 
      codes, 
      qualifiedNames, 
      namespace, 
      options
    );
    
    ws.send(JSON.stringify({
      type: 'subscription_confirmed',
      subscriberId: subscriptionResult.subscriberId,
      success: true
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'subscription_confirmed',
      success: false,
      error: error.message
    }));
  }
  break;
```

#### 3.3 实时数据推送

**推送数据格式**:
```javascript
{
  type: 'real_time_data',
  data: [
    {
      timestamp: "1704153600",
      fields: {
        macd: 13.45,
        macd_diff: 6.78,
        macd_dea: 9.01
      },
      market: "SHFE",
      code: "rb2501",
      metaName: "builtin-macd",
      namespace: "global"
    }
  ]
}
```

## 前端数据处理

### 数据接收和处理

**位置**: `frontend-vue/src/components/FormulaViewer.vue`

```javascript
// 监听WebSocket消息
watch(() => wsStore.lastMessage, (newMessage) => {
  if (!newMessage) return

  if (newMessage.type === 'formula_execution_response') {
    // 处理公式执行结果
    if (newMessage.success && newMessage.data) {
      const responseData = newMessage.data
      
      let processedData = []
      if (responseData.records && Array.isArray(responseData.records)) {
        processedData = responseData.records.map((record, index) => {
          const flatRecord = {
            ...record,
            row_id: index + 1,
            timestamp: record.timestamp ? 
              new Date(parseInt(record.timestamp)).toISOString() : 
              new Date().toISOString()
          }
          
          if (record.fields && typeof record.fields === 'object') {
            Object.assign(flatRecord, record.fields)
          }
          
          return flatRecord
        })
      }
      
      formulaData.value = processedData
      resultFields.value = processedData.length > 0 ? 
        Object.keys(processedData[0]).filter(key => key !== 'timestamp' && key !== 'row_id') : []
    }
  } else if (newMessage.type === 'real_time_data') {
    // 处理实时数据推送
    if (newMessage.data && Array.isArray(newMessage.data)) {
      const newData = newMessage.data.map((record, index) => {
        const flatRecord = {
          ...record,
          row_id: formulaData.value.length + index + 1,
          timestamp: record.timestamp ? 
            new Date(parseInt(record.timestamp)).toISOString() : 
            new Date().toISOString()
        }
        
        if (record.fields && typeof record.fields === 'object') {
          Object.assign(flatRecord, record.fields)
        }
        
        return flatRecord
      })
      
      formulaData.value = [...formulaData.value, ...newData]
    }
  }
})
```

## 错误处理

### 常见错误类型

1. **公式语法错误**
   ```javascript
   {
     type: 'register_formula_response',
     success: false,
     error: 'Formula syntax error, compilation failed'
   }
   ```

2. **计算超时**
   ```javascript
   {
     type: 'formula_execution_response',
     success: false,
     error: 'Formula calculation timeout'
   }
   ```

3. **订阅失败**
   ```javascript
   {
     type: 'subscription_confirmed',
     success: false,
     error: 'Subscription failed: Invalid parameters'
   }
   ```

## 开发实现步骤

### 步骤1: 完善后端公式注册处理
- [ ] 在 `backend/src/server.js` 中添加 `register_formula` 消息处理
- [ ] 实现 `caitlynService.registerFormula()` 方法
- [ ] 添加错误处理和日志记录

### 步骤2: 完善后端公式计算处理
- [ ] 在 `backend/src/server.js` 中完善 `execute_formula` 消息处理
- [ ] 实现 `caitlynService.calculateFormula()` 方法
- [ ] 添加数据格式化和验证

### 步骤3: 完善实时订阅处理
- [ ] 在 `backend/src/server.js` 中完善 `subscribe` 消息处理
- [ ] 实现公式数据的实时推送逻辑
- [ ] 添加订阅状态管理

### 步骤4: 前端数据展示优化
- [ ] 优化 `FormulaViewer.vue` 中的数据展示
- [ ] 添加加载状态和错误提示
- [ ] 实现数据导出功能

### 步骤5: 测试和验证
- [ ] 测试公式注册流程
- [ ] 测试数据计算和展示
- [ ] 测试实时订阅功能
- [ ] 验证错误处理机制

## 相关文件

### 前端文件
- `frontend-vue/src/components/FormulaViewer.vue` - 主要的小公式展示组件
- `frontend-vue/src/stores/websocketStore.ts` - WebSocket状态管理

### 后端文件
- `backend/src/server.js` - WebSocket消息处理
- `backend/src/services/CaitlynWebSocketService.js` - Caitlyn服务封装
- `backend/src/utils/CaitlynClientConnection.js` - Caitlyn客户端连接

### 文档文件
- `docs/CAITLYN_JS_API.md` - Caitlyn JS API文档
- `docs/SINGULARITY_DATA_MAINTENANCE.md` - 数据维护文档

## 注意事项

1. **UUID管理**: 每个注册的公式都会获得唯一的UUID，需要妥善保存和复用
2. **错误处理**: 公式语法错误、计算超时等需要友好的错误提示
3. **性能优化**: 大量数据计算时需要考虑分页和缓存
4. **实时性**: 实时订阅需要考虑网络断开重连机制
5. **数据格式**: 确保前后端数据格式的一致性

## 总结

小公式数据显示流程包含三个核心步骤：注册、计算、订阅。通过WebSocket实现前后端通信，使用Caitlyn Server进行公式计算和数据处理。整个流程需要完善的错误处理和状态管理，确保用户体验的流畅性。

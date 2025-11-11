# 小公式完整工作流程文档

## 概述

本文档详细描述了 Mini Wolverine 系统中小公式（Formula）的完整工作流程，包括注册、计算和实时订阅三个核心步骤。本文档基于最新的代码实现，整合了数据显示和订阅管理的完整流程。

## 核心概念

### 关键字段说明

1. **formula.id**: 公式的原始ID（可能是负数，如 -222, -333, -111）
2. **formula.uuid**: 公式注册后 Caitlyn Server 返回的唯一标识符，用于后续计算和订阅
3. **subscriberId**: 订阅请求后后端返回的订阅ID，用于识别推送数据和取消订阅

### 数据流向

```
公式注册(REG) → 获得 formula.uuid → 执行计算(CAL) → 订阅实时数据(SUBSCRIBE) → 获得 subscriberId → 接收实时推送
```

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 前端 (Vue/TypeScript)                                                        │
│                                                                              │
│  FormulaViewer.vue                                                           │
│  ├── registerFormula()          - 注册公式获取 UUID                          │
│  ├── executeFormula()            - 执行公式获取历史数据                       │
│  ├── subscribeToRealTimeData()   - 订阅实时数据推送                          │
│  └── handleFormulaPushData()     - 处理实时推送数据（分钟级去重）             │
│                                                                              │
│  formulaSubscriptionService.ts                                               │
│  ├── subscribe()                 - 订阅管理（含 UUID 映射）                  │
│  ├── unsubscribe()               - 取消订阅                                  │
│  └── handleWebSocketPushData()   - 路由推送数据到回调                        │
│                                                                              │
│  websocketTaskService.ts                                                     │
│  └── sendTask()                  - WebSocket 请求/响应匹配                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ WebSocket over HTTP
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│ 后端 (Node.js + Express)                                                     │
│                                                                              │
│  server.js (WebSocket 消息路由)                                              │
│  ├── register_formula            - 转发公式注册请求                          │
│  ├── execute_formula             - 注册 + 计算组合操作                       │
│  ├── calculate_formula           - 单独的计算请求                            │
│  ├── subscribe                   - 订阅管理（Hub去重）                       │
│  └── unsubscribe                 - 取消订阅                                  │
│                                                                              │
│  CaitlynWebSocketService.js                                                  │
│  ├── registerFormula()           - 公式注册服务                              │
│  ├── calculateFormula()          - 公式计算服务                              │
│  └── subscribeHub()              - Hub订阅（自动去重广播）                    │
│                                                                              │
│  CaitlynClientConnection.js (WASM 集成)                                      │
│  ├── registerFormula()           - ATRegFormulaReq/Res 处理                  │
│  ├── calculateFormula()          - ATCalFormulaReq/Res 处理                  │
│  └── subscribe()                 - ATSubscribeReq/Res 处理                   │
│                                                                              │
│  CaitlynSubscriptionHub.js                                                   │
│  ├── subscribe()                 - 订阅去重和管理                            │
│  ├── unsubscribe()               - 订阅清理                                  │
│  └── broadcast()                 - 实时数据广播                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ Binary Protocol (WASM)
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│ Caitlyn Server                                                               │
│                                                                              │
│  CMD_AT_REG_FORMULA              - 公式注册命令                              │
│  CMD_AT_CAL_FORMULA              - 公式计算命令                              │
│  CMD_AT_SUBSCRIBE                - 订阅命令                                  │
│  CMD_AT_UNSUBSCRIBE              - 退订命令                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 完整流程详解

### 第一步：公式注册 (CMD_AT_REG_FORMULA)

#### 1.1 前端发起注册请求

**位置**: `frontend-vue/src/components/FormulaViewer.vue`

**触发时机**:
- 用户选择小公式时自动注册
- 系统初始化时批量注册所有公式

**请求参数**:
```typescript
{
  type: "register_formula",
  formulaId: formula.id,           // 公式ID (如: -222, -333, -111)
  sourceCode: formula.source_code, // 公式源代码
  languageId: formula.language_id, // 语言ID (通常为5)
  requestId: `reg_${Date.now()}_${randomString()}`
}
```

**示例公式数据**:
```javascript
const mockFormulas = [
  {
    id: -222,
    name: 'builtin-macd',
    type: 'Technical Indicator',
    language_id: 5,
    source_code: `macd: macd(close, 12, 26, 9), colorff9c00, linethick1;
macd_diff: macd(close, 12, 26, 9), color0000ff, linethick1;
macd_dea: macd(close, 12, 26, 9), colorF23456, linethick1;`,
    description: 'MACD Technical Indicator'
  }
]
```

#### 1.2 后端处理注册请求

**位置**: `backend/src/server.js` (Line 820-854)

**处理流程**:
```javascript
case 'register_formula':
  try {
    const { formulaId, sourceCode, languageId = 5 } = data;

    logger.info(`🧮 Registering formula: ${formulaId} (language: ${languageId})`);

    // 检查连接池是否就绪
    if (!caitlynService.connectionPool) {
      ws.send(JSON.stringify({
        type: 'register_formula_response',
        success: false,
        error: 'Connection pool not initialized',
        requestId: data.requestId
      }));
      break;
    }

    // 调用注册服务
    const result = await caitlynService.registerFormula(formulaId, sourceCode, languageId);

    ws.send(JSON.stringify({
      type: 'register_formula_response',
      success: true,
      data: result,
      requestId: data.requestId
    }));
  } catch (error) {
    logger.error('Error in register_formula:', error);
    ws.send(JSON.stringify({
      type: 'register_formula_response',
      success: false,
      error: error.message,
      requestId: data.requestId
    }));
  }
  break;
```

#### 1.3 WASM 层注册处理

**位置**: `backend/src/utils/CaitlynClientConnection.js` (Line 2510-2560)

**关键实现**:
```javascript
async registerFormula(formulaId, sourceCode, languageId) {
  return new Promise((resolve, reject) => {
    const requestId = this.getNextSeq();

    // 创建注册请求
    const regReq = new this.wasmModule.ATRegFormulaReq();
    regReq.token = this.token;              // CRITICAL: 设置 token 用于认证
    regReq.ID = String(formulaId);          // 公式ID
    regReq.languageID = parseInt(languageId); // 语言ID
    regReq.sourceCode = sourceCode;         // 公式源代码
    regReq.seq = parseInt(requestId);       // 请求序列号

    // 编码并发送请求
    const encodedRequest = regReq.encode();
    this.sendRequest(this.wasmModule.CMD_AT_REG_FORMULA, encodedRequest, requestId)
      .then((response) => {
        // 解码响应
        const regRes = new this.wasmModule.ATRegFormulaRes();
        regRes.decode(response);

        if (regRes.errorCode === 0) {
          this.logger.info(`✅ Formula ${formulaId} registered with UUID: ${regRes.UUID}`);
          resolve({
            success: true,
            uuid: regRes.UUID,        // 返回 UUID
            formulaId: formulaId
          });
        } else {
          reject(new Error(`Registration failed with error code: ${regRes.errorCode}`));
        }

        // 清理 WASM 对象
        regReq.delete();
        regRes.delete();
      })
      .catch(reject);
  });
}
```

#### 1.4 前端接收注册响应

**响应格式**:
```javascript
{
  type: 'register_formula_response',
  success: true,
  data: {
    uuid: 'generated-uuid-string',  // Caitlyn Server 生成的 UUID
    formulaId: -222
  },
  requestId: 'reg_1234567890_abc'
}
```

**前端处理**:
```javascript
// FormulaViewer.vue - 保存 UUID 到公式对象
if (response.success && response.data?.uuid) {
  selectedFormula.value.uuid = response.data.uuid;
  console.log(`✅ Formula registered with UUID: ${response.data.uuid}`);
}
```

### 第二步：公式计算 (CMD_AT_CAL_FORMULA)

#### 2.1 前端发起计算请求

**位置**: `frontend-vue/src/components/FormulaViewer.vue`

**触发时机**:
- 用户点击 "Execute Formula" 按钮
- 配置完成公式、时间范围、标的物后

**请求参数**:
```typescript
{
  type: "execute_formula",
  market: selectedFutures.value.market,      // 市场代码 (如: "SHFE")
  code: selectedFutures.value.code,          // 合约代码 (如: "rb2501")
  fromTime: fromTimestamp,                   // 开始时间戳（秒）
  toTime: toTimestamp,                       // 结束时间戳（秒）
  granularity: selectedGranularity.value,    // 时间粒度（秒）
  formulaCode: formulaCode.value,            // 公式源代码
  formulaName: selectedFormula.value.name,   // 公式名称
  formulaId: selectedFormula.value.id,       // 公式ID
  enableSubscription: enableSubscription.value, // 是否启用实时订阅
  requestId: `exec_${Date.now()}_${randomString()}`
}
```

#### 2.2 后端处理计算请求

**位置**: `backend/src/server.js` (Line 856-900)

**处理流程** (注册 + 计算组合):
```javascript
case 'execute_formula':
  try {
    const { market, code, fromTime, toTime, granularity, formulaCode, formulaName, formulaId } = data;

    logger.info(`🧮 Executing formula: ${formulaName} (ID: ${formulaId}) for ${market}/${code}`);

    // 检查连接池
    if (!caitlynService.connectionPool) {
      ws.send(JSON.stringify({
        type: 'formula_execution_response',
        success: false,
        error: 'Connection pool not initialized',
        requestId: data.requestId
      }));
      break;
    }

    // Step 1: 注册公式获取 UUID
    const registerResult = await caitlynService.registerFormula(formulaId, formulaCode, 5);

    if (!registerResult.success) {
      ws.send(JSON.stringify({
        type: 'formula_execution_response',
        success: false,
        error: 'Formula registration failed',
        requestId: data.requestId
      }));
      break;
    }

    // Step 2: 使用 UUID 计算公式
    const result = await caitlynService.calculateFormula(
      registerResult.uuid,
      market,
      code,
      fromTime,
      toTime,
      granularity
    );

    // 返回结果（包含 UUID）
    ws.send(JSON.stringify({
      type: 'formula_execution_response',
      success: true,
      uuid: registerResult.uuid,  // 返回 UUID 用于订阅
      data: result.data,
      requestId: data.requestId
    }));
  } catch (error) {
    logger.error('Error in execute_formula:', error);
    ws.send(JSON.stringify({
      type: 'formula_execution_response',
      success: false,
      error: error.message,
      requestId: data.requestId
    }));
  }
  break;
```

#### 2.3 WASM 层计算处理

**位置**: `backend/src/utils/CaitlynClientConnection.js` (Line 2590-2670)

**关键实现**:
```javascript
async calculateFormula(uuid, market, code, beginTime, endTime, granularity, sourcecode = '') {
  return new Promise((resolve, reject) => {
    const requestId = this.getNextSeq();

    // 创建计算请求
    const calReq = new this.wasmModule.ATCalFormulaReq();
    calReq.token = this.token;              // CRITICAL: 设置 token
    calReq.UUID = uuid;                     // 使用注册时获得的 UUID
    calReq.market = market;
    calReq.seq = parseInt(requestId);

    // 设置合约代码（使用 StringVector）
    const codesVector = new this.wasmModule.StringVector();
    codesVector.push_back(code);
    calReq.codes = codesVector;

    calReq.granularity = granularity;
    calReq.beginTime = String(beginTime);
    calReq.endTime = String(endTime);
    calReq.isRealTime = 1;                  // 启用实时模式

    // 编码并发送请求
    const encodedRequest = calReq.encode();
    this.sendRequest(this.wasmModule.CMD_AT_CAL_FORMULA, encodedRequest, requestId)
      .then((calRes) => {
        if (calRes.errorCode === 0) {
          this.logger.info(`✅ Formula calculation completed for ${market}/${code}`);
          const results = this.processFormulaCalculationResults(calRes, sourcecode);
          resolve({
            success: true,
            data: results,
            message: 'Formula calculation completed successfully'
          });
        } else {
          reject(new Error(`Calculation failed with error code: ${calRes.errorCode}`));
        }

        // 清理 WASM 对象
        calReq.delete();
        calRes.delete();
        codesVector.delete();
      })
      .catch(reject);
  });
}
```

#### 2.4 计算结果响应

**响应格式**:
```javascript
{
  type: 'formula_execution_response',
  success: true,
  uuid: 'registered-formula-uuid',    // 公式 UUID（用于订阅）
  data: {
    records: [
      {
        timestamp: 1704067200000,     // 毫秒时间戳
        time_tag: 1704067200000,
        fields: {
          macd: 12.34,
          macd_diff: 5.67,
          macd_dea: 8.90
        }
      },
      // ... 更多记录
    ],
    displayConfiguration: {           // 显示配置
      lines: [
        { name: 'macd', color: '#ff9c00', thickness: 1 },
        { name: 'macd_diff', color: '#0000ff', thickness: 1 },
        { name: 'macd_dea', color: '#F23456', thickness: 1 }
      ]
    },
    metadata: {                       // 元数据
      formulaId: -222,
      market: 'SHFE',
      code: 'rb2501'
    }
  },
  requestId: 'exec_1234567890_abc'
}
```

#### 2.5 前端处理计算结果

**位置**: `frontend-vue/src/components/FormulaViewer.vue` (Line 820-855)

```javascript
// 处理公式执行响应
if (newMessage.type === 'formula_execution_response') {
  if (newMessage.success && newMessage.data) {
    const responseData = newMessage.data;

    // 保存公式 UUID（用于后续订阅）
    if (newMessage.uuid) {
      selectedFormula.value.uuid = newMessage.uuid;
      formulaUuid = newMessage.uuid;
    }

    // 处理数据记录
    const processedData = responseData.records?.map((record, index) => ({
      ...record,
      ...record.fields,              // 展平字段
      row_id: index + 1,
      timestamp: new Date(parseInt(record.timestamp)).toISOString()
    })) || [];

    // 保存元数据和显示配置
    if (responseData.metadata) {
      formulaMetadata.value = responseData.metadata;
    }

    formulaData.value = processedData;
    resultFields.value = processedData.length > 0 ?
      Object.keys(processedData[0]).filter(key =>
        key !== 'timestamp' && key !== 'row_id' && key !== 'time_tag'
      ) : [];

    // 如果启用订阅，自动开始实时订阅
    if (enableSubscription.value) {
      await subscribeToRealTimeData();
    }
  }
}
```

### 第三步：实时数据订阅 (CMD_AT_SUBSCRIBE)

#### 3.1 前端发起订阅请求

**位置**: `frontend-vue/src/components/FormulaViewer.vue` (Line 857-907)

**触发时机**:
- 公式执行成功后自动订阅（如果启用）
- 用户勾选 "Enable Real-time Subscription"

**订阅参数**:
```typescript
const config: FormulaSubscriptionConfig = {
  formulaId: selectedFormula.value.id,
  formulaName: selectedFormula.value.name,
  formulaCode: formulaCode.value,
  market: selectedFutures.value.market,
  code: selectedFutures.value.code,
  granularity: 0,                         // 实时订阅固定使用 0
  languageId: selectedFormula.value.language_id || 5,
  registeredUuid: selectedFormula.value.uuid  // 使用注册时获得的 UUID
};

// 通过 formulaSubscriptionService 订阅
const subscriptionId = await formulaSubscriptionService.subscribe(config, dataCallback);
```

#### 3.2 订阅服务处理

**位置**: `frontend-vue/src/services/formulaSubscriptionService.ts` (Line 120-210)

**关键实现**:
```typescript
async subscribe(config: FormulaSubscriptionConfig, callback?: (data: any) => void): Promise<string> {
  const requestId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const { registeredUuid } = config;

  // 检查公式是否已注册
  if (!registeredUuid) {
    throw new Error('Formula must be registered first');
  }

  // 创建订阅信息（临时存储在 requestId 下）
  const subscriptionInfo: FormulaSubscriptionInfo = {
    uuid: requestId,
    config: { ...config, registeredUuid },
    status: 'pending',
    createdAt: new Date(),
    dataCount: 0
  };

  this.subscriptions.value.set(requestId, subscriptionInfo);
  this.realTimeData.value.set(requestId, []);

  // 注册回调
  if (callback) {
    this.callbacks.set(requestId, callback);
  }

  try {
    // 发送订阅请求
    const subscribeResponse = await websocketTaskService.sendTask({
      type: "subscribe",
      markets: ["STRATEGY"],                    // 硬编码
      codes: [registeredUuid],                  // 使用公式 UUID
      qualifiedNames: ["Formula::Data"],        // 硬编码（包含 namespace 前缀）
      options: {
        granularities: [config.granularity],    // 实时订阅为 0
        fields: ["formula_res"],                // 公式结果字段
        start: 0,                               // 硬编码
        end: 50,                                // 硬编码
        sort: [],                               // 硬编码
        direction: [],                          // 硬编码
        filters: []                             // 硬编码
      }
    }, {
      timeout: 10000,
      retries: 0,
      retryDelay: 1000
    });

    // 订阅确认后，将所有数据从 requestId 移动到 subscriberId
    if (subscribeResponse.type === 'subscription_confirmed' || subscribeResponse.success) {
      const subscribeUuid = subscribeResponse.subscriberId || subscribeResponse.data?.uuid;

      if (subscribeUuid) {
        subscriptionInfo.status = 'active';
        subscriptionInfo.uuid = subscribeUuid;
        subscriptionInfo.subscriberId = subscribeUuid;

        // 将 subscription 从 requestId 移动到 subscriberId
        this.subscriptions.value.delete(requestId);
        this.subscriptions.value.set(subscribeUuid, subscriptionInfo);

        // 将 realTimeData 也移动到新 key
        const existingData = this.realTimeData.value.get(requestId) || [];
        this.realTimeData.value.delete(requestId);
        this.realTimeData.value.set(subscribeUuid, existingData);

        // 将 callback 移动到新 key
        if (callback) {
          this.callbacks.delete(requestId);
          this.callbacks.set(subscribeUuid, callback);
        }

        console.log(`✅ Formula subscription confirmed: ${subscribeUuid}`);
        return subscribeUuid;
      } else {
        throw new Error('No subscription UUID returned');
      }
    } else {
      throw new Error(subscribeResponse.error || 'Subscription failed');
    }
  } catch (error) {
    // 订阅失败，清理资源
    this.subscriptions.value.delete(requestId);
    this.realTimeData.value.delete(requestId);
    this.callbacks.delete(requestId);
    throw error;
  }
}
```

#### 3.3 后端订阅处理

**位置**: `backend/src/server.js` (Line 935-1000)

**处理流程**:
```javascript
case 'subscribe':
  try {
    const { markets, codes, qualifiedNames, options = {} } = data;

    logger.info(`📡 [SERVER] Subscription request received:`);
    logger.info(`   📊 Markets: ${markets.join(',')}`);
    logger.info(`   🏷️ Codes: ${codes.join(',')}`);
    logger.info(`   🧬 Qualified Names: ${qualifiedNames.join(',')}`);

    if (!clientHandler.isConnected) {
      ws.send(JSON.stringify({
        type: 'subscription_error',
        error: 'Not connected to Caitlyn server',
        requestId: data.requestId
      }));
      break;
    }

    // 使用 Hub 进行订阅（自动去重和广播）
    const subscriberId = await clientHandler.subscribeHub(
      markets,
      codes,
      qualifiedNames,
      (realTimeData) => {
        // 广播实时数据到前端
        ws.send(JSON.stringify({
          type: 'real_time_data',
          data: realTimeData,
          subscriberId: subscriberId,         // 订阅ID
          requestId: data.requestId,
          timestamp: new Date().toISOString()
        }));
      },
      options
    );

    logger.info(`✅ Subscription established with ID: ${subscriberId}`);

    // 发送订阅确认
    ws.send(JSON.stringify({
      type: 'subscription_confirmed',
      subscriberId: subscriberId,
      message: 'Real-time subscription established successfully',
      requestId: data.requestId,
      subscriptionInfo: {
        markets: markets,
        codes: codes,
        qualifiedNames: qualifiedNames,
        options: options
      }
    }));
  } catch (error) {
    logger.error('Error in subscription:', error);
    ws.send(JSON.stringify({
      type: 'subscription_error',
      error: error.message,
      requestId: data.requestId
    }));
  }
  break;
```

#### 3.4 订阅确认响应

**响应���式**:
```javascript
{
  type: 'subscription_confirmed',
  subscriberId: 'sub_1234567890_abcdef',  // 后端生成的订阅ID
  message: 'Real-time subscription established successfully',
  requestId: 'sub_1234567890_xyz',
  subscriptionInfo: {
    markets: ["STRATEGY"],
    codes: ["registered-formula-uuid"],
    qualifiedNames: ["Formula::Data"],
    options: {
      granularities: [0],
      fields: ["formula_res"],
      start: 0,
      end: 50,
      sort: [],
      direction: [],
      filters: []
    }
  }
}
```

### 第四步：实时数据推送处理

#### 4.1 推送数据格式

**从后端推送的数据**:
```javascript
{
  type: 'real_time_data',
  subscriberId: 'sub_1234567890_abcdef',  // 订阅ID
  data: {
    rawData: {
      data: [
        {
          time_tag: 1704067200000,          // 毫秒时间戳
          fields: {
            macd: 13.45,
            macd_diff: 6.78,
            macd_dea: 9.01
          }
        }
      ],
      displayConfiguration: {               // 可选：显示配置更新
        lines: [...]
      }
    }
  },
  timestamp: '2024-01-01T00:00:00.000Z',
  requestId: 'sub_1234567890_xyz'
}
```

#### 4.2 订阅服务路由推送数据

**位置**: `frontend-vue/src/services/formulaSubscriptionService.ts` (Line 505-530)

```typescript
// WebSocket 消息处理
case 'real_time_data':
  // subscriberId 在顶层
  if (lastMessage.subscriberId && lastMessage.data) {
    this.handleWebSocketPushData({
      subscriberId: lastMessage.subscriberId,
      data: lastMessage.data,
      timestamp: lastMessage.data.timestamp || lastMessage.timestamp
    });
  }
  break;

// 处理推送数据
handleWebSocketPushData(pushData: FormulaPushData): void {
  const { subscriberId, data } = pushData;

  // 查找对应的订阅
  const subscription = this.subscriptions.value.get(subscriberId);
  if (!subscription) {
    // 静默忽略（可能是其他服务的订阅）
    return;
  }

  // 存储实时数据
  const existingData = this.realTimeData.value.get(subscriberId) || [];
  this.realTimeData.value.set(subscriberId, [...existingData, data]);

  // 调用回调函数
  const callback = this.callbacks.get(subscriberId);
  if (callback) {
    callback(data);
  }
}
```

#### 4.3 前端处理推送数据（分钟级去重）

**位置**: `frontend-vue/src/components/FormulaViewer.vue` (Line 909-1010)

**关键实现**:
```typescript
const handleFormulaPushData = (data: any) => {
  console.log("📡 Formula push data received:", data);

  // 解析推送数据
  let recordsToProcess: any[] = [];

  if (Array.isArray(data)) {
    recordsToProcess = data;
  } else if (data.rawData?.data && Array.isArray(data.rawData.data)) {
    recordsToProcess = data.rawData.data;

    // 更新显示配置
    if (data.rawData.displayConfiguration) {
      displayConfiguration.value = data.rawData.displayConfiguration;
    }
  } else if (data.data && Array.isArray(data.data)) {
    recordsToProcess = data.data;
  }

  if (recordsToProcess.length === 0) {
    console.warn("⚠️ No valid records in push data");
    return;
  }

  // 处理实时数据记录
  const newData = recordsToProcess.map((record: any, index: number) => ({
    ...record,
    ...record.fields,                       // 展平字段
    row_id: index + 1,                      // 临时ID
    timestamp: record.timestamp ?
      new Date(parseInt(record.timestamp)).toISOString() :
      new Date().toISOString(),
    time_tag: record.time_tag
  }));

  // 分钟级去重逻辑
  const normalizeToMinute = (timeTag: number) => {
    return Math.floor(timeTag / 60000) * 60000;  // 归一化到分钟
  };

  const updatedData = [...formulaData.value];

  for (const newRecord of newData) {
    const newTimeMinute = normalizeToMinute(newRecord.time_tag);
    const existingIndex = updatedData.findIndex(existing => {
      const existingTimeMinute = normalizeToMinute(existing.time_tag);
      return existingTimeMinute === newTimeMinute;
    });

    if (existingIndex !== -1) {
      // 覆盖同分钟的旧数据
      updatedData[existingIndex] = { ...newRecord };
      console.log(`🔄 Updated record at minute ${new Date(newTimeMinute).toISOString()}`);
    } else {
      // 添加新数据到开头
      updatedData.unshift(newRecord);
      console.log(`➕ Added new record at minute ${new Date(newTimeMinute).toISOString()}`);
    }
  }

  // 重新分配 row_id
  formulaData.value = updatedData.map((record, index) => ({
    ...record,
    row_id: index + 1
  }));

  console.log(`✅ Formula data updated, total records: ${formulaData.value.length}`);
};
```

### 第五步：取消订阅 (CMD_AT_UNSUBSCRIBE)

#### 5.1 前端发起退订请求

**位置**: `frontend-vue/src/components/FormulaViewer.vue` (Line 1013-1050)

```typescript
const unsubscribe = async () => {
  if (!subscriberId.value) {
    console.warn("⚠️ No active subscription to cancel");
    return;
  }

  try {
    const currentSubscriptionId = subscriberId.value;
    console.log("📞 Calling unsubscribe with ID:", currentSubscriptionId);

    const success = await formulaSubscriptionService.unsubscribe(currentSubscriptionId);

    if (success) {
      isSubscribed.value = false;
      subscriberId.value = null;
      enableSubscription.value = false;
      console.log("✅ Formula subscription cancelled successfully");
    } else {
      console.error("❌ Formula unsubscription failed");
    }
  } catch (error) {
    console.error("❌ Formula unsubscription error:", error);
  }
};
```

#### 5.2 订阅服务处理退订

**位置**: `frontend-vue/src/services/formulaSubscriptionService.ts` (Line 244-300)

```typescript
async unsubscribe(subscriptionId: string): Promise<boolean> {
  // 使用 subscriberId 查找订阅
  const subscription = this.subscriptions.value.get(subscriptionId);
  if (!subscription) {
    console.warn(`⚠️ Formula subscription not found: ${subscriptionId}`);
    return false;
  }

  if (subscription.status === 'cancelled') {
    console.log(`ℹ️ Formula subscription already cancelled: ${subscriptionId}`);
    return true;
  }

  console.log(`⏹️ Cancelling formula subscription: ${subscriptionId}`);

  // 清理回调
  this.callbacks.delete(subscriptionId);
  this.callbacks.delete(subscription.subscriberId || '');

  try {
    // 发送取消订阅请求
    const response = await websocketTaskService.sendTask({
      type: 'unsubscribe',
      subscriberId: subscription.subscriberId || subscriptionId
    }, {
      timeout: 5000,
      retries: 1,
      retryDelay: 1000
    });

    // 检查响应
    if (response.type === 'unsubscription_confirmed' || response.success) {
      subscription.status = 'cancelled';
      console.log(`✅ Formula unsubscription confirmed: ${subscriptionId}`);
      return true;
    } else {
      console.error(`❌ Formula unsubscription failed: ${subscriptionId}`, response.error);
      return false;
    }
  } catch (error) {
    console.error(`❌ Formula unsubscription error: ${subscriptionId}`, error);
    subscription.status = 'cancelled';  // 即使出错也标记为已取消
    return false;
  }
}
```

#### 5.3 后端处理退订

**位置**: `backend/src/server.js` (Line 1002-1030)

```javascript
case 'unsubscribe':
  try {
    const { subscriberId } = data;

    logger.info(`⏹️ [SERVER] Unsubscribe request for: ${subscriberId}`);

    if (!clientHandler.isConnected) {
      ws.send(JSON.stringify({
        type: 'unsubscription_error',
        error: 'Not connected to Caitlyn server',
        requestId: data.requestId
      }));
      break;
    }

    // 使用 Hub 取消订阅
    const result = await clientHandler.unsubscribeHub(subscriberId);

    logger.info(`✅ Unsubscription successful: ${subscriberId}`);

    ws.send(JSON.stringify({
      type: 'unsubscription_confirmed',
      subscriberId: subscriberId,
      message: 'Subscription cancelled successfully',
      requestId: data.requestId
    }));
  } catch (error) {
    logger.error('Error in unsubscribe:', error);
    ws.send(JSON.stringify({
      type: 'unsubscription_error',
      error: error.message,
      subscriberId: data.subscriberId,
      requestId: data.requestId
    }));
  }
  break;
```

#### 5.4 退订确认响应

**响应格式**:
```javascript
{
  type: 'unsubscription_confirmed',
  subscriberId: 'sub_1234567890_abcdef',
  message: 'Subscription cancelled successfully',
  requestId: 'unsub_1234567890_xyz'
}
```

## 关键技术要点

### 1. Token 认证

**CRITICAL**: 所有 Caitlyn Server 请求都必须包含 token 字段用于认证。

```javascript
// 公式注册
regReq.token = this.token;  // 必须设置

// 公式计算
calReq.token = this.token;  // 必须设置
```

### 2. UUID 映射管理

整个流程涉及三种 ID 的转换：

1. **requestId**: 前端生成的临时请求ID（用于请求/响应匹配）
2. **formula.uuid**: Caitlyn Server 返回的公式UUID（用于计算和订阅）
3. **subscriberId**: 后端生成的订阅ID（用于推送数据识别和退订）

**映射流程**:
```
requestId (临时) → formula.uuid (注册后) → subscriberId (订阅后)
     ↓                    ↓                      ↓
  存储订阅信息       用于计算请求          用于推送数据匹配
  (subscription)      (calculate)          (real_time_data)
```

### 3. 订阅 Key 迁移

订阅确认后，必须将所有相关数据从 `requestId` 迁移到 `subscriberId`：

```typescript
// 迁移 subscription
this.subscriptions.value.delete(requestId);
this.subscriptions.value.set(subscriberId, subscriptionInfo);

// 迁移 realTimeData
const existingData = this.realTimeData.value.get(requestId) || [];
this.realTimeData.value.delete(requestId);
this.realTimeData.value.set(subscriberId, existingData);

// 迁移 callback
this.callbacks.delete(requestId);
this.callbacks.set(subscriberId, callback);
```

### 4. 硬编码订阅参数

公式订阅使用固定参数（不可修改）：

```typescript
{
  markets: ["STRATEGY"],              // 固定为 STRATEGY
  codes: [formula.uuid],              // 使用公式 UUID
  qualifiedNames: ["Formula::Data"],  // 固定为 Formula::Data
  options: {
    granularities: [0],               // 实时订阅固定为 0
    fields: ["formula_res"],          // 固定为 formula_res
    start: 0,                         // 固定分页参数
    end: 50,                          // 固定分页参数
    sort: [],                         // 空数组
    direction: [],                    // 空数组
    filters: []                       // 空数组
  }
}
```

### 5. 分钟级数据去重

实时推送数据按分钟粒度去重，避免同一分钟内的重复数据：

```typescript
const normalizeToMinute = (timeTag: number) => {
  return Math.floor(timeTag / 60000) * 60000;  // 归一化到分钟
};

// 查找同分钟数据
const existingIndex = updatedData.findIndex(existing => {
  const existingTimeMinute = normalizeToMinute(existing.time_tag);
  return existingTimeMinute === newTimeMinute;
});

if (existingIndex !== -1) {
  // 覆盖旧数据
  updatedData[existingIndex] = { ...newRecord };
} else {
  // 添加新数据到开头
  updatedData.unshift(newRecord);
}
```

### 6. WASM 对象生命周期管理

所有 WASM 对象使用后必须删除，防止内存泄漏：

```javascript
// 创建对象
const regReq = new this.wasmModule.ATRegFormulaReq();
const regRes = new this.wasmModule.ATRegFormulaRes();
const codesVector = new this.wasmModule.StringVector();

try {
  // 使用对象...
} finally {
  // 必须删除
  regReq.delete();
  regRes.delete();
  codesVector.delete();
}
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
     type: 'subscription_error',
     error: 'Not connected to Caitlyn server'
   }
   ```

4. **未注册公式订阅**
   ```javascript
   {
     error: 'Formula must be registered first. Please register the formula before subscribing.'
   }
   ```

### 错误处理策略

1. **注册阶段**: 显示语法错误，允许用户修改代码
2. **计算阶段**: 显示计算错误，检查参数配置
3. **订阅阶段**: 重试或降级到非实时模式
4. **推送阶段**: 记录日志，继续处理其他数据

## 生命周期管理

### 组件初始化流程

```
1. 加载公式列表
2. 用户选择公式
3. 自动注册公式（如未注册）
4. 配置参数（市场、合约、时间范围）
5. 执行计算获取历史数据
6. （可选）启用实时订阅
7. 接收实时推送数据
```

### 组件销毁流程

```
1. 取消所有活跃订阅
2. 清理回调函数
3. 清理订阅数据
4. 清理 WASM 对象
```

**实现代码**:
```typescript
onBeforeUnmount(async () => {
  // 清理所有公式订阅
  try {
    await formulaSubscriptionService.unsubscribeAllFormulas();
  } catch (error) {
    console.error("Error cleaning up formula subscriptions:", error);
  }
});
```

## 相关文件索引

### 前端文件
- `frontend-vue/src/components/FormulaViewer.vue` - 主要UI组件
- `frontend-vue/src/services/formulaSubscriptionService.ts` - 订阅管理服务
- `frontend-vue/src/services/websocketTaskService.ts` - WebSocket任务服务
- `frontend-vue/src/stores/websocketStore.ts` - WebSocket状态管理

### 后端文件
- `backend/src/server.js` - WebSocket消息路由
- `backend/src/services/CaitlynWebSocketService.js` - Caitlyn服务封装
- `backend/src/utils/CaitlynClientConnection.js` - Caitlyn客户端连接（WASM集成）
- `backend/src/utils/CaitlynSubscriptionHub.js` - 订阅Hub（去重和广播）

### 文档文件
- `docs/CAITLYN_JS_API.md` - Caitlyn JS API文档
- `docs/BACKEND_API_REFERENCE.md` - 后端API参考
- `docs/SVOBJECT_BEST_PRACTICES.md` - SVObject最佳实践

## 测试要点

### 功能测试

1. **注册流程**: 验证公式注册和UUID获取
2. **执行流程**: 验证公式执行和初始数据获取
3. **订阅流程**: 验证订阅请求和订阅ID获取
4. **推送流程**: 验证实时数据推送和解析
5. **取消订阅**: 验证订阅取消和资源清理
6. **分钟去重**: 验证同分钟数据覆盖逻辑

### 错误测试

1. **未注册订阅**: 验证未注册公式无法订阅
2. **网络异常**: 验证断线重连机制
3. **数据异常**: 验证畸形数据的处理
4. **并发订阅**: 验证多个订阅的隔离性

## 注意事项

1. **UUID 管理**: 确保 `formula.uuid` 和 `subscriberId` 的正确设置和使用
2. **Token 认证**: 所有 Caitlyn 请求必须包含 token 字段
3. **硬编码参数**: 订阅时的硬编码参数不能随意修改
4. **时序依赖**: 必须先注册获得 UUID，才能进行计算和订阅
5. **资源清理**: 组件销毁时必须取消所有订阅和清理 WASM 对象
6. **Key 迁移**: 订阅确认后必须将数据从 requestId 迁移到 subscriberId
7. **分钟去重**: 实时推送按分钟粒度去重，覆盖旧值
8. **响应格式**: 退订响应使用 `type === 'unsubscription_confirmed'` 而非 `success` 字段

## 后续优化方向

1. **缓存机制**: 缓存注册结果，避免重复注册
2. **批量操作**: 支持批量注册和订阅多个公式
3. **性能优化**: 优化大量数据的渲染性能
4. **监控统计**: 添加订阅状态监控和性能统计
5. **错误恢复**: 增强网络异常时的自动重试机制
6. **数据持久化**: 支持本地缓存历史数据

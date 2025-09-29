# 小公式订阅完整流程文档

## 概述

本文档详细记录了小公式（Formula）的订阅流程，包括注册、执行、订阅和实时数据推送的完整生命周期。参考了成熟的 `wb-subscribe.service.ts` 和 `chip.component.ts` 中的实现。

## 核心概念

### 关键字段说明

1. **formula.uuid**: 公式注册后后端返回的唯一标识符
2. **formula.subscribeUuid**: 订阅请求后后端返回的订阅ID，用于识别推送数据
3. **formula.id**: 公式的原始ID（可能是负数，如 -222, -333, -111）

### 数据流向

```
公式注册(REG) → 获得 formula.uuid → 执行公式 → 订阅公式 → 获得 formula.subscribeUuid → 接收实时数据
```

## 完整流程详解

### 1. 公式注册阶段 (REG)

**目的**: 将公式代码注册到后端，获得唯一的UUID

**请求参数**:
```typescript
{
  type: "register_formula",
  formulaId: formula.id,           // 原始公式ID
  sourceCode: formula.source_code, // 公式源代码
  languageId: formula.language_id  // 语言ID (通常是5)
}
```

**响应结果**:
```typescript
{
  success: true,
  data: {
    uuid: "4e6d8864-cc52-4484-9dc9-e89cd4485348", // 注册后获得的UUID
    formulaId: -222
  }
}
```

**关键点**:
- 注册成功后，需要将返回的 `uuid` 设置到 `formula.uuid` 字段
- 这个UUID后续用于订阅请求

### 2. 公式执行阶段 (CAL_FORMULA)

**目的**: 执行公式获取初始数据和配置

**请求参数**:
```typescript
{
  cmd: "CMD_AT_CAL_FORMULA",
  uuid: formula.uuid,              // 注册时获得的UUID
  market: security.market,         // 市场代码
  code: security.code,             // 证券代码
  granularity: granularity,        // 时间粒度
  begin_time: domain[0],           // 开始时间
  end_time: domain[domain.length - 1] + 1, // 结束时间
  is_real_time: is_real_time       // 是否实时模式
}
```

**响应结果**:
```typescript
{
  timeTags: [...],
  results: {
    data: [...],                   // 公式计算结果数据
    displayConfiguration: {...},   // 显示配置
    metadata: {...}                // 元数据
  }
}
```

**关键点**:
- 使用注册时获得的 `formula.uuid`
- 返回的数据包含显示配置，用于后续渲染
- 这个阶段主要是获取历史数据和配置

### 3. 公式订阅阶段 (SUBSCRIBE)

**目的**: 订阅公式的实时数据推送

**请求参数** (参考 wb-subscribe.service.ts):
```typescript
{
  markets: ["STRATEGY"],                    // 硬编码为 "STRATEGY"
  symbols: [formula.uuid],                  // 使用注册时获得的UUID
  granularities: [0],                       // 硬编码为 0
  indicators: { 
    "Formula::Data": ["formula_res"]        // 硬编码的指标配置
  },
  start: 0,                                 // 硬编码分页参数
  end: 50,                                  // 硬编码分页参数
  sort: [],                                 // 空数组
  direction: [],                            // 空数组
  filters: [],                              // 空数组
  cmd: "CMD_AT_SUBSCRIBE"
}
```

**响应结果**:
```typescript
{
  errorCode: 0,
  uuid: "subscription-uuid-12345"           // 订阅ID
}
```

**关键点**:
- `markets` 硬编码为 `["STRATEGY"]`
- `symbols` 使用注册时获得的 `formula.uuid`
- `granularities` 硬编码为 `[0]`
- `indicators` 硬编码为 `{ "Formula::Data": ["formula_res"] }`
- 订阅成功后，需要将返回的 `uuid` 设置到 `formula.subscribeUuid` 字段

### 4. 实时数据推送阶段

**目的**: 接收公式的实时计算结果

**推送数据格式**:
```typescript
{
  type: "real_time_data",
  subscriberId: formula.subscribeUuid,      // 订阅时获得的ID
  data: [
    {
      time_tag: 1640995200000,              // 时间戳
      fields: {                             // 公式计算结果字段
        "field1": 123.45,
        "field2": 67.89,
        // ... 其他字段
      }
    }
  ],
  timestamp: "2023-01-01T00:00:00.000Z"
}
```

**关键点**:
- 通过 `subscriberId` 识别是哪个公式的推送数据
- 数据包含 `time_tag` 和计算结果字段
- 需要根据 `formula.subscribeUuid` 匹配对应的公式

## 代码实现参考

### chip.component.ts 中的实现

```typescript
// 1. 执行公式获取初始数据
me.formulas.forEach((formula: any) => {
  let params = {
    cmd: Module.CMD_AT_CAL_FORMULA,
    uuid: formula.uuid,              // 注册时获得的UUID
    market: formula.security ? formula.security.market : me.security.market,
    code: formula.security ? formula.security.code : me.security.code,
    granularity: me.granularity,
    begin_time: +me.domain[0],
    end_time: +me.domain[me.domain.length - 1] + 1,
    is_real_time: is_real_time,
  };
  
  me.asyncWebsocketClient.send(true, params, (result, msg) => {
    if (msg == me.fetchDataSeq) {
      formulaCallback(result, msg, formula);
    }
  }, me.fetchDataSeq);
});

// 2. 订阅公式实时数据
if (me.formulas) {
  me.formulas.forEach(formula => {
    if (formula.subscribeUuid) {
      me.subscribeService.unsubscribe(formula.subscribeUuid);
    }
    me.subscribeService.subscribe(
      [formula].map(f => "STRATEGY"),                    // 硬编码 markets
      [formula].map(f => f.uuid),                        // 使用注册UUID
      [formula].map(f => 0),                             // 硬编码 granularities
      { "Formula::Data": ["formula_res"] },              // 硬编码 indicators
      (result, seq) => {
        if (result.uuid) {
          formula.subscribeUuid = result.uuid;            // 设置订阅ID
        } else if (result.data) {
          if (seq == me.fetchDataSeq) {
            formulaCallback(result.data, "", formula);    // 处理推送数据
          }
        }
      },
      0, 50, [], [], [], me.fetchDataSeq
    );
  });
}

// 3. 取消订阅
unsubscribeAllFormulas() {
  this.formulas.forEach(f => {
    if (f.subscribeUuid) {
      this.subscribeService.unsubscribe(f.subscribeUuid, () => {
        // 取消订阅回调
      });
    }
  });
}
```

### wb-subscribe.service.ts 中的实现

```typescript
subscribe(
  markets: string[],           // ["STRATEGY"]
  symbols: string[],           // [formula.uuid]
  granularities: number[],     // [0]
  indicators: any,             // { "Formula::Data": ["formula_res"] }
  callback: Function,
  start?: number,              // 0
  end?: number,                // 50
  sort?: string[],             // []
  direction?: number[],        // []
  filters?: any[],             // []
  seq?: number
) {
  let qualifiedNames: string[] = Object.keys(indicators);
  let fields: string[][] = [];
  qualifiedNames.forEach(d => {
    fields.push(indicators[d]);
  });

  return this.asyncWebsocketClient.send(
    true,
    {
      name: "",
      markets: markets,
      symbols: symbols,
      granularities: granularities,
      qualified_names: qualifiedNames,
      fields: fields,
      cmd: Module.CMD_AT_SUBSCRIBE,
      start: start || 0,
      end: end || 50,
      sort: sort || [],
      direction: direction || [],
      filters: filters || [],
    },
    result => {
      if (result.errorCode == 0) {
        let res = {};
        if (result instanceof Module.ATSubscribeRes) {
          res = { uuid: result.UUID };                    // 返回订阅UUID
        } else if (result instanceof Module.ATCalFormulaRTRes) {
          res = { data: result };                         // 推送数据
        }
        callback(res, seq);
      }
    },
    seq
  );
}
```

## 错误处理和状态管理

### 订阅状态

- `pending`: 订阅请求已发送，等待确认
- `active`: 订阅已确认，正在接收数据
- `error`: 订阅失败
- `cancelled`: 订阅已取消

### 错误处理

1. **注册失败**: 重试注册或显示错误信息
2. **执行失败**: 检查参数或公式代码
3. **订阅失败**: 重试订阅或降级到非实时模式
4. **推送数据异常**: 记录日志，继续处理其他数据

### 生命周期管理

1. **组件初始化**: 注册公式 → 执行公式 → 订阅公式
2. **数据更新**: 重新执行公式 → 更新订阅
3. **组件销毁**: 取消所有订阅 → 清理资源

## 与现有系统的集成

### FormulaViewer.vue 集成点

1. **注册阶段**: 在 `registerFormula()` 方法中实现
2. **执行阶段**: 在 `executeFormula()` 方法中实现
3. **订阅阶段**: 在 `subscribeToRealTimeData()` 方法中实现
4. **数据接收**: 在 WebSocket 消息监听器中处理

### 数据格式转换

```typescript
// 推送数据转换为 FormulaViewer 格式
const convertedData = pushData.map(record => ({
  ...record.fields,
  row_id: formulaData.value.length + index + 1,
  timestamp: record.timestamp,
  time_tag: record.time_tag
}));
```

## 注意事项

1. **UUID 管理**: 确保 `formula.uuid` 和 `formula.subscribeUuid` 的正确设置和使用
2. **硬编码参数**: 订阅时的硬编码参数不能随意修改
3. **时序依赖**: 必须先注册获得UUID，才能进行订阅
4. **资源清理**: 组件销毁时必须取消所有订阅
5. **错误恢复**: 网络异常时的重试和恢复机制
6. **数据去重**: 避免重复订阅相同的公式

## 测试要点

1. **注册流程**: 验证公式注册和UUID获取
2. **执行流程**: 验证公式执行和初始数据获取
3. **订阅流程**: 验证订阅请求和订阅ID获取
4. **推送流程**: 验证实时数据推送和解析
5. **取消订阅**: 验证订阅取消和资源清理
6. **错误处理**: 验证各种异常情况的处理
7. **生命周期**: 验证组件的完整生命周期管理

## 后续优化方向

1. **统一订阅管理**: 创建统一的订阅管理器
2. **缓存机制**: 缓存注册结果，避免重复注册
3. **批量操作**: 支持批量注册和订阅
4. **监控统计**: 添加订阅状态监控和统计
5. **性能优化**: 优化大量公式的订阅性能

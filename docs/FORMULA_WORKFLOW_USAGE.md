# 小公式工作流程使用说明

## 概述

本文档说明如何使用新实现的小公式数据显示功能，包括公式注册、数据计算和实时订阅。

## 功能特性

✅ **公式注册**: 向Caitlyn服务器注册小公式并获取UUID  
✅ **数据计算**: 使用注册的公式计算历史数据  
✅ **实时订阅**: 订阅公式的实时数据推送  
✅ **错误处理**: 完善的错误提示和状态管理  
✅ **数据展示**: 表格和图表视图（图表待实现）  

## 使用步骤

### 1. 启动后端服务

```bash
cd backend
npm start
```

确保后端服务运行在 `http://localhost:3001`

### 2. 启动前端服务

```bash
cd frontend-vue
npm run dev
```

前端服务将运行在 `http://localhost:5173`

### 3. 连接Caitlyn服务器

1. 在前端界面中，点击"Connect to Caitlyn"
2. 输入Caitlyn服务器URL和认证token
3. 等待连接成功

### 4. 使用小公式功能

#### 4.1 选择公式

1. 在左侧"Formulas"面板中选择一个公式
2. 系统会自动填充公式代码到编辑器中
3. 可以修改公式代码（可选）

#### 4.2 选择标的物

1. 在右侧"Futures"面板中选择一个期货合约
2. 系统会自动设置时间范围（基于tradeDay）

#### 4.3 配置参数

1. **时间范围**: 设置From Time和To Time
2. **时间粒度**: 选择数据的时间间隔（1min, 5min, 15min, 30min, 1h, 1day）
3. **实时订阅**: 勾选"Enable Real-time Subscription"以接收实时数据

#### 4.4 执行公式

1. 点击"Execute Formula"按钮
2. 系统会：
   - 注册公式到Caitlyn服务器
   - 计算历史数据
   - 如果启用了订阅，会建立实时数据连接

#### 4.5 查看结果

1. **表格视图**: 默认显示计算结果的表格
2. **图表视图**: 点击"📈 Chart"切换到图表视图（待实现）
3. **实时数据**: 如果启用了订阅，新数据会自动追加到结果中

## API接口

### WebSocket消息类型

#### 公式注册
```javascript
// 发送
{
  type: 'register_formula',
  formulaId: -222,
  sourceCode: 'macd: macd(close, 12, 26, 9)...',
  languageId: 5,
  requestId: 'unique_request_id'
}

// 接收
{
  type: 'register_formula_response',
  success: true,
  data: {
    uuid: 'generated-uuid',
    formulaId: -222
  },
  requestId: 'unique_request_id'
}
```

#### 公式执行
```javascript
// 发送
{
  type: 'execute_formula',
  market: 'SHFE',
  code: 'rb2501',
  fromTime: 1704067200,
  toTime: 1704153600,
  granularity: 86400,
  formulaCode: 'macd: macd(close, 12, 26, 9)...',
  formulaName: 'builtin-macd',
  enableSubscription: true,
  requestId: 'unique_request_id'
}

// 接收
{
  type: 'formula_execution_response',
  success: true,
  data: {
    records: [
      {
        timestamp: '1704067200',
        fields: {
          macd: 12.34,
          macd_diff: 5.67,
          macd_dea: 8.90
        }
      }
    ],
    message: 'Formula executed successfully'
  },
  requestId: 'unique_request_id'
}
```

#### 实时订阅
```javascript
// 发送
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
  requestId: 'unique_request_id'
}

// 接收
{
  type: 'subscription_confirmed',
  subscriberId: 'subscriber-uuid',
  message: 'Real-time subscription established successfully',
  requestId: 'unique_request_id'
}

// 实时数据推送
{
  type: 'real_time_data',
  data: [
    {
      timestamp: '1704153600',
      fields: {
        macd: 13.45,
        macd_diff: 6.78,
        macd_dea: 9.01
      }
    }
  ],
  subscriberId: 'subscriber-uuid',
  timestamp: '2024-01-01T12:00:00.000Z'
}
```

## 测试

### 运行自动化测试

```bash
cd backend
node test-formula-workflow.js
```

测试脚本会验证：
- WebSocket连接
- 公式注册
- 公式计算
- 实时订阅

### 手动测试

1. 打开浏览器开发者工具
2. 查看Console日志，确认消息发送和接收
3. 检查Network标签页，确认WebSocket连接状态

## 错误处理

### 常见错误

1. **连接错误**: "Not connected to Caitlyn server"
   - 解决：确保Caitlyn服务器正在运行且连接正常

2. **公式语法错误**: "Formula syntax error, compilation failed"
   - 解决：检查公式代码语法，参考Caitlyn公式语法文档

3. **计算超时**: "Formula calculation timeout"
   - 解决：减少时间范围或检查网络连接

4. **订阅失败**: "Subscription failed"
   - 解决：检查标的物代码和公式名称是否正确

### 错误显示

前端会显示友好的错误信息：
- 红色错误图标
- 错误描述
- 建议的解决方案

## 性能优化

### 建议

1. **时间范围**: 避免过大的时间范围，建议不超过1年
2. **数据粒度**: 根据需求选择合适的时间粒度
3. **实时订阅**: 只在需要时启用，避免不必要的网络开销
4. **连接管理**: 及时取消不需要的订阅

### 限制

- 单次查询最多返回1000条记录
- 实时订阅最多支持10个并发订阅
- 公式代码长度限制为10KB

## 扩展功能

### 待实现功能

- [ ] 图表可视化
- [ ] 数据导出（CSV, Excel）
- [ ] 公式编辑器（语法高亮、自动补全）
- [ ] 公式模板库
- [ ] 批量公式执行
- [ ] 公式性能分析

### 自定义开发

如需添加新功能，请参考：
- `docs/FORMULA_DATA_DISPLAY_WORKFLOW.md` - 完整的技术文档
- `backend/src/server.js` - WebSocket消息处理
- `frontend-vue/src/components/FormulaViewer.vue` - 前端组件

## 支持

如有问题，请：
1. 查看控制台错误日志
2. 运行测试脚本验证功能
3. 检查Caitlyn服务器状态
4. 参考技术文档

# 小公式注册功能测试指南

## 概述

本文档说明如何测试新添加的小公式注册功能。我们添加了一个独立的"Register Formula"按钮，用于测试公式注册流程。

## 问题修复

### 原始问题

在初始实现中，`register_formula` 请求会收到错误响应：
```json
{
  "type": "register_formula_response",
  "success": false,
  "error": "Not connected to Caitlyn server. Please connect first.",
  "requestId": "register_1757925076167"
}
```

但 `fetch_by_code` 请求却能正常工作，这表明连接状态检查逻辑不一致。

### 问题原因

1. **连接状态检查不一致**：
   - `fetch_by_code` 没有检查 `clientHandler.isConnected`
   - `register_formula` 检查了 `clientHandler.isConnected`
   - `clientHandler.isConnected` 默认为 `false`，且没有在WebSocket连接建立时设置为 `true`

2. **连接池状态正确**：
   - 实际的连接池 (`caitlynService.connectionPool`) 是正常工作的
   - 问题在于 `clientHandler.isConnected` 状态不准确

### 修复方案

修复了以下问题：

1. **连接状态检查不一致**：
   ```javascript
   // 修复前：检查 clientHandler.isConnected
   if (!clientHandler.isConnected) {
     // 返回错误
   }
   
   // 修复后：检查连接池是否可用
   if (!caitlynService.connectionPool) {
     // 返回错误
   }
   ```

2. **方法名错误**：
   ```javascript
   // 修复前：调用不存在的方法
   const requestId = this.getNextSequenceId();
   
   // 修复后：调用正确的方法
   const requestId = this.getNextSeq();
   ```

3. **缺少sendRequest方法**：
   - 添加了 `sendRequest()` 方法实现
   - 使用现有的 `queryCache` 机制处理异步响应

4. **缺少响应处理**：
   - 添加了 `handleFormulaRegistrationResponse()` 方法
   - 添加了 `handleFormulaCalculationResponse()` 方法
   - 在 `handleBinaryMessage()` 中添加了相应的命令处理

这样确保了所有请求都使用相同的连接状态检查逻辑，并正确处理公式注册和计算的响应。

## 测试步骤

### 1. 启动服务

确保后端和前端服务都在运行：

```bash
# 后端服务
cd backend
npm start

# 前端服务
cd frontend-vue
npm run dev
```

### 1.1 验证修复

在测试之前，可以运行测试脚本验证修复：

```bash
# 在后端目录运行测试脚本
cd backend
node test-formula-registration-fix.js
```

这个脚本会测试WebSocket消息处理是否正确修复了连接状态检查问题。

### 2. 连接Caitlyn服务器

1. 打开前端界面 `http://localhost:5173`
2. 点击"Connect to Caitlyn"按钮
3. 输入Caitlyn服务器URL和认证token
4. 等待连接成功

### 3. 测试公式注册

#### 3.1 选择公式

1. 在左侧"Formulas"面板中选择一个公式（如"builtin-macd"）
2. 系统会自动填充公式代码到编辑器中
3. 可以修改公式代码（可选）

#### 3.2 注册公式

1. 点击蓝色的"Register Formula"按钮
2. 按钮会显示"Registering..."状态
3. 等待注册完成

#### 3.3 查看注册结果

**成功情况：**
- 在公式信息区域会显示绿色的UUID
- 控制台会输出注册成功的日志
- 按钮恢复为"Register Formula"状态

**失败情况：**
- 在公式信息区域会显示红色的错误信息
- 控制台会输出错误日志
- 按钮恢复为"Register Formula"状态

## 测试用例

### 测试用例1：正常注册

1. 选择"builtin-macd"公式
2. 点击"Register Formula"
3. 预期结果：显示UUID，注册成功

### 测试用例2：语法错误

1. 选择任意公式
2. 修改公式代码为无效语法（如：`invalid: syntax error;`）
3. 点击"Register Formula"
4. 预期结果：显示语法错误信息

### 测试用例3：网络错误

1. 断开Caitlyn服务器连接
2. 选择公式并点击"Register Formula"
3. 预期结果：显示连接错误信息

## 调试信息

### 控制台日志

注册过程中会在浏览器控制台输出以下日志：

```
Registering formula: {formulaId: -222, sourceCode: "...", languageId: 5}
🧮 Processing formula registration response: {...}
Formula registration successful: {uuid: "...", formulaId: -222}
```

### WebSocket消息

可以通过浏览器开发者工具的Network标签页查看WebSocket消息：

**发送消息：**
```json
{
  "type": "register_formula",
  "formulaId": -222,
  "sourceCode": "macd: macd(close, 12, 26, 9)...",
  "languageId": 5,
  "requestId": "register_1234567890"
}
```

**接收消息：**
```json
{
  "type": "register_formula_response",
  "success": true,
  "data": {
    "uuid": "generated-uuid-string",
    "formulaId": -222
  },
  "requestId": "register_1234567890"
}
```

## 预期行为

### 成功注册

- ✅ 按钮状态正确切换
- ✅ UUID正确显示
- ✅ 控制台日志正常
- ✅ 无错误信息显示

### 注册失败

- ✅ 按钮状态正确恢复
- ✅ 错误信息正确显示
- ✅ 控制台错误日志
- ✅ 用户友好的错误提示

## 故障排除

### 常见问题

1. **按钮无响应**
   - 检查是否选择了公式
   - 检查WebSocket连接状态
   - 查看控制台错误信息

2. **注册一直显示"Registering..."**
   - 检查后端服务是否运行
   - 检查Caitlyn服务器连接
   - 查看网络请求状态

3. **UUID显示异常**
   - 检查后端返回的数据格式
   - 查看WebSocket消息内容
   - 确认UUID字段名称

### 调试步骤

1. 打开浏览器开发者工具
2. 查看Console标签页的错误信息
3. 查看Network标签页的WebSocket连接
4. 检查后端日志输出
5. 验证Caitlyn服务器状态

## 测试完成后

测试完成后，可以：

1. **移除注册按钮** - 删除独立的注册按钮，只保留执行按钮
2. **集成到执行流程** - 将注册逻辑集成到执行流程中
3. **优化用户体验** - 根据测试结果优化界面和交互

## 相关文件

- `frontend-vue/src/components/FormulaViewer.vue` - 前端组件
- `backend/src/server.js` - 后端WebSocket处理
- `backend/src/utils/CaitlynClientConnection.js` - Caitlyn客户端连接
- `docs/FORMULA_DATA_DISPLAY_WORKFLOW.md` - 完整技术文档

# Connection Row 状态管理分析

## 概述

`connection-row` 是 `ConnectionControls.vue` 组件中的核心 UI 元素，负责显示和管理 WebSocket 连接状态。它使用 **Pinia Store** 进行状态管理，采用 **Vue 3 Composition API** 模式。

## 组件位置

- **组件文件**: `frontend-vue/src/components/ConnectionControls.vue`
- **Store 文件**: `frontend-vue/src/stores/websocketStore.ts`

---

## 状态列表

### 1. 核心连接状态（在 Store 中定义）

#### 1.1 基础连接状态
```typescript
// 基础状态变量（使用 ref）
const backendWs = ref<WebSocket | null>(null)           // WebSocket 实例
const isConnected = ref<boolean>(false)                   // 后端连接状态
const isConnecting = ref<boolean>(false)                 // 连接中状态
const error = ref<string | null>(null)                   // 错误信息
const caitlynConnected = ref<boolean>(false)             // Caitlyn 服务器连接状态
```

#### 1.2 连接配置状态
```typescript
const serverUrl = ref<string | null>(null)              // 服务器 URL
const authToken = ref<string | null>(null)               // 认证 Token
const clientId = ref<string | null>(null)                // 客户端 ID
const assignedConnectionId = ref<string | null>(null)     // 分配的连接 ID
```

#### 1.3 连接池状态
```typescript
const poolReady = ref<boolean>(false)                    // 连接池就绪状态
const poolStats = ref<PoolStats>({                       // 连接池统计
  totalConnections: 0,
  availableConnections: 0,
  busyConnections: 0
})
```

#### 1.4 缓存和种子数据状态
```typescript
const cachedSeeds = ref<Map<string, any>>(new Map())      // 缓存的种子数据
const lastSeedTimestamp = ref<number>(0)                  // 最后种子时间戳
```

#### 1.5 统计和消息状态
```typescript
const stats = ref<WebSocketStats>({                      // WebSocket 统计
  messagesSent: 0,
  messagesReceived: 0,
  errors: 0,
  lastMessageType: null,
  lastMessageTime: null,
  cachedSeedsCount: 0
})
const lastMessage = ref<WebSocketMessage | null>(null)   // 最后收到的消息
```

#### 1.6 内部引用状态
```typescript
const wsRef = ref<WebSocket | null>(null)                // WebSocket 引用（用于清理）
const hasAutoConnected = ref<boolean>(false)             // 是否已自动连接
```

### 2. 计算属性（Computed States）

#### 2.1 连接状态文本
```typescript
const connectionStatus = computed(() => {
  if (error.value) return 'Connection Error'
  if (isConnecting.value) return 'Connecting...'
  if (!isConnected.value) return 'Backend Disconnected'
  if (!caitlynConnected.value) return 'Caitlyn Disconnected'
  return 'Connected & Ready'
})
```

#### 2.2 连接详情文本
```typescript
const connectionDetails = computed(() => {
  if (error.value) return error.value
  if (isConnecting.value) return 'Establishing connection to backend'
  if (!isConnected.value) return 'Not connected to backend WebSocket'
  if (!caitlynConnected.value) return 'Backend connected, waiting for Caitlyn server'
  return 'Connected to backend and Caitlyn server'
})
```

### 3. 组件中使用的状态（ConnectionControls.vue）

组件通过 `storeToRefs` 获取响应式状态：

```typescript
const {
  isConnected,        // 后端连接状态
  caitlynConnected,   // Caitlyn 连接状态
  isConnecting,       // 连接中状态
  connectionStatus,   // 连接状态文本（计算属性）
  connectionDetails   // 连接详情文本（计算属性）
} = storeToRefs(wsStore)
```

---

## 状态实现方式

### 1. 状态管理架构

#### **Pinia Store (Composition API 模式)**
- 使用 `defineStore` 定义 store
- 使用 Vue 3 的 `ref` 和 `computed` 创建响应式状态
- 返回状态和操作方法

#### **组件状态绑定**
- 使用 `storeToRefs` 保持响应式（解构时保持响应性）
- 直接解构 actions（不需要响应式）

### 2. 状态更新方法（Actions）

#### 2.1 连接状态管理
```typescript
// 设置连接中状态
const setConnecting = () => {
  isConnecting.value = true
  isConnected.value = false
  error.value = null
}

// 设置已连接状态
const setConnected = () => {
  isConnected.value = true
  isConnecting.value = false
  error.value = null
}

// 设置断开连接状态
const setDisconnected = () => {
  isConnected.value = false
  isConnecting.value = false
  caitlynConnected.value = false
  backendWs.value = null
}
```

#### 2.2 Caitlyn 连接状态管理
```typescript
const setCaitlynConnected = () => {
  caitlynConnected.value = true
}

const setCaitlynDisconnected = () => {
  caitlynConnected.value = false
}
```

#### 2.3 错误状态管理
```typescript
const setError = (errorMessage: string) => {
  error.value = errorMessage
  isConnecting.value = false
  stats.value.errors++
}

const clearError = () => {
  error.value = null
}
```

#### 2.4 连接池状态管理
```typescript
const setPoolReady = () => {
  poolReady.value = true
  caitlynConnected.value = true  // 同时设置 Caitlyn 连接状态
}

const updatePoolStats = (newStats: Partial<PoolStats>) => {
  poolStats.value = { ...poolStats.value, ...newStats }
}
```

### 3. 主要连接操作

#### 3.1 连接到后端
```typescript
const connectToBackend = () => {
  // 1. 连接保护（防止重复连接）
  if (isConnecting.value || isConnected.value) return
  
  // 2. 设置连接中状态
  setConnecting()
  
  // 3. 创建 WebSocket 连接
  const ws = new WebSocket(backendUrl)
  
  // 4. 设置事件处理器
  ws.onopen = () => setConnected()
  ws.onerror = () => setError('Connection error')
  ws.onclose = () => setDisconnected()
  
  // 5. 处理消息
  ws.onmessage = (event) => handleBackendMessage(JSON.parse(event.data))
}
```

#### 3.2 断开连接
```typescript
const disconnectFromBackend = () => {
  if (wsRef.value) {
    wsRef.value.close(1000, 'User requested disconnect')
    wsRef.value = null
  }
  hasAutoConnected.value = false
  setDisconnected()
}
```

### 4. 状态流转图

```
初始状态
  ↓
[isConnected: false, isConnecting: false, caitlynConnected: false]
  ↓ (用户点击 Connect)
[isConnecting: true, isConnected: false]
  ↓ (WebSocket onopen)
[isConnected: true, isConnecting: false]
  ↓ (收到 connection_status 或 pool_ready)
[isConnected: true, caitlynConnected: true]
  ↓ (用户点击 Disconnect 或连接错误)
[isConnected: false, caitlynConnected: false]
```

---

## UI 状态绑定

### 1. 状态指示器（Status Dot）

```vue
<div class="status-dot" :class="{ connected: isConnected && caitlynConnected }"></div>
```

- **红色**（默认）: `!isConnected || !caitlynConnected`
- **绿色**（connected）: `isConnected && caitlynConnected`

### 2. 连接状态文本

```vue
<div class="connection-text">{{ connectionStatus }}</div>
<div class="connection-status">{{ connectionDetails }}</div>
```

显示计算属性 `connectionStatus` 和 `connectionDetails` 的值。

### 3. 按钮状态

```vue
<button
  :class="isConnected && caitlynConnected ? 'btn-danger' : 'btn-primary'"
  @click="handleAction"
  :disabled="isConnecting"
>
  {{ getButtonText() }}
</button>
```

**按钮文本逻辑**:
```typescript
const getButtonText = () => {
  if (!isConnected.value) return 'Connect'
  if (isConnected.value && !caitlynConnected.value) return 'Connecting...'
  return 'Disconnect'
}
```

**按钮样式**:
- `btn-primary` (蓝色): 未连接或连接中
- `btn-danger` (红色): 已完全连接（可断开）

**禁用状态**: `isConnecting === true`

### 4. 按钮点击处理

```typescript
const handleAction = () => {
  if (!isConnected.value) {
    connectToBackend()  // 开始连接
  } else if (isConnected.value && !caitlynConnected.value) {
    // 后端已连接，等待 Caitlyn（有超时处理）
  } else {
    disconnectFromBackend()  // 断开连接
  }
}
```

---

## 状态同步机制

### 1. WebSocket 消息处理

Store 通过 `handleBackendMessage` 处理来自后端的消息，更新相应状态：

```typescript
switch (message.type) {
  case 'connection_status':
    if (message.status === 'connected') {
      setCaitlynConnected()
    } else {
      setCaitlynDisconnected()
    }
    break
    
  case 'pool_ready':
    setPoolReady()  // 同时设置 poolReady 和 caitlynConnected
    break
    
  case 'error':
    setError(message.message)
    break
}
```

### 2. 自动连接机制

```typescript
const initializeConnection = () => {
  if (hasAutoConnected.value) return  // 防止重复自动连接
  hasAutoConnected.value = true
  setTimeout(() => {
    if (!isConnected.value && !isConnecting.value) {
      connectToBackend()
    }
  }, 100)
}
```

---

## 状态依赖关系

### 完整连接状态 = 后端连接 + Caitlyn 连接

```typescript
// 完整连接状态（UI 显示绿色）
const fullyConnected = isConnected.value && caitlynConnected.value

// 连接状态优先级
1. error → 'Connection Error'
2. isConnecting → 'Connecting...'
3. !isConnected → 'Backend Disconnected'
4. !caitlynConnected → 'Caitlyn Disconnected'
5. 全部就绪 → 'Connected & Ready'
```

---

## 总结

### 状态管理特点

1. **集中式管理**: 所有连接状态都在 `websocketStore` 中统一管理
2. **响应式**: 使用 Vue 3 `ref` 和 `computed` 实现响应式更新
3. **类型安全**: 使用 TypeScript 定义状态类型
4. **计算属性**: 使用 `computed` 派生 UI 显示文本
5. **状态保护**: 通过 guards 防止重复连接等异常状态

### 状态数量统计

- **基础状态变量**: 15+ 个
- **计算属性**: 2 个
- **状态更新方法**: 10+ 个
- **主要操作**: 3 个（connect, disconnect, reset）

### 实现方式

- **Store**: Pinia (Composition API)
- **响应式**: Vue 3 `ref` / `computed`
- **组件绑定**: `storeToRefs` + 直接解构 actions
- **状态更新**: 通过 actions 方法统一更新


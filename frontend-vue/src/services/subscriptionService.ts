import { ref } from 'vue'
import type { WebSocketMessage } from '@/types'

export interface SubscriptionConfig {
  markets: string[]
  codes: string[]
  qualifiedNames: string[]
  namespace: string
  options?: {
    formulaCode?: string
    granularity?: number
    [key: string]: any
  }
}

export interface SubscriptionInfo {
  id: string
  config: SubscriptionConfig
  status: 'pending' | 'active' | 'error' | 'cancelled'
  createdAt: Date
  lastDataReceived?: Date
  dataCount: number
  error?: string
}

export interface RealTimeData {
  market: string
  code: string
  timestamp: string
  metaName: string
  namespace: string
  fields: Record<string, any>
  subscriptionId: string
  receivedAt: string
}

class SubscriptionService {
  private subscriptions = ref<Map<string, SubscriptionInfo>>(new Map())
  private realTimeData = ref<Map<string, RealTimeData[]>>(new Map())
  private wsStore: any = null
  private nextRequestId = 1
  private pendingRequests = ref<Map<string, { resolve: (value: any) => void; reject: (error: any) => void; timeout?: number }>>(new Map())
  private unloadCleanup?: () => void

  // Computed properties
  get activeSubscriptions() {
    return Array.from(this.subscriptions.value.values()).filter(sub => sub.status === 'active')
  }

  get totalSubscriptions() {
    return this.subscriptions.value.size
  }

  get totalDataReceived() {
    return Array.from(this.realTimeData.value.values()).reduce((total, dataArray) => total + dataArray.length, 0)
  }

  // Initialize the service with WebSocket store
  initialize(wsStore: any): void {
    this.wsStore = wsStore
    console.log('📡 SubscriptionService initialized with WebSocket store')

    // 设置 WebSocket 消息监听
    this.setupWebSocketMessageHandler()

    // 设置页面销毁时的清理
    this.setupPageUnloadHandler()
  }

  // Generate unique request ID
  private generateRequestId(): string {
    return `sub_${Date.now()}_${this.nextRequestId++}`
  }

  // 设置 WebSocket 消息处理器
  private setupWebSocketMessageHandler(): void {
    if (!this.wsStore) {
      console.warn('⚠️ Cannot setup WebSocket message handler: wsStore not available')
      return
    }

    // 监听 WebSocket store 的消息变化
    this.wsStore.$subscribe((_mutation: any, state: any) => {
      const lastMessage = state.lastMessage
      if (!lastMessage) return

      this.handleWebSocketMessage(lastMessage)
    })
  }

  // 设置页面销毁时的清理处理器
  private setupPageUnloadHandler(): void {
    // 监听页面刷新/关闭事件
    const handleBeforeUnload = () => {
      console.log('🔄 Page unloading - cancelling all subscriptions...')
      this.cancelAllSubscriptionsSync()
    }

    // 只监听页面真正关闭/刷新，不监听可见性变化
    // 因为用户切换标签页或窗口失焦时不应该取消订阅

    // 注册事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('unload', handleBeforeUnload)

    // 保存清理函数，以便需要时可以移除监听器
    this.unloadCleanup = () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('unload', handleBeforeUnload)
    }
  }

  // 处理 WebSocket 消息
  private handleWebSocketMessage(message: WebSocketMessage): void {
    // 处理订阅确认消息 - 只在内存中处理，不调用实时数据回调
    if (message.type === 'subscription_confirmed') {
      if (message.requestId && this.pendingRequests.value.has(message.requestId)) {
        // 对于 subscribeWithCallback，这是订阅确认，不是实时数据
        // 只记录日志，不调用回调函数，因为用户期望的是实时数据回调
        console.log('✅ Subscription confirmed with callback setup:', message.subscriberId)

        // 更新订阅状态但不调用回调
        const subscription = Array.from(this.subscriptions.value.values())
          .find(sub => sub.status === 'pending')
        if (subscription) {
          subscription.status = 'active'
        }
      } else {
        // 查找对应的订阅（没有 requestId 的情况）
        const subscription = Array.from(this.subscriptions.value.values())
          .find(sub => sub.status === 'pending')

        if (subscription) {
          subscription.status = 'active'
          console.log('✅ Subscription confirmed via callback:', subscription.id)
        }
      }
      return
    }

    // 处理实时数据 - 如果包含 requestId，调用对应的回调函数
    if (message.type === 'real_time_data') {
      // 如果实时数据包含 requestId，且有对应的待处理请求，则调用其回调
      if (message.requestId && this.pendingRequests.value.has(message.requestId)) {
        const callback = this.pendingRequests.value.get(message.requestId)!

        // 调用回调函数传递实时数据，但不删除回调（除非明确取消订阅）
        callback.resolve(message)
      }

      // 同时也处理标准的实时数据流程
      this.handleRealTimeData(message)
      return
    }

    // 处理其他订阅相关的响应
    if (message.requestId && this.pendingRequests.value.has(message.requestId)) {
      const callback = this.pendingRequests.value.get(message.requestId)!

      if (message.success !== false && !message.error) {
        callback.resolve(message)
      } else {
        callback.reject(new Error(message.error || message.message || 'Unknown error'))
      }
      return
    }

    // 其他订阅确认消息已在上面处理

    // 处理取消订阅确认
    if (message.type === 'unsubscription_confirmed' && !message.requestId) {
      const subscription = Array.from(this.subscriptions.value.values())
        .find(sub => sub.id === message.subscriberId)
      
      if (subscription) {
        subscription.status = 'cancelled'
        console.log('✅ Unsubscription confirmed via callback:', subscription.id)
      }
      return
    }
  }

  // 发送消息并等待回调
  private sendMessageWithCallback(message: WebSocketMessage, timeout = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId()
      const messageWithId = {
        ...message,
        requestId
      }
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        this.pendingRequests.value.delete(requestId)
        reject(new Error(`Request timeout after ${timeout}ms`))
      }, timeout)
      
      // 存储回调
      this.pendingRequests.value.set(requestId, {
        resolve: (response: any) => {
          clearTimeout(timeoutId)
          this.pendingRequests.value.delete(requestId)
          resolve(response)
        },
        reject: (error: any) => {
          clearTimeout(timeoutId)
          this.pendingRequests.value.delete(requestId)
          reject(error)
        },
        timeout: timeoutId
      })
      
      // 发送消息
      this.wsStore.sendMessage(messageWithId)
    })
  }

  // Generate subscription key for deduplication
  private generateSubscriptionKey(config: SubscriptionConfig): string {
    const markets = Array.isArray(config.markets) ? config.markets.sort().join(',') : config.markets
    const codes = Array.isArray(config.codes) ? config.codes.sort().join(',') : config.codes
    const qualifiedNames = Array.isArray(config.qualifiedNames) ? config.qualifiedNames.sort().join(',') : config.qualifiedNames
    const options = config.options ? JSON.stringify(config.options) : ''
    
    return `${config.namespace}::${markets}::${codes}::${qualifiedNames}::${options}`
  }

  // Subscribe to real-time data with callback for real-time updates
  async subscribeWithCallback(config: SubscriptionConfig, realTimeCallback?: (data: any) => void): Promise<string> {
    if (!this.wsStore) {
      throw new Error('SubscriptionService not initialized')
    }

    if (!this.wsStore.isConnected) {
      throw new Error('Not connected to backend WebSocket')
    }

    const subscriptionKey = this.generateSubscriptionKey(config)
    const subscriptionId = this.generateRequestId()

    // Check if subscription already exists
    const existingSubscription = Array.from(this.subscriptions.value.values())
      .find(sub => this.generateSubscriptionKey(sub.config) === subscriptionKey)

    if (existingSubscription && existingSubscription.status === 'active') {
      console.log(`♻️ Reusing existing subscription: ${existingSubscription.id}`)
      return existingSubscription.id
    }

    // Create new subscription
    const subscriptionInfo: SubscriptionInfo = {
      id: subscriptionId,
      config,
      status: 'pending',
      createdAt: new Date(),
      dataCount: 0
    }

    this.subscriptions.value.set(subscriptionId, subscriptionInfo)
    this.realTimeData.value.set(subscriptionId, [])

    console.log(`📡 Creating new subscription with callback: ${subscriptionId}`, config)

    // Send subscription request using callback mechanism
    // 根据后端当前接口格式发送消息（后端暂未处理 namespace）
    const message: WebSocketMessage = {
      type: 'subscribe',
      markets: config.markets,
      codes: config.codes,
      qualifiedNames: config.qualifiedNames,
      options: config.options || {}
    }

    // Set up real-time callback if provided
    if (realTimeCallback) {
      const requestId = this.generateRequestId()
      const messageWithId = { ...message, requestId }

      // Store callback for real-time data (do not auto-clear, no timeout)
      this.pendingRequests.value.set(requestId, {
        resolve: realTimeCallback,
        reject: (error) => {
          console.error(`❌ Real-time callback error for ${subscriptionId}:`, error)
        }
      })

      // Send subscription with requestId (no timeout mechanism)
      this.wsStore.sendMessage(messageWithId)

      // 订阅状态在收到 subscription_confirmed 消息时更新
      console.log(`📡 Subscription request sent (no timeout): ${subscriptionId}`)
      return subscriptionId
    } else {
      // Standard subscription without real-time callback (keep existing behavior)
      try {
        const response = await this.sendMessageWithCallback(message, 10000)

        if (response.success !== false && !response.error) {
          subscriptionInfo.status = 'active'
          console.log(`✅ Subscription confirmed: ${subscriptionId}`)
        } else {
          subscriptionInfo.status = 'error'
          subscriptionInfo.error = response.error || 'Subscription failed'
          console.error(`❌ Subscription failed: ${subscriptionId}`, response.error)
        }
      } catch (error) {
        subscriptionInfo.status = 'error'
        subscriptionInfo.error = error instanceof Error ? error.message : 'Subscription timeout'
        console.error(`❌ Subscription error: ${subscriptionId}`, error)
      }

      return subscriptionId
    }
  }

  // Subscribe to real-time data
  async subscribe(config: SubscriptionConfig): Promise<string> {
    if (!this.wsStore) {
      throw new Error('SubscriptionService not initialized')
    }
    
    if (!this.wsStore.isConnected) {
      throw new Error('Not connected to backend WebSocket')
    }

    const subscriptionKey = this.generateSubscriptionKey(config)
    const subscriptionId = this.generateRequestId()

    // Check if subscription already exists
    const existingSubscription = Array.from(this.subscriptions.value.values())
      .find(sub => this.generateSubscriptionKey(sub.config) === subscriptionKey)

    if (existingSubscription && existingSubscription.status === 'active') {
      console.log(`♻️ Reusing existing subscription: ${existingSubscription.id}`)
      return existingSubscription.id
    }

    // Create new subscription
    const subscriptionInfo: SubscriptionInfo = {
      id: subscriptionId,
      config,
      status: 'pending',
      createdAt: new Date(),
      dataCount: 0
    }

    this.subscriptions.value.set(subscriptionId, subscriptionInfo)
    this.realTimeData.value.set(subscriptionId, [])

    console.log(`📡 Creating new subscription: ${subscriptionId}`, config)

    // Send subscription request using callback mechanism
    // 根据后端当前接口格式发送消息（后端暂未处理 namespace）
    const message: WebSocketMessage = {
      type: 'subscribe',
      markets: config.markets,
      codes: config.codes,
      qualifiedNames: config.qualifiedNames,
      options: config.options || {}
    }

    try {
      const response = await this.sendMessageWithCallback(message, 10000)

      if (response.success !== false && !response.error) {
        subscriptionInfo.status = 'active'
        console.log(`✅ Subscription confirmed: ${subscriptionId}`)
      } else {
        subscriptionInfo.status = 'error'
        subscriptionInfo.error = response.error || 'Subscription failed'
        console.error(`❌ Subscription failed: ${subscriptionId}`, response.error)
      }
    } catch (error) {
      subscriptionInfo.status = 'error'
      subscriptionInfo.error = error instanceof Error ? error.message : 'Subscription timeout'
      console.error(`❌ Subscription error: ${subscriptionId}`, error)
    }

    return subscriptionId
  }

  // Unsubscribe from real-time data
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    if (!this.wsStore) {
      throw new Error('SubscriptionService not initialized')
    }

    const subscription = this.subscriptions.value.get(subscriptionId)
    if (!subscription) {
      console.warn(`⚠️ Subscription not found: ${subscriptionId}`)
      return false
    }

    if (subscription.status === 'cancelled') {
      console.log(`ℹ️ Subscription already cancelled: ${subscriptionId}`)
      return true
    }

    console.log(`⏹️ Cancelling subscription: ${subscriptionId}`)

    // Clear any pending real-time callbacks for this subscription
    // We need to find and remove callbacks that match this subscription
    const requestsToRemove: string[] = []
    this.pendingRequests.value.forEach((_callback, requestId) => {
      // This is a simple approach - in a more complex system,
      // we might need to track requestId -> subscriptionId mapping
      if (requestId.includes(subscriptionId)) {
        requestsToRemove.push(requestId)
      }
    })

    requestsToRemove.forEach(requestId => {
      this.pendingRequests.value.delete(requestId)
      console.log(`🧹 Cleared callback for requestId: ${requestId}`)
    })

    // Send unsubscribe request using callback mechanism
    const message: WebSocketMessage = {
      type: 'unsubscribe',
      subscriberId: subscriptionId
    }

    try {
      const response = await this.sendMessageWithCallback(message, 5000)

      if (response.success !== false && !response.error) {
        subscription.status = 'cancelled'
        console.log(`✅ Unsubscription confirmed: ${subscriptionId}`)
        return true
      } else {
        console.error(`❌ Unsubscription failed: ${subscriptionId}`, response.error)
        return false
      }
    } catch (error) {
      console.error(`❌ Unsubscription error: ${subscriptionId}`, error)
      // 即使出错也标记为已取消，避免重复尝试
      subscription.status = 'cancelled'
      return false
    }
  }

  // Handle real-time data from backend
  private handleRealTimeData(message: WebSocketMessage) {
    const { data, subscriberId, timestamp } = message

    if (!subscriberId || !data) {
      console.error('❌ Real-time data missing subscriberId or data')
      return
    }

    const subscription = this.subscriptions.value.get(subscriberId)
    if (!subscription) {
      console.warn(`⚠️ Subscription not found for real-time data:`, subscriberId)
      return
    }

    if (subscription.status !== 'active') {
      console.warn(`⚠️ Received data for inactive subscription: ${subscriberId}`)
      return
    }

    // Process real-time data
    const dataArray = Array.isArray(data) ? data : [data]
    const processedData: RealTimeData[] = dataArray.map((record: any) => ({
      market: record.market || 'unknown',
      code: record.code || 'unknown',
      timestamp: record.timestamp || new Date().toISOString(),
      metaName: record.metaName || 'unknown',
      namespace: record.namespace || 'global',
      fields: record.fields || {},
      subscriptionId: subscriberId,
      receivedAt: timestamp || new Date().toISOString()
    }))

    // Store real-time data
    const existingData = this.realTimeData.value.get(subscriberId) || []
    this.realTimeData.value.set(subscriberId, [...existingData, ...processedData])

    // Update subscription info
    subscription.lastDataReceived = new Date()
    subscription.dataCount += processedData.length

    console.log(`📡 Real-time data received for subscription ${subscriberId}:`, {
      recordCount: processedData.length,
      totalDataCount: subscription.dataCount
    })

    // Emit custom event for components to listen
    window.dispatchEvent(new CustomEvent('realTimeDataReceived', {
      detail: {
        subscriptionId: subscriberId,
        data: processedData,
        subscription: subscription
      }
    }))
  }

  // Get subscription info
  getSubscription(subscriptionId: string): SubscriptionInfo | undefined {
    return this.subscriptions.value.get(subscriptionId)
  }

  // Get real-time data for a subscription
  getRealTimeData(subscriptionId: string): RealTimeData[] {
    return this.realTimeData.value.get(subscriptionId) || []
  }

  // Get all real-time data
  getAllRealTimeData(): Map<string, RealTimeData[]> {
    return this.realTimeData.value
  }

  // Clear real-time data for a subscription
  clearRealTimeData(subscriptionId: string): void {
    this.realTimeData.value.set(subscriptionId, [])
    const subscription = this.subscriptions.value.get(subscriptionId)
    if (subscription) {
      subscription.dataCount = 0
    }
  }

  // Clear all real-time data
  clearAllRealTimeData(): void {
    this.realTimeData.value.clear()
    this.subscriptions.value.forEach(subscription => {
      subscription.dataCount = 0
    })
  }

  // Cancel all subscriptions
  async cancelAllSubscriptions(): Promise<void> {
    const activeSubscriptions = Array.from(this.subscriptions.value.values())
      .filter(sub => sub.status === 'active')

    const unsubscribePromises = activeSubscriptions.map(sub => this.unsubscribe(sub.id))
    await Promise.all(unsubscribePromises)
  }

  // Cancel all subscriptions synchronously (for page unload)
  private cancelAllSubscriptionsSync(): void {
    const activeSubscriptions = Array.from(this.subscriptions.value.values())
      .filter(sub => sub.status === 'active')

    console.log(`🧹 Cancelling ${activeSubscriptions.length} active subscriptions synchronously`)

    // 清理所有待处理的回调
    this.pendingRequests.value.clear()

    // 发送取消订阅消息（同步，不等待响应）
    activeSubscriptions.forEach(sub => {
      if (this.wsStore && this.wsStore.isConnected) {
        try {
          this.wsStore.sendMessage({
            type: 'unsubscribe',
            subscriberId: sub.id
          })
          sub.status = 'cancelled'
          console.log(`📤 Sent unsubscribe for: ${sub.id}`)
        } catch (error) {
          console.warn(`⚠️ Failed to send unsubscribe for ${sub.id}:`, error)
          sub.status = 'cancelled' // 仍然标记为已取消
        }
      } else {
        sub.status = 'cancelled'
        console.log(`🔌 WebSocket not connected, marked as cancelled: ${sub.id}`)
      }
    })

    // 清理所有数据
    this.realTimeData.value.clear()
    console.log('✅ All subscriptions cancelled and data cleared')
  }

  // Get subscription statistics
  getStatistics() {
    const subscriptions = Array.from(this.subscriptions.value.values())
    
    return {
      total: subscriptions.length,
      active: subscriptions.filter(sub => sub.status === 'active').length,
      pending: subscriptions.filter(sub => sub.status === 'pending').length,
      error: subscriptions.filter(sub => sub.status === 'error').length,
      cancelled: subscriptions.filter(sub => sub.status === 'cancelled').length,
      totalDataReceived: this.totalDataReceived,
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        status: sub.status,
        createdAt: sub.createdAt,
        lastDataReceived: sub.lastDataReceived,
        dataCount: sub.dataCount,
        error: sub.error,
        config: {
          markets: sub.config.markets,
          codes: sub.config.codes,
          qualifiedNames: sub.config.qualifiedNames,
          namespace: sub.config.namespace
        }
      }))
    }
  }

  // Clean up old data (keep only last N records per subscription)
  cleanupOldData(maxRecordsPerSubscription: number = 1000): void {
    this.realTimeData.value.forEach((dataArray, subscriptionId) => {
      if (dataArray.length > maxRecordsPerSubscription) {
        const trimmedData = dataArray.slice(-maxRecordsPerSubscription)
        this.realTimeData.value.set(subscriptionId, trimmedData)
        
        const subscription = this.subscriptions.value.get(subscriptionId)
        if (subscription) {
          subscription.dataCount = trimmedData.length
        }
      }
    })
  }

  // Clean up pending requests and event listeners
  cleanup(): void {
    // 取消所有活动订阅
    this.cancelAllSubscriptionsSync()

    // 清理所有待处理的请求
    this.pendingRequests.value.forEach((callback) => {
      callback.reject(new Error('Service cleanup'))
    })
    this.pendingRequests.value.clear()

    // 清理页面事件监听器
    if (this.unloadCleanup) {
      this.unloadCleanup()
      this.unloadCleanup = undefined
    }

    console.log('🧹 SubscriptionService cleaned up completely')
  }
}

// Create singleton instance
export const subscriptionService = new SubscriptionService()

// Export the class for testing
export { SubscriptionService }

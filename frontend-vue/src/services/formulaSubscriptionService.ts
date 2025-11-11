import { ref } from 'vue'
import { websocketTaskService } from './websocketTaskService'

export interface FormulaSubscriptionConfig {
  formulaId: number
  formulaName: string
  formulaCode: string
  market: string
  code: string
  granularity: number
  namespace?: string
  languageId?: number
  // 注册后获得的UUID
  registeredUuid?: string
}

export interface FormulaSubscriptionInfo {
  uuid: string
  config: FormulaSubscriptionConfig
  status: 'pending' | 'active' | 'error' | 'cancelled'
  createdAt: Date
  lastDataReceived?: Date
  dataCount: number
  error?: string
  subscriberId?: string  // 保存 server 返回的 subscriberId
}

export interface FormulaRealTimeData {
  time_tag: string | number
  timestamp: string
  fields: Record<string, any>
  subscriptionId: string
  receivedAt: string
}

class FormulaSubscriptionService {
  private subscriptions = ref<Map<string, FormulaSubscriptionInfo>>(new Map())
  private realTimeData = ref<Map<string, FormulaRealTimeData[]>>(new Map())
  private nextRequestId = 1
  // Callback registry: requestId -> callback function
  private callbacks = new Map<string, (data: any) => void>()
  private wsStore: any = null

  // 生成唯一请求ID
  private generateRequestId(): string {
    return `formula_sub_${Date.now()}_${this.nextRequestId++}`
  }

  // 生成订阅键用于去重
  private generateSubscriptionKey(config: FormulaSubscriptionConfig): string {
    return `${config.market}::${config.code}::${config.formulaName}::${config.granularity}`
  }

  // 注册公式 (REG) - 第一步
  async registerFormula(config: FormulaSubscriptionConfig): Promise<string> {
    console.log(`📝 Registering formula: ${config.formulaName}`, config)

    try {
      const registerResponse = await websocketTaskService.sendTask({
        type: "register_formula",
        formulaId: config.formulaId,
        sourceCode: config.formulaCode,
        languageId: config.languageId || 5
      }, {
        timeout: 15000,
        retries: 1,
        retryDelay: 2000
      })

      if (!registerResponse.success) {
        throw new Error(registerResponse.error || 'Formula registration failed')
      }

      const registeredUuid = registerResponse.data?.uuid
      if (!registeredUuid) {
        throw new Error('No UUID returned from formula registration')
      }

      console.log(`✅ Formula registered successfully: ${registeredUuid}`)
      return registeredUuid
    } catch (error) {
      console.error(`❌ Formula registration failed:`, error)
      throw error
    }
  }

  // 执行公式 (CAL_FORMULA) - 第二步
  async executeFormula(config: FormulaSubscriptionConfig, registeredUuid: string, domain: number[]): Promise<any> {
    console.log(`⚡ Executing formula: ${config.formulaName}`, { registeredUuid, domain })

    try {
      const executeResponse = await websocketTaskService.sendTask({
        type: "execute_formula",
        uuid: registeredUuid,                    // 使用注册时获得的UUID
        market: config.market,
        code: config.code,
        granularity: config.granularity,
        begin_time: domain[0],
        end_time: domain[domain.length - 1] + 1,
        is_real_time: 1                          // 启用实时模式
      }, {
        timeout: 30000,
        retries: 1,
        retryDelay: 3000
      })

      if (!executeResponse.success) {
        throw new Error(executeResponse.error || 'Formula execution failed')
      }

      console.log(`✅ Formula executed successfully: ${config.formulaName}`)
      return executeResponse.data
    } catch (error) {
      console.error(`❌ Formula execution failed:`, error)
      throw error
    }
  }

  // 订阅公式 (SUBSCRIBE) - 第三步，支持callback
  async subscribeFormula(config: FormulaSubscriptionConfig, registeredUuid: string, callback?: (data: any) => void): Promise<string> {
    const subscriptionKey = this.generateSubscriptionKey(config)
    const requestId = this.generateRequestId()

    // 检查是否已存在相同订阅
    const existingSubscription = Array.from(this.subscriptions.value.values())
      .find(sub => this.generateSubscriptionKey(sub.config) === subscriptionKey)

    if (existingSubscription && existingSubscription.status === 'active') {
      console.log(`♻️ Reusing existing formula subscription: ${existingSubscription.uuid}`)
      return existingSubscription.uuid
    }

    // 创建新订阅
    const subscriptionInfo: FormulaSubscriptionInfo = {
      uuid: requestId,
      config: { ...config, registeredUuid },
      status: 'pending',
      createdAt: new Date(),
      dataCount: 0
    }

    this.subscriptions.value.set(requestId, subscriptionInfo)
    this.realTimeData.value.set(requestId, [])

    console.log(`📡 Creating new formula subscription: ${requestId}`, config)

    // 如果提供了callback，注册到callbacks Map
    if (callback) {
      this.callbacks.set(requestId, callback)
      console.log(`📝 Registered callback for subscription: ${requestId}`)
    }

    try {
      // 使用硬编码的订阅参数（参考 wb-subscribe.service.ts）
      console.log('formula uuid:', registeredUuid)
      const subscribeResponse = await websocketTaskService.sendTask({
        type: "subscribe",
        markets: ["STRATEGY"],                           // 硬编码
        codes: [registeredUuid],                         // 使用注册时获得的UUID
        qualifiedNames: ["Formula::Data"],               // 硬编码（包含namespace前缀）
        options: {
          granularities: [config.granularity],           // 使用配置中的粒度值（实时订阅应为0）
          fields: ["formula_res"],                       // 公式结果字段
          start: 0,                                      // 硬编码
          end: 50,                                       // 硬编码
          sort: [],                                      // 硬编码
          direction: [],                                 // 硬编码
          filters: []                                    // 硬编码
        }
      }, {
        timeout: 10000,
        retries: 0,
        retryDelay: 1000
      })

      // 检查订阅是否成功 - 支持两种响应格式
      if (subscribeResponse.type === 'subscription_confirmed' || subscribeResponse.success) {
        // 从 subscription_confirmed 响应中获取 subscriberId
        const subscribeUuid = subscribeResponse.subscriberId || subscribeResponse.data?.uuid
        if (subscribeUuid) {
          subscriptionInfo.status = 'active'
          subscriptionInfo.uuid = subscribeUuid           // 更新为订阅UUID
          subscriptionInfo.subscriberId = subscribeUuid   // 保存 subscriberId 用于取消订阅

          // 将subscription从旧key移动到新key（使用subscriberId作为key）
          this.subscriptions.value.delete(requestId)
          this.subscriptions.value.set(subscribeUuid, subscriptionInfo)
          console.log(`🔄 Moved subscription from ${requestId} to ${subscribeUuid}`)

          // 将realTimeData也移动到新key
          const existingData = this.realTimeData.value.get(requestId) || []
          this.realTimeData.value.delete(requestId)
          this.realTimeData.value.set(subscribeUuid, existingData)

          // 如果有callback，将其移动到新的subscriberId下
          if (callback) {
            this.callbacks.delete(requestId)
            this.callbacks.set(subscribeUuid, callback)
            console.log(`📝 Moved callback to subscriberId: ${subscribeUuid}`)
          }

          console.log(`✅ Formula subscription confirmed: ${subscribeUuid}`)
          return subscribeUuid
        } else {
          throw new Error('No subscription UUID returned')
        }
      } else {
        subscriptionInfo.status = 'error'
        subscriptionInfo.error = subscribeResponse.error || 'Formula subscription failed'
        console.error(`❌ Formula subscription failed: ${requestId}`, subscribeResponse.error)

        // 清理callback
        if (callback) {
          this.callbacks.delete(requestId)
        }

        throw new Error(subscriptionInfo.error)
      }
    } catch (error) {
      subscriptionInfo.status = 'error'
      subscriptionInfo.error = error instanceof Error ? error.message : 'Subscription timeout'
      console.error(`❌ Formula subscription error: ${requestId}`, error)

      // 清理callback
      if (callback) {
        this.callbacks.delete(requestId)
      }

      throw error
    }
  }

  // 简化的公式订阅流程 - 直接订阅（需要预先注册好的UUID）
  async subscribe(config: FormulaSubscriptionConfig, callback?: (data: any) => void): Promise<string> {
    try {
      // 验证是否有注册UUID
      if (!config.registeredUuid) {
        throw new Error('Formula must be registered first. No UUID found in config.')
      }

      console.log(`📡 Subscribing to formula with UUID: ${config.registeredUuid}`)

      // 直接订阅公式实时数据
      const subscribeUuid = await this.subscribeFormula(config, config.registeredUuid, callback)

      return subscribeUuid
    } catch (error) {
      console.error(`❌ Formula subscription failed:`, error)
      throw error
    }
  }

  // 取消订阅
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.value.get(subscriptionId)
    if (!subscription) {
      console.warn(`⚠️ Formula subscription not found: ${subscriptionId}`)
      return false
    }

    if (subscription.status === 'cancelled') {
      console.log(`ℹ️ Formula subscription already cancelled: ${subscriptionId}`)
      return true
    }

    console.log(`⏹️ Cancelling formula subscription: ${subscriptionId}`)

    // 清理callback
    this.callbacks.delete(subscriptionId)
    this.callbacks.delete(subscription.subscriberId || '')
    console.log(`🧹 Cleared callback for subscription: ${subscriptionId}`)

    try {
      // 发送取消订阅请求，使用正确的 subscriberId
      const response = await websocketTaskService.sendTask({
        type: 'unsubscribe',
        subscriberId: subscription.subscriberId || subscriptionId
      }, {
        timeout: 5000,
        retries: 1,
        retryDelay: 1000
      })

      if (response.type === 'unsubscription_confirmed' || response.success) {
        subscription.status = 'cancelled'
        console.log(`✅ Formula unsubscription confirmed: ${subscriptionId}`)
        return true
      } else {
        console.error(`❌ Formula unsubscription failed: ${subscriptionId}`, response.error)
        return false
      }
    } catch (error) {
      console.error(`❌ Formula unsubscription error: ${subscriptionId}`, error)
      // 即使出错也标记为已取消
      subscription.status = 'cancelled'
      return false
    }
  }

  // 处理公式实时数据推送
  handleFormulaData(subscriptionId: string, data: any[]): void {
    const subscription = this.subscriptions.value.get(subscriptionId)
    if (!subscription) {
      console.warn(`⚠️ Formula subscription not found for data: ${subscriptionId}`)
      return
    }

    if (subscription.status !== 'active') {
      console.warn(`⚠️ Received data for inactive formula subscription: ${subscriptionId}`)
      return
    }

    // 处理实时数据
    const processedData: FormulaRealTimeData[] = data.map((record: any) => ({
      time_tag: record.time_tag || record.timestamp,
      timestamp: record.timestamp ? 
        new Date(parseInt(record.timestamp)).toISOString() : 
        new Date().toISOString(),
      fields: record.fields || record,
      subscriptionId: subscriptionId,
      receivedAt: new Date().toISOString()
    }))

    // 存储实时数据
    const existingData = this.realTimeData.value.get(subscriptionId) || []
    this.realTimeData.value.set(subscriptionId, [...existingData, ...processedData])

    // 更新订阅信息
    subscription.lastDataReceived = new Date()
    subscription.dataCount += processedData.length

    console.log(`📡 Formula real-time data received for subscription ${subscriptionId}:`, {
      recordCount: processedData.length,
      totalDataCount: subscription.dataCount
    })

    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('formulaRealTimeDataReceived', {
      detail: {
        subscriptionId: subscriptionId,
        data: processedData,
        subscription: subscription
      }
    }))
  }

  // 处理WebSocket推送的实时数据
  handleWebSocketPushData(message: any): void {
    const { subscriberId, data, timestamp } = message

    if (!subscriberId && !data) {
      console.error('❌ Formula real-time data missing subscriberId or data')
      return
    }

    // 查找对应的订阅
    const subscription = Array.from(this.subscriptions.value.values())
      .find(sub => sub.uuid === subscriberId || sub.subscriberId === subscriberId)

    if (!subscription) {
      console.warn(`⚠️ Formula subscription not found for subscriberId: ${subscriberId}`)
      return
    }

    if (subscription.status !== 'active') {
      console.warn(`⚠️ Received data for inactive formula subscription: ${subscriberId}`)
      return
    }

    // 处理推送数据
    const dataArray = Array.isArray(data) ? data : [data]
    const processedData: FormulaRealTimeData[] = dataArray.map((record: any) => ({
      time_tag: record.time_tag || record.timestamp,
      timestamp: record.timestamp ?
        new Date(parseInt(record.timestamp)).toISOString() :
        new Date().toISOString(),
      fields: record.fields || record,
      subscriptionId: subscriberId,
      receivedAt: timestamp || new Date().toISOString()
    }))

    // 存储实时数据 - 使用 unshift 将新数据放到数组开头
    const existingData = this.realTimeData.value.get(subscriberId) || []
    this.realTimeData.value.set(subscriberId, [...processedData, ...existingData])

    // 更新订阅信息
    subscription.lastDataReceived = new Date()
    subscription.dataCount += processedData.length

    console.log(`📡 Formula WebSocket push data received for subscription ${subscriberId}:`, {
      recordCount: processedData.length,
      totalDataCount: subscription.dataCount
    })

    // 调用注册的callback（如果存在）
    const callback = this.callbacks.get(subscriberId) || this.callbacks.get(subscription.uuid)
    if (callback) {
      try {
        callback(message)
        console.log(`✅ Callback executed for subscription: ${subscriberId}`)
      } catch (error) {
        console.error(`❌ Error executing callback for subscription ${subscriberId}:`, error)
      }
    }

    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('formulaRealTimeDataReceived', {
      detail: {
        subscriptionId: subscriberId,
        data: processedData,
        subscription: subscription
      }
    }))
  }

  // 获取订阅信息
  getSubscription(subscriptionId: string): FormulaSubscriptionInfo | undefined {
    return this.subscriptions.value.get(subscriptionId)
  }

  // 获取实时数据
  getRealTimeData(subscriptionId: string): FormulaRealTimeData[] {
    return this.realTimeData.value.get(subscriptionId) || []
  }

  // 获取所有实时数据
  getAllRealTimeData(): Map<string, FormulaRealTimeData[]> {
    return this.realTimeData.value
  }

  // 清理实时数据
  clearRealTimeData(subscriptionId: string): void {
    this.realTimeData.value.set(subscriptionId, [])
    const subscription = this.subscriptions.value.get(subscriptionId)
    if (subscription) {
      subscription.dataCount = 0
    }
  }

  // 清理所有实时数据
  clearAllRealTimeData(): void {
    this.realTimeData.value.clear()
    this.subscriptions.value.forEach(subscription => {
      subscription.dataCount = 0
    })
  }

  // 取消所有订阅
  async cancelAllSubscriptions(): Promise<void> {
    const activeSubscriptions = Array.from(this.subscriptions.value.values())
      .filter(sub => sub.status === 'active')

    const unsubscribePromises = activeSubscriptions.map(sub => this.unsubscribe(sub.uuid))
    await Promise.all(unsubscribePromises)
  }

  // 获取订阅统计
  getStatistics() {
    const subscriptions = Array.from(this.subscriptions.value.values())
    
    return {
      total: subscriptions.length,
      active: subscriptions.filter(sub => sub.status === 'active').length,
      pending: subscriptions.filter(sub => sub.status === 'pending').length,
      error: subscriptions.filter(sub => sub.status === 'error').length,
      cancelled: subscriptions.filter(sub => sub.status === 'cancelled').length,
      totalDataReceived: Array.from(this.realTimeData.value.values())
        .reduce((total, dataArray) => total + dataArray.length, 0),
      subscriptions: subscriptions.map(sub => ({
        uuid: sub.uuid,
        status: sub.status,
        createdAt: sub.createdAt,
        lastDataReceived: sub.lastDataReceived,
        dataCount: sub.dataCount,
        error: sub.error,
        config: {
          formulaName: sub.config.formulaName,
          market: sub.config.market,
          code: sub.config.code,
          granularity: sub.config.granularity
        }
      }))
    }
  }

  // 清理旧数据
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

  // 初始化WebSocket消息处理
  initializeWebSocketHandlers(wsStore: any): (() => void) | undefined {
    if (!wsStore) {
      console.warn('⚠️ Cannot initialize WebSocket handlers: wsStore not provided')
      return undefined
    }

    this.wsStore = wsStore
    console.log('📡 FormulaSubscriptionService initialized with WebSocket store')

    // 监听WebSocket消息
    const unwatch = wsStore.$subscribe((_mutation: any, state: any) => {
      const lastMessage = state.lastMessage
      if (!lastMessage) return

      switch (lastMessage.type) {
        case 'real_time_data':
          // subscriberId is at top level from server.js
          if (lastMessage.subscriberId && lastMessage.data) {
            this.handleWebSocketPushData({
              subscriberId: lastMessage.subscriberId,
              data: lastMessage.data,
              timestamp: lastMessage.data.timestamp || lastMessage.timestamp
            })
          }
          break
        case 'formula_push':
        case 'formula_push_data':
          // Direct formula push data
          this.handleWebSocketPushData({
            subscriberId: lastMessage.subscriberId,
            data: lastMessage,
            timestamp: lastMessage.timestamp
          })
          break
      }
    })

    // 返回清理函数
    return unwatch
  }

  // 批量取消所有公式订阅
  async unsubscribeAllFormulas(): Promise<void> {
    const activeSubscriptions = Array.from(this.subscriptions.value.values())
      .filter(sub => sub.status === 'active')

    console.log(`⏹️ Cancelling ${activeSubscriptions.length} formula subscriptions`)

    const unsubscribePromises = activeSubscriptions.map(sub => this.unsubscribe(sub.uuid))
    await Promise.all(unsubscribePromises)

    console.log(`✅ All formula subscriptions cancelled`)
  }

  // 获取活跃的公式订阅列表
  getActiveFormulaSubscriptions(): FormulaSubscriptionInfo[] {
    return Array.from(this.subscriptions.value.values())
      .filter(sub => sub.status === 'active')
  }

  // 根据公式名称查找订阅
  findSubscriptionByFormulaName(formulaName: string): FormulaSubscriptionInfo | undefined {
    return Array.from(this.subscriptions.value.values())
      .find(sub => sub.config.formulaName === formulaName && sub.status === 'active')
  }

  // 根据市场代码查找订阅
  findSubscriptionsByMarket(market: string, code: string): FormulaSubscriptionInfo[] {
    return Array.from(this.subscriptions.value.values())
      .filter(sub => 
        sub.config.market === market && 
        sub.config.code === code && 
        sub.status === 'active'
      )
  }
}

// 创建单例实例
export const formulaSubscriptionService = new FormulaSubscriptionService()

// 导出类用于测试
export { FormulaSubscriptionService }

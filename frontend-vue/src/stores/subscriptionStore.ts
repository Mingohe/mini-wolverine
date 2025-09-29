import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { subscriptionService, type SubscriptionInfo, type RealTimeData, type SubscriptionConfig } from '@/services/subscriptionService'
import { useWebSocketStore } from './websocketStore'

export const useSubscriptionStore = defineStore('subscription', () => {
  // State
  const subscriptions = ref<Map<string, SubscriptionInfo>>(new Map())
  const realTimeData = ref<Map<string, RealTimeData[]>>(new Map())
  const isInitialized = ref<boolean>(false)
  const lastError = ref<string | null>(null)

  // Computed
  const activeSubscriptions = computed(() => {
    return Array.from(subscriptions.value.values()).filter(sub => sub.status === 'active')
  })

  const totalSubscriptions = computed(() => {
    return subscriptions.value.size
  })

  const totalDataReceived = computed(() => {
    return Array.from(realTimeData.value.values()).reduce((total, dataArray) => total + dataArray.length, 0)
  })

  const subscriptionStatistics = computed(() => {
    const allSubscriptions = Array.from(subscriptions.value.values())
    
    return {
      total: allSubscriptions.length,
      active: allSubscriptions.filter(sub => sub.status === 'active').length,
      pending: allSubscriptions.filter(sub => sub.status === 'pending').length,
      error: allSubscriptions.filter(sub => sub.status === 'error').length,
      cancelled: allSubscriptions.filter(sub => sub.status === 'cancelled').length,
      totalDataReceived: totalDataReceived.value
    }
  })

  // Actions
  const initialize = () => {
    if (isInitialized.value) {
      console.log('📡 Subscription store already initialized')
      return
    }

    console.log('📡 Initializing subscription store...')
    
    // Initialize subscription service with WebSocket store
    const wsStore = useWebSocketStore()
    subscriptionService.initialize(wsStore)
    
    // Set up periodic cleanup
    const cleanupInterval = setInterval(() => {
      subscriptionService.cleanupOldData(1000) // Keep last 1000 records per subscription
    }, 60000) // Clean up every minute

    // Listen for real-time data events
    const handleRealTimeData = (event: CustomEvent) => {
      const { subscriptionId, data, subscription } = event.detail
      
      // Update local state
      const existingData = realTimeData.value.get(subscriptionId) || []
      realTimeData.value.set(subscriptionId, [...existingData, ...data])
      
      // Update subscription info
      subscriptions.value.set(subscriptionId, subscription)
    }

    window.addEventListener('realTimeDataReceived', handleRealTimeData as EventListener)

    // Store cleanup function
    const cleanup = () => {
      clearInterval(cleanupInterval)
      window.removeEventListener('realTimeDataReceived', handleRealTimeData as EventListener)
      subscriptionService.cleanup()
    }

    isInitialized.value = true
    console.log('✅ Subscription store initialized')

    return cleanup
  }

  const subscribe = async (config: SubscriptionConfig): Promise<string> => {
    try {
      lastError.value = null
      
      const subscriptionId = await subscriptionService.subscribe(config)
      
      // Get subscription info from service
      const subscriptionInfo = subscriptionService.getSubscription(subscriptionId)
      if (subscriptionInfo) {
        subscriptions.value.set(subscriptionId, subscriptionInfo)
      }
      
      console.log(`📡 Subscription created: ${subscriptionId}`)
      return subscriptionId
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown subscription error'
      lastError.value = errorMessage
      console.error('❌ Subscription failed:', errorMessage)
      throw error
    }
  }

  const unsubscribe = async (subscriptionId: string): Promise<boolean> => {
    try {
      lastError.value = null
      
      const success = await subscriptionService.unsubscribe(subscriptionId)
      
      if (success) {
        // Update local subscription status
        const subscription = subscriptions.value.get(subscriptionId)
        if (subscription) {
          subscription.status = 'cancelled'
          subscriptions.value.set(subscriptionId, subscription)
        }
        
        console.log(`⏹️ Subscription cancelled: ${subscriptionId}`)
      }
      
      return success
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown unsubscription error'
      lastError.value = errorMessage
      console.error('❌ Unsubscription failed:', errorMessage)
      throw error
    }
  }

  const getSubscription = (subscriptionId: string): SubscriptionInfo | undefined => {
    return subscriptions.value.get(subscriptionId)
  }

  const getRealTimeData = (subscriptionId: string): RealTimeData[] => {
    return realTimeData.value.get(subscriptionId) || []
  }

  const getAllRealTimeData = (): Map<string, RealTimeData[]> => {
    return realTimeData.value
  }

  const clearRealTimeData = (subscriptionId: string): void => {
    realTimeData.value.set(subscriptionId, [])
    subscriptionService.clearRealTimeData(subscriptionId)
    
    // Update subscription data count
    const subscription = subscriptions.value.get(subscriptionId)
    if (subscription) {
      subscription.dataCount = 0
      subscriptions.value.set(subscriptionId, subscription)
    }
  }

  const clearAllRealTimeData = (): void => {
    realTimeData.value.clear()
    subscriptionService.clearAllRealTimeData()
    
    // Update all subscription data counts
    subscriptions.value.forEach((subscription, subscriptionId) => {
      subscription.dataCount = 0
      subscriptions.value.set(subscriptionId, subscription)
    })
  }

  const cancelAllSubscriptions = async (): Promise<void> => {
    try {
      lastError.value = null
      
      await subscriptionService.cancelAllSubscriptions()
      
      // Update local subscription statuses
      subscriptions.value.forEach((subscription, subscriptionId) => {
        if (subscription.status === 'active') {
          subscription.status = 'cancelled'
          subscriptions.value.set(subscriptionId, subscription)
        }
      })
      
      console.log('⏹️ All subscriptions cancelled')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error cancelling subscriptions'
      lastError.value = errorMessage
      console.error('❌ Failed to cancel all subscriptions:', errorMessage)
      throw error
    }
  }

  const getStatistics = () => {
    return subscriptionService.getStatistics()
  }

  const refreshSubscriptionData = () => {
    // Sync with subscription service
    const serviceStats = subscriptionService.getStatistics()
    
    // Update local subscriptions
    serviceStats.subscriptions.forEach(serviceSub => {
      const localSub = subscriptions.value.get(serviceSub.id)
      if (localSub) {
        // Update local subscription with service data
        localSub.status = serviceSub.status
        localSub.dataCount = serviceSub.dataCount
        localSub.lastDataReceived = serviceSub.lastDataReceived
        localSub.error = serviceSub.error
        subscriptions.value.set(serviceSub.id, localSub)
      } else {
        // Add new subscription from service
        subscriptions.value.set(serviceSub.id, {
          id: serviceSub.id,
          config: serviceSub.config as SubscriptionConfig,
          status: serviceSub.status,
          createdAt: new Date(serviceSub.createdAt),
          lastDataReceived: serviceSub.lastDataReceived ? new Date(serviceSub.lastDataReceived) : undefined,
          dataCount: serviceSub.dataCount,
          error: serviceSub.error
        })
      }
    })

    // Update real-time data
    const serviceData = subscriptionService.getAllRealTimeData()
    realTimeData.value = new Map(serviceData)
  }

  const clearError = () => {
    lastError.value = null
  }

  // Formula-specific subscription helpers
  const subscribeToFormula = async (
    market: string,
    code: string,
    formulaName: string,
    formulaCode: string,
    granularity: number,
    namespace: string = 'global'
  ): Promise<string> => {
    const config: SubscriptionConfig = {
      markets: [market],
      codes: [code],
      qualifiedNames: [formulaName],
      namespace,
      options: {
        formulaCode,
        granularity
      }
    }

    return await subscribe(config)
  }

  const unsubscribeFromFormula = async (subscriptionId: string): Promise<boolean> => {
    return await unsubscribe(subscriptionId)
  }

  return {
    // State
    subscriptions,
    realTimeData,
    isInitialized,
    lastError,
    
    // Computed
    activeSubscriptions,
    totalSubscriptions,
    totalDataReceived,
    subscriptionStatistics,
    
    // Actions
    initialize,
    subscribe,
    unsubscribe,
    getSubscription,
    getRealTimeData,
    getAllRealTimeData,
    clearRealTimeData,
    clearAllRealTimeData,
    cancelAllSubscriptions,
    getStatistics,
    refreshSubscriptionData,
    clearError,
    
    // Formula-specific helpers
    subscribeToFormula,
    unsubscribeFromFormula
  }
})

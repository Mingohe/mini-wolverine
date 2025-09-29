import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDataStore } from './dataStore'
import { loadCredentials, saveCredentials, clearCredentials } from '../utils/storage'
import type { 
  WebSocketMessage, 
  PoolStats, 
  WebSocketStats, 
  QueryParams
} from '@/types'

export const useWebSocketStore = defineStore('websocket', () => {
  // State
  const backendWs = ref<WebSocket | null>(null)
  const isConnected = ref<boolean>(false)
  const isConnecting = ref<boolean>(false)
  const error = ref<string | null>(null)
  const caitlynConnected = ref<boolean>(false)
  const serverUrl = ref<string | null>(null)
  const authToken = ref<string | null>(null)
  const clientId = ref<string | null>(null)
  const assignedConnectionId = ref<string | null>(null)
  const cachedSeeds = ref<Map<string, any>>(new Map())
  const lastSeedTimestamp = ref<number>(0)
  const poolReady = ref<boolean>(false)
  const poolStats = ref<PoolStats>({
    totalConnections: 0,
    availableConnections: 0,
    busyConnections: 0
  })
  const stats = ref<WebSocketStats>({
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    lastMessageType: null,
    lastMessageTime: null,
    cachedSeedsCount: 0
  })
  const lastMessage = ref<WebSocketMessage | null>(null)

  // Refs for cleanup
  const wsRef = ref<WebSocket | null>(null)
  const hasAutoConnected = ref<boolean>(false)

  // Computed
  const connectionStatus = computed(() => {
    if (error.value) return 'Connection Error'
    if (isConnecting.value) return 'Connecting...'
    if (!isConnected.value) return 'Backend Disconnected'
    if (!caitlynConnected.value) return 'Caitlyn Disconnected'
    return 'Connected & Ready'
  })

  const connectionDetails = computed(() => {
    if (error.value) return error.value
    if (isConnecting.value) return 'Establishing connection to backend'
    if (!isConnected.value) return 'Not connected to backend WebSocket'
    if (!caitlynConnected.value) return 'Backend connected, waiting for Caitlyn server'
    return 'Connected to backend and Caitlyn server'
  })

  // Actions
  const setConnecting = () => {
    isConnecting.value = true
    isConnected.value = false
    error.value = null
  }

  const setConnected = () => {
    isConnected.value = true
    isConnecting.value = false
    error.value = null
  }

  const setDisconnected = () => {
    isConnected.value = false
    isConnecting.value = false
    caitlynConnected.value = false
    backendWs.value = null
  }

  const setCaitlynConnected = () => {
    caitlynConnected.value = true
  }

  const setCaitlynDisconnected = () => {
    caitlynConnected.value = false
  }

  const setError = (errorMessage: string) => {
    error.value = errorMessage
    isConnecting.value = false
    stats.value.errors++
  }

  const setWebSocket = (ws: WebSocket) => {
    backendWs.value = ws
    wsRef.value = ws
  }

  const updateStats = (newStats: Partial<WebSocketStats>) => {
    stats.value = { ...stats.value, ...newStats }
  }

  const clearError = () => {
    error.value = null
  }

  const setCredentials = (url: string, token: string) => {
    serverUrl.value = url
    authToken.value = token
  }

  const setClientInfo = (info: { clientId: string; assignedConnectionId: string; cachedSeedsCount?: number }) => {
    clientId.value = info.clientId
    assignedConnectionId.value = info.assignedConnectionId
    stats.value.cachedSeedsCount = info.cachedSeedsCount || 0
  }

  const updateCachedSeeds = (key: string, data: any, timestamp?: number) => {
    cachedSeeds.value.set(key, data)
    lastSeedTimestamp.value = timestamp || Date.now()
    stats.value.cachedSeedsCount = cachedSeeds.value.size
  }

  const batchUpdateCachedSeeds = (seeds: Array<{ key: string; [key: string]: any }>, currentTimestamp?: number) => {
    seeds.forEach(seed => {
      cachedSeeds.value.set(seed.key, seed)
    })
    lastSeedTimestamp.value = currentTimestamp || Date.now()
    stats.value.cachedSeedsCount = cachedSeeds.value.size
  }

  const setPoolReady = () => {
    poolReady.value = true
    caitlynConnected.value = true
  }

  const updatePoolStats = (newStats: Partial<PoolStats>) => {
    poolStats.value = { ...poolStats.value, ...newStats }
  }

  const setLastMessage = (message: WebSocketMessage) => {
    lastMessage.value = message
    stats.value.lastMessageType = message?.type || null
    stats.value.lastMessageTime = new Date().toISOString()
  }

  const connectToBackend = () => {
    // Connection guard - prevent multiple simultaneous connections
    if (isConnecting.value) {
      console.log('⚠️ Already connecting to backend, please wait...')
      return
    }
    
    if (isConnected.value && wsRef.value) {
      console.log('⚠️ Already connected to backend, connection state:', {
        isConnected: isConnected.value,
        isConnecting: isConnecting.value,
        hasWebSocket: !!wsRef.value
      })
      return
    }

    console.log('🔌 Starting backend connection process...')
    setConnecting()

    const backendUrl = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:4000'
    console.log(`🔌 Connecting to backend: ${backendUrl}`)
    
    const ws = new WebSocket(backendUrl)
    wsRef.value = ws
    setWebSocket(ws)

    ws.onopen = () => {
      console.log('✅ Connected to backend')
      setConnected()
      
      // Request client info and connect to Caitlyn server
      setTimeout(() => {
        console.log('📤 Requesting client info...')
        ws.send(JSON.stringify({ type: 'get_client_info' }))
        
        console.log('ℹ️ Backend pre-initialized with Caitlyn connection - no reconfiguration needed')
        
        // After connection, the enhanced pool will automatically initialize
        // and send pool_ready event with all data
        setTimeout(() => {
          console.log('📤 Requesting client info and pool status...')
          ws.send(JSON.stringify({ type: 'get_pool_stats' }))
        }, 1000) // Wait 1 second for pool initialization
      }, 500)
      
      updateStats({ 
        messagesSent: stats.value.messagesSent + 1,
        lastMessageType: 'connection',
        lastMessageTime: new Date().toISOString()
      })
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      console.log('📨 Backend message:', message.type)
      
      // Store the complete message for components to access
      setLastMessage(message)
      
      handleBackendMessage(message)
      
      updateStats({ 
        messagesReceived: stats.value.messagesReceived + 1
      })
    }

    ws.onerror = (error) => {
      console.error('❌ Backend WebSocket error:', error)
      setError('Backend connection error')
    }

    ws.onclose = (event) => {
      console.log('🔌 Backend WebSocket disconnected', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      })
      
      // Clean up WebSocket reference
      if (wsRef.value === ws) {
        wsRef.value = null
      }
      
      setDisconnected()
    }
  }

  const handleBackendMessage = (message: WebSocketMessage) => {
    const dataStore = useDataStore()
    
    // Add all messages to raw messages log
    dataStore.addRawMessage({
      timestamp: new Date(),
      type: message.type || 'unknown',
      data: message
    })

    switch (message.type) {
      case 'connection_status':
        if (message.status === 'connected') {
          console.log('✅ Caitlyn server connected via backend')
          setCaitlynConnected()
          dataStore.addLog('success', 'Connected to Caitlyn server via backend')
        } else if (message.status === 'disconnected') {
          console.log('🔌 Caitlyn server disconnected')
          setCaitlynDisconnected()
          dataStore.addLog('info', 'Disconnected from Caitlyn server')
        }
        break
        
      case 'client_info':
        console.log('📋 Client info received:', message)
        setClientInfo({
          clientId: message.clientId,
          assignedConnectionId: message.assignedConnectionId,
          cachedSeedsCount: message.cachedSeedsCount || 0
        })
        dataStore.addLog('info', 'Client assigned to dedicated connection', {
          clientId: message.clientId,
          connectionId: message.assignedConnectionId
        })
        break
        
      case 'cached_seeds_batch':
        console.log('🌱 Cached seeds batch received:', message.count || 0, 'seeds')
        if (message.seeds && message.seeds.length > 0) {
          batchUpdateCachedSeeds(message.seeds, message.currentTimestamp || Date.now())
          dataStore.addLog('success', 'Cached seeds data loaded', {
            seedCount: message.seeds.length,
            fromCache: true
          })
        }
        break
        
      case 'pool_ready':
        console.log('🎆 Enhanced connection pool ready!')
        setPoolReady()
        
        // Handle all the data from the pool
        if (message.schema) {
          console.log('📋 Schema received from pool')
          dataStore.setSchema(message.schema)
          dataStore.addLog('success', 'Schema definitions loaded from pool', { 
            definitionsCount: Object.keys(message.schema).reduce((sum, ns) => sum + Object.keys(message.schema[ns] || {}).length, 0)
          })
        }
        
        if (message.markets) {
          console.log('🌍 Markets data received from pool')
          dataStore.setMarketData(message.markets)
          const globalCount = Object.keys(message.markets?.global || {}).length
          const privateCount = Object.keys(message.markets?.private || {}).length
          dataStore.addLog('success', 'Market data loaded from pool', { 
            globalMarkets: globalCount, 
            privateMarkets: privateCount 
          })
        }
        
        if (message.securities) {
          console.log('🗺️ Securities data received from pool')
          dataStore.setSecurities(message.securities)
          const marketsCount = Object.keys(message.securities).length
          const totalSecurities = Object.values(message.securities).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
          dataStore.addLog('success', 'Securities data loaded from pool', {
            marketsWithSecurities: marketsCount,
            totalSecurities: totalSecurities
          })
        }
        
        dataStore.addLog('success', 'Enhanced connection pool fully initialized and ready')
        break
        
      case 'handshake_success':
        console.log('✅ Caitlyn handshake successful')
        dataStore.addLog('success', 'Caitlyn handshake completed successfully')
        break
        
      case 'handshake_failed':
        console.error('❌ Caitlyn handshake failed:', message.message)
        setError(`Handshake failed: ${message.message}`)
        dataStore.addLog('error', 'Caitlyn handshake failed', { error: message.message })
        break
        
      case 'schema_received':
      case 'schema':
        console.log('📋 Schema received from backend with revision support')
        const schemaData = message.data || message.schema
        
        // Log revision information if available
        let totalRevisions = 0
        if (schemaData) {
          Object.values(schemaData).forEach((namespace: any) => {
            Object.values(namespace).forEach((meta: any) => {
              if (meta.revision !== undefined) {
                totalRevisions++
              }
            })
          })
        }
        
        dataStore.setSchema(schemaData)
        dataStore.addLog('success', 'Schema definitions with revisions loaded', { 
          definitionsCount: Object.keys(schemaData || {}).length,
          totalRevisions: totalRevisions
        })
        break
        
      case 'markets_received':
        console.log('🌍 Markets data received from backend')
        dataStore.setMarketData(message.data)
        const globalCount = Object.keys(message.data?.global || {}).length
        const privateCount = Object.keys(message.data?.private || {}).length
        dataStore.addLog('success', 'Market data received', { 
          globalMarkets: globalCount, 
          privateMarkets: privateCount 
        })
        break
        
      case 'seeds_received':
        console.log('🌱 Seeds data received from backend')
        // Handle individual seed updates
        if (message.key && message.data) {
          updateCachedSeeds(message.key, message.data, message.timestamp || Date.now())
        }
        dataStore.addLog('info', 'Universe seeds data received', { 
          seedCount: message.data?.count || 0,
          key: message.key
        })
        break
        
      case 'universe_revision':
        console.log('🌍 Universe revision received from backend')
        if (message.success) {
          // Create market data structure from universe revision response
          const marketData = {
            global: message.globalMarkets || {},
            private: message.privateMarkets || {}
          }
          dataStore.setMarketData(marketData)
          dataStore.addLog('success', 'Universe revision data loaded', {
            totalMarkets: message.marketsCount || 0,
            globalMarkets: Object.keys(message.globalMarkets || {}).length,
            privateMarkets: Object.keys(message.privateMarkets || {}).length
          })
        } else {
          dataStore.addLog('error', 'Failed to load universe revision')
        }
        break
        
      case 'market_data':
        console.log('📊 Real-time market data received')
        dataStore.addLog('info', 'Real-time market data received', {
          cmd: message.cmd,
          seq: message.seq
        })
        break
        
      case 'historical_data_response':
        console.log('📈 Historical data response received:', message.success ? 'Success' : 'Failed')
        if (message.success && message.data) {
          // Store historical data in DataStore
          const dataKey = `${message.params?.market || 'unknown'}_${message.params?.code || 'unknown'}_${Date.now()}`
          dataStore.addHistoricalData(dataKey, {
            requestId: message.requestId,
            market: message.params?.market,
            code: message.params?.code,
            metaName: message.params?.metaName,
            namespace: message.params?.namespace,
            granularity: message.params?.granularity,
            fieldCount: message.params?.fieldCount || 0,
            timeRange: message.params?.timeRange,
            data: message.data.records || [],
            totalCount: message.data.totalCount || 0,
            source: message.data.source || 'backend',
            processingTime: message.data.processingTime,
            receivedAt: new Date().toISOString()
          })
          
          dataStore.addLog('success', 'Historical data retrieved successfully', {
            market: message.params?.market,
            code: message.params?.code,
            recordCount: message.data.totalCount || 0,
            fieldCount: message.params?.fieldCount,
            source: message.data.source
          })
          
          // Dispatch custom event for HistoricalDataQuery component to catch
          window.dispatchEvent(new CustomEvent('historicalDataReceived', {
            detail: {
              success: true,
              data: message.data.records || [],
              totalCount: message.data.totalCount || 0,
              requestId: message.requestId,
              params: message.params
            }
          }))
        } else {
          dataStore.addLog('error', 'Historical data query failed', { 
            error: message.error,
            market: message.params?.market,
            code: message.params?.code
          })
          
          // Dispatch error event
          window.dispatchEvent(new CustomEvent('historicalDataReceived', {
            detail: {
              success: false,
              error: message.error || 'Unknown error',
              requestId: message.requestId
            }
          }))
        }
        break
        
      case 'connection_error':
        console.error('❌ Pool connection error:', message.connectionId, message.error)
        dataStore.addLog('error', 'Connection pool error', { 
          connectionId: message.connectionId,
          error: message.error 
        })
        break
        
      case 'pool_shutdown':
        console.log('📋 Connection pool shutdown')
        setCaitlynDisconnected()
        dataStore.addLog('warning', 'Connection pool has been shut down')
        break
        
      case 'securities_data':
        console.log('🗺️ Securities data received from backend')
        if (message.data) {
          dataStore.setSecurities(message.data)
          const marketsCount = Object.keys(message.data).length
          const totalSecurities = Object.values(message.data).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
          dataStore.addLog('success', 'Securities data loaded', {
            marketsWithSecurities: marketsCount,
            totalSecurities: totalSecurities
          })
        }
        break
        
      case 'securities_not_ready':
        console.log('⚠️ Securities data not yet ready')
        dataStore.addLog('info', 'Securities data not yet available - pool initializing')
        break
        
      case 'error':
        console.error('❌ Backend error:', message.message)
        setError(message.message)
        dataStore.addLog('error', 'Backend error', { error: message.message })
        break
        
      case 'fetch_by_code_response':
        console.log('📊 Fetch by code response received:', message.success ? 'Success' : 'Failed')
        // The SchemaViewer component handles this message directly via useEffect
        // No additional processing needed here - just pass it through
        break

      case 'fetch_by_time_response':
        console.log('⏰ Fetch by time response received:', message.success ? 'Success' : 'Failed')
        if (message.success) {
          dataStore.addLog('success', 'Market data fetched successfully', {
            recordCount: message.data?.records?.length || 0,
            requestId: message.requestId
          })

          // 派发自定义事件给 WatchlistStore 处理
          window.dispatchEvent(new CustomEvent('fetchByTimeReceived', {
            detail: {
              success: true,
              data: message.data,
              requestId: message.requestId,
              params: message.queryParams
            }
          }))
        } else {
          dataStore.addLog('error', 'Market data fetch failed', {
            error: message.error,
            message: message.message
          })

          // 派发错误事件
          window.dispatchEvent(new CustomEvent('fetchByTimeReceived', {
            detail: {
              success: false,
              error: message.error || message.message,
              requestId: message.requestId
            }
          }))
        }
        break
        
      case 'historical_data':
        console.log('📈 Historical data message received')
        // This is also handled by SchemaViewer component
        break
        
      case 'register_formula_response':
        console.log('🧮 Formula registration response received:', message.success ? 'Success' : 'Failed')
        if (message.success) {
          dataStore.addLog('success', 'Formula registered successfully', {
            uuid: message.data?.uuid,
            formulaId: message.data?.formulaId
          })
        } else {
          dataStore.addLog('error', 'Formula registration failed', {
            error: message.error
          })
        }
        break
        
      case 'formula_execution_response':
        console.log('⚡ Formula execution response received:', message.success ? 'Success' : 'Failed')
        if (message.success) {
          dataStore.addLog('success', 'Formula executed successfully', {
            uuid: message.data?.uuid,
            recordCount: message.data?.records?.length || 0
          })
        } else {
          dataStore.addLog('error', 'Formula execution failed', {
            error: message.error
          })
        }
        break
        
      case 'subscription_confirmed':
        console.log('✅ Subscription confirmed:', message.subscriberId)
        dataStore.addLog('success', 'Real-time subscription established', {
          subscriberId: message.subscriberId
        })
        break
        
      case 'subscription_error':
        console.log('❌ Subscription error:', message.error)
        dataStore.addLog('error', 'Subscription failed', {
          error: message.error,
          subscriberId: message.subscriberId
        })
        break
        
      case 'unsubscription_confirmed':
        console.log('⏹️ Unsubscription confirmed:', message.subscriberId)
        dataStore.addLog('info', 'Real-time subscription cancelled', {
          subscriberId: message.subscriberId
        })
        break
        
      case 'real_time_data':
        console.log('📡 Real-time data received:', message.data?.length || 0, 'records')
        dataStore.addLog('info', 'Real-time data received', {
          recordCount: message.data?.length || 0,
          subscriberId: message.subscriberId
        })
        break
        
      default:
        console.log('❓ Unknown backend message type:', message.type)
        dataStore.addLog('warning', 'Unknown message type received', { type: message })
    }
  }

  const connectToCaitlyn = (serverUrl: string, authToken: string) => {
    if (!isConnected.value) {
      console.warn('⚠️ Not connected to backend')
      return
    }

    // Save credentials
    if (serverUrl && authToken) {
      saveCredentials(serverUrl, authToken)
      setCredentials(serverUrl, authToken)
    }

    console.log(`🔌 Requesting connection to Caitlyn server via backend`)
    
    const message = {
      type: 'connect',
      url: serverUrl,
      token: authToken
    }
    
    wsRef.value?.send(JSON.stringify(message))
  }

  const disconnectFromCaitlyn = () => {
    if (!isConnected.value) {
      console.warn('⚠️ Not connected to backend')
      return
    }

    console.log('🔌 Requesting disconnection from Caitlyn server')
    
    const message = {
      type: 'disconnect'
    }
    
    wsRef.value?.send(JSON.stringify(message))
  }

  const disconnectFromBackend = () => {
    if (wsRef.value) {
      console.log('🔌 Manually disconnecting from backend...')
      wsRef.value?.close(1000, 'User requested disconnect')
      wsRef.value = null
    }
    
    // Reset auto-connection flag to allow reconnection
    hasAutoConnected.value = false
    
    setDisconnected()
  }

  const resetConnectionState = () => {
    console.log('🔄 Resetting connection state...')
    hasAutoConnected.value = false
    if (wsRef.value) {
      wsRef.value.close(1000, 'Reset connection state')
      wsRef.value = null
    }
    setDisconnected()
  }

  const requestHistoricalData = (params: QueryParams) => {
    if (!isConnected.value) {
      console.warn('⚠️ Not connected to backend')
      return
    }

    console.log('📊 Requesting historical data via backend with revision:', params.revision)
    
    // Ensure revision is included in the request
    const enhancedParams = {
      ...params,
      revision: params.revision || 0xFFFFFFFF, // Default to latest revision if not specified
      requestId: Date.now() // Add request ID for tracking
    }
    
    const message = {
      type: 'request_historical',
      params: enhancedParams
    }
    
    wsRef.value?.send(JSON.stringify(message))
  }

  const clearStoredCredentials = () => {
    const success = clearCredentials()
    if (success) {
      console.log('🗑️ Stored credentials cleared')
      setCredentials('', '')
    }
    return success
  }

  const getSavedCredentials = () => {
    return loadCredentials()
  }

  const sendMessage = (message: WebSocketMessage) => {
    if (!isConnected.value) {
      console.warn('⚠️ Not connected to backend')
      return
    }

    console.log('📤 Sending message to backend:', message.type)
    wsRef.value?.send(JSON.stringify(message))
  }

  // Auto-connect on store initialization
  const initializeConnection = () => {
    // Prevent multiple auto-connection attempts
    if (hasAutoConnected.value) {
      console.log('🔒 Auto-connection already attempted, skipping...')
      return
    }
    
    hasAutoConnected.value = true
    console.log('🚀 Auto-connecting to backend on mount...')
    
    // Small delay to ensure component is fully mounted
    setTimeout(() => {
      // Only auto-connect if not already connected
      if (!isConnected.value && !isConnecting.value) {
        connectToBackend()
      } else {
        console.log('🔒 Already connected or connecting, skipping auto-connection')
      }
    }, 100)
  }

  // Load saved credentials on store initialization
  const loadSavedCredentials = () => {
    const credentials = loadCredentials()
    if (credentials.url || credentials.token) {
      setCredentials(credentials.url, credentials.token)
    }
  }

  return {
    // State
    backendWs,
    isConnected,
    isConnecting,
    error,
    caitlynConnected,
    serverUrl,
    authToken,
    clientId,
    assignedConnectionId,
    cachedSeeds,
    lastSeedTimestamp,
    poolReady,
    poolStats,
    stats,
    lastMessage,
    
    // Computed
    connectionStatus,
    connectionDetails,
    
    // Actions
    connectToBackend,
    disconnectFromBackend,
    connectToCaitlyn,
    disconnectFromCaitlyn,
    requestHistoricalData,
    clearError,
    clearStoredCredentials,
    getSavedCredentials,
    sendMessage,
    updatePoolStats,
    initializeConnection,
    loadSavedCredentials,
    resetConnectionState
  }
})

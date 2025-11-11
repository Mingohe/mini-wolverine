/**
 * Watchlist Pinia Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WatchlistGroup, WatchlistItem, MarketQuote, SortConfig, FutureContract } from '@/types/watchlist'
import { watchlistDB } from '@/utils/indexeddb'
import { useWebSocketStore } from './websocketStore'
import { useDataStore } from './dataStore'
import { websocketTaskService } from '@/services/websocketTaskService'
import { subscriptionService } from '@/services/subscriptionService'

export const useWatchlistStore = defineStore('watchlist', () => {
  // 状态定义
  const groups = ref<WatchlistGroup[]>([])
  const selectedGroupId = ref<string | null>(null)
  const marketData = ref<Map<string, MarketQuote>>(new Map())
  const loading = ref(false)
  const loadingItems = ref<Set<string>>(new Set()) // 跟踪正在加载的票子
  const spotlightVisible = ref(false)
  const lastUpdateTime = ref(0)
  const allFutures = ref<FutureContract[]>([])
  const sortConfig = ref<SortConfig>({ field: 'code', direction: 'asc' })

  // 实时订阅相关状态
  const currentSubscriptionId = ref<string | null>(null)
  const isSubscribed = ref(false)
  const realTimeDataCount = ref(0)
  const subscribedFields = ref<string[]>([]) // 当前订阅的字段列表

  // 列配置状态
  const columnConfig = ref<{ metas: string[]; fields: Record<string, string[]> }>({
    metas: ['global::SampleQuote'],
    fields: {
      'global::SampleQuote': ['open', 'close', 'low', 'high', 'volume']
    }
  })

  // 计算属性
  const selectedGroup = computed((): WatchlistGroup | null => {
    return groups.value.find(g => g.id === selectedGroupId.value) || null
  })

  const customGroups = computed((): WatchlistGroup[] => {
    return groups.value.filter(g => g.type === 'custom')
  })

  const selectedGroupItems = computed((): WatchlistItem[] => {
    return selectedGroup.value?.items || []
  })

  // 获取WebSocket store实例
  const wsStore = useWebSocketStore()

  // 获取Data store实例用于日志
  const dataStore = useDataStore()

  // 初始化
  const init = async (): Promise<void> => {
    try {
      await watchlistDB.init()
      await loadWatchlistsFromDB()
      await loadColumnConfig()

      // 初始化 websocketTaskService 和 subscriptionService
      websocketTaskService.initialize(wsStore)
      subscriptionService.initialize(wsStore)

      console.log('✅ Watchlist store initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize watchlist store:', error)
      throw error
    }
  }

  // 从数据库加载列配置
  const loadColumnConfig = async (): Promise<void> => {
    try {
      const savedConfig = await watchlistDB.getColumnConfig()
      if (savedConfig) {
        columnConfig.value = savedConfig
        console.log('📋 Loaded column config from database:', savedConfig)
      } else {
        console.log('📋 Using default column config')
      }
    } catch (error) {
      console.error('❌ Failed to load column config:', error)
    }
  }

  // 保存列配置到数据库
  const saveColumnConfig = async (config: { metas: string[]; fields: Record<string, string[]> }): Promise<void> => {
    try {
      columnConfig.value = config
      await watchlistDB.saveColumnConfig(config)
      console.log('✅ Column config saved to database:', config)

      // 重新订阅实时数据使用新配置
      if (isSubscribed.value) {
        await subscribeRealTimeData()
      }
    } catch (error) {
      console.error('❌ Failed to save column config:', error)
      throw error
    }
  }

  // 从数据库加载自选组
  const loadWatchlistsFromDB = async (): Promise<void> => {
    try {
      const dbGroups = await watchlistDB.getAllGroups()

      // 为每个组加载项目
      for (const group of dbGroups) {
        const items = await watchlistDB.getGroupItems(group.id)
        group.items = items.map(item => ({
          ...item,
          addedAt: new Date(item.addedAt) // 确保日期类型正确
        }))
      }

      groups.value = dbGroups.map(group => ({
        ...group,
        createdAt: new Date(group.createdAt),
        updatedAt: new Date(group.updatedAt)
      }))

      // 如果没有自选组，创建默认的
      if (groups.value.length === 0) {
        await createDefaultGroups()
      }

      console.log('📚 Loaded', groups.value.length, 'watchlist groups from database')
    } catch (error) {
      console.error('❌ Failed to load watchlists from DB:', error)
      throw error
    }
  }

  // 创建默认自选组
  const createDefaultGroups = async (): Promise<void> => {
    const defaultGroup: WatchlistGroup = {
      id: 'default',
      name: 'My Watchlist',
      type: 'custom',
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      color: '#0066cc'
    }

    await saveWatchlistToDB(defaultGroup)
    groups.value.push(defaultGroup)
    selectedGroupId.value = defaultGroup.id
  }

  // 保存自选组到数据库
  const saveWatchlistToDB = async (group: WatchlistGroup): Promise<void> => {
    try {
      group.updatedAt = new Date()
      await watchlistDB.saveGroup(group)

      // 保存组内所有项目
      for (const item of group.items) {
        await watchlistDB.addItemToGroup(group.id, item)
      }
    } catch (error) {
      console.error('❌ Failed to save watchlist to DB:', error)
      throw error
    }
  }

  // 创建新自选组
  const createGroup = async (name: string, color?: string): Promise<string> => {
    const newGroup: WatchlistGroup = {
      id: `group_${Date.now()}`,
      name,
      type: 'custom',
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      color: color || '#0066cc'
    }

    await saveWatchlistToDB(newGroup)
    groups.value.push(newGroup)

    console.log('✅ Created new watchlist group:', name)
    return newGroup.id
  }

  // 删除自选组
  const deleteGroup = async (groupId: string): Promise<void> => {
    try {
      await watchlistDB.deleteGroup(groupId)
      groups.value = groups.value.filter(g => g.id !== groupId)

      if (selectedGroupId.value === groupId) {
        selectedGroupId.value = groups.value.length > 0 ? groups.value[0].id : null
      }

      console.log('✅ Deleted watchlist group:', groupId)
    } catch (error) {
      console.error('❌ Failed to delete group:', error)
      throw error
    }
  }

  // 选择自选组
  const selectGroup = async (groupId: string): Promise<void> => {
    selectedGroupId.value = groupId
    // 选择组时自动刷新数据和订阅实时数据
    refreshMarketData()
    await subscribeRealTimeData()
  }

  // 重新订阅实时数据（动态管理订阅）
  const resubscribeRealTimeData = async (): Promise<void> => {
    // 如果当前选中组有票子且组被选中，重新订阅
    if (selectedGroupItems.value.length > 0 && selectedGroupId.value && isSubscribed.value) {
      console.log('🔄 Re-subscribing due to watchlist changes...')
      await subscribeRealTimeData()
    }
  }

  // 添加品种到自选组
  const addToWatchlist = async (groupId: string, item: WatchlistItem): Promise<void> => {
    try {
      const group = groups.value.find(g => g.id === groupId)
      if (!group) {
        throw new Error(`Group ${groupId} not found`)
      }

      // 检查是否已存在
      const exists = group.items.some(
        existingItem => existingItem.market === item.market && existingItem.code === item.code
      )

      if (exists) {
        console.warn('Item already in watchlist:', item.market, item.code)
        return
      }

      item.addedAt = new Date()
      group.items.push(item)

      await watchlistDB.addItemToGroup(groupId, item)
      group.updatedAt = new Date()
      await watchlistDB.saveGroup(group)

      console.log('✅ Added to watchlist:', item.market, item.code)

      // 主动获取新添加票子的行情数据
      await fetchSingleItemMarketData(item)

      // 如果添加到当前选中组，重新订阅实时数据
      if (groupId === selectedGroupId.value) {
        await resubscribeRealTimeData()
      }
    } catch (error) {
      console.error('❌ Failed to add to watchlist:', error)
      throw error
    }
  }

  // 从自选组移除品种
  const removeFromWatchlist = async (groupId: string, market: string, code: string): Promise<void> => {
    try {
      const group = groups.value.find(g => g.id === groupId)
      if (!group) {
        throw new Error(`Group ${groupId} not found`)
      }

      group.items = group.items.filter(
        item => !(item.market === market && item.code === code)
      )

      await watchlistDB.removeItemFromGroup(groupId, market, code)
      group.updatedAt = new Date()
      await watchlistDB.saveGroup(group)

      console.log('✅ Removed from watchlist:', market, code)

      // 如果从当前选中组移除，重新订阅实时数据
      if (groupId === selectedGroupId.value) {
        await resubscribeRealTimeData()
      }
    } catch (error) {
      console.error('❌ Failed to remove from watchlist:', error)
      throw error
    }
  }

  // 获取单个票子的行情数据
  const fetchSingleItemMarketData = async (item: WatchlistItem): Promise<void> => {
    const itemKey = `${item.market}_${item.code}`

    try {
      console.log('🔍 Fetching market data for newly added item:', item.market, item.code)

      // 标记为加载中
      loadingItems.value.add(itemKey)

      // 使用 websocketTaskService 发送请求
      const response = await websocketTaskService.sendTask({
        type: 'fetch_by_time',
        params: {
          markets: [item.market],
          codes: [item.code],
          timeTag: -1,  // 使用 -1 获取最新数据
          granularity: 60, // 1小时
          fields: ['open', 'close', 'high', 'low', 'volume', 'turnover'],
          metaName: 'SampleQuote',
          namespace: '0',
          revision: 0
        }
      }, { timeout: 10000 })

      if (response.success && response.data?.records && response.data.records.length > 0) {
        // 处理单个票子的数据
        const record = response.data.records[0]
        const key = `${record.market}_${record.code}`
        marketData.value.set(key, {
          market: record.market,
          code: record.code,
          timestamp: record.timestamp || Date.now(),
          fields: {
            open: record.fields?.open || 0,
            close: record.fields?.close || 0,
            high: record.fields?.high || 0,
            low: record.fields?.low || 0,
            volume: record.fields?.volume || 0,
            turnover: record.fields?.turnover || 0,
            change: record.fields?.change || 0,
            changeRate: record.fields?.changeRate || 0
          }
        })
        console.log('✅ Updated market data for newly added item:', item.market, item.code, record.fields)
        dataStore.addLog('info', `Market data updated for ${item.market}/${item.code}`)
      } else {
        console.warn('⚠️ No market data received for newly added item:', item.market, item.code)
        dataStore.addLog('warning', `No market data available for ${item.market}/${item.code}`)
      }

    } catch (error) {
      console.error('❌ Failed to fetch market data for new item:', error)
      dataStore.addLog('error', `Failed to fetch market data for ${item.market}/${item.code}`, error)
    } finally {
      // 清除加载状态
      loadingItems.value.delete(itemKey)
    }
  }

  // 获取行情数据
  const fetchMarketData = async (items: WatchlistItem[]): Promise<void> => {
    if (items.length === 0) return

    try {
      loading.value = true

      // 按市场分组
      const marketGroups = new Map<string, string[]>()
      items.forEach(item => {
        if (!marketGroups.has(item.market)) {
          marketGroups.set(item.market, [])
        }
        marketGroups.get(item.market)!.push(item.code)
      })

      const markets = Array.from(marketGroups.keys())
      const codes = items.map(item => item.code)
      const timeTag = -1  // 使用 -1 获取最新数据

      // 为每个配置的 meta 发送请求
      const fetchPromises = columnConfig.value.metas.map(async (qualifiedName) => {
        const [namespace, metaName] = qualifiedName.split('::')
        const namespaceKey = namespace === 'global' ? '0' : '1'
        const fields = columnConfig.value.fields[qualifiedName] || []

        if (fields.length === 0) return

        // Find the revision from schema (use the user-selected namespace)
        let revision = 0
        const schema = dataStore.schema as any

        if (schema && schema[namespaceKey]) {
          const namespaceData = schema[namespaceKey]
          // Find meta with matching name in the specified namespace only
          Object.values(namespaceData).forEach((metaInfo: any) => {
            const schemaMetaName = metaInfo.displayName ||
                                   (metaInfo.name && metaInfo.name.includes("::") ? metaInfo.name.split("::").pop() : metaInfo.name)
            if (schemaMetaName === metaName && revision === 0) {
              revision = metaInfo.revision || 0
              console.log(`✅ Found ${qualifiedName} with revision ${revision}`)
            }
          })
        }

        if (revision === 0) {
          console.warn(`⚠️ ${qualifiedName} not found in schema, using revision 0`)
        }

        console.log(`📊 Fetching ${qualifiedName} with revision ${revision}`)

        try {
          const response = await websocketTaskService.sendTask({
            type: 'fetch_by_time',
            params: {
              markets,
              codes,
              timeTag,
              granularity: 60, // 1小时
              fields,
              metaName,
              namespace: namespaceKey,  // Use the user-selected namespace
              revision
            }
          }, { timeout: 15000 })

          if (response.success && response.data?.records) {
            // 处理真实数据
            response.data.records.forEach((record: any) => {
              const key = `${record.market}_${record.code}`

              // Get existing data or create new entry
              const existingData = marketData.value.get(key) || {
                market: record.market,
                code: record.code,
                timestamp: Date.now(),
                fields: {}
              }

              // Update timestamp
              existingData.timestamp = record.timestamp || Date.now()

              // Merge fields from this meta
              if (record.fields) {
                existingData.fields = {
                  ...existingData.fields,
                  ...record.fields
                }
              }

              marketData.value.set(key, existingData)
            })
            console.log(`✅ Fetched ${metaName} data: ${response.data.records.length} records`)
            dataStore.addLog('info', `Fetched ${metaName} data for ${response.data.records.length} items`)
          } else {
            console.error(`❌ Fetch ${metaName} failed:`, response)
            dataStore.addLog('error', `Failed to fetch ${metaName} data`, response.error)
          }
        } catch (error) {
          console.error(`❌ Failed to fetch ${metaName}:`, error)
          dataStore.addLog('error', `Failed to fetch ${metaName}`, error)
        }
      })

      // 等待所有请求完成
      await Promise.all(fetchPromises)

      lastUpdateTime.value = Date.now()
      console.log('✅ Updated market data for', items.length, 'items from', columnConfig.value.metas.length, 'meta types')

    } catch (error) {
      console.error('❌ Failed to fetch market data:', error)
      dataStore.addLog('error', 'Failed to fetch market data', error)
    } finally {
      loading.value = false
    }
  }

  // 刷新当前选中组的行情数据
  const refreshMarketData = (): void => {
    if (selectedGroupItems.value.length > 0) {
      fetchMarketData(selectedGroupItems.value)
    }
  }

  // 订阅当前选中组的实时数据
  const subscribeRealTimeData = async (): Promise<void> => {
    if (selectedGroupItems.value.length === 0) {
      console.warn('⚠️ No items to subscribe')
      return
    }

    // 如果已经有订阅，先取消
    if (currentSubscriptionId.value) {
      await unsubscribeRealTimeData()
    }

    try {
      console.log('📡 Subscribing to real-time data for watchlist items:', selectedGroupItems.value.length)

      // 准备订阅参数
      const markets = Array.from(new Set(selectedGroupItems.value.map(item => item.market)))
      const codes = selectedGroupItems.value.map(item => item.code)

      // 为每个票子提供对应的粒度（服务器要求数量一致）
      const granularities = codes.map(() => 60) // 每个票子都是日线数据

      // Use columnConfig for subscription
      const qualifiedNames = columnConfig.value.metas
      const fieldsArray = qualifiedNames.map(metaName => columnConfig.value.fields[metaName] || [])

      const subscriptionConfig = {
        markets,
        codes,
        qualifiedNames,
        options: {
          granularities, // 数量与codes数量一致
          fields: fieldsArray,
          start: 0,
          end: 10,
          sort: [],
          direction: [],
          filters: []
        }
      }

      // Populate subscribedFields by flattening the 2D fields array
      subscribedFields.value = subscriptionConfig.options.fields.flat()

      // 使用 subscriptionService 订阅，带有实时数据回调
      const subscriptionId = await subscriptionService.subscribeWithCallback(
        subscriptionConfig,
        (realTimeData) => {
          // 处理实时数据回调
          console.log('📊 Watchlist real-time data received:', realTimeData)

          // 更新实时数据计数
          realTimeDataCount.value++

          // 解析实时数据并更新 marketData
          if (realTimeData.data) {
            const data = realTimeData.data
            const key = `${data.market || 'unknown'}_${data.code || 'unknown'}`
            const metaName = data.metaName || realTimeData.metaName || 'unknown'

            console.log(`📦 Received data for ${key}, metaName: ${metaName}`, data.fields)

            if (data.fields) {
              // Get existing market data or create new entry
              const existingData: MarketQuote = marketData.value.get(key) || {
                market: data.market || 'unknown',
                code: data.code || 'unknown',
                timestamp: Date.now(),
                fields: {}
              }

              // Update timestamp
              existingData.timestamp = data.timestamp || Date.now()

              // Generic field merge - merge all incoming fields regardless of metaName
              existingData.fields = {
                ...existingData.fields,
                ...data.fields  // Dynamically merge all fields from incoming data
              }

              console.log(`✅ Updated ${metaName} fields for ${key}:`, data.fields)

              // Update marketData
              marketData.value.set(key, existingData)
              dataStore.addLog('info', `Real-time ${metaName} data updated for ${data.market}/${data.code}`)
            }
          }
        }
      )

      currentSubscriptionId.value = subscriptionId
      isSubscribed.value = true
      console.log('✅ Watchlist real-time subscription established:', subscriptionId)
      dataStore.addLog('info', `Real-time subscription started for ${selectedGroupItems.value.length} items`)

    } catch (error) {
      console.error('❌ Failed to subscribe to real-time data:', error)
      dataStore.addLog('error', 'Failed to start real-time subscription', error)
    }
  }

  // 取消订阅实时数据
  const unsubscribeRealTimeData = async (): Promise<void> => {
    if (!currentSubscriptionId.value) {
      console.log('ℹ️ No active subscription to cancel')
      return
    }

    try {
      console.log('⏹️ Cancelling watchlist real-time subscription:', currentSubscriptionId.value)

      const success = await subscriptionService.unsubscribe(currentSubscriptionId.value)

      if (success) {
        console.log('✅ Watchlist real-time subscription cancelled successfully')
        dataStore.addLog('info', 'Real-time subscription cancelled')
      } else {
        console.warn('⚠️ Failed to cancel watchlist subscription, but marking as cancelled')
        dataStore.addLog('warning', 'Subscription cancellation may have failed')
      }

    } catch (error) {
      console.error('❌ Error cancelling watchlist subscription:', error)
      dataStore.addLog('error', 'Error cancelling real-time subscription', error)
    } finally {
      // 无论成功失败都清理状态
      currentSubscriptionId.value = null
      isSubscribed.value = false
      realTimeDataCount.value = 0
    }
  }

  // 显示全局搜索
  const showSpotlight = (): void => {
    spotlightVisible.value = true
  }

  // 隐藏全局搜索
  const hideSpotlight = (): void => {
    spotlightVisible.value = false
  }

  // 设置排序
  const setSortConfig = (field: string, direction: 'asc' | 'desc'): void => {
    sortConfig.value = { field, direction }
  }

  // 获取行情数据
  const getMarketQuote = (market: string, code: string): MarketQuote | null => {
    return marketData.value.get(`${market}_${code}`) || null
  }

  // 检查票子是否正在加载
  const isItemLoading = (market: string, code: string): boolean => {
    return loadingItems.value.has(`${market}_${code}`)
  }

  // 从后端获取所有期货合约
  const loadAllFutures = async (): Promise<void> => {
    try {
      // 这里应该从后端API获取期货列表
      // 暂时使用模拟数据
      allFutures.value = []
      console.log('📈 Loaded futures contracts for search')
    } catch (error) {
      console.error('❌ Failed to load futures:', error)
    }
  }

  return {
    // 状态
    groups,
    selectedGroupId,
    marketData,
    loading,
    spotlightVisible,
    lastUpdateTime,
    allFutures,
    sortConfig,
    // 订阅相关状态
    currentSubscriptionId,
    isSubscribed,
    realTimeDataCount,
    subscribedFields,
    columnConfig,

    // 计算属性
    selectedGroup,
    customGroups,
    selectedGroupItems,

    // 方法
    init,
    createGroup,
    deleteGroup,
    selectGroup,
    addToWatchlist,
    removeFromWatchlist,
    fetchMarketData,
    refreshMarketData,
    // 订阅相关方法
    subscribeRealTimeData,
    unsubscribeRealTimeData,
    resubscribeRealTimeData,
    showSpotlight,
    hideSpotlight,
    setSortConfig,
    getMarketQuote,
    isItemLoading,
    loadAllFutures,
    // 列配置方法
    saveColumnConfig
  }
})
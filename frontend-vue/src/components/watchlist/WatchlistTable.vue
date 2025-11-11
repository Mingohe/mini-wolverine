<template>
  <div class="watchlist-table-container">
    <div class="table-header">
      <div class="header-info">
        <h3 class="table-title">
          {{ selectedGroup?.name || 'Select Watchlist' }}
          <span v-if="items.length > 0" class="item-count">({{ items.length }})</span>
        </h3>
        <div class="last-update" v-if="lastUpdateTime">
          Last Update: {{ formatTime(lastUpdateTime) }}
        </div>
      </div>
      <div class="table-actions">
        <ColumnSelector
          :current-config="watchlistStore.columnConfig"
          @update:config="handleColumnConfigUpdate"
        />
        <button
          class="action-btn refresh-btn"
          @click="$emit('refresh')"
          :disabled="loading"
          title="Refresh Data"
        >
          <span class="btn-icon" :class="{ spinning: loading }">🔄</span>
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button class="action-btn export-btn" @click="handleExport" title="Export Data">
          📊 Export
        </button>
      </div>
    </div>

    <!-- 表格内容 -->
    <div class="table-content" v-if="items.length > 0">
      <div class="table-wrapper">
        <table class="quote-table">
          <thead>
            <tr>
              <th @click="handleSort('market')" class="sortable">
                Market <span class="sort-indicator" :class="getSortClass('market')">⇅</span>
              </th>
              <th @click="handleSort('code')" class="sortable">
                Code <span class="sort-indicator" :class="getSortClass('code')">⇅</span>
              </th>
              <th @click="handleSort('name')" class="sortable">
                Name <span class="sort-indicator" :class="getSortClass('name')">⇅</span>
              </th>
              <!-- 动态字段列 -->
              <th
                v-for="field in displayFields"
                :key="field"
                @click="handleSort(field)"
                class="sortable number"
              >
                {{ availableFields[field]?.label || field }} <span class="sort-indicator" :class="getSortClass(field)">⇅</span>
              </th>
              <th class="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in sortedItems"
              :key="`${item.market}-${item.code}`"
              class="data-row"
            >
              <td class="market">{{ item.market }}</td>
              <td class="code">{{ item.code }}</td>
              <td class="name">
                {{ item.name || '-' }}
                <span v-if="watchlistStore.isItemLoading(item.market, item.code)" class="loading-indicator" title="Loading market data...">
                  ⏳
                </span>
              </td>
              <!-- 动态字段数据 -->
              <td
                v-for="field in displayFields"
                :key="field"
                class="number price"
                :class="field === 'close' ? hasBlinkEffect(item, 'close') : ''"
              >
                <span v-if="watchlistStore.isItemLoading(item.market, item.code)" class="loading-data">Loading...</span>
                <span v-else>{{ (availableFields[field]?.formatter || formatPrice)(getQuoteField(item, field as keyof MarketQuote['fields'])) }}</span>
              </td>
              <td class="actions">
                <button
                  class="remove-btn"
                  @click="handleRemoveItem(item)"
                  title="Remove from watchlist"
                >
                  ×
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-else>
      <div class="empty-icon">📈</div>
      <div class="empty-title">
        {{ selectedGroup ? 'No instruments added' : 'Please select a watchlist' }}
      </div>
      <div class="empty-description">
        {{ selectedGroup
          ? 'Click the button below or use Ctrl+K shortcut to add instruments to current watchlist'
          : 'Select a watchlist from the left sidebar to view market data'
        }}
      </div>
      <button
        v-if="selectedGroup"
        class="add-first-btn"
        @click="$emit('toggle-spotlight')"
      >
        <span class="btn-icon">🔍</span>
        Add First Instrument
      </button>
    </div>

    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner"></div>
        <div class="loading-text">Loading market data...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { WatchlistItem, WatchlistGroup, MarketQuote, SortConfig } from '@/types/watchlist'
import { useWatchlistStore } from '@/stores/watchlistStore'
import ColumnSelector from './ColumnSelector.vue'

// 获取watchlist store实例
const watchlistStore = useWatchlistStore()

// Props
interface Props {
  items: WatchlistItem[]
  loading?: boolean
  selectedGroup: WatchlistGroup | null
  marketData: Map<string, MarketQuote>
  sortConfig: SortConfig
  subscribedFields?: string[]  // 订阅的字段列表
}

// 价格变化追踪
interface PriceChange {
  direction: 'up' | 'down' | null
  field: 'open' | 'high' | 'low' | 'close'
  timestamp: number
}

// 价格历史记录
const priceHistory = ref<Map<string, {open?: number, high?: number, low?: number, close?: number}>>(new Map())
// 价格变化闪烁状态
const priceChanges = ref<Map<string, PriceChange[]>>(new Map())

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Emits
const emit = defineEmits<{
  'refresh': []
  'sort': [field: string, direction: 'asc' | 'desc']
  'remove-item': [item: WatchlistItem]
  'toggle-spotlight': []
}>()

// 格式化函数（需要先声明）
const formatPrice = (value: number | null): string => {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  })
}

const formatChange = (value: number | null): string => {
  if (value === null || value === undefined) return '-'
  const sign = value > 0 ? '+' : ''
  return sign + value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  })
}

const formatChangeRate = (value: number | null): string => {
  if (value === null || value === undefined) return '-'
  const sign = value > 0 ? '+' : ''
  return sign + value.toFixed(2) + '%'
}

const formatVolume = (value: number | null): string => {
  if (value === null || value === undefined) return '-'
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + '万'
  }
  return value.toLocaleString('zh-CN')
}

const formatAmount = (value: number | null): string => {
  if (value === null || value === undefined) return '-'
  if (value >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿'
  }
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + '万'
  }
  return value.toLocaleString('zh-CN')
}

// 预定义的特殊字段格式化函数映射
const specialFormatters: Record<string, (value: number | null) => string> = {
  volume: formatVolume,
  turnover: formatAmount,
  change: formatChange,
  changeRate: formatChangeRate,
  change_percentage: formatChangeRate
}

// 动态构建可用字段定义（基于订阅的字段列表）
const availableFields = computed(() => {
  const fields: Record<string, { label: string; sortable: boolean; formatter: (value: number | null) => string }> = {}

  if (!props.subscribedFields || props.subscribedFields.length === 0) {
    return fields
  }

  props.subscribedFields.forEach(fieldName => {
    // 生成友好的标签名称（首字母大写，下划线转空格）
    const label = fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    // 根据字段名选择合适的格式化函数
    const formatter = specialFormatters[fieldName] || formatPrice

    fields[fieldName] = {
      label,
      sortable: true,
      formatter
    }
  })

  return fields
})

// 动态显示的字段列（直接使用订阅的字段列表）
const displayFields = computed(() => {
  if (!props.subscribedFields || props.subscribedFields.length === 0) {
    return []
  }
  return props.subscribedFields
})

// 计算属性
const lastUpdateTime = computed(() => {
  if (props.marketData.size === 0) return null

  let maxTime = 0
  props.marketData.forEach(quote => {
    if (quote.timestamp > maxTime) {
      maxTime = quote.timestamp
    }
  })

  return maxTime > 0 ? new Date(maxTime * 1000) : null
})

const sortedItems = computed(() => {
  const items = [...props.items]
  const { field, direction } = props.sortConfig

  items.sort((a, b) => {
    let aValue: any
    let bValue: any

    // 根据字段类型获取值
    if (['open', 'high', 'low', 'close', 'volume', 'turnover'].includes(field)) {
      // 数值字段从行情数据中获取
      aValue = getQuoteField(a, field as keyof MarketQuote['fields']) || 0
      bValue = getQuoteField(b, field as keyof MarketQuote['fields']) || 0
    } else {
      // 其他字段直接从item获取
      aValue = a[field as keyof WatchlistItem] || ''
      bValue = b[field as keyof WatchlistItem] || ''
    }

    // 数值比较
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'asc' ? aValue - bValue : bValue - aValue
    }

    // 字符串比较
    const aStr = String(aValue).toLowerCase()
    const bStr = String(bValue).toLowerCase()

    if (direction === 'asc') {
      return aStr.localeCompare(bStr, 'zh-CN')
    } else {
      return bStr.localeCompare(aStr, 'zh-CN')
    }
  })

  return items
})

// 方法
const handleColumnConfigUpdate = async (config: { metas: string[]; fields: Record<string, string[]> }) => {
  await watchlistStore.saveColumnConfig(config)
}

const handleSort = (field: string) => {
  const currentDirection = props.sortConfig.field === field ? props.sortConfig.direction : 'asc'
  const newDirection = currentDirection === 'asc' ? 'desc' : 'asc'
  emit('sort', field, newDirection)
}

const handleRemoveItem = (item: WatchlistItem) => {
  if (confirm(`Are you sure to remove ${item.market}/${item.code} from watchlist?`)) {
    emit('remove-item', item)
  }
}

const handleExport = () => {
  if (props.items.length === 0) return

  // 创建CSV内容
  const headers = ['Market', 'Code', 'Name', 'Open', 'High', 'Low', 'Close', 'Volume']
  const rows = props.items.map(item => {
    return [
      item.market,
      item.code,
      item.name || '',
      formatPrice(getQuoteField(item, 'open')),
      formatPrice(getQuoteField(item, 'high')),
      formatPrice(getQuoteField(item, 'low')),
      formatPrice(getQuoteField(item, 'close')),
      formatVolume(getQuoteField(item, 'volume'))
    ]
  })

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n')

  // 下载文件
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `Watchlist_${props.selectedGroup?.name}_${formatTime(new Date(), 'file')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

const getQuoteField = (item: WatchlistItem, field: keyof MarketQuote['fields']): number | null => {
  const quote = props.marketData.get(`${item.market}_${item.code}`)
  return quote?.fields[field] ?? null
}

const getSortClass = (field: string): string => {
  if (props.sortConfig.field !== field) return ''
  return props.sortConfig.direction === 'asc' ? 'asc' : 'desc'
}

// 检查指定字段是否有闪烁效果
const hasBlinkEffect = (item: WatchlistItem, field: 'open' | 'high' | 'low' | 'close'): string => {
  const key = `${item.market}_${item.code}`
  const changes = priceChanges.value.get(key) || []
  const currentTime = +new Date() // 使用一元加号转换为数字
  const recentChange = changes.find(change =>
    change.field === field &&
    currentTime - change.timestamp < 1000 // 闪烁持续1秒
  )

  if (!recentChange) return ''

  const blinkClass = recentChange.direction === 'up' ? 'blink-up' : 'blink-down'
  console.log(`✨ Applying blink effect: ${key} ${field} -> ${blinkClass}`)
  return blinkClass
}

// 清理过期的闪烁效果
const cleanupExpiredBlinks = () => {
  const now = +new Date() // 使用一元加号转换为数字
  priceChanges.value.forEach((changes, key) => {
    const validChanges = changes.filter(change => now - change.timestamp < 1000)
    if (validChanges.length === 0) {
      priceChanges.value.delete(key)
    } else {
      priceChanges.value.set(key, validChanges)
    }
  })
}

// 检测价格变化并触发闪烁
const detectPriceChanges = () => {
  props.items.forEach(item => {
    const key = `${item.market}_${item.code}`
    const currentQuote = props.marketData.get(key)

    if (!currentQuote) return

    const previousPrices = priceHistory.value.get(key)
    const currentPrices = {
      open: currentQuote.fields.open,
      high: currentQuote.fields.high,
      low: currentQuote.fields.low,
      close: currentQuote.fields.close
    }

    if (previousPrices) {
      const changes: PriceChange[] = []
      const now = +new Date(); // 直接使用一元加号获取时间戳

      // 检查每个价格字段的变化
      (['open', 'high', 'low', 'close'] as const).forEach((field: 'open' | 'high' | 'low' | 'close') => {
        const oldPrice = previousPrices[field]
        const newPrice = currentPrices[field]

        if (oldPrice !== undefined && newPrice !== undefined && oldPrice !== newPrice) {
          const direction = newPrice > oldPrice ? 'up' : 'down'
          changes.push({
            direction,
            field,
            timestamp: now
          })

          console.log(`💰 Price change detected: ${key} ${field} ${oldPrice} → ${newPrice} (${direction === 'up' ? '📈 UP' : '📉 DOWN'}) - Will blink ${direction === 'up' ? 'RED' : 'GREEN'}`)
        } else if (oldPrice !== undefined && newPrice !== undefined) {
          console.log(`📊 Price unchanged: ${key} ${field} = ${newPrice}`)
        }
      })

      if (changes.length > 0) {
        const existingChanges = priceChanges.value.get(key) || []
        priceChanges.value.set(key, [...existingChanges, ...changes])
      }
    }

    // 更新价格历史
    priceHistory.value.set(key, currentPrices)
  })

  // 清理过期的闪烁效果
  cleanupExpiredBlinks()
}

// 监听marketData变化
watch(() => props.marketData, () => {
  nextTick(() => {
    detectPriceChanges()
  })
}, { deep: true })

// 定期清理过期的闪烁效果
setInterval(cleanupExpiredBlinks, 500)

// 其他格式化函数
const formatPercent = (value: number | null): string => {
  if (value === null || value === undefined) return '-'
  const sign = value > 0 ? '+' : ''
  return sign + (value * 100).toFixed(2) + '%'
}

const formatTime = (date: Date | null, type: string = 'display'): string => {
  if (!date) return ''

  if (type === 'file') {
    return date.toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
  }

  return date.toLocaleTimeString('zh-CN')
}
</script>

<style scoped>
.watchlist-table-container {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: white;
  position: relative;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5.5px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.header-info {
  flex: 1;
}

.table-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  display: flex;
  align-items: center;
}

.item-count {
  font-size: 13px;
  color: #9ca3af;
  font-weight: normal;
  margin-left: 6px;
}

.last-update {
  font-size: 10px;
  color: #9ca3af;
  margin-top: 2px;
}

.table-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  background: white;
  border: 1px solid #d1d5db;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.action-btn:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn {
  color: #0066cc;
  border-color: #0066cc;
}

.refresh-btn:hover:not(:disabled) {
  background: #e6f3ff;
}

.export-btn {
  color: #28a745;
  border-color: #28a745;
}

.export-btn:hover:not(:disabled) {
  background: #f0f8f0;
}

.btn-icon {
  margin-right: 2px;
  font-size: 10px;
}

.btn-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.table-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
}

.quote-table {
  width: 100%;
  border-collapse: collapse;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.quote-table th {
  background: #f9fafb;
  padding: 6px 4px;
  text-align: left;
  font-weight: 500;
  font-size: 13px;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
}

.quote-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.quote-table th.sortable:hover {
  background: #e9ecef;
}

.quote-table th.number {
  text-align: right;
}

.sort-indicator {
  margin-left: 4px;
  opacity: 0.3;
  font-size: 12px;
}

.sort-indicator.asc {
  opacity: 1;
  transform: rotate(0deg);
}

.sort-indicator.desc {
  opacity: 1;
  transform: rotate(180deg);
}

.quote-table td {
  padding: 4px 4px;
  font-size: 13px;
  border-bottom: 1px solid #f3f4f6;
  white-space: nowrap;
}

.data-row:hover {
  background: #f9fafb;
}

.market {
  font-weight: 500;
  color: #4b5563;
  font-size: 10px;
}

.code {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-weight: 600;
  color: #374151;
  font-size: 13px;
}

.name {
  color: #9ca3af;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
}

.number {
  text-align: right;
  font-family: 'SF Mono', 'Monaco', monospace;
  font-variant-numeric: tabular-nums;
  font-size: 10px;
}

.price {
  font-weight: 600;
  color: #374151;
  font-size: 13px;
}

.price.high {
  color: #dc3545; /* Red for high */
}

.price.low {
  color: #28a745; /* Green for low */
}

.price.close {
  font-weight: 700;
}

.change.positive {
  color: #dc3545;
}

.change.negative {
  color: #28a745;
}

.actions {
  text-align: center;
  width: 60px;
}

.remove-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 12px;
  padding: 2px;
  border-radius: 2px;
  transition: all 0.2s;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
}

.remove-btn:hover {
  background: #fee2e2;
  color: #dc2626;
  opacity: 1;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: #6c757d;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.3;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #495057;
}

.empty-description {
  font-size: 14px;
  margin-bottom: 24px;
  max-width: 400px;
  line-height: 1.5;
}

.add-first-btn {
  background: #0066cc;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.add-first-btn:hover {
  background: #0052a3;
  transform: translateY(-1px);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-content {
  text-align: center;
  color: #6c757d;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #0066cc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

.loading-text {
  font-size: 14px;
}

/* 单个票子加载指示器 */
.loading-indicator {
  font-size: 11px;
  margin-left: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}

.loading-data {
  color: #6c757d;
  font-style: italic;
  font-size: 11px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* 价格闪烁动画 - 红涨绿跌 */
@keyframes higher {
  0% {
    background-color: #ff000088;
  }
  100% {
    background-color: transparent;
  }
}

@keyframes lower {
  0% {
    background-color: #00ff0088;
  }
  100% {
    background-color: transparent;
  }
}

.blink-up {
  animation: higher 1s ease;
}

.blink-down {
  animation: lower 1s ease;
}

/* 响应式 */
@media (max-width: 768px) {
  .table-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .table-actions {
    justify-content: center;
  }

  .quote-table th,
  .quote-table td {
    padding: 8px 4px;
    font-size: 12px;
  }

  .name {
    max-width: 80px;
  }
}
</style>
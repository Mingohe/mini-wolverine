<template>
  <div class="spotlight-overlay" @click="handleOverlayClick" @keydown="handleKeydown">
    <div class="spotlight-modal" @click.stop ref="modalRef">
      <!-- 搜索输入框 -->
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="Search futures instruments..."
          class="search-input"
          @input="performSearch"
          @keydown="handleInputKeydown"
        />
        <button class="close-btn" @click="$emit('close')" title="Close">×</button>
      </div>

      <!-- 搜索结果 -->
      <div class="results-container" v-if="searchResults.length > 0">
        <div class="results-info">
          <span>{{ searchResults.length }} results</span>
          <span class="hint"><kbd>↑↓</kbd>Navigate <kbd>Enter</kbd>Select</span>
        </div>

        <div class="results-list" ref="resultsList">
          <div
            v-for="(item, index) in searchResults"
            :key="`${item.market}-${item.code}`"
            :class="['result-item', { selected: selectedIndex === index }]"
            @click="selectItem(item, index)"
            @mouseover="selectedIndex = index"
            :ref="el => setResultRef(el, index)"
          >
            <div class="item-left">
              <div class="item-code">{{ item.code }}</div>
              <div class="item-market">{{ item.market }}</div>
            </div>
            <div class="item-name">{{ item.name || 'Unnamed' }}</div>
            <select
              class="add-select"
              @click.stop
              @change="handleAddToGroup(item, $event)"
              :value="''"
            >
              <option value="" disabled>+</option>
              <option
                v-for="group in watchlistGroups"
                :key="group.id"
                :value="group.id"
              >
                {{ group.name }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="empty-state" v-else-if="isSearching">
        <div class="loading-spinner"></div>
        <div class="empty-text">Searching...</div>
      </div>

      <!-- Search Hint -->
      <div class="empty-state" v-else-if="searchQuery.length === 0">
        <div class="empty-text">Enter code or name to search futures instruments</div>
        <div class="examples">e.g: CU, Copper, SHFE</div>
      </div>

      <!-- No Results -->
      <div class="empty-state" v-else>
        <div class="empty-text">No results for "{{ searchQuery }}"</div>
        <div class="examples">Check your input or try other keywords</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch, type ComponentPublicInstance } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { seedService } from '@/services/seedService'
import type { FutureContract, WatchlistGroup, SearchResultItem } from '@/types/watchlist'

// Props
interface Props {
  futures: FutureContract[]
  watchlistGroups: WatchlistGroup[]
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'add-to-watchlist': [groupId: string, item: SearchResultItem]
  'close': []
}>()

// Stores
const dataStore = useDataStore()

// 组件状态
const searchQuery = ref('')
const selectedIndex = ref(0)
const loading = ref(false)
const searchInput = ref<HTMLInputElement>()
const modalRef = ref<HTMLElement>()
const resultsList = ref<HTMLElement>()
const resultRefs = ref<HTMLElement[]>([])

// 搜索结果 (使用远端API)
const searchResults = ref<SearchResultItem[]>([])
const isSearching = ref(false)

// 生命周期
onMounted(() => {
  nextTick(() => {
    searchInput.value?.focus()
  })
})

onUnmounted(() => {
  // 清理引用
  resultRefs.value = []
})

// 监听搜索结果变化，重置选中索引
watch(searchResults, () => {
  selectedIndex.value = 0
  nextTick(() => {
    scrollToSelected()
  })
})

// 清理定时器
onUnmounted(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
})

// 远端搜索期货合约
let searchTimeout: number | null = null

const performSearch = async () => {
  const query = searchQuery.value.trim()

  if (!query) {
    searchResults.value = []
    return
  }

  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(async () => {
    isSearching.value = true
    try {
      const response = await seedService.searchFutures({
        pattern: query,
        limit: 20
      })

      if (response.success) {
        // 将 seedService 返回的数据转换为 SearchResultItem 格式
        searchResults.value = response.data.map(item => ({
          market: item.market,
          code: item.code || item.symbol,
          name: item.name,
          category: item.category || 'Future'
        }))
      } else {
        console.error('Search failed:', response.message)
        searchResults.value = []
      }
    } catch (error) {
      console.error('Search error:', error)
      searchResults.value = []
      dataStore.addLog('error', '搜索失败', error)
    } finally {
      isSearching.value = false
    }
  }, 300) // 300ms 防抖
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
  }
}

const handleInputKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, searchResults.value.length - 1)
      scrollToSelected()
      break

    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      scrollToSelected()
      break

    case 'Enter':
      event.preventDefault()
      if (searchResults.value[selectedIndex.value]) {
        selectItem(searchResults.value[selectedIndex.value], selectedIndex.value)
      }
      break

    case 'Escape':
      emit('close')
      break
  }
}

const handleOverlayClick = () => {
  emit('close')
}

const selectItem = (item: SearchResultItem, index: number) => {
  selectedIndex.value = index

  // 自动添加到第一个自选组（如果存在）
  if (props.watchlistGroups.length > 0) {
    const firstGroup = props.watchlistGroups[0]
    handleAddToGroup(item, { target: { value: firstGroup.id } } as any)
  }
}

const handleAddToGroup = (item: SearchResultItem, event: Event) => {
  const select = event.target as HTMLSelectElement
  const groupId = select.value

  if (!groupId) return

  emit('add-to-watchlist', groupId, item)

  // 重置选择器
  select.value = ''

  dataStore.addLog('info', `已添加 ${item.market}/${item.code} 到自选组`)
}

const setResultRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el && '$el' in el) {
    // Component instance - get the root element
    if (!resultRefs.value) {
      resultRefs.value = []
    }
    resultRefs.value[index] = el.$el as HTMLElement
  } else if (el) {
    // Direct element
    if (!resultRefs.value) {
      resultRefs.value = []
    }
    resultRefs.value[index] = el as HTMLElement
  } else {
    // Clean up when element is unmounted
    if (resultRefs.value && resultRefs.value[index]) {
      delete resultRefs.value[index]
    }
  }
}

const scrollToSelected = () => {
  nextTick(() => {
    const selectedElement = resultRefs.value[selectedIndex.value]
    if (selectedElement && resultsList.value) {
      const container = resultsList.value
      const elementTop = selectedElement.offsetTop
      const elementHeight = selectedElement.offsetHeight
      const containerTop = container.scrollTop
      const containerHeight = container.clientHeight

      if (elementTop < containerTop) {
        container.scrollTop = elementTop
      } else if (elementTop + elementHeight > containerTop + containerHeight) {
        container.scrollTop = elementTop + elementHeight - containerHeight
      }
    }
  })
}
</script>

<style scoped>
.spotlight-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  backdrop-filter: blur(4px);
}

.spotlight-modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 500px;
  max-height: 70vh;
  overflow: hidden;
}

/* 搜索框 */
.search-box {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: white;
}

.search-icon {
  font-size: 16px;
  color: #6c757d;
  margin-right: 12px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 15px;
  color: #212529;
  background: transparent;
}

.search-input::placeholder {
  color: #9ca3af;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #6c757d;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* 结果容器 */
.results-container {
  max-height: 50vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.results-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
  color: #6b7280;
}

.hint {
  font-size: 12px;
}

.hint kbd {
  background: #e5e7eb;
  border-radius: 2px;
  padding: 1px 4px;
  margin: 0 1px;
  font-size: 10px;
}

.results-list {
  flex: 1;
  overflow-y: auto;
}

/* 结果项 */
.result-item {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background-color 0.15s;
  gap: 12px;
}

.result-item:hover {
  background: #f9fafb;
}

.result-item.selected {
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
  padding-left: 17px;
}

.item-left {
  min-width: 80px;
}

.item-code {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-weight: 600;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.2;
}

.item-market {
  font-family: monospace;
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.item-name {
  flex: 1;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-select {
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  min-width: 40px;
  text-align: center;
}

.add-select:hover {
  border-color: #9ca3af;
}

.add-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

/* 空状态 */
.empty-state {
  padding: 40px 20px;
  text-align: center;
}

.empty-text {
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.examples {
  color: #9ca3af;
  font-size: 12px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 8px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 响应式 */
@media (max-width: 640px) {
  .spotlight-overlay {
    padding: 60px 16px;
  }

  .spotlight-modal {
    max-width: none;
  }

  .search-box {
    padding: 12px 16px;
  }

  .results-info {
    padding: 6px 16px;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .result-item {
    padding: 8px 16px;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .item-left {
    min-width: auto;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .item-name {
    align-self: stretch;
  }

  .add-select {
    align-self: flex-end;
  }
}
</style>
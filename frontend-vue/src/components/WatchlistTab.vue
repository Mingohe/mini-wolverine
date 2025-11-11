<template>
  <div class="watchlist-container">
    <!-- 工具栏 -->
    <WatchlistToolbar
      :selected-group="watchlistStore.selectedGroup"
      @create-group="handleCreateGroup"
      @edit-group="handleEditGroup"
      @delete-group="handleDeleteGroup"
      @import-data="handleImportData"
      @export-data="handleExportData"
      @toggle-spotlight="toggleSpotlight"
      @refresh="handleRefresh"
    />

    <!-- 主内容区 -->
    <div class="watchlist-content">
      <!-- 左侧自选组管理 -->
      <WatchlistSidebar
        :groups="watchlistStore.groups"
        :selected-group="watchlistStore.selectedGroup"
        :loading="watchlistStore.loading"
        @select-group="handleSelectGroup"
        @create-group="handleCreateGroup"
        @delete-group="handleDeleteGroup"
      />

      <!-- 右侧行情表格 -->
      <WatchlistTable
        :items="watchlistStore.selectedGroupItems"
        :loading="watchlistStore.loading"
        :selected-group="watchlistStore.selectedGroup"
        :market-data="watchlistStore.marketData"
        :sort-config="watchlistStore.sortConfig"
        :subscribed-fields="watchlistStore.subscribedFields"
        @refresh="handleRefresh"
        @sort="handleSort"
        @remove-item="handleRemoveItem"
      />
    </div>

    <!-- 全局搜索覆盖层 -->
    <Spotlight
      v-if="watchlistStore.spotlightVisible"
      :futures="[]"
      :watchlist-groups="watchlistStore.customGroups"
      @add-to-watchlist="handleAddToWatchlist"
      @close="hideSpotlight"
    />

    <!-- 创建/编辑组对话框 -->
    <GroupDialog
      v-if="groupDialogVisible"
      :mode="groupDialogMode"
      :group="editingGroup"
      @save="handleSaveGroup"
      @cancel="closeGroupDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { useDataStore } from '@/stores/dataStore'
import WatchlistToolbar from './watchlist/WatchlistToolbar.vue'
import WatchlistSidebar from './watchlist/WatchlistSidebar.vue'
import WatchlistTable from './watchlist/WatchlistTable.vue'
import Spotlight from './watchlist/Spotlight.vue'
import GroupDialog from './watchlist/GroupDialog.vue'
import type { WatchlistGroup, WatchlistItem, SearchResultItem } from '@/types/watchlist'

// Store 实例
const watchlistStore = useWatchlistStore()
const dataStore = useDataStore()

// 组件状态
const groupDialogVisible = ref(false)
const groupDialogMode = ref<'create' | 'edit'>('create')
const editingGroup = ref<WatchlistGroup | null>(null)

// 初始化
onMounted(async () => {
  try {
    await watchlistStore.init()
    // 不再需要预加载所有期货数据，因为 Spotlight 使用远端搜索

    // 注册全局键盘快捷键
    document.addEventListener('keydown', handleGlobalKeydown)

    // 为开发者提供手动迁移功能
    if (typeof window !== 'undefined') {
      (window as any).migrateWatchlistNames = async () => {
        try {
          await watchlistStore.init()
          console.log('✅ Manual migration completed. Please refresh to see changes.')
        } catch (error) {
          console.error('❌ Manual migration failed:', error)
        }
      }
    }

    console.log('✅ Watchlist tab initialized')
    console.log('💡 Developer tip: Run migrateWatchlistNames() in console to manually trigger name migration')
  } catch (error) {
    console.error('❌ Failed to initialize watchlist tab:', error)
    dataStore.addLog('error', 'Failed to initialize watchlist', error)
  }
})

onUnmounted(() => {
  // 清理全局事件监听器
  document.removeEventListener('keydown', handleGlobalKeydown)
})

// 全局键盘快捷键处理
const handleGlobalKeydown = (event: KeyboardEvent) => {
  // Ctrl+K 或 Cmd+K 打开搜索
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    toggleSpotlight()
  }

  // ESC 关闭搜索
  if (event.key === 'Escape') {
    hideSpotlight()
  }
}

// 工具栏事件处理
const handleCreateGroup = () => {
  groupDialogMode.value = 'create'
  editingGroup.value = null
  groupDialogVisible.value = true
}

const handleEditGroup = (group: WatchlistGroup) => {
  groupDialogMode.value = 'edit'
  editingGroup.value = group
  groupDialogVisible.value = true
}

const handleDeleteGroup = async (groupId: string) => {
  if (!confirm('Are you sure to delete this watchlist?')) return

  try {
    await watchlistStore.deleteGroup(groupId)
    dataStore.addLog('success', `Watchlist deleted successfully`)
  } catch (error) {
    console.error('Failed to delete group:', error)
    dataStore.addLog('error', 'Failed to delete watchlist', error)
  }
}

const handleImportData = () => {
  // TODO: 实现数据导入功能
  console.log('Import data - to be implemented')
}

const handleExportData = () => {
  // TODO: 实现数据导出功能
  console.log('Export data - to be implemented')
}

const handleRefresh = () => {
  watchlistStore.refreshMarketData()
  dataStore.addLog('info', 'Refreshing market data...')
}

// 侧边栏事件处理
const handleSelectGroup = (groupId: string) => {
  watchlistStore.selectGroup(groupId)
  dataStore.addLog('info', `Selected watchlist: ${watchlistStore.selectedGroup?.name}`)
}

// 表格事件处理
const handleSort = (field: string, direction: 'asc' | 'desc') => {
  watchlistStore.setSortConfig(field, direction)
}

const handleRemoveItem = async (item: WatchlistItem) => {
  if (!watchlistStore.selectedGroup) return

  try {
    await watchlistStore.removeFromWatchlist(
      watchlistStore.selectedGroup.id,
      item.market,
      item.code
    )
    dataStore.addLog('success', `Removed ${item.market}/${item.code}`)
  } catch (error) {
    console.error('Failed to remove item:', error)
    dataStore.addLog('error', 'Failed to remove instrument', error)
  }
}

// 搜索相关
const toggleSpotlight = () => {
  if (watchlistStore.spotlightVisible) {
    hideSpotlight()
  } else {
    watchlistStore.showSpotlight()
  }
}

const hideSpotlight = () => {
  watchlistStore.hideSpotlight()
}

const handleAddToWatchlist = async (groupId: string, searchItem: SearchResultItem) => {
  try {
    // 将 SearchResultItem 转换为 WatchlistItem
    const item: WatchlistItem = {
      market: searchItem.market,
      code: searchItem.code,
      name: searchItem.name,
      category: searchItem.category,
      addedAt: new Date()
    }
    await watchlistStore.addToWatchlist(groupId, item)
    dataStore.addLog('success', `Added ${item.market}/${item.code} to watchlist and fetching market data...`)
    hideSpotlight()
  } catch (error) {
    console.error('Failed to add to watchlist:', error)
    dataStore.addLog('error', 'Failed to add to watchlist', error)
  }
}

// 组对话框处理
const handleSaveGroup = async (groupData: { name: string; color?: string }) => {
  try {
    if (groupDialogMode.value === 'create') {
      const groupId = await watchlistStore.createGroup(groupData.name, groupData.color)
      watchlistStore.selectGroup(groupId)
      dataStore.addLog('success', `Created watchlist: ${groupData.name}`)
    } else {
      // TODO: 实现编辑组功能
      console.log('Edit group - to be implemented')
    }
    closeGroupDialog()
  } catch (error) {
    console.error('Failed to save group:', error)
    dataStore.addLog('error', 'Failed to save watchlist', error)
  }
}

const closeGroupDialog = () => {
  groupDialogVisible.value = false
  editingGroup.value = null
}
</script>

<style scoped>
.watchlist-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
}

.watchlist-content {
  display: flex;
  flex: 1;
  min-height: 400px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .watchlist-content {
    flex-direction: column;
    min-height: auto;
  }
}
</style>
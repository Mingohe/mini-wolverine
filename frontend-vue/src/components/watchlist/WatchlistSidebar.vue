<template>
  <div class="watchlist-sidebar">
    <div class="sidebar-header">
      <h3>Watchlist Management</h3>
      <button
        class="refresh-btn"
        @click="$emit('refresh')"
        :disabled="loading"
        title="Refresh Data"
      >
        <span class="refresh-icon" :class="{ spinning: loading }">🔄</span>
      </button>
    </div>

    <!-- 自定义组 -->
    <div class="group-section">
      <div class="section-header">
        <h4 class="section-title">Watchlists</h4>
        <button class="add-group-btn" @click="$emit('create-group')" title="Create New Watchlist">
          +
        </button>
      </div>

      <div class="groups-list">
        <div
          v-for="group in customGroups"
          :key="group.id"
          :class="['group-item', { active: selectedGroup?.id === group.id }]"
          @click="selectGroup(group)"
        >
          <div class="group-info">
            <span class="group-icon" :style="{ color: group.color || '#0066cc' }">●</span>
            <span class="group-name">{{ group.name }}</span>
            <span class="group-count">({{ group.items?.length || 0 }})</span>
          </div>

          <div class="group-actions">
            <button
              class="group-action-btn edit-btn"
              @click.stop="$emit('edit-group', group)"
              title="Edit Group"
            >
              ✏️
            </button>
            <button
              class="group-action-btn delete-btn"
              @click.stop="confirmDeleteGroup(group)"
              title="Delete Group"
            >
              🗑️
            </button>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="customGroups.length === 0" class="empty-groups">
          <div class="empty-icon">📂</div>
          <div class="empty-text">No watchlists</div>
          <button class="create-first-btn" @click="$emit('create-group')">
            Create First Watchlist
          </button>
        </div>
      </div>
    </div>

    <!-- 添加新组按钮 -->
    <div class="sidebar-footer" v-if="customGroups.length > 0">
      <button class="add-group-btn-large" @click="$emit('create-group')">
        <span class="add-icon">+</span>
        Create New Watchlist
      </button>
    </div>

    <!-- 统计信息 -->
    <div class="sidebar-stats" v-if="selectedGroup">
      <div class="stats-item">
        <span class="stats-label">Items in current group:</span>
        <span class="stats-value">{{ selectedGroup.items?.length || 0 }}</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">Last updated:</span>
        <span class="stats-value">{{ formatUpdateTime(selectedGroup.updatedAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WatchlistGroup } from '@/types/watchlist'

// Props
interface Props {
  groups: WatchlistGroup[]
  selectedGroup: WatchlistGroup | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Emits
const emit = defineEmits<{
  'select-group': [groupId: string]
  'create-group': []
  'edit-group': [group: WatchlistGroup]
  'delete-group': [groupId: string]
  'refresh': []
}>()

// 计算属性
const customGroups = computed(() => {
  return props.groups.filter(g => g.type === 'custom')
})

// 方法
const selectGroup = (group: WatchlistGroup) => {
  emit('select-group', group.id)
}

const confirmDeleteGroup = (group: WatchlistGroup) => {
  if (confirm(`Are you sure you want to delete watchlist "${group.name}"? This will remove all items in the group.`)) {
    emit('delete-group', group.id)
  }
}

const formatUpdateTime = (date: Date): string => {
  if (!date) return 'Unknown'

  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minutes ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hours ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} days ago`

  return date.toLocaleDateString()
}
</script>

<style scoped>
.watchlist-sidebar {
  width: 280px;
  background: #f8f9fa;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 8px 12px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.refresh-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 3px;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.refresh-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 12px;
  display: inline-block;
  transition: transform 0.5s;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.group-section {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px 4px;
}

.section-title {
  margin: 0;
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.add-group-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  background: white;
  color: #3b82f6;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.add-group-btn:hover {
  background: #3b82f6;
  color: white;
  transform: scale(1.05);
}

.groups-list {
  padding: 0 6px;
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  margin: 1px 0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  background: white;
  border: 1px solid transparent;
}

.group-item:hover {
  background: #f3f4f6;
  border-color: #e5e7eb;
}

.group-item.active {
  background: #eff6ff;
  border-color: #3b82f6;
  box-shadow: 0 1px 2px rgba(59, 130, 246, 0.1);
}

.group-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.group-icon {
  margin-right: 6px;
  font-size: 10px;
}

.group-name {
  font-weight: 500;
  color: #374151;
  margin-right: 6px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.group-count {
  font-size: 10px;
  color: #9ca3af;
  margin-right: 6px;
}

.group-actions {
  display: flex;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.group-item:hover .group-actions {
  opacity: 1;
}

.group-action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  font-size: 10px;
  margin-left: 2px;
  transition: background-color 0.2s;
}

.group-action-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.empty-groups {
  text-align: center;
  padding: 24px 16px;
  color: #9ca3af;
  font-size: 12px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  margin-bottom: 16px;
}

.create-first-btn,
.add-group-btn-large {
  background: #0066cc;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.create-first-btn:hover,
.add-group-btn-large:hover {
  background: #0052a3;
  transform: translateY(-1px);
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background: white;
}

.add-group-btn-large {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-icon {
  margin-right: 8px;
  font-size: 16px;
}

.sidebar-stats {
  padding: 12px 16px;
  background: white;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
}

.stats-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.stats-item:last-child {
  margin-bottom: 0;
}

.stats-label {
  color: #6c757d;
}

.stats-value {
  color: #212529;
  font-weight: 500;
}

/* 响应式 */
@media (max-width: 768px) {
  .watchlist-sidebar {
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }

  .group-section {
    max-height: 200px;
  }
}
</style>
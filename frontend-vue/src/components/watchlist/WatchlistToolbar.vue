<template>
  <div class="watchlist-toolbar">
    <div class="toolbar-section">
      <h2 class="toolbar-title">Watchlist Management</h2>
      <div class="toolbar-subtitle" v-if="selectedGroup">
        Current: {{ selectedGroup.name }}
      </div>
    </div>

    <div class="toolbar-actions">
      <button
        class="toolbar-btn primary"
        @click="$emit('create-group')"
        title="Create new watchlist"
      >
        <span class="btn-icon">📂</span>
        New Watchlist
      </button>

      <button
        v-if="selectedGroup && selectedGroup.type === 'custom'"
        class="toolbar-btn"
        @click="$emit('edit-group', selectedGroup)"
        title="Edit current watchlist"
      >
        <span class="btn-icon">✏️</span>
        Edit Group
      </button>

      <button
        v-if="selectedGroup && selectedGroup.type === 'custom'"
        class="toolbar-btn danger"
        @click="handleDeleteGroup"
        title="Delete current watchlist"
      >
        <span class="btn-icon">🗑️</span>
        Delete Group
      </button>
      <div class="toolbar-divider"></div>

      <button
        class="toolbar-btn spotlight-btn"
        @click="$emit('toggle-spotlight')"
        title="Global search (Ctrl+K)"
      >
        <span class="btn-icon">🔍</span>
        Search & Add
        <span class="shortcut">Ctrl+K</span>
      </button>

      <button
        class="toolbar-btn refresh-btn"
        @click="$emit('refresh')"
        title="Refresh market data"
      >
        <span class="btn-icon">🔄</span>
        Refresh
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WatchlistGroup } from '@/types/watchlist'

// Props
interface Props {
  selectedGroup: WatchlistGroup | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'create-group': []
  'edit-group': [group: WatchlistGroup]
  'delete-group': [groupId: string]
  'import-data': []
  'export-data': []
  'toggle-spotlight': []
  'refresh': []
}>()

// Methods
const handleDeleteGroup = () => {
  if (!props.selectedGroup) return

  if (confirm(`Are you sure you want to delete watchlist "${props.selectedGroup.name}"? This will remove all items in the group.`)) {
    emit('delete-group', props.selectedGroup.id)
  }
}
</script>

<style scoped>
.watchlist-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  color: #495057;
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.toolbar-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #212529;
}

.toolbar-subtitle {
  margin: 1px 0 0 0;
  font-size: 11px;
  color: #6c757d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  background: white;
  color: #6b7280;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 400;
  transition: all 0.2s;
  white-space: nowrap;
}

.toolbar-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
  color: #374151;
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-btn.primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
  font-weight: 500;
}

.toolbar-btn.primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

.toolbar-btn.danger:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

.toolbar-btn.spotlight-btn {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #2563eb;
}

.toolbar-btn.spotlight-btn:hover:not(:disabled) {
  background: #dbeafe;
  border-color: #93c5fd;
}

.btn-icon {
  margin-right: 3px;
  font-size: 11px;
}

.shortcut {
  margin-left: 4px;
  font-size: 9px;
  background: rgba(0, 0, 0, 0.1);
  padding: 1px 3px;
  border-radius: 2px;
  font-family: monospace;
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background: #d1d5db;
  margin: 0 2px;
}

/* 响应式 */
@media (max-width: 768px) {
  .watchlist-toolbar {
    flex-direction: column;
    gap: 6px;
    align-items: stretch;
    padding: 6px 8px;
  }

  .toolbar-actions {
    justify-content: center;
    gap: 3px;
  }

  .toolbar-btn {
    padding: 3px 6px;
    font-size: 10px;
  }

  .shortcut {
    display: none;
  }

  .toolbar-divider {
    display: none;
  }
}

@media (max-width: 480px) {
  .toolbar-actions {
    flex-direction: column;
    width: 100%;
  }

  .toolbar-btn {
    width: 100%;
    justify-content: center;
    padding: 4px 8px;
  }
}
</style>
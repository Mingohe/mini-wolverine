<template>
  <div class="container">
    <nav class="tab-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-button"
        :class="{ active: activeTab === tab.id }"
        @click="setActiveTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>
    
    <div class="tab-content">
      <div v-if="activeTab === 'watchlist'">
        <WatchlistTab />
      </div>

      <div v-else-if="activeTab === 'schema'">
        <!-- <div class="section-header">
          <h3 class="title">Schema Definitions</h3>
        </div> -->
        <SchemaViewer />
      </div>

      <div v-else-if="activeTab === 'historical'">
        <HistoricalDataQuery />
      </div>

      <div v-else-if="activeTab === 'formula'">
        <FormulaViewer />
      </div>

      <div v-else-if="activeTab === 'test'">
        <SubscriptionTest />
      </div>
      
      <div v-else-if="activeTab === 'console'">
        <div class="section-header">
          <h3 class="title">Application Console</h3>
          <button class="btn btn-primary" @click="clearConsole">
            Clear
          </button>
        </div>
        
        <div class="content-box">
          <div v-if="logs && logs.length > 0" class="log-entries">
            <div
              v-for="(log, index) in logs.slice(-50)"
              :key="index"
              class="log-entry"
            >
              <span class="log-time">{{ formatTime(log.timestamp) }}</span>
              <span class="log-level" :class="log.level">{{ log.level.toUpperCase() }}</span>
              <span>{{ log.message }}</span>
              <div v-if="log.data" class="log-data">
                {{ typeof log.data === 'string' ? log.data : JSON.stringify(log.data) }}
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            No logs yet.<br />
            Connect to backend to see application logs.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/dataStore'
import SchemaViewer from './SchemaViewer.vue'
import HistoricalDataQuery from './HistoricalDataQuery.vue'
import FormulaViewer from './FormulaViewer.vue'
import SubscriptionTest from './SubscriptionTest.vue'
import WatchlistTab from './WatchlistTab.vue'
import type { TabItem } from '@/types'

const dataStore = useDataStore()
const activeTab = ref<string>('watchlist')

const tabs: TabItem[] = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'schema', label: 'Schema & Revisions' },
  { id: 'historical', label: 'Historical Data' },
  { id: 'formula', label: 'Formula Viewer' },
  { id: 'test', label: 'Subscription Test' },
  { id: 'console', label: 'Console' }
]

const logs = computed(() => dataStore.logs)

const setActiveTab = (tabId: string) => {
  activeTab.value = tabId
}

const clearConsole = () => {
  window.location.reload()
}

const formatTime = (timestamp: Date) => {
  return new Date(timestamp).toLocaleTimeString()
}
</script>

<style scoped>
.container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

.tab-nav {
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.tab-button {
  padding: 16px 24px;
  border: none;
  background: transparent;
  color: #6c757d;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-button.active {
  color: #0066cc;
  background: white;
  border-bottom: 2px solid #0066cc;
}

.tab-button:hover:not(.active) {
  color: #495057;
}

.tab-content {
  padding: 24px;
  min-height: 400px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.title {
  margin: 0;
  color: #212529;
  font-size: 18px;
  font-weight: 600;
}

.btn {
  background: #0066cc;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:hover:not(:disabled) {
  background: #0052a3;
}

.btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.content-box {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  max-height: 500px;
  overflow-y: auto;
}

.log-entries {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
}

.log-entry {
  padding: 8px 16px;
  border-bottom: 1px solid #f1f3f4;
  font-size: 13px;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #6c757d;
  margin-right: 12px;
}

.log-level {
  font-weight: 600;
  margin-right: 12px;
}

.log-level.error {
  color: #dc3545;
}

.log-level.success {
  color: #28a745;
}

.log-level.warning {
  color: #ffc107;
}

.log-level.info {
  color: #17a2b8;
}

.log-data {
  margin-top: 4px;
  opacity: 0.7;
  font-size: 12px;
}

.empty-state {
  text-align: center;
  color: #6c757d;
  padding: 60px 20px;
  font-size: 14px;
}
</style>

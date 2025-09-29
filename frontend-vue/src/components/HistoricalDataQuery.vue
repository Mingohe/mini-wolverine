<template>
  <div class="historical-query-container">
    <!-- Left Panel: Schema Tree -->
    <div class="left-panel" :class="{ collapsed: leftPanelCollapsed }">
      <div class="panel-header">
        <div class="panel-title">
          <span class="panel-icon">📊</span>
          <span class="panel-text">Schema Tree</span>
        </div>
        <button class="collapse-button" @click="toggleLeftPanel">
          {{ leftPanelCollapsed ? '▶' : '◀' }}
        </button>
        </div>
        
      <div v-if="!leftPanelCollapsed" class="panel-content">
        <div v-if="!schema || Object.keys(schema).length === 0" class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-text">No schema loaded yet.<br />Connect to server to load schema definitions.</div>
        </div>
        
        <div v-else class="schema-tree-container">
          <div class="tree-header">
          <input
              v-model="searchQuery" 
            type="text"
              placeholder="Search schemas, markets, or revisions..."
              class="search-input" 
            />
          </div>
          <div class="tree-content">
            <div v-if="filteredTreeData.length > 0">
              <Tree 
                :value="filteredTreeData" 
                :selection-mode="'single'" 
                :selection-keys="selectedKeys"
                :expanded-keys="expandedKeys" 
                @node-select="onNodeSelect" 
                @node-expand="onNodeExpand"
                @node-collapse="onNodeCollapse" 
                class="custom-tree"
              >
                <template #default="slotProps">
                  <div class="tree-node-content">
                    <span class="tree-icon">{{ getTreeIcon(slotProps.node) }}</span>
                    <span class="tree-label">{{ slotProps.node.name }}</span>
                    <span v-if="slotProps.node.type === 'revision'" class="revision-badge">
                      {{ slotProps.node.revision }}
                    </span>
                  </div>
                </template>
              </Tree>
            </div>
            <div v-else class="empty-state">
              <div class="empty-text">No tree nodes to display</div>
            </div>
          </div>
        </div>
      </div>
        </div>
        
    <!-- Center Panel: Main Content -->
    <div class="center-panel">
      <!-- Query Configuration Header -->
      <div class="query-header">
        <div class="query-title">
          <div class="query-status">
            <span v-if="selectedSchema" class="status-item">
              <span class="status-label">Schema:</span>
              <span class="status-value">{{ selectedSchema.fullName }}</span>
            </span>
            <span v-if="selectedFutures" class="status-item">
              <span class="status-label">Instrument:</span>
              <span class="status-value">{{ selectedFutures.code }} ({{ selectedFutures.market }})</span>
            </span>
          </div>
        </div>
        
        <div class="view-mode-toggle">
          <!-- <button 
            :class="['mode-button', { active: viewMode === 'table' }]"
            @click="viewMode = 'table'"
          >
            📊 Table
          </button>
          <button 
            :class="['mode-button', { active: viewMode === 'chart' }]"
            @click="viewMode = 'chart'"
          >
            📈 Chart
          </button> -->
        </div>
        </div>
        
      <!-- Query Configuration -->
      <div class="query-config">
        <div class="config-section">
          <div class="section-header">
            <h4 class="section-title">Field Selection</h4>
            <div class="field-actions">
              <button 
                v-if="selectedSchema && selectedSchema.fullMeta?.fields"
                class="select-all-button"
                @click="selectAllFields"
                :disabled="allFieldsSelected"
              >
                {{ allFieldsSelected ? 'All Selected' : 'Select All' }}
              </button>
              <button 
                v-if="selectedSchema && selectedSchema.fullMeta?.fields && selectedFields.size > 0"
                class="clear-all-button"
                @click="clearAllFields"
              >
                Clear All
              </button>
            </div>
          </div>
          <div class="field-selector">
            <div v-if="selectedSchema && selectedSchema.fullMeta?.fields" class="field-grid">
              <label 
                v-for="(field, index) in selectedSchema.fullMeta.fields" 
                :key="index" 
                class="field-option"
              >
                <input
                  type="checkbox" 
                  :checked="selectedFields.has(field.name)"
                  @change="handleFieldToggle(field.name)" 
                />
                <span class="field-name">{{ field.name || `field_${index}` }}</span>
                <span class="field-type">({{ getTypeName(field.type) }})</span>
              </label>
            </div>
            <div v-else class="empty-state">
              <div class="empty-text">Select a schema revision to choose fields</div>
            </div>
          </div>
        </div>
        
        <div class="config-section">
          <h4 class="section-title">Time Configuration</h4>
          <div class="time-config-grid">
            <div class="time-field">
              <label class="form-label">From Time</label>
              <input
                v-model="queryParams.fromTime" 
                type="datetime-local" 
                class="form-input datetime-input" 
              />
            </div>
            <div class="time-field">
              <label class="form-label">To Time</label>
              <input
                v-model="queryParams.toTime" 
                type="datetime-local" 
                class="form-input datetime-input" 
              />
            </div>
          </div>
          
          <div class="time-config-row">
            <div class="time-field">
              <label class="form-label">Granularity</label>
              <select v-model="queryParams.granularity" class="form-select">
                <option value="60">1min (60s)</option>
                <option value="300">5min (300s)</option>
                <option value="900">15min (900s)</option>
                <option value="1800">30min (1800s)</option>
                <option value="3600">1h (3600s)</option>
                <option value="86400">1day (86400s)</option>
              </select>
            </div>
            <div class="time-field">
              <button
                class="query-button"
                @click="executeQuery"
                :disabled="!canExecuteQuery || isQuerying"
              >
                {{ isQuerying ? 'Querying...' : 'Execute Query' }}
              </button>
            </div>
          </div>
        </div>
    </div>
    
      <!-- Results Display -->
      <div class="results-section">
        <div v-if="historicalData.length > 0" class="results-container">
      <div class="results-header">
            <h4 class="results-title">Query Results ({{ historicalData.length }} records)</h4>
            <div class="results-actions">
              <button class="export-button" @click="exportData">
                📥 Export
              </button>
        </div>
      </div>
      
          <!-- Table View -->
          <div v-if="viewMode === 'table'" class="table-view">
            <div class="data-grid">
              <table class="data-table">
          <thead>
            <tr>
                    <th class="data-header">Timestamp</th>
                    <th class="data-header">Row ID</th>
                    <th v-for="field in Array.from(selectedFields)" :key="field" class="data-header">
                      {{ field }}
              </th>
            </tr>
          </thead>
          <tbody>
                  <tr v-for="(record, index) in paginatedData" :key="index" class="data-row">
                    <td class="data-cell">{{ new Date(record.timestamp).toLocaleString() }}</td>
                    <td class="data-cell">{{ record.row_id }}</td>
                    <td v-for="field in Array.from(selectedFields)" :key="field" class="data-cell">
                      {{ renderFieldValue(record[field]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div v-if="totalPages > 1" class="pagination">
        <button
                @click="currentPage = Math.max(1, currentPage - 1)" 
          :disabled="currentPage === 1"
                class="pagination-button"
        >
          Previous
        </button>
              <span class="pagination-info">
                Page {{ currentPage }} of {{ totalPages }} ({{ historicalData.length }} total records)
        </span>
        <button
                @click="currentPage = Math.min(totalPages, currentPage + 1)"
          :disabled="currentPage === totalPages"
                class="pagination-button"
        >
          Next
        </button>
            </div>
          </div>

          <!-- Chart View (Placeholder) -->
          <div v-else-if="viewMode === 'chart'" class="chart-view">
            <div class="chart-placeholder">
              <div class="chart-icon">📈</div>
              <div class="chart-text">Chart View</div>
              <div class="chart-subtitle">Chart visualization will be implemented here</div>
            </div>
      </div>
    </div>
    
    <div v-else-if="hasQueried" class="empty-results">
          <div class="empty-icon">🔍</div>
          <div class="empty-text">No results found for the given query parameters.</div>
          <div class="empty-subtitle">Try adjusting your search criteria.</div>
        </div>
        
        <div v-else class="empty-results">
          <div class="empty-icon">📊</div>
          <div class="empty-text">Select schema and instrument, then configure query parameters</div>
          <div class="empty-subtitle">Choose fields, set time range, and execute query to see results</div>
        </div>
      </div>
    </div>

    <!-- Right Panel: Futures List -->
    <div class="right-panel" :class="{ collapsed: rightPanelCollapsed }">
      <div class="panel-header">
        <div class="panel-title">
          <span class="panel-icon">📈</span>
          <span class="panel-text">Futures</span>
        </div>
        <button class="collapse-button" @click="toggleRightPanel">
          {{ rightPanelCollapsed ? '◀' : '▶' }}
        </button>
      </div>
      
      <div v-if="!rightPanelCollapsed" class="panel-content">
        <div class="futures-search">
          <input 
            v-model="futuresSearchQuery" 
            type="text" 
            placeholder="Search futures..."
            class="search-input"
            @input="searchFutures"
          />
        </div>
        
        <div class="futures-list">
          <div v-if="loadingFutures" class="loading-state">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading futures...</div>
          </div>
          
          <div v-else-if="allFutures.length > 0" class="futures-grid">
            <div 
              v-for="future in allFutures" 
              :key="`${future.market}-${future.code}`"
              :class="['future-item', { selected: selectedFutures && selectedFutures.code === future.code && selectedFutures.market === future.market }]"
              @click="selectFutures(future)"
            >
              <div class="future-header">
                <div class="future-code">{{ future.code }}</div>
                <div class="future-market">{{ future.market }}</div>
              </div>
              <div class="future-name">{{ future.name }}</div>
            </div>
          </div>
          
          <div v-else class="empty-state">
            <div class="empty-text">No futures found</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDataStore } from '../stores/dataStore'
import { useWebSocketStore } from '../stores/websocketStore'
import type { TreeNode, QueryParams } from '@/types'
import { seedService } from '@/services/seedService'

// PrimeVue Components
import Tree from 'primevue/tree'

const dataStore = useDataStore()
const wsStore = useWebSocketStore()

// Panel State
const leftPanelCollapsed = ref<boolean>(false)
const rightPanelCollapsed = ref<boolean>(false)
const viewMode = ref<'table' | 'chart'>('table')

// Schema Tree State (from SchemaViewer)
const searchQuery = ref<string>('')
const selectedItem = ref<TreeNode | null>(null)
const selectedKeys = ref<Record<string, boolean>>({})
const expandedKeys = ref<Record<string, boolean>>({})
const selectedSchema = ref<TreeNode | null>(null)

// Futures State
const futuresSearchQuery = ref<string>('')
const allFutures = ref<any[]>([])
const selectedFutures = ref<any>(null)
const loadingFutures = ref<boolean>(false)

// Query State
const queryParams = ref<QueryParams>({
  market: '',
  code: '',
  namespace: '',
  metaName: '',
  granularity: '86400', // Default to 1 day
  fromTime: '',
  toTime: '',
  fieldCount: 10,
  revision: '0xFFFFFFFF'
})

const historicalData = ref<any[]>([])
const currentPage = ref<number>(1)
const pageSize = ref<number>(100)
const selectedFields = ref<Set<string>>(new Set())
const isQuerying = ref<boolean>(false)
const hasQueried = ref<boolean>(false)

// Computed
const schema = computed(() => dataStore.schema)

const treeData = computed(() => {
  if (!schema.value || Object.keys(schema.value).length === 0) {
    return []
  }

  const tree: any[] = []

  // Create namespace nodes directly from schema data
  const namespaceKeys = ["0", "1"] as const
  namespaceKeys.forEach((namespaceKey: string) => {
    const namespaceName = namespaceKey === "0" ? "Global" : "Private"
    const namespaceData = (schema.value as any)[namespaceKey]

    if (!namespaceData) return

    // Group metas by name and collect all their revisions
    const metaGroups: Record<string, any> = {}
    Object.entries(namespaceData).forEach(([metaId, metaInfo]: [string, any]) => {
      const metaName =
        metaInfo.displayName ||
        (metaInfo.name && metaInfo.name.includes("::") ? metaInfo.name.split("::").pop() : metaInfo.name) ||
        `Meta ${metaId}`

      const revision = metaInfo.revision || 0

      if (!metaGroups[metaName]) {
        metaGroups[metaName] = {
          metaName,
          revisions: [],
        }
      }

      metaGroups[metaName].revisions.push({
        key: `revision_${namespaceKey}_${metaId}_${revision}`,
        id: `revision_${namespaceKey}_${metaId}_${revision}`,
        type: "revision" as const,
        name: `Rev ${revision}`,
        namespaceKey,
        metaName,
        revision: revision,
        metaId,
        fullMeta: metaInfo,
        fullName: `${namespaceName.toLowerCase()}::${metaName}`,
      })
    })

    // Create meta children with grouped revisions
    const metaChildren: any[] = Object.entries(metaGroups).map(([metaName, group]) => {
      // Sort revisions by revision number
      const sortedRevisions = group.revisions.sort((a: any, b: any) => a.revision - b.revision)

      return {
        key: `meta_${namespaceKey}_${metaName}`,
        id: `meta_${namespaceKey}_${metaName}`,
        type: "meta" as const,
        name: `${metaName} (${sortedRevisions.length} rev${sortedRevisions.length > 1 ? "s" : ""})`,
        namespaceKey,
        metaName,
        children: sortedRevisions,
      }
    })

    if (metaChildren.length > 0) {
      tree.push({
        key: `namespace_${namespaceKey}`,
        id: `namespace_${namespaceKey}`,
        type: "namespace" as const,
        name: namespaceName,
        namespaceKey,
        children: metaChildren.sort((a: any, b: any) => a.name.localeCompare(b.name)),
      })
    }
  })

  return tree
})

const filteredTreeData = computed(() => {
  if (!searchQuery.value.trim()) return treeData.value

  const filterTree = (nodes: any[]): any[] => {
    return nodes.reduce((filtered: any[], node: any) => {
      const matchesSearch =
        node.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        node.fullName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        node.namespaceKey?.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Filter children recursively
      const filteredChildren = node.children ? filterTree(node.children) : []

      // Include node if it matches search or has matching children
      if (matchesSearch || filteredChildren.length > 0) {
        const filteredNode: any = {
          ...node,
          children: filteredChildren,
        }

        filtered.push(filteredNode)
      }

      return filtered
    }, [])
  }

  return filterTree(treeData.value)
})

const canExecuteQuery = computed(() => {
  return selectedSchema.value && selectedFutures.value && queryParams.value.fromTime && queryParams.value.toTime && selectedFields.value.size > 0
})

const allFieldsSelected = computed(() => {
  if (!selectedSchema.value || !selectedSchema.value.fullMeta?.fields) {
    return false
  }
  const totalFields = selectedSchema.value.fullMeta.fields.length
  return selectedFields.value.size === totalFields && totalFields > 0
})

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return historicalData.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(historicalData.value.length / pageSize.value)
})

// Methods
const toggleLeftPanel = () => {
  leftPanelCollapsed.value = !leftPanelCollapsed.value
}

const toggleRightPanel = () => {
  rightPanelCollapsed.value = !rightPanelCollapsed.value
}

const getTreeIcon = (item: any): string => {
  if (item.type === "revision") return "●"
  if (item.type === "namespace") return "📁"
  if (item.type === "meta") return "📋"
  return "●"
}

const getTypeName = (type: number): string => {
  const types: Record<number, string> = {
    0x01: "INT",
    0x02: "DOUBLE",
    0x03: "STRING",
    0x04: "VINT",
    0x05: "VDOUBLE",
    0x06: "VSTRING",
    0x07: "INT64",
    0x08: "VINT64",
  }
  return types[type] || `UNKNOWN_0x${type.toString(16).toUpperCase()}`
}

const onNodeSelect = (node: any) => {
  if (node.type === 'revision') {
    selectedItem.value = node
    selectedSchema.value = node

    // Update selected keys for Tree component
    selectedKeys.value = { [node.id]: true }

    // Auto-fill query params
    if (node.namespaceKey) {
      queryParams.value.namespace = node.namespaceKey
    }
    if (node.revision !== undefined) {
      queryParams.value.revision = `0x${node.revision.toString(16).toUpperCase()}`
    }
    if (node.metaName) {
      queryParams.value.metaName = node.metaName
    }

    // Clear selected fields when schema changes
    selectedFields.value.clear()
  } else {
    // For non-revision nodes, toggle their expand/collapse state
    const nodeKey = node.key
    const newExpandedKeys = { ...expandedKeys.value }

    if (newExpandedKeys[nodeKey]) {
      delete newExpandedKeys[nodeKey]
    } else {
      newExpandedKeys[nodeKey] = true
    }

    expandedKeys.value = newExpandedKeys
  }
}

const onNodeExpand = (node: any) => {
  const newExpandedKeys = { ...expandedKeys.value }
  newExpandedKeys[node.key] = true
  expandedKeys.value = newExpandedKeys
}

const onNodeCollapse = (node: any) => {
  const newExpandedKeys = { ...expandedKeys.value }
  delete newExpandedKeys[node.key]
  expandedKeys.value = newExpandedKeys
}

const handleFieldToggle = (fieldName: string) => {
  const newSelected = new Set(selectedFields.value)
  if (newSelected.has(fieldName)) {
    newSelected.delete(fieldName)
  } else {
    newSelected.add(fieldName)
  }
  selectedFields.value = newSelected
}

const selectAllFields = () => {
  if (!selectedSchema.value || !selectedSchema.value.fullMeta?.fields) {
    return
  }
  
  const allFieldNames = selectedSchema.value.fullMeta.fields.map((field: any) => field.name)
  selectedFields.value = new Set(allFieldNames)
}

const clearAllFields = () => {
  selectedFields.value.clear()
}

const loadFutures = async (searchPattern?: string) => {
  loadingFutures.value = true
  try {
    const params = searchPattern ? { pattern: searchPattern } : {}
    const result = await seedService.searchFutures(params)
    
    if (result.success) {
      allFutures.value = result.data
    } else {
      console.error('Failed to load futures:', result.message)
      allFutures.value = []
    }
  } catch (error) {
    console.error('Error loading futures:', error)
    allFutures.value = []
  } finally {
    loadingFutures.value = false
  }
}

// 防抖搜索
let searchTimeout: number | null = null

const searchFutures = () => {
  // 清除之前的定时器
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  // 设置新的定时器，300ms后执行搜索
  searchTimeout = setTimeout(() => {
    const searchPattern = futuresSearchQuery.value.trim() || undefined
    loadFutures(searchPattern)
  }, 300)
}

const selectFutures = (future: any) => {
  selectedFutures.value = future
  queryParams.value.market = future.market
  queryParams.value.code = future.code
}

const executeQuery = () => {
  if (!canExecuteQuery.value || isQuerying.value) return

  isQuerying.value = true
  hasQueried.value = true
  currentPage.value = 1

  // Convert datetime-local to timestamp
  const fromTimestamp = Math.floor(new Date(queryParams.value.fromTime || "").getTime() / 1000)
  const toTimestamp = Math.floor(new Date(queryParams.value.toTime || "").getTime() / 1000)

  const params = {
    market: queryParams.value.market,
    code: queryParams.value.code,
    fromTime: fromTimestamp,
    toTime: toTimestamp,
    granularity: parseInt(queryParams.value.granularity || "86400"),
    fields: Array.from(selectedFields.value),
    metaName: selectedSchema.value?.metaName || "",
    namespace: selectedSchema.value?.namespaceKey || "",
    revision: selectedSchema.value?.revision || -1
  }

  console.log("Executing historical data query:", params)

  // Send fetchByCode message to backend
  wsStore.sendMessage({
    type: "fetch_by_code",
    ...params,
  })
}

const renderFieldValue = (value: any): string => {
  if (value === null || value === undefined) {
    return "null"
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]"
    }

    const preview = value
      .slice(0, 3)
      .map(item => (typeof item === "number" ? item.toFixed(3) : String(item)))
      .join(", ")

    const suffix = value.length > 3 ? `, ...${value.length - 3} more` : ""
    return `[${preview}${suffix}]`
  }
  
  if (typeof value === "object") {
    return "{...}"
  }
  
  if (typeof value === "number") {
    return value.toFixed(4)
  }
  
  if (typeof value === "string" && value.length > 50) {
    return value.substring(0, 50) + "..."
  }
  
  return String(value)
}

const exportData = () => {
  // TODO: Implement data export functionality
  console.log('Export data functionality to be implemented')
}

// Watch for schema changes to auto-expand namespaces
watch(() => schema.value, (newSchema) => {
  if (newSchema && Object.keys(newSchema).length > 0) {
    // 当 schema 加载完成后，自动展开 Global 和 Private 命名空间
    setTimeout(() => {
      const newExpandedKeys = { ...expandedKeys.value }
      newExpandedKeys['namespace_0'] = true // Global
      expandedKeys.value = newExpandedKeys
    }, 50)
  }
}, { immediate: true })

// Watch for WebSocket messages
watch(() => wsStore.lastMessage, (newMessage) => {
  if (!newMessage) return

  if (newMessage.type === 'fetch_by_code_response') {
    console.log('🔍 Processing fetch_by_code_response:', newMessage)
  
  isQuerying.value = false
  
    if (newMessage.success && newMessage.data) {
      const responseData = newMessage.data
      
      // Convert backend response to frontend format
      let processedData = []
      if (responseData.records && Array.isArray(responseData.records)) {
        processedData = responseData.records.map((record: any, index: number) => {
          // Flatten the fields structure for data grid access
          const flatRecord = {
            ...record,
            row_id: index + 1,
            timestamp: record.timestamp ? 
              new Date(parseInt(record.timestamp)).toISOString() : 
              new Date().toISOString()
          }
          
          // If fields are nested under a "fields" property, flatten them to top level
          if (record.fields && typeof record.fields === 'object') {
            Object.assign(flatRecord, record.fields)
          }
          
          return flatRecord
        })
      }
      
      historicalData.value = processedData
      currentPage.value = 1
      
      console.log('Historical data received:', {
        recordCount: processedData.length,
        message: newMessage.message,
        source: responseData.source
      })
  } else {
      console.error('Historical data fetch failed:', newMessage.message)
      historicalData.value = []
  }
}
}, { immediate: true })

// Lifecycle
onMounted(() => {
  loadFutures()
  
  // 默认展开 Global 和 Private 命名空间
  setTimeout(() => {
    const newExpandedKeys = { ...expandedKeys.value }
    newExpandedKeys['namespace_0'] = true // Global
    expandedKeys.value = newExpandedKeys
  }, 100) 
})

onUnmounted(() => {
  // 清理搜索定时器
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
})
</script>

<style scoped>
/* Main Container - Three Column Layout */
.historical-query-container {
  display: flex;
  height: 100vh;
  background: #f8f9fa;
  gap: 1px;
}

/* Left Panel - Schema Tree */
.left-panel {
  width: 320px;
  background: white;
  border-right: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
}

.left-panel.collapsed {
  width: 50px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  min-height: 48px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.panel-icon {
  font-size: 16px;
}

.panel-text {
  transition: opacity 0.3s ease;
}

.left-panel.collapsed .panel-text {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.collapse-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: #6c757d;
  font-size: 12px;
  transition: all 0.2s ease;
}

.collapse-button:hover {
  background: #e9ecef;
  color: #495057;
}

.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.left-panel.collapsed .panel-content {
  display: none;
}

/* Schema Tree Styles */
.schema-tree-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tree-header {
  padding: 12px 16px;
  border-bottom: 1px solid #dee2e6;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  background: white;
}

.search-input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* Tree Node Styles */
.tree-node-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tree-icon {
  width: 12px;
  color: #6c757d;
  font-size: 12px;
}

.tree-label {
  font-size: 13px;
  color: #374151;
}

.revision-badge {
  background: #28a745;
  color: white;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  margin-left: auto;
}

/* Center Panel - Main Content */
.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  overflow: hidden;
}

/* Query Header */
.query-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.query-title h3 {
  margin: 0 0 8px 0;
  color: #495057;
  font-size: 18px;
  font-weight: 600;
}

.query-status {
  display: flex;
  gap: 16px;
  font-size: 13px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-label {
  color: #6c757d;
  font-weight: 500;
}

.status-value {
  color: #495057;
  font-weight: 600;
}

.view-mode-toggle {
  display: flex;
  gap: 4px;
  background: white;
  border-radius: 6px;
  padding: 2px;
  border: 1px solid #dee2e6;
}

.mode-button {
  padding: 6px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #6c757d;
  transition: all 0.2s ease;
}

.mode-button:hover {
  background: #f8f9fa;
  color: #495057;
}

.mode-button.active {
  background: #0066cc;
  color: white;
}

/* Query Configuration */
.query-config {
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
  background: #fafbfc;
}

.config-section {
  margin-bottom: 24px;
}

.config-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  margin: 0;
  color: #495057;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-actions {
  display: flex;
  gap: 8px;
}

.select-all-button,
.clear-all-button {
  padding: 4px 8px;
  border: 1px solid #dee2e6;
  background: white;
  cursor: pointer;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
  color: #495057;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.select-all-button:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #0066cc;
  color: #0066cc;
}

.select-all-button:disabled {
  background: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
  border-color: #dee2e6;
}

.clear-all-button:hover {
  background: #f8f9fa;
  border-color: #dc3545;
  color: #dc3545;
}

/* Field Selection */
.field-selector {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.field-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  font-size: 13px;
}

.field-option:hover {
  background: #f8f9fa;
}

.field-option input {
  margin: 0;
}

.field-name {
  font-weight: 500;
  color: #495057;
}

.field-type {
  color: #6c757d;
  font-size: 11px;
}

/* Time Configuration */
.time-config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  align-items: end;
  margin-bottom: 16px;
}

.time-config-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: end;
}

.time-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: #495057;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-input,
.form-select {
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  font-size: 14px;
  color: #495057;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-select:focus {
  border-color: #0066cc;
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.datetime-input {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 13px;
}

.query-button {
  background: #0066cc;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  height: fit-content;
}

.query-button:hover:not(:disabled) {
  background: #0052a3;
}

.query-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Results Section */
.results-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.results-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.results-title {
  margin: 0;
  color: #495057;
  font-size: 16px;
  font-weight: 600;
}

.results-actions {
  display: flex;
  gap: 8px;
}

.export-button {
  padding: 6px 12px;
  border: 1px solid #dee2e6;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: #495057;
  transition: all 0.2s ease;
}

.export-button:hover {
  background: #f8f9fa;
  border-color: #0066cc;
  color: #0066cc;
}

/* Table View */
.table-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.data-grid {
  flex: 1;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-header {
  background: #f8f9fa;
  padding: 12px 16px;
  text-align: left;
  border-bottom: 2px solid #dee2e6;
  font-weight: 600;
  color: #495057;
  position: sticky;
  top: 0;
  white-space: nowrap;
}

.data-row:nth-child(even) {
  background: #f9f9f9;
}

.data-row:hover {
  background: #e3f2fd;
}

.data-cell {
  padding: 10px 16px;
  border-bottom: 1px solid #f1f3f4;
  vertical-align: top;
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 11px;
  color: #495057;
}

/* Chart View Placeholder */
.chart-view {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafbfc;
}

.chart-placeholder {
  text-align: center;
  color: #6c757d;
}

.chart-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.chart-text {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #495057;
}

.chart-subtitle {
  font-size: 14px;
  color: #6c757d;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
}

.pagination-button {
  padding: 8px 16px;
  border: 1px solid #dee2e6;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
  transition: background-color 0.2s;
}

.pagination-button:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
  opacity: 0.6;
}

.pagination-button:hover:not(:disabled) {
  background: #f8f9fa;
}

.pagination-info {
  font-size: 14px;
  color: #6c757d;
}

/* Right Panel - Futures */
.right-panel {
  width: 260px;
  background: white;
  border-left: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
}

.right-panel.collapsed {
  width: 50px;
}

.right-panel.collapsed .panel-text {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.right-panel.collapsed .panel-content {
  display: none;
}

/* Futures Search */
.futures-search {
  padding: 12px 16px;
  border-bottom: 1px solid #dee2e6;
}

/* Futures List */
.futures-list {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #6c757d;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e9ecef;
  border-top: 2px solid #0066cc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  color: #6c757d;
}

.futures-grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.future-item {
  padding: 8px 10px;
  margin-bottom: 4px;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.future-item:hover {
  border-color: #0066cc;
  background: #f8f9fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.future-item.selected {
  border-color: #0066cc;
  background: #e3f2fd;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.future-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.future-code {
  font-weight: 600;
  color: #495057;
  font-size: 13px;
  line-height: 1.2;
  flex: 1;
}

.future-name {
  color: #6c757d;
  font-size: 11px;
  line-height: 1.2;
  opacity: 0.8;
}

.future-market {
  color: #28a745;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  opacity: 0.7;
  flex-shrink: 0;
}

/* Empty States */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #6c757d;
  text-align: center;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.6;
}

.empty-text {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.empty-subtitle {
  font-size: 12px;
  color: #9ca3af;
}

.empty-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #6c757d;
  text-align: center;
  padding: 40px 20px;
}

/* Custom Tree Overrides */
:deep(.custom-tree) {
  border: none;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

:deep(.custom-tree .p-tree-root) {
  padding: 0;
  background: transparent;
}

:deep(.custom-tree .p-tree-node) {
  padding: 0;
  margin: 0;
  position: relative;
}

:deep(.custom-tree .p-tree-node-content) {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #374151;
  border-bottom: 1px solid #f1f3f4;
  transition: all 0.15s ease;
  position: relative;
  margin-left: 0;
}

:deep(.custom-tree .p-tree-node-content:hover) {
  background: #f9fafb;
  color: #111827;
}

:deep(.custom-tree .p-tree-node-content.p-tree-node-selected) {
  background: #eff6ff;
  color: #1d4ed8;
  border-left: 3px solid #3b82f6;
}

:deep(.custom-tree .p-tree-node-children) {
  position: relative;
  margin-left: 20px;
}

:deep(.custom-tree .p-tree-node-toggle-button) {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
}

:deep(.custom-tree .p-tree-node-toggle-button:hover) {
  color: #374151;
  background: #f3f4f6;
  border-radius: 3px;
}

:deep(.custom-tree .p-tree-node-toggle-icon) {
  font-size: 10px;
}

:deep(.custom-tree .p-tree-node-label) {
  padding: 0;
  flex: 1;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .field-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

@media (max-width: 768px) {
  .historical-query-container {
    flex-direction: column;
    height: auto;
  }
  
  .left-panel,
  .right-panel {
    width: 100%;
    height: 300px;
  }
  
  .left-panel.collapsed,
  .right-panel.collapsed {
    height: 50px;
  }
  
  .time-config-grid {
    grid-template-columns: 1fr;
  }
  
  .time-config-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .field-grid {
    grid-template-columns: 1fr;
  }
  
  .query-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}
</style>

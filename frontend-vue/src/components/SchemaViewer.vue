<template>
  <!-- Empty State -->
  <div v-if="!schema || Object.keys(schema).length === 0" class="empty-state">
    No schema loaded yet.<br />
    Connect to server to load schema definitions.
  </div>

  <!-- Main Content -->
  <div v-else class="schema-viewer-container">
    <!-- Left Panel: Schema Tree -->
    <div class="tree-panel">
      <div class="tree-header">
        Schema Tree
        <input v-model="searchQuery" type="text" placeholder="Search schemas, markets, or revisions..."
          class="search-input" />
      </div>
      <div class="tree-content">
        <div v-if="filteredTreeData.length > 0">
          <Tree :value="filteredTreeData" :selection-mode="'single'" :selection-keys="selectedKeys"
            :expanded-keys="expandedKeys" @node-select="onNodeSelect" @node-expand="onNodeExpand"
            @node-collapse="onNodeCollapse" class="custom-tree">
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
        <div v-else class="empty-state">No tree nodes to display</div>
      </div>
    </div>

    <!-- Right Panel: Details -->
    <div class="grid-panel">
      <div class="tab-container">
        <button :class="['tab', { active: activeTabIndex === 0 }]" @click="activeTabIndex = 0">
          Field Definitions
        </button>
        <button :class="['tab', { active: activeTabIndex === 1 }]" @click="activeTabIndex = 1">
          Historical Data Query
        </button>
      </div>
      <div class="tab-content">
        <!-- Field Definitions Tab -->
        <div v-if="activeTabIndex === 0" class="field-details">
          <div v-if="selectedItem && selectedItem.type === 'revision'" class="field-details-content">
            <!-- Meta Information -->
            <div class="meta-info">
              <div><strong>Full Name:</strong> {{ selectedItem.fullName }}</div>
              <div>
                <strong>Namespace:</strong>
                {{
                  selectedItem.namespaceKey === "0"
                    ? "Global"
                    : selectedItem.namespaceKey === "1"
                      ? "Private"
                      : `Namespace ${selectedItem.namespaceKey}`
                }}
              </div>
              <div><strong>Meta ID:</strong> {{ selectedItem.metaId }}</div>
              <div><strong>Revision:</strong> {{ selectedItem.revision }}</div>
              <div><strong>Field Count:</strong> {{ selectedItem.fullMeta?.fields?.length || 0 }}</div>
              <div v-if="selectedItem.fullMeta?.description">
                <strong>Description:</strong> {{ selectedItem.fullMeta.description }}
              </div>
            </div>

            <!-- Fields Table -->
            <div v-if="selectedItem.fullMeta?.fields && selectedItem.fullMeta.fields.length > 0" class="fields-table">
              <table class="field-table">
                <thead>
                  <tr>
                    <th class="field-header">Index</th>
                    <th class="field-header">Field Name</th>
                    <th class="field-header">Type</th>
                    <th class="field-header">Position</th>
                    <th class="field-header">Precision</th>
                    <th class="field-header">Multiple</th>
                    <th class="field-header">Sample Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(field, index) in selectedItem.fullMeta.fields" :key="index" class="field-row">
                    <td class="field-cell">{{ index }}</td>
                    <td class="field-cell field-name">{{ field.name || `field_${index}` }}</td>
                    <td class="field-cell">
                      <code class="type-code">{{ getTypeName(field.type) }}</code>
                    </td>
                    <td class="field-cell">{{ field.pos !== undefined ? field.pos : index }}</td>
                    <td class="field-cell">{{ field.precision || 0 }}</td>
                    <td class="field-cell">
                      <span v-if="field.multiple" class="check-mark">✓</span>
                      <span v-else class="cross-mark">✗</span>
                    </td>
                    <td class="field-cell">{{ field.sampleType || 0 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state">No fields defined for this revision</div>
          </div>
          <div v-else class="empty-state">Select a revision from the tree to view field definitions</div>
        </div>

        <!-- Historical Data Query Tab -->
        <div v-else class="historical-query">
          <div v-if="selectedItem && selectedItem.type === 'revision'" class="query-panel">
            <div class="query-section">
              <h4 class="section-title">
                Query Parameters
              </h4>
              
              <!-- 第一行：Market, Code, Granularity -->
              <div class="form-row-group">
                <div class="form-field">
                  <label class="form-label">
                    Market
                  </label>
                  <div class="combo-container">
                    <input 
                      v-model="queryParams.market" 
                      type="text" 
                      placeholder="e.g., SHFE, DCE, CZCE or type to search..."
                      class="form-input combo-input" 
                      @input="marketFilter = queryParams.market; showMarketDropdown = true"
                      @focus="marketFilter = queryParams.market; showMarketDropdown = true"
                      @blur="handleMarketBlur"
                    />
                    <button 
                      type="button"
                      class="combo-button"
                      @click="marketFilter = ''; showMarketDropdown = !showMarketDropdown"
                    >
                      ▼
                    </button>
                    <div v-if="showMarketDropdown" class="dropdown-list">
                      <div v-if="filteredMarkets.length > 0">
                        <div 
                          v-for="(marketItem, index) in filteredMarkets" 
                          :key="index"
                          class="dropdown-item"
                          @click="queryParams.market = marketItem.code; showMarketDropdown = false"
                        >
                          <span class="code">{{ marketItem.code }}</span>
                          <span class="name">- {{ marketItem.name }}</span>
                        </div>
                      </div>
                      <div v-else class="dropdown-item">No markets found</div>
                    </div>
                  </div>
                </div>
                <div class="form-field">
                  <label class="form-label">
                    Code
                  </label>
                  <div class="combo-container">
                    <input 
                      v-model="queryParams.code" 
                      type="text" 
                      placeholder="e.g., cu2401, i2401 or type to search..."
                      class="form-input combo-input" 
                      @input="codeFilter = queryParams.code; showCodeDropdown = true"
                      @focus="codeFilter = queryParams.code; showCodeDropdown = true"
                      @blur="handleCodeBlur"
                    />
                    <button 
                      type="button"
                      class="combo-button"
                      @click="codeFilter = ''; showCodeDropdown = !showCodeDropdown"
                    >
                      ▼
                    </button>
                    <div v-if="showCodeDropdown" class="dropdown-list">
                      <div v-if="filteredCodes.length > 0">
                        <div 
                          v-for="(codeItem, index) in filteredCodes.slice(0, 50)" 
                          :key="index"
                          class="dropdown-item"
                          @click="queryParams.code = codeItem.code; showCodeDropdown = false"
                        >
                          <span class="code">{{ codeItem.code }}</span>
                          <span class="name">- {{ codeItem.name }}</span>
                          <span v-if="queryParams.market !== codeItem.market" class="name">({{ codeItem.market }})</span>
                        </div>
                        <div v-if="filteredCodes.length > 50" class="dropdown-item" style="font-style: italic; color: #6c757d;">
                          Showing first 50 results... type to refine search
                        </div>
                      </div>
                      <div v-else class="dropdown-item">
                        No codes found {{ queryParams.market ? `for ${queryParams.market}` : '' }}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="form-field">
                  <label class="form-label">
                    Granularity
                  </label>
                  <select v-model="queryParams.granularity" class="form-select">
                    <option value="60">1min (60s)</option>
                    <option value="300">5min (300s)</option>
                    <option value="900">15min (900s)</option>
                    <option value="1800">30min (1800s)</option>
                    <option value="3600">1h (3600s)</option>
                    <option value="86400">1day (86400s)</option>
                  </select>
                </div>
              </div>

              <!-- 第二行：From Time, To Time -->
              <div class="form-row-group">
                <div class="form-field">
                  <label class="form-label">
                    From Time
                  </label>
                  <input 
                    v-model="queryParams.fromTime" 
                    type="datetime-local" 
                    class="form-input datetime-input" 
                  />
                </div>
                <div class="form-field">
                  <label class="form-label">
                    To Time
                  </label>
                  <input 
                    v-model="queryParams.toTime" 
                    type="datetime-local" 
                    class="form-input datetime-input" 
                  />
                </div>
                <div class="form-field form-field-spacer"></div>
              </div>
            </div>

            <div class="query-section">
              <h4 class="section-title">Field Selection ({{ selectedFields.size }} selected)</h4>
              <div class="field-selector">
                <label v-for="(field, index) in selectedItem.fullMeta?.fields || []" :key="index" class="field-option">
                  <input type="checkbox" :checked="selectedFields.has(field.name)"
                    @change="handleFieldToggle(field.name)" />
                  <strong>{{ field.name }}</strong>
                  <span class="field-type">({{ getTypeName(field.type) }})</span>
                </label>
              </div>
            </div>

            <div class="query-actions">
              <button class="query-button" :disabled="!canExecuteQuery || selectedFields.size === 0"
                @click="executeQuery">
                {{ isQuerying ? "Querying..." : "Execute Query" }}
              </button>
            </div>

            <div v-if="historicalData.length > 0" class="query-section">
              <h4 class="section-title">Query Results ({{ historicalData.length }} records)</h4>
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
                <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1"
                  class="pagination-button">
                  Previous
                </button>
                <span class="pagination-info">
                  Page {{ currentPage }} of {{ totalPages }} ({{ historicalData.length }} total
                  records)
                </span>
                <button @click="currentPage = Math.min(totalPages, currentPage + 1)"
                  :disabled="currentPage === totalPages" class="pagination-button">
                  Next
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            Select a revision from the tree to configure historical data query
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useDataStore } from "../stores/dataStore";
import { useWebSocketStore } from "../stores/websocketStore";
import type { TreeNode, QueryParams } from "@/types";

// PrimeVue Components
import Tree from "primevue/tree";

const dataStore = useDataStore();
const wsStore = useWebSocketStore();

// State
const searchQuery = ref<string>("");
const activeTabIndex = ref<number>(0);
const selectedItem = ref<TreeNode | null>(null);
const selectedKeys = ref<Record<string, boolean>>({});
const expandedKeys = ref<Record<string, boolean>>({});
const queryParams = ref<QueryParams>({
  market: "",
  code: "",
  namespace: "",
  metaName: "",
  granularity: "86400", // Default to 1 day
  fromTime: "",
  toTime: "",
  fieldCount: 10,
  revision: "0xFFFFFFFF",
});
const historicalData = ref<any[]>([]);
const currentPage = ref<number>(1);
const pageSize = ref<number>(100);
const selectedFields = ref<Set<string>>(new Set());
const isQuerying = ref<boolean>(false);

// Dropdown state
const showMarketDropdown = ref<boolean>(false);
const showCodeDropdown = ref<boolean>(false);
const marketFilter = ref<string>("");
const codeFilter = ref<string>("");

// Computed
const schema = computed(() => dataStore.schema);
const marketData = computed(() => dataStore.marketData);
const securities = computed(() => dataStore.securities);

// Process available markets
const availableMarkets = computed(() => {
  if (!marketData.value) return [];
  
  const markets: Array<{code: string, name: string, type: string}> = [];
  
  // Add global markets
  if ((marketData.value as any).global) {
    Object.entries((marketData.value as any).global).forEach(([code, market]: [string, any]) => {
      markets.push({
        code: code,
        name: market.name || code,
        type: 'global'
      });
    });
  }
  
  // Add private markets  
  if ((marketData.value as any).private) {
    Object.entries((marketData.value as any).private).forEach(([code, market]: [string, any]) => {
      markets.push({
        code: code,
        name: market.name || code,
        type: 'private'
      });
    });
  }
  
  return markets.sort((a, b) => a.code.localeCompare(b.code));
});

// Process available securities/codes
const availableCodes = computed(() => {
  if (!securities.value) return [];
  
  const codes: Array<{code: string, name: string, market: string, category: string}> = [];
  const seenCodes = new Set<string>(); // Track unique codes to avoid duplicates
  
  // Process securities by market
  Object.entries(securities.value).forEach(([marketCode, securityList]: [string, any]) => {
    if (Array.isArray(securityList)) {
      securityList.forEach((security: any) => {
        if (security.codes && Array.isArray(security.codes)) {
          security.codes.forEach((code: string, index: number) => {
            // Create unique key to avoid duplicates
            const uniqueKey = `${marketCode}-${code}`;
            
            if (!seenCodes.has(uniqueKey)) {
              seenCodes.add(uniqueKey);
              
              const name = security.names && security.names[index] ? security.names[index] : code;
              codes.push({
                code: code,
                name: name,
                market: marketCode,
                category: security.categories && security.categories[index] ? security.categories[index] : 'Unknown'
              });
            }
          });
        }
      });
    }
  });
  
  return codes.sort((a, b) => a.code.localeCompare(b.code));
});

// Filtered markets and codes
const filteredMarkets = computed(() => {
  return availableMarkets.value.filter(m => 
    m.code.toLowerCase().includes(marketFilter.value.toLowerCase()) ||
    m.name.toLowerCase().includes(marketFilter.value.toLowerCase())
  );
});

const filteredCodes = computed(() => {
  // Filter codes by selected market if one is chosen
  const relevantCodes = queryParams.value.market 
    ? availableCodes.value.filter(c => c.market === queryParams.value.market)
    : availableCodes.value;
    
  return relevantCodes.filter(c => 
    c.code.toLowerCase().includes(codeFilter.value.toLowerCase()) ||
    c.name.toLowerCase().includes(codeFilter.value.toLowerCase())
  );
});


const treeData = computed(() => {
  if (!schema.value || Object.keys(schema.value).length === 0) {
    return [];
  }

  const tree: any[] = [];

  // Create namespace nodes directly from schema data
  const namespaceKeys = ["0", "1"] as const;
  namespaceKeys.forEach((namespaceKey: string) => {
    const namespaceName = namespaceKey === "0" ? "Global" : "Private";
    const namespaceData = (schema.value as any)[namespaceKey];

    if (!namespaceData) return;

    // Group metas by name and collect all their revisions
    const metaGroups: Record<string, any> = {};
    Object.entries(namespaceData).forEach(([metaId, metaInfo]: [string, any]) => {
      const metaName =
        metaInfo.displayName ||
        (metaInfo.name && metaInfo.name.includes("::") ? metaInfo.name.split("::").pop() : metaInfo.name) ||
        `Meta ${metaId}`;

      const revision = metaInfo.revision || 0;

      if (!metaGroups[metaName]) {
        metaGroups[metaName] = {
          metaName,
          revisions: [],
        };
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
      });
    });

    // Create meta children with grouped revisions
    const metaChildren: any[] = Object.entries(metaGroups).map(([metaName, group]) => {
      // Sort revisions by revision number
      const sortedRevisions = group.revisions.sort((a: any, b: any) => a.revision - b.revision);

      return {
        key: `meta_${namespaceKey}_${metaName}`,
        id: `meta_${namespaceKey}_${metaName}`,
        type: "meta" as const,
        name: `${metaName} (${sortedRevisions.length} rev${sortedRevisions.length > 1 ? "s" : ""})`,
        namespaceKey,
        metaName,
        children: sortedRevisions,
      };
    });

    if (metaChildren.length > 0) {
      tree.push({
        key: `namespace_${namespaceKey}`,
        id: `namespace_${namespaceKey}`,
        type: "namespace" as const,
        name: namespaceName,
        namespaceKey,
        children: metaChildren.sort((a: any, b: any) => a.name.localeCompare(b.name)),
      });
    }
  });

  return tree;
});

const filteredTreeData = computed(() => {
  if (!searchQuery.value.trim()) return treeData.value;

  const filterTree = (nodes: any[]): any[] => {
    return nodes.reduce((filtered: any[], node: any) => {
      const matchesSearch =
        node.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        node.fullName?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        node.namespaceKey?.toLowerCase().includes(searchQuery.value.toLowerCase());

      // Filter children recursively
      const filteredChildren = node.children ? filterTree(node.children) : [];

      // Include node if it matches search or has matching children
      if (matchesSearch || filteredChildren.length > 0) {
        const filteredNode: any = {
          ...node,
          children: filteredChildren,
        };

        filtered.push(filteredNode);
      }

      return filtered;
    }, []);
  };

  return filterTree(treeData.value);
});

const canExecuteQuery = computed(() => {
  return queryParams.value.market && queryParams.value.code && queryParams.value.fromTime && queryParams.value.toTime;
});

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return historicalData.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(historicalData.value.length / pageSize.value);
});

// Methods
const getTreeIcon = (item: any): string => {
  if (item.type === "revision") return "●";
  if (item.type === "namespace") return "📁";
  if (item.type === "meta") return "📋";
  return "●";
};

const getTypeName = (type: number): string => {
  const types: Record<number, string> = {
    0x01: "INT", // DataType.INT = 0x01
    0x02: "DOUBLE", // DataType.DOUBLE = 0x02
    0x03: "STRING", // DataType.STRING = 0x03
    0x04: "VINT", // DataType.VINT = 0x04 (vector<int32_t>)
    0x05: "VDOUBLE", // DataType.VDOUBLE = 0x05 (vector<double>)
    0x06: "VSTRING", // DataType.VSTRING = 0x06 (vector<string>)
    0x07: "INT64", // DataType.INT64 = 0x07
    0x08: "VINT64", // DataType.VINT64 = 0x08 (vector<int64_t>)
  };
  return types[type] || `UNKNOWN_0x${type.toString(16).toUpperCase()}`;
};


const onNodeSelect = (node: any) => {
  // Only handle revision nodes for content updates
  if (node.type === 'revision') {
    selectedItem.value = node;

    // Update selected keys for Tree component - use node.id instead of node.key
    selectedKeys.value = { [node.id]: true };

    // Auto-fill query params if on historical tab
    if (activeTabIndex.value === 1) {
      if (node.namespaceKey) {
        queryParams.value.namespace = node.namespaceKey;
      }
      if (node.revision !== undefined) {
        queryParams.value.revision = `0x${node.revision.toString(16).toUpperCase()}`;
      }
    }
  } else {
    // For non-revision nodes (namespace, meta), toggle their expand/collapse state
    const nodeKey = node.key;
    const newExpandedKeys = { ...expandedKeys.value };

    if (newExpandedKeys[nodeKey]) {
      // 如果当前是展开状态，则折叠
      delete newExpandedKeys[nodeKey];
    } else {
      // 如果当前是折叠状态，则展开
      newExpandedKeys[nodeKey] = true;
    }

    expandedKeys.value = newExpandedKeys;
    console.log(`切换 ${node.type} 节点展开状态: ${node.name}`);
  }
};

const onNodeExpand = (node: any) => {
  const newExpandedKeys = { ...expandedKeys.value };
  newExpandedKeys[node.key] = true;
  expandedKeys.value = newExpandedKeys;
  console.log(`展开 ${node.type} 节点: ${node.name}`);
};

const onNodeCollapse = (node: any) => {
    const newExpandedKeys = { ...expandedKeys.value };
    delete newExpandedKeys[node.key];
    expandedKeys.value = newExpandedKeys;
    console.log(`折叠 ${node.type} 节点: ${node.name}`);
};

// Dropdown handlers
const handleMarketBlur = () => {
    setTimeout(() => {
        showMarketDropdown.value = false;
    }, 150);
};

const handleCodeBlur = () => {
    setTimeout(() => {
        showCodeDropdown.value = false;
    }, 150);
};

const renderFieldValue = (value: any): string => {
  if (value === null || value === undefined) {
    return "null";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const preview = value
      .slice(0, 3)
      .map(item => (typeof item === "number" ? item.toFixed(3) : String(item)))
      .join(", ");

    const suffix = value.length > 3 ? `, ...${value.length - 3} more` : "";
    return `[${preview}${suffix}]`;
  }

  if (typeof value === "object") {
    return "{...}";
  }

  if (typeof value === "number") {
    return value.toFixed(4);
  }

  if (typeof value === "string" && value.length > 50) {
    return value.substring(0, 50) + "...";
  }

  return String(value);
};

const handleFieldToggle = (fieldName: string) => {
  const newSelected = new Set(selectedFields.value);
  if (newSelected.has(fieldName)) {
    newSelected.delete(fieldName);
  } else {
    newSelected.add(fieldName);
  }
  selectedFields.value = newSelected;
};

const executeQuery = () => {
  if (!canExecuteQuery.value || selectedFields.value.size === 0) return;

  isQuerying.value = true;

  // Convert datetime-local to timestamp
  const fromTimestamp = Math.floor(new Date(queryParams.value.fromTime || "").getTime() / 1000);
  const toTimestamp = Math.floor(new Date(queryParams.value.toTime || "").getTime() / 1000);

  const params = {
    market: queryParams.value.market,
    code: queryParams.value.code,
    fromTime: fromTimestamp,
    toTime: toTimestamp,
    granularity: parseInt(queryParams.value.granularity || "86400"),
    fields: Array.from(selectedFields.value),
    metaName: selectedItem.value?.metaName || "",
    namespace: selectedItem.value?.namespaceKey || "",
  };

  console.log("Executing historical data query:", params);

  // Send fetchByCode message to backend
  wsStore.sendMessage({
    type: "fetch_by_code",
    ...params,
  });

  currentPage.value = 1;
};

// Watch for WebSocket messages
watch(() => wsStore.lastMessage, (newMessage) => {
  if (!newMessage) return;

  if (newMessage.type === 'fetch_by_code_response') {
    console.log('🔍 Processing fetch_by_code_response:', newMessage);
    
    isQuerying.value = false;
    
    if (newMessage.success && newMessage.data) {
      const responseData = newMessage.data;
      
      console.log('🔍 Response data structure:', {
        responseData: responseData,
        hasRecords: !!responseData.records,
        recordsIsArray: Array.isArray(responseData.records),
        recordCount: responseData.records?.length || 0
      });
      
      // Convert backend response to frontend format
      let processedData = [];
      if (responseData.records && Array.isArray(responseData.records)) {
        processedData = responseData.records.map((record: any, index: number) => {
          // Flatten the fields structure for data grid access
          const flatRecord = {
            ...record,
            row_id: index + 1,
            timestamp: record.timestamp ? 
              new Date(parseInt(record.timestamp)).toISOString() : 
              new Date().toISOString() // Parse timestamp from milliseconds
          };
          
          // If fields are nested under a "fields" property, flatten them to top level
          if (record.fields && typeof record.fields === 'object') {
            Object.assign(flatRecord, record.fields);
          }
          
          return flatRecord;
        });
      }
      
      console.log('🔍 Setting historicalData:', {
        processedDataLength: processedData.length,
        firstRecord: processedData[0],
        firstRecordKeys: processedData[0] ? Object.keys(processedData[0]) : [],
        fieldsFlattened: processedData[0] && responseData.records[0] && responseData.records[0].fields ? 
          'Yes - fields moved to top level' : 'No nested fields found'
      });
      
      historicalData.value = processedData;
      currentPage.value = 1;
      
      console.log('Historical data received:', {
        recordCount: processedData.length,
        message: newMessage.message,
        source: responseData.source
      });
    } else {
      console.error('Historical data fetch failed:', newMessage.message);
      historicalData.value = [];
    }
  }
}, { immediate: true });
</script>

<style scoped>
/* Container Layout - matching React version */
.schema-viewer-container {
  display: flex;
  gap: 20px;
  height: 600px;
}

.tree-panel {
  flex: 0 0 300px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
}

.grid-panel {
  flex: 1;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
}

/* Tree Panel Styles */
.tree-header {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  font-weight: 600;
  color: #495057;
}

.search-input {
  width: 100%;
  margin-top: 8px;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  font-weight: normal;
}

.search-input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.25);
}

.search-input::placeholder {
  color: #6c757d;
}

.tree-content {
  height: calc(100% - 47px);
  overflow-y: auto;
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
}

.tree-label {
  font-size: 14px;
}

.revision-badge {
  background: #28a745;
  color: white;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  margin-left: 8px;
}

/* Tab Styles */
.tab-container {
  display: flex;
  border-bottom: 1px solid #dee2e6;
  background: #f8f9fa;
}

.tab {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: #6c757d;
  font-weight: normal;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.tab:hover {
  background: #e9ecef;
  color: #495057;
}

.tab.active {
  background: #ffffff;
  color: #495057;
  font-weight: 600;
  border-bottom: 2px solid #0066cc;
}

.tab-content {
  height: calc(100% - 47px);
  overflow-y: auto;
}

/* Field Details Styles */
.field-details-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Meta Information Card */
.meta-info-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 24px;
  color: white;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.15);
  position: relative;
  overflow: hidden;
}

.meta-info-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  pointer-events: none;
}

.meta-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}

.meta-icon {
  font-size: 32px;
  opacity: 0.9;
}

.meta-title {
  flex: 1;
}

.meta-title h3 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: white;
}

.meta-subtitle {
  font-size: 14px;
  opacity: 0.8;
  font-weight: 400;
}

.meta-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.meta-details {
  position: relative;
  z-index: 1;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.meta-item {
  background: rgba(255, 255, 255, 0.1);
  padding: 16px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.meta-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.8;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-icon-small {
  font-size: 14px;
}

.meta-value {
  font-size: 16px;
  font-weight: 600;
  color: white;
}

.namespace-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.namespace-tag.global {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.namespace-tag.private {
  background: rgba(249, 115, 22, 0.2);
  color: #f97316;
  border: 1px solid rgba(249, 115, 22, 0.3);
}

.meta-description {
  background: rgba(255, 255, 255, 0.1);
  padding: 16px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.description-text {
  font-size: 14px;
  line-height: 1.5;
  opacity: 0.9;
}

/* Fields Table Card */
.fields-table-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.table-header {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.table-icon {
  font-size: 20px;
}

.table-stats {
  background: #3b82f6;
  color: white;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
}

.table-container {
  overflow-x: auto;
}

/* Field Table Styles */
.field-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.field-header {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 16px 12px;
  text-align: left;
  border-bottom: 2px solid #e5e7eb;
  font-weight: 600;
  color: #374151;
  position: sticky;
  top: 0;
  white-space: nowrap;
}

.header-icon {
  margin-right: 8px;
  opacity: 0.7;
}

.field-row:nth-child(even) {
  background: #fafbfc;
}

.field-row:hover {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.field-cell {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f3f4;
  vertical-align: top;
  transition: all 0.2s ease;
}

.field-cell:first-child {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  font-weight: 600;
  color: #495057;
  text-align: center;
  font-family: "SF Mono", "Monaco", "Consolas", monospace;
  font-size: 12px;
}

.field-cell:nth-child(3) {
  text-align: center;
}

.field-cell:nth-child(4),
.field-cell:nth-child(5),
.field-cell:nth-child(7) {
  text-align: center;
  font-family: "SF Mono", "Monaco", "Consolas", monospace;
  font-size: 12px;
  color: #6c757d;
}

.index-cell {
  text-align: center;
  font-weight: 600;
  color: #6b7280;
  background: #f9fafb;
}

.field-name-cell {
  min-width: 150px;
}

.field-name-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-name {
  font-weight: 600;
  color: #2c3e50;
  font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif;
}

.unnamed-badge {
  background: #fef3c7;
  color: #92400e;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.type-cell {
  min-width: 100px;
}

.type-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.type-badge.type-int {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
}

.type-badge.type-double {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.type-badge.type-string {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.type-badge.type-vector {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
}

.type-badge.type-int64 {
  background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
  color: white;
}

.type-badge.type-unknown {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  color: white;
}

.position-cell,
.precision-cell,
.sample-cell {
  text-align: center;
  font-weight: 500;
  color: #6b7280;
}

.multiple-cell {
  text-align: center;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.status-badge.multiple {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.single {
  background: #fee2e2;
  color: #991b1b;
}

.status-icon {
  font-size: 10px;
}

/* Empty State Card */
.empty-state-card {
  background: white;
  border-radius: 12px;
  padding: 60px 20px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e7eb;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.empty-subtitle {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
}

/* Query Panel Styles */
.query-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.query-section {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
}

.section-title {
  margin: 0 0 16px 0;
  color: #495057;
  font-size: 16px;
  font-weight: 600;
}

.form-row-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.form-row-group:last-child {
  margin-bottom: 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field-spacer {
  /* 占位符，用于保持布局平衡 */
  min-height: 1px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.form-input,
.form-select {
  padding: 10px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  transition: all 0.2s ease;
  font-family: inherit;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  transform: translateY(-1px);
}

.form-input:hover,
.form-select:hover {
  border-color: #9ca3af;
}

.datetime-input {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
}

.form-select {
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 8px center;
  background-repeat: no-repeat;
  background-size: 16px;
  padding-right: 32px;
  appearance: none;
}

/* Combo Box Styles */
.combo-container {
  position: relative;
  flex: 1;
}

.combo-input {
  width: 100%;
  padding-right: 32px;
}

.combo-button {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border: none;
  background: #f8f9fa;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #6b7280;
  transition: all 0.2s ease;
}

.combo-button:hover {
  background: #e9ecef;
  color: #495057;
}

.combo-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.25);
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ced4da;
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dropdown-item {
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #f1f3f4;
  transition: background-color 0.2s ease;
}

.dropdown-item:hover {
  background: #f8f9fa;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item .code {
  font-weight: 600;
  color: #495057;
}

.dropdown-item .name {
  font-size: 12px;
  color: #6c757d;
  margin-left: 8px;
}

.field-selector {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
}

.field-option {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #f1f3f4;
}

.field-option:hover {
  background: #f8f9fa;
}

.field-option:last-child {
  border-bottom: none;
}

.field-option input {
  margin-right: 8px;
}

.field-type {
  margin-left: 8px;
  color: #6c757d;
}

.query-actions {
  display: flex;
  justify-content: center;
}

.query-button {
  padding: 10px 20px;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.query-button:hover:not(:disabled) {
  background: #0056b3;
}

.query-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.query-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.25);
}

/* Data Grid Styles */
.data-grid {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-header {
  background: #f8f9fa;
  padding: 10px 8px;
  text-align: left;
  border-bottom: 2px solid #dee2e6;
  font-weight: 600;
  color: #495057;
  position: sticky;
  top: 0;
}

.data-row:nth-child(even) {
  background: #f9f9f9;
}

.data-row:hover {
  background: #e3f2fd;
}

.data-cell {
  padding: 8px;
  border-bottom: 1px solid #f1f3f4;
  vertical-align: top;
  font-family: monospace;
  font-size: 11px;
}

/* Pagination Styles */
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.pagination-button {
  padding: 6px 12px;
  border: 1px solid #dee2e6;
  background: white;
  cursor: pointer;
}

.pagination-button:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 13px;
  color: #6c757d;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #6c757d;
  font-size: 14px;
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 8px;
  margin: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.empty-state::before {
  content: "📋";
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.6;
}

.empty-state:not(:has(::before)) {
  font-style: italic;
}

/* Custom Tree Overrides - Minimalist Design with PrimeVue 4.x classes */
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
  padding: 10px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
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

/* Tree Lines and Hierarchy */
:deep(.custom-tree .p-tree-node-children) {
  position: relative;
  margin-left: 20px;
}

/* Expand/Collapse Icons */
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

/* Node Icons */
:deep(.custom-tree .tree-icon) {
  margin-right: 8px;
  font-size: 14px;
  opacity: 0.8;
}

/* Revision Badge */
:deep(.custom-tree .revision-badge) {
  margin-left: auto;
  background: #10b981;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.025em;
}

/* Remove default PrimeVue styling */
:deep(.custom-tree .p-tree-node-label) {
  padding: 0;
  flex: 1;
}

/* Focus states */
:deep(.custom-tree .p-tree-node-content:focus) {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}

/* Smooth animations */
:deep(.custom-tree .p-tree-node-children) {
  transition: all 0.2s ease;
}

/* Clean spacing */
:deep(.custom-tree .p-tree) {
  margin: 0;
  padding: 0;
}

/* Root level nodes should not have left margin */
:deep(.custom-tree .p-tree-root-children > .p-tree-node > .p-tree-node-content) {
  margin-left: 0;
}

:deep(.custom-tree .p-tree-root-children > .p-tree-node > .p-tree-node-content::before),
:deep(.custom-tree .p-tree-root-children > .p-tree-node > .p-tree-node-content::after) {
  display: none;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .schema-viewer-container {
    flex-direction: column;
    height: auto;
  }

  .tree-panel {
    flex: none;
    height: 300px;
  }

  .grid-panel {
    flex: 1;
  }

  .form-row-group {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .form-field-spacer {
    display: none;
  }
}

@media (max-width: 1024px) and (min-width: 769px) {
  .form-row-group {
    grid-template-columns: repeat(2, 1fr);
  }

  .form-row-group:last-child .form-field-spacer {
    display: none;
  }
}
</style>

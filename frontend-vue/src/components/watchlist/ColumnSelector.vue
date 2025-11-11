<template>
  <div class="column-selector">
    <button class="selector-trigger" @click="showModal = true" title="Configure Columns">
      ⚙️ Columns
    </button>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Configure Watchlist Columns</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>

        <div class="modal-body">
          <div class="section">
            <h4>Select Metadata and Fields</h4>
            <div class="tree-info">
              <span class="info-text">📌 Check meta types and their fields to display in watchlist</span>
            </div>
            <div class="tree-container">
              <Tree
                v-model:selectionKeys="selectedKeys"
                v-model:expandedKeys="expandedKeys"
                :value="treeData"
                selectionMode="checkbox"
                class="column-tree"
              >
                <template #default="slotProps">
                  <div class="tree-node-content">
                    <span class="tree-icon">{{ getNodeIcon(slotProps.node) }}</span>
                    <span class="tree-label">{{ slotProps.node.label }}</span>
                    <span v-if="slotProps.node.type === 'meta'" class="revision-badge">
                      ({{ slotProps.node.revision }})
                    </span>
                    <!-- <span v-if="slotProps.node.type === 'namespace'" class="namespace-badge">
                      {{ slotProps.node.key === 'ns-0' ? 'Global' : 'Private' }}
                    </span> -->
                  </div>
                </template>
              </Tree>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="selection-summary">
            Selected: {{ selectedMetaCount }} meta(s), {{ selectedFieldCount }} field(s)
          </div>
          <button class="btn btn-secondary" @click="resetToDefault">
            Reset to Default
          </button>
          <button class="btn btn-primary" @click="applyConfiguration">
            Apply
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import Tree from 'primevue/tree'

interface ColumnConfig {
  metas: string[]
  fields: Record<string, string[]>
}

interface CustomTreeNode {
  key: string
  label: string
  type: 'namespace' | 'meta' | 'field'
  selectable?: boolean
  children?: CustomTreeNode[]
  revision?: number
  metaName?: string
  namespace?: string
  fieldName?: string
}

// Props
interface Props {
  currentConfig?: ColumnConfig
}

const props = withDefaults(defineProps<Props>(), {
  currentConfig: () => ({ metas: ['global::SampleQuote'], fields: { 'global::SampleQuote': ['open', 'close', 'low', 'high', 'volume'] } })
})

// Emits
const emit = defineEmits<{
  'update:config': [config: ColumnConfig]
}>()

// State
const showModal = ref(false)
const selectedKeys = ref<Record<string, any>>({})
const expandedKeys = ref<Record<string, boolean>>({
  'ns-0': true  // Default expand Global namespace
})

const dataStore = useDataStore()

// Build tree data structure
const treeData = computed((): CustomTreeNode[] => {
  const schema = dataStore.schema

  if (!schema || typeof schema !== 'object') {
    return []
  }

  const tree: CustomTreeNode[] = []
  const namespaceKeys = ["0", "1"] as const

  namespaceKeys.forEach((namespaceKey: string) => {
    const namespaceName = namespaceKey === "0" ? "global" : "private"
    const namespaceData = (schema as any)[namespaceKey]

    if (!namespaceData) return

    // Group metas by name and collect revisions
    const metaGroups: Record<string, any[]> = {}

    Object.entries(namespaceData).forEach(([, metaInfo]: [string, any]) => {
      const metaName = metaInfo.displayName ||
                       (metaInfo.name && metaInfo.name.includes("::") ? metaInfo.name.split("::").pop() : metaInfo.name) ||
                       'Unknown'

      if (!metaGroups[metaName]) {
        metaGroups[metaName] = []
      }

      metaGroups[metaName].push(metaInfo)
    })

    // Build meta nodes with revisions
    const metaNodes: CustomTreeNode[] = []

    Object.entries(metaGroups).forEach(([metaName, metaInfos]: [string, any[]]) => {
      // Sort by revision (highest first)
      metaInfos.sort((a, b) => (b.revision || 0) - (a.revision || 0))

      // Use the first (latest) meta for fields
      const latestMeta = metaInfos[0]
      const revision = latestMeta.revision || 0

      // Build field nodes
      const fieldNodes: CustomTreeNode[] = []
      if (latestMeta.fields && Array.isArray(latestMeta.fields)) {
        latestMeta.fields.forEach((field: any) => {
          const fieldName = field.name || field
          fieldNodes.push({
            key: `${namespaceKey}-${metaName}-${revision}-${fieldName}`,
            label: fieldName,
            type: 'field',
            selectable: true,
            metaName: metaName,
            namespace: namespaceName,
            fieldName: fieldName
          })
        })
      }

      // Create meta node
      metaNodes.push({
        key: `${namespaceKey}-${metaName}-${revision}`,
        label: metaName,
        type: 'meta',
        selectable: true,
        revision: revision,
        metaName: metaName,
        namespace: namespaceName,
        children: fieldNodes
      })
    })

    // Create namespace node (not selectable)
    tree.push({
      key: `ns-${namespaceKey}`,
      label: namespaceName.charAt(0).toUpperCase() + namespaceName.slice(1),
      type: 'namespace',
      selectable: false,
      children: metaNodes.sort((a, b) => a.label.localeCompare(b.label))
    })
  })

  return tree
})

// Function to initialize selectedKeys from currentConfig
const initializeSelectionFromConfig = (config: ColumnConfig) => {
  if (!config || !treeData.value.length) return

  const keys: Record<string, any> = {}

  config.metas.forEach(qualifiedName => {
    const [namespace, metaName] = qualifiedName.split('::')
    const namespaceKey = namespace === 'global' ? '0' : '1'

    // Find matching meta node key in tree
    treeData.value.forEach(nsNode => {
      if (nsNode.key === `ns-${namespaceKey}`) {
        nsNode.children?.forEach(metaNode => {
          if (metaNode.metaName === metaName) {
            // Select meta node
            keys[metaNode.key] = { checked: true, partialChecked: false }

            // Select configured fields
            const fields = config.fields[qualifiedName] || []
            metaNode.children?.forEach(fieldNode => {
              if (fields.includes(fieldNode.fieldName || '')) {
                keys[fieldNode.key] = { checked: true, partialChecked: false }
              }
            })
          }
        })
      }
    })
  })

  selectedKeys.value = keys
  console.log('✅ Initialized column selection from config:', config, 'Selected keys:', keys)
}

// Watch treeData changes and reinitialize selection
watch(treeData, (newTreeData) => {
  if (newTreeData.length > 0) {
    initializeSelectionFromConfig(props.currentConfig)
  }
}, { immediate: true })

// Watch currentConfig changes
watch(() => props.currentConfig, (config) => {
  if (treeData.value.length > 0) {
    initializeSelectionFromConfig(config)
  }
}, { deep: true })

// Count selected items
const selectedMetaCount = computed(() => {
  let count = 0
  Object.keys(selectedKeys.value).forEach(key => {
    if (selectedKeys.value[key]?.checked) {
      // Find node type
      treeData.value.forEach(nsNode => {
        nsNode.children?.forEach(metaNode => {
          if (metaNode.key === key) count++
        })
      })
    }
  })
  return count
})

const selectedFieldCount = computed(() => {
  let count = 0
  Object.keys(selectedKeys.value).forEach(key => {
    if (selectedKeys.value[key]?.checked) {
      // Check if it's a field node
      treeData.value.forEach(nsNode => {
        nsNode.children?.forEach(metaNode => {
          metaNode.children?.forEach(fieldNode => {
            if (fieldNode.key === key) count++
          })
        })
      })
    }
  })
  return count
})

// Get node icon
const getNodeIcon = (node: any): string => {
  if (node.type === 'namespace') return '📁'
  if (node.type === 'meta') return '📊'
  if (node.type === 'field') return '🏷️'
  return '•'
}

// Actions
const resetToDefault = () => {
  // Reset to default: global::SampleQuote with basic fields
  const keys: Record<string, any> = {}

  treeData.value.forEach(nsNode => {
    if (nsNode.key === 'ns-0') { // Global namespace
      nsNode.children?.forEach(metaNode => {
        if (metaNode.metaName === 'SampleQuote') {
          // Select meta
          keys[metaNode.key] = { checked: true, partialChecked: false }

          // Select default fields
          const defaultFields = ['open', 'close', 'low', 'high', 'volume']
          metaNode.children?.forEach(fieldNode => {
            if (defaultFields.includes(fieldNode.fieldName || '')) {
              keys[fieldNode.key] = { checked: true, partialChecked: false }
            }
          })
        }
      })
    }
  })

  selectedKeys.value = keys
}

const applyConfiguration = () => {
  // Extract configuration from selectedKeys
  const config: ColumnConfig = {
    metas: [],
    fields: {}
  }

  // Group selections by meta
  const metaSelections: Record<string, { namespace: string; metaName: string; fields: string[] }> = {}

  Object.keys(selectedKeys.value).forEach(key => {
    if (!selectedKeys.value[key]?.checked) return

    // Find the node
    treeData.value.forEach(nsNode => {
      nsNode.children?.forEach(metaNode => {
        // Check if it's a meta node
        if (metaNode.key === key) {
          const qualifiedName = `${metaNode.namespace}::${metaNode.metaName}`
          if (!metaSelections[qualifiedName]) {
            metaSelections[qualifiedName] = {
              namespace: metaNode.namespace || 'global',
              metaName: metaNode.metaName || '',
              fields: []
            }
          }
        }

        // Check if it's a field node
        metaNode.children?.forEach(fieldNode => {
          if (fieldNode.key === key) {
            const qualifiedName = `${fieldNode.namespace}::${fieldNode.metaName}`
            if (!metaSelections[qualifiedName]) {
              metaSelections[qualifiedName] = {
                namespace: fieldNode.namespace || 'global',
                metaName: fieldNode.metaName || '',
                fields: []
              }
            }
            metaSelections[qualifiedName].fields.push(fieldNode.fieldName || '')
          }
        })
      })
    })
  })

  // Build final config
  Object.entries(metaSelections).forEach(([qualifiedName, selection]) => {
    if (selection.fields.length > 0) {
      config.metas.push(qualifiedName)
      config.fields[qualifiedName] = selection.fields
    }
  })
  emit('update:config', config)
  closeModal()
}

const closeModal = () => {
  showModal.value = false
}

const handleOverlayClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    closeModal()
  }
}
</script>

<style scoped>
.column-selector {
  display: inline-block;
}

.selector-trigger {
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

.selector-trigger:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

/* Tree indentation fix */
.column-tree :deep(.p-tree-node-children) {
  padding-left: 1.5rem;
}

.column-tree :deep(.p-tree-node-content) {
  transition: background-color 0.2s;
}

.column-tree :deep(.p-tree-node-content:hover) {
  background: #f3f4f6;
}

.column-tree :deep(.p-tree-node-toggler) {
  margin-right: 0.1rem;
}

.column-tree :deep(.p-checkbox) {
  margin-right: 0.1rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #374151;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.section {
  margin-bottom: 24px;
}

.section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.meta-list,
.fields-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.meta-item,
.field-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.meta-item:hover,
.field-item:hover {
  background: #f9fafb;
  border-color: #0066cc;
}

.meta-item input,
.field-item input {
  margin-right: 8px;
  cursor: pointer;
}

.meta-name,
.field-name {
  font-size: 13px;
  color: #374151;
  font-weight: 500;
}

.meta-namespace {
  margin-left: auto;
  font-size: 11px;
  color: #9ca3af;
  padding: 2px 6px;
  background: #f3f4f6;
  border-radius: 3px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.btn-primary {
  background: #0066cc;
  color: white;
}

.btn-primary:hover {
  background: #0052a3;
}
</style>

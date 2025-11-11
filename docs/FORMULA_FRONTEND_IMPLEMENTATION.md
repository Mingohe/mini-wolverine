# Formula Frontend Implementation Guide

## Overview

This document provides a complete guide for implementing the Formula Management frontend interface in the Mini Wolverine Vue 3 application. The interface allows users to query, edit, create, and manage arithmetic formulas stored in the Wolverine Rails backend.

## Architecture

### Component Structure

```
frontend-vue/src/components/formula/
├── FormulaTab.vue              # Main Tab component (resizable split layout)
├── FormulaList.vue             # Left panel: formula list with search/filter
├── FormulaEditor.vue           # Right panel: Monaco editor
├── FormulaToolbar.vue          # Toolbar: New, Save, Delete, Share buttons
├── FormulaMetadataPanel.vue    # Formula metadata editing (name, description)
└── ResizableSplitter.vue       # Resizable divider component
```

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Formula Management Tab                                      │
├─────────────────┬──┬────────────────────────────────────────┤
│ 📋 Formula List │││ 🛠️ Toolbar: [New] [Save] [Delete]      │
│                 │││                                          │
│ ┌─────────────┐ │││ 📝 Formula Name: momentum_strategy      │
│ │ Formula 1   │ │││ 📋 Language: Formula DSL (5)           │
│ │ ├─ Owned    │ │││ 📄 Description: Momentum trading...    │
│ └─────────────┘ │││                                          │
│ ┌─────────────┐ │││ Monaco Editor (Code):                   │
│ │ Formula 2   │ │││ ┌─────────────────────────────────────┐│
│ │ ├─ Shared   │ │││ │ def calculate_momentum(...):        ││
│ └─────────────┘ │││ │     return ...                      ││
│                 │││ │                                     ││
│ [Search...]     │││ └─────────────────────────────────────┘│
│ [Filter: All▼]  │││                                          │
│                 │││                                          │
└─────────────────┴──┴────────────────────────────────────────┘
     240px-600px  │   Flex: 1
                Resize
                Handle
```

**Key Features:**
- **Resizable Layout**: Left panel width adjustable from 240px to 600px
- **Formula List**: Searchable and filterable formula list
- **Monaco Editor**: VSCode-quality code editing experience
- **Metadata Panel**: Edit formula name, language, and description
- **Toolbar**: Quick access to common operations

---

## Technology Stack

### Dependencies

```json
{
  "dependencies": {
    "monaco-editor": "^0.45.0",
    "@guolao/vue-monaco-editor": "^1.3.0",
    "pinia": "^2.1.7"
  },
  "devDependencies": {
    "vite-plugin-monaco-editor": "^1.1.0"
  }
}
```

### Installation

```bash
cd frontend-vue
npm install monaco-editor @guolao/vue-monaco-editor
npm install -D vite-plugin-monaco-editor
```

---

## Configuration

### Vite Configuration

Update `vite.config.ts` to include Monaco Editor plugin:

```typescript
// frontend-vue/vite.config.ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

export default defineConfig({
  plugins: [
    vue(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html']
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
})
```

---

## State Management

### Formula Store (Pinia)

Create a dedicated Pinia store for formula management:

```typescript
// frontend-vue/src/stores/formulaStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { formulaService } from '@/services/formulaService'

export interface Formula {
  id: number
  name: string
  source_code: string
  language_id: number
  created_at: string
  updated_at: string
  owner_user_id: number
  is_public: boolean
  description?: string
}

export interface FormulaFilters {
  languageId?: number
  pattern?: string
  privateOnly?: boolean
}

export const useFormulaStore = defineStore('formula', () => {
  // State
  const formulas = ref<Formula[]>([])
  const selectedFormula = ref<Formula | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const isDirty = ref(false) // Track unsaved changes

  // Filters
  const searchPattern = ref('')
  const languageFilter = ref<number | null>(null)
  const privateOnlyFilter = ref(false)

  // Computed
  const filteredFormulas = computed(() => {
    let result = formulas.value

    // Apply search pattern
    if (searchPattern.value) {
      const pattern = searchPattern.value.toLowerCase()
      result = result.filter(f =>
        f.name.toLowerCase().includes(pattern) ||
        f.source_code.toLowerCase().includes(pattern)
      )
    }

    // Apply language filter
    if (languageFilter.value !== null) {
      result = result.filter(f => f.language_id === languageFilter.value)
    }

    // Apply private only filter
    if (privateOnlyFilter.value) {
      result = result.filter(f => !f.is_public)
    }

    return result
  })

  const hasUnsavedChanges = computed(() => isDirty.value)

  // Actions
  async function loadFormulas(filters?: FormulaFilters) {
    loading.value = true
    error.value = null

    try {
      const response = await formulaService.queryFormulas(filters)
      formulas.value = response.formulas

      // Auto-select first formula if none selected
      if (formulas.value.length > 0 && !selectedFormula.value) {
        selectFormula(formulas.value[0])
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load formulas'
      console.error('Failed to load formulas:', err)
    } finally {
      loading.value = false
    }
  }

  async function saveFormula(formulaData: Partial<Formula>) {
    saving.value = true
    error.value = null

    try {
      const response = await formulaService.saveFormula({
        id: formulaData.id,
        name: formulaData.name!,
        sourceCode: formulaData.source_code!,
        languageId: formulaData.language_id!,
        description: formulaData.description
      })

      // Update local state
      if (formulaData.id) {
        // Update existing
        const index = formulas.value.findIndex(f => f.id === formulaData.id)
        if (index !== -1) {
          formulas.value[index] = response.formula
        }
      } else {
        // Add new
        formulas.value.unshift(response.formula)
      }

      selectedFormula.value = response.formula
      isDirty.value = false

      return response.formula
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save formula'
      console.error('Failed to save formula:', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  async function deleteFormula(id: number) {
    loading.value = true
    error.value = null

    try {
      await formulaService.deleteFormula(id)
      formulas.value = formulas.value.filter(f => f.id !== id)

      // Select next formula if current was deleted
      if (selectedFormula.value?.id === id) {
        selectedFormula.value = formulas.value.length > 0 ? formulas.value[0] : null
        isDirty.value = false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete formula'
      console.error('Failed to delete formula:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function selectFormula(formula: Formula) {
    // Clone for editing (prevent direct mutation)
    selectedFormula.value = JSON.parse(JSON.stringify(formula))
    isDirty.value = false
  }

  function updateSelectedFormula(updates: Partial<Formula>) {
    if (selectedFormula.value) {
      selectedFormula.value = { ...selectedFormula.value, ...updates }
      isDirty.value = true
    }
  }

  function createNewFormula() {
    selectedFormula.value = {
      id: 0, // 0 indicates new formula
      name: 'New Formula',
      source_code: '# Enter your formula code here\n',
      language_id: 5, // Default to Formula DSL
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_user_id: 0,
      is_public: false,
      description: ''
    }
    isDirty.value = true
  }

  function resetDirtyFlag() {
    isDirty.value = false
  }

  return {
    // State
    formulas,
    selectedFormula,
    loading,
    saving,
    error,
    isDirty,

    // Filters
    searchPattern,
    languageFilter,
    privateOnlyFilter,

    // Computed
    filteredFormulas,
    hasUnsavedChanges,

    // Actions
    loadFormulas,
    saveFormula,
    deleteFormula,
    selectFormula,
    updateSelectedFormula,
    createNewFormula,
    resetDirtyFlag
  }
})
```

---

## Service Layer

### Formula Service

Create a service for formula-related API calls:

```typescript
// frontend-vue/src/services/formulaService.ts
import { websocketTaskService } from './websocketTaskService'

export interface FormulaFilters {
  languageId?: number
  pattern?: string
  privateOnly?: boolean
}

export interface FormulaData {
  id?: number
  name: string
  sourceCode: string
  languageId: number
  description?: string
}

export interface FormulaQueryResponse {
  success: boolean
  formulas: Array<{
    id: number
    name: string
    source_code: string
    language_id: number
    created_at: string
    updated_at: string
    owner_user_id: number
    is_public: boolean
    description?: string
  }>
  error?: string
}

export interface FormulaSaveResponse {
  success: boolean
  formula: {
    id: number
    name: string
    source_code: string
    language_id: number
    created_at: string
    updated_at: string
    owner_user_id: number
    is_public: boolean
    description?: string
  }
  error?: string
}

export interface FormulaDeleteResponse {
  success: boolean
  error?: string
}

export class FormulaService {
  /**
   * Query formulas with optional filters
   */
  async queryFormulas(filters?: FormulaFilters): Promise<FormulaQueryResponse> {
    const params: Record<string, any> = {}

    if (filters?.languageId !== undefined) {
      params.language_id = filters.languageId
    }

    if (filters?.pattern) {
      params.pattern = filters.pattern
    }

    if (filters?.privateOnly !== undefined) {
      params.private_only = filters.privateOnly ? 1 : 0
    }

    return websocketTaskService.sendTask({
      type: 'query_formulas',
      params
    })
  }

  /**
   * Save (create or update) a formula
   */
  async saveFormula(data: FormulaData): Promise<FormulaSaveResponse> {
    const params: Record<string, any> = {
      name: data.name,
      source_code: data.sourceCode,
      language_id: data.languageId
    }

    if (data.id && data.id > 0) {
      params.id = data.id
    }

    if (data.description) {
      params.description = data.description
    }

    return websocketTaskService.sendTask({
      type: 'save_formula',
      params
    })
  }

  /**
   * Delete a formula by ID
   */
  async deleteFormula(id: number): Promise<FormulaDeleteResponse> {
    return websocketTaskService.sendTask({
      type: 'delete_formula',
      params: { id }
    })
  }
}

export const formulaService = new FormulaService()
```

---

## Component Implementation

### 1. ResizableSplitter Component

A reusable component for resizable split layouts:

```vue
<!-- frontend-vue/src/components/formula/ResizableSplitter.vue -->
<template>
  <div class="resizable-splitter" ref="containerRef">
    <div class="left-panel" :style="{ width: leftWidth + 'px' }">
      <slot name="left"></slot>
    </div>

    <div
      class="resize-handle"
      @mousedown="startResize"
      @touchstart="startResize"
    >
      <div class="resize-handle-icon"></div>
    </div>

    <div class="right-panel">
      <slot name="right"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  minLeftWidth: {
    type: Number,
    default: 240
  },
  maxLeftWidth: {
    type: Number,
    default: 600
  },
  defaultLeftWidth: {
    type: Number,
    default: 320
  }
})

const emit = defineEmits<{
  resize: [width: number]
}>()

const containerRef = ref<HTMLElement | null>(null)
const leftWidth = ref(props.defaultLeftWidth)
const isResizing = ref(false)

function startResize(e: MouseEvent | TouchEvent) {
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  e.preventDefault()
}

function handleResize(e: MouseEvent | TouchEvent) {
  if (!isResizing.value || !containerRef.value) return

  const containerRect = containerRef.value.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const newWidth = clientX - containerRect.left

  // Constrain width within min/max bounds
  if (newWidth >= props.minLeftWidth && newWidth <= props.maxLeftWidth) {
    leftWidth.value = newWidth
    emit('resize', newWidth)
  }
}

function stopResize() {
  if (isResizing.value) {
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
}

onMounted(() => {
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.addEventListener('touchmove', handleResize)
  document.addEventListener('touchend', stopResize)

  // Restore saved width from localStorage
  const savedWidth = localStorage.getItem('formula-splitter-width')
  if (savedWidth) {
    const width = parseInt(savedWidth, 10)
    if (width >= props.minLeftWidth && width <= props.maxLeftWidth) {
      leftWidth.value = width
    }
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', handleResize)
  document.removeEventListener('touchend', stopResize)

  // Save width to localStorage
  localStorage.setItem('formula-splitter-width', leftWidth.value.toString())
})
</script>

<style scoped>
.resizable-splitter {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.left-panel {
  flex-shrink: 0;
  overflow: auto;
  border-right: 1px solid var(--border-color);
}

.resize-handle {
  width: 8px;
  flex-shrink: 0;
  cursor: col-resize;
  background: var(--background-secondary);
  position: relative;
  transition: background-color 0.2s;
}

.resize-handle:hover {
  background: var(--primary-color);
}

.resize-handle-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 40px;
  background: var(--text-tertiary);
  border-radius: 1px;
}

.resize-handle:hover .resize-handle-icon {
  background: white;
}

.right-panel {
  flex: 1;
  overflow: auto;
}
</style>
```

### 2. FormulaList Component

Left panel showing the list of formulas:

```vue
<!-- frontend-vue/src/components/formula/FormulaList.vue -->
<template>
  <div class="formula-list">
    <!-- Search and Filter -->
    <div class="list-header">
      <div class="search-box">
        <input
          v-model="searchPattern"
          type="text"
          placeholder="Search formulas..."
          class="search-input"
        />
      </div>

      <div class="filter-row">
        <select v-model="languageFilter" class="language-filter">
          <option :value="null">All Languages</option>
          <option :value="0">Python</option>
          <option :value="5">Formula DSL</option>
        </select>

        <label class="private-filter">
          <input type="checkbox" v-model="privateOnlyFilter" />
          Private Only
        </label>
      </div>
    </div>

    <!-- Formula Items -->
    <div class="list-content">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading formulas...</p>
      </div>

      <div v-else-if="filteredFormulas.length === 0" class="empty-state">
        <p>No formulas found</p>
      </div>

      <div
        v-for="formula in filteredFormulas"
        :key="formula.id"
        class="formula-item"
        :class="{ active: selectedFormula?.id === formula.id }"
        @click="handleSelectFormula(formula)"
      >
        <div class="formula-name">{{ formula.name }}</div>
        <div class="formula-meta">
          <span class="language-tag">{{ getLanguageName(formula.language_id) }}</span>
          <span class="ownership-tag" :class="{ owned: !formula.is_public, shared: formula.is_public }">
            {{ formula.is_public ? 'Shared' : 'Owned' }}
          </span>
        </div>
        <div v-if="formula.description" class="formula-description">
          {{ formula.description }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFormulaStore } from '@/stores/formulaStore'

const formulaStore = useFormulaStore()
const {
  filteredFormulas,
  selectedFormula,
  loading,
  searchPattern,
  languageFilter,
  privateOnlyFilter
} = storeToRefs(formulaStore)

function handleSelectFormula(formula: any) {
  // Check for unsaved changes
  if (formulaStore.hasUnsavedChanges) {
    const confirmed = confirm('You have unsaved changes. Do you want to discard them?')
    if (!confirmed) return
  }

  formulaStore.selectFormula(formula)
}

function getLanguageName(languageId: number): string {
  switch (languageId) {
    case 0: return 'Python'
    case 5: return 'Formula DSL'
    default: return `Language ${languageId}`
  }
}
</script>

<style scoped>
.formula-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--background-primary);
}

.list-header {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.search-box {
  margin-bottom: 8px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--background-secondary);
  color: var(--text-primary);
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.filter-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.language-filter {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--background-secondary);
  color: var(--text-primary);
  font-size: 12px;
}

.private-filter {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.list-content {
  flex: 1;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-tertiary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.formula-item {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.2s;
}

.formula-item:hover {
  background: var(--background-secondary);
}

.formula-item.active {
  background: var(--primary-color);
  color: white;
}

.formula-name {
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 4px;
}

.formula-meta {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}

.language-tag,
.ownership-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--background-tertiary);
  color: var(--text-tertiary);
}

.ownership-tag.owned {
  background: var(--success-color);
  color: white;
}

.ownership-tag.shared {
  background: var(--info-color);
  color: white;
}

.formula-item.active .language-tag,
.formula-item.active .ownership-tag {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.formula-description {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.4;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.formula-item.active .formula-description {
  color: rgba(255, 255, 255, 0.8);
}
</style>
```

### 3. FormulaToolbar Component

Toolbar with action buttons:

```vue
<!-- frontend-vue/src/components/formula/FormulaToolbar.vue -->
<template>
  <div class="formula-toolbar">
    <div class="toolbar-left">
      <button class="toolbar-btn primary" @click="handleNew" title="New Formula">
        <span class="icon">➕</span>
        <span class="label">New</span>
      </button>

      <button
        class="toolbar-btn success"
        @click="handleSave"
        :disabled="!hasChanges || saving"
        title="Save Formula (Ctrl+S)"
      >
        <span class="icon">💾</span>
        <span class="label">{{ saving ? 'Saving...' : 'Save' }}</span>
      </button>

      <button
        class="toolbar-btn danger"
        @click="handleDelete"
        :disabled="!selectedFormula || selectedFormula.id === 0"
        title="Delete Formula"
      >
        <span class="icon">🗑️</span>
        <span class="label">Delete</span>
      </button>
    </div>

    <div class="toolbar-right">
      <div v-if="hasChanges" class="unsaved-indicator">
        ● Unsaved changes
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFormulaStore } from '@/stores/formulaStore'

const formulaStore = useFormulaStore()
const { selectedFormula, saving, hasUnsavedChanges } = storeToRefs(formulaStore)

const hasChanges = computed(() => hasUnsavedChanges.value)

function handleNew() {
  if (hasChanges.value) {
    const confirmed = confirm('You have unsaved changes. Do you want to discard them?')
    if (!confirmed) return
  }

  formulaStore.createNewFormula()
}

async function handleSave() {
  if (!selectedFormula.value) return

  try {
    await formulaStore.saveFormula(selectedFormula.value)
    // Success notification could be added here
  } catch (error) {
    alert('Failed to save formula: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

async function handleDelete() {
  if (!selectedFormula.value || selectedFormula.value.id === 0) return

  const confirmed = confirm(`Are you sure you want to delete "${selectedFormula.value.name}"?`)
  if (!confirmed) return

  try {
    await formulaStore.deleteFormula(selectedFormula.value.id)
    // Success notification could be added here
  } catch (error) {
    alert('Failed to delete formula: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}
</script>

<style scoped>
.formula-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--background-secondary);
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--background-primary);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-btn.primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.toolbar-btn.success {
  background: var(--success-color);
  color: white;
  border-color: var(--success-color);
}

.toolbar-btn.danger {
  background: var(--danger-color);
  color: white;
  border-color: var(--danger-color);
}

.icon {
  font-size: 16px;
}

.unsaved-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--warning-color);
  font-size: 13px;
  font-weight: 500;
}
</style>
```

### 4. FormulaMetadataPanel Component

Panel for editing formula metadata:

```vue
<!-- frontend-vue/src/components/formula/FormulaMetadataPanel.vue -->
<template>
  <div class="formula-metadata" v-if="selectedFormula">
    <div class="metadata-row">
      <label class="metadata-label">Formula Name:</label>
      <input
        v-model="formulaName"
        type="text"
        class="metadata-input"
        placeholder="Enter formula name..."
        @input="handleUpdate"
      />
    </div>

    <div class="metadata-row">
      <label class="metadata-label">Language:</label>
      <select v-model="languageId" class="metadata-select" @change="handleUpdate">
        <option :value="0">Python</option>
        <option :value="5">Formula DSL</option>
      </select>
    </div>

    <div class="metadata-row">
      <label class="metadata-label">Description:</label>
      <textarea
        v-model="description"
        class="metadata-textarea"
        placeholder="Enter formula description..."
        rows="2"
        @input="handleUpdate"
      ></textarea>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useFormulaStore } from '@/stores/formulaStore'

const formulaStore = useFormulaStore()
const { selectedFormula } = storeToRefs(formulaStore)

const formulaName = ref('')
const languageId = ref(5)
const description = ref('')

// Watch for formula selection changes
watch(selectedFormula, (newFormula) => {
  if (newFormula) {
    formulaName.value = newFormula.name
    languageId.value = newFormula.language_id
    description.value = newFormula.description || ''
  }
}, { immediate: true })

function handleUpdate() {
  formulaStore.updateSelectedFormula({
    name: formulaName.value,
    language_id: languageId.value,
    description: description.value
  })
}
</script>

<style scoped>
.formula-metadata {
  padding: 16px;
  background: var(--background-secondary);
  border-bottom: 1px solid var(--border-color);
}

.metadata-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.metadata-row:last-child {
  margin-bottom: 0;
}

.metadata-label {
  flex-shrink: 0;
  width: 100px;
  padding-top: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.metadata-input,
.metadata-select,
.metadata-textarea {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--background-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
}

.metadata-input:focus,
.metadata-select:focus,
.metadata-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
}

.metadata-textarea {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}
</style>
```

### 5. FormulaEditor Component

Monaco Editor integration:

```vue
<!-- frontend-vue/src/components/formula/FormulaEditor.vue -->
<template>
  <div class="formula-editor">
    <MonacoEditor
      v-if="selectedFormula"
      v-model:value="code"
      :language="editorLanguage"
      :theme="editorTheme"
      :options="editorOptions"
      @change="handleChange"
    />
    <div v-else class="empty-editor">
      <p>Select a formula to edit or create a new one</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useFormulaStore } from '@/stores/formulaStore'
import MonacoEditor from '@guolao/vue-monaco-editor'

const formulaStore = useFormulaStore()
const { selectedFormula } = storeToRefs(formulaStore)

const code = ref('')
const editorTheme = ref('vs-dark')

const editorLanguage = computed(() => {
  if (!selectedFormula.value) return 'plaintext'

  // Map language_id to Monaco language
  switch (selectedFormula.value.language_id) {
    case 0: return 'python'
    case 5: return 'plaintext' // Formula DSL (custom)
    default: return 'plaintext'
  }
})

const editorOptions = {
  automaticLayout: true,
  fontSize: 14,
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  lineNumbers: 'on',
  renderWhitespace: 'selection',
  tabSize: 2,
  insertSpaces: true,
  folding: true,
  bracketPairColorization: {
    enabled: true
  }
}

// Watch for formula selection changes
watch(selectedFormula, (newFormula) => {
  if (newFormula) {
    code.value = newFormula.source_code
  }
}, { immediate: true })

function handleChange(newValue: string) {
  formulaStore.updateSelectedFormula({
    source_code: newValue
  })
}

// Keyboard shortcuts
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

function handleKeyDown(e: KeyboardEvent) {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (selectedFormula.value && formulaStore.hasUnsavedChanges) {
      formulaStore.saveFormula(selectedFormula.value)
    }
  }
}
</script>

<style scoped>
.formula-editor {
  height: 100%;
  width: 100%;
}

.empty-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  font-size: 16px;
}
</style>
```

### 6. FormulaTab Component (Main Container)

Main component that combines all sub-components:

```vue
<!-- frontend-vue/src/components/formula/FormulaTab.vue -->
<template>
  <div class="formula-tab">
    <ResizableSplitter
      :min-left-width="240"
      :max-left-width="600"
      :default-left-width="320"
    >
      <template #left>
        <FormulaList />
      </template>

      <template #right>
        <div class="editor-container">
          <FormulaToolbar />
          <FormulaMetadataPanel />
          <FormulaEditor />
        </div>
      </template>
    </ResizableSplitter>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useFormulaStore } from '@/stores/formulaStore'
import ResizableSplitter from './ResizableSplitter.vue'
import FormulaList from './FormulaList.vue'
import FormulaToolbar from './FormulaToolbar.vue'
import FormulaMetadataPanel from './FormulaMetadataPanel.vue'
import FormulaEditor from './FormulaEditor.vue'

const formulaStore = useFormulaStore()

onMounted(() => {
  // Load formulas when component mounts
  formulaStore.loadFormulas()
})
</script>

<style scoped>
.formula-tab {
  height: 100%;
  overflow: hidden;
}

.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>
```

---

## Integration with WatchlistTab

Update the WatchlistTab component to include the Formula tab:

```vue
<!-- frontend-vue/src/components/WatchlistTab.vue -->
<template>
  <div class="watchlist-container">
    <!-- Tabs -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-button"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Existing tabs... -->

      <!-- Formula Management Tab -->
      <div v-if="activeTab === 'formula'" class="tab-panel">
        <FormulaTab />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import FormulaTab from './formula/FormulaTab.vue'

const tabs = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'historical', label: 'Historical' },
  { id: 'formula', label: 'Formula' } // Add formula tab
]

const activeTab = ref('watchlist')
</script>
```

---

## CSS Variables

Add these CSS variables to your global styles for consistent theming:

```css
/* frontend-vue/src/assets/main.css */
:root {
  /* Colors */
  --primary-color: #007bff;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;

  /* Backgrounds */
  --background-primary: #1e1e1e;
  --background-secondary: #252526;
  --background-tertiary: #2d2d30;

  /* Text */
  --text-primary: #cccccc;
  --text-secondary: #999999;
  --text-tertiary: #666666;

  /* Borders */
  --border-color: #3e3e42;
}
```

---

## Testing

### Manual Testing Checklist

1. **Formula List**
   - [ ] Load formulas on component mount
   - [ ] Search formulas by name/code
   - [ ] Filter by language
   - [ ] Filter by ownership (private only)
   - [ ] Select formula from list
   - [ ] Unsaved changes warning when switching

2. **Formula Editor**
   - [ ] Display selected formula code
   - [ ] Syntax highlighting for Python
   - [ ] Code editing updates state
   - [ ] Keyboard shortcuts (Ctrl+S)

3. **Metadata Panel**
   - [ ] Edit formula name
   - [ ] Change language
   - [ ] Edit description
   - [ ] Changes mark formula as dirty

4. **Toolbar**
   - [ ] Create new formula
   - [ ] Save formula (new and existing)
   - [ ] Delete formula
   - [ ] Disabled states when appropriate
   - [ ] Unsaved changes indicator

5. **Resizable Layout**
   - [ ] Drag resize handle
   - [ ] Constrain width within min/max
   - [ ] Persist width to localStorage
   - [ ] Restore width on reload

### Integration Testing

```bash
# Start backend
cd backend
npm start

# Start frontend
cd frontend-vue
npm run dev

# Test WebSocket task responses
# Use browser DevTools Network tab to verify:
# - query_formulas task
# - save_formula task
# - delete_formula task
```

---

## Deployment Checklist

1. **Build Configuration**
   - [ ] Verify Monaco Editor plugin in Vite config
   - [ ] Check production build size
   - [ ] Test production build locally

2. **Environment Variables**
   - [ ] Configure WebSocket URL
   - [ ] Set authentication token

3. **Performance**
   - [ ] Lazy load Monaco Editor
   - [ ] Optimize formula list rendering
   - [ ] Add pagination for large lists

4. **Error Handling**
   - [ ] Network error handling
   - [ ] WebSocket disconnection recovery
   - [ ] User-friendly error messages

---

## Future Enhancements

### Phase 2 Features

1. **Formula Sharing**
   - Toggle public/private visibility
   - Share formulas with specific users
   - Import/export formulas

2. **Advanced Editor Features**
   - Custom DSL syntax highlighting
   - Language Server Protocol integration
   - Code snippets and templates
   - Formula validation

3. **Formula Execution**
   - Run formulas from UI
   - Display execution results
   - Error reporting and debugging

4. **Collaboration**
   - Real-time collaborative editing
   - Version history
   - Comments and annotations

### Performance Optimizations

1. **Virtual Scrolling**: Implement virtual scrolling for large formula lists
2. **Code Splitting**: Lazy load Monaco Editor bundle
3. **Caching**: Cache formula list and editor state
4. **Debouncing**: Debounce search and filter operations

---

## Troubleshooting

### Monaco Editor Issues

**Problem**: Monaco Editor not loading
```bash
# Solution: Verify Vite plugin configuration
npm install -D vite-plugin-monaco-editor
# Check vite.config.ts includes monacoEditorPlugin
```

**Problem**: Workers not loading in production
```typescript
// Solution: Configure worker path in vite.config.ts
export default defineConfig({
  plugins: [
    monacoEditorPlugin({
      publicPath: '/assets/monaco-editor'
    })
  ]
})
```

### WebSocket Task Issues

**Problem**: Tasks not receiving responses
```typescript
// Solution: Check backend task handler registration
// Ensure CaitlynBackendService handles formula tasks
```

### State Management Issues

**Problem**: Dirty flag not updating
```typescript
// Solution: Ensure updateSelectedFormula is called
// Check component v-model bindings
```

---

## Summary

This implementation provides:

- ✅ **Resizable Split Layout**: Adjustable left panel width (240px-600px)
- ✅ **Monaco Editor Integration**: VSCode-quality editing experience
- ✅ **Complete CRUD Operations**: Create, Read, Update, Delete formulas
- ✅ **Search and Filter**: Find formulas by name, language, ownership
- ✅ **Unsaved Changes Tracking**: Prevent accidental data loss
- ✅ **Keyboard Shortcuts**: Ctrl+S to save
- ✅ **Responsive Design**: Adapts to different screen sizes
- ✅ **Error Handling**: User-friendly error messages
- ✅ **State Persistence**: Save layout preferences to localStorage

The formula management interface is now ready for implementation with all components, services, and state management fully specified.

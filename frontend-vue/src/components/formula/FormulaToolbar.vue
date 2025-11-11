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

      <button
        class="toolbar-btn test"
        @click="handleTestRun"
        :disabled="!selectedFormula || !selectedFormula.source_code"
        title="Test Run Formula"
      >
        <span class="icon">▶️</span>
        <span class="label">Test Run</span>
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

const emit = defineEmits<{
  (e: 'test-run'): void
}>()

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

function handleTestRun() {
  if (!selectedFormula.value) return
  emit('test-run')
}
</script>

<style scoped>
.formula-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.toolbar-left {
  display: flex;
  gap: 6px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-btn.primary {
  background: #0066cc;
  color: white;
  border-color: #0066cc;
}

.toolbar-btn.primary:hover:not(:disabled) {
  background: #0052a3;
}

.toolbar-btn.success {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

.toolbar-btn.success:hover:not(:disabled) {
  background: #218838;
}

.toolbar-btn.danger {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.toolbar-btn.danger:hover:not(:disabled) {
  background: #c82333;
}

.toolbar-btn.test {
  background: #17a2b8;
  color: white;
  border-color: #17a2b8;
}

.toolbar-btn.test:hover:not(:disabled) {
  background: #138496;
}

.icon {
  font-size: 14px;
}

.unsaved-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #f59e0b;
  font-size: 13px;
  font-weight: 500;
}
</style>

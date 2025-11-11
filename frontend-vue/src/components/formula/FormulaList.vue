<template>
  <div class="formula-list">
    <!-- Search -->
    <div class="list-header">
      <div class="search-box">
        <input
          v-model="searchPattern"
          type="text"
          placeholder="Search formulas..."
          class="search-input"
        />
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
        <div class="formula-header">
          <span class="formula-name">{{ formula.name }}</span>
          <span class="language-tag">{{ getLanguageName(formula.language_id) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useFormulaStore } from '@/stores/formulaStore'

const formulaStore = useFormulaStore()
const {
  filteredFormulas,
  selectedFormula,
  loading,
  searchPattern
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
  background: white;
}

.list-header {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.search-box {
  margin-bottom: 8px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  color: #374151;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
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
  color: #9ca3af;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #0066cc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.formula-item {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background-color 0.2s;
  background: white;
}

.formula-item:hover {
  background: #f9fafb;
}

.formula-item.active {
  background: #eff6ff;
  border-left: 3px solid #0066cc;
}

.formula-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.formula-name {
  font-weight: 500;
  font-size: 14px;
  color: #111827;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.formula-item.active .formula-name {
  color: #0066cc;
}

.language-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: #f3f4f6;
  color: #6b7280;
  flex-shrink: 0;
}

.formula-item.active .language-tag {
  background: rgba(0, 102, 204, 0.1);
  color: #0066cc;
}
</style>

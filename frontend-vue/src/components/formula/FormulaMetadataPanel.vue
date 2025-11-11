<template>
  <div class="formula-metadata" v-if="selectedFormula">
    <div class="metadata-info">
      <span class="info-label">Formula Name:</span>
      <input
        type="text"
        :value="selectedFormula.name"
        @input="handleNameChange"
        class="name-input"
        placeholder="Enter formula name"
      />
      <span class="info-separator">|</span>
      <span class="info-label">Language:</span>
      <span class="info-value">{{ getLanguageName(selectedFormula.language_id) }}</span>

      <div class="checkbox-container">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="addToMain"
            @change="handleAddToMainChange"
            class="checkbox-input"
          />
          <span>Add to Main</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFormulaStore } from '@/stores/formulaStore'

const formulaStore = useFormulaStore()
const { selectedFormula } = storeToRefs(formulaStore)

function getLanguageName(languageId: number): string {
  switch (languageId) {
    case 0: return 'Python'
    case 5: return 'Formula DSL'
    default: return `Language ${languageId}`
  }
}

const addToMain = computed(() => {
  if (!selectedFormula.value?.property) return false
  try {
    const prop = JSON.parse(selectedFormula.value.property)
    return prop.add_to_main === true
  } catch {
    return false
  }
})

function handleNameChange(event: Event) {
  const target = event.target as HTMLInputElement
  formulaStore.updateSelectedFormula({
    name: target.value
  })
}

function handleAddToMainChange(event: Event) {
  const target = event.target as HTMLInputElement
  const newValue = target.checked

  // Update the property JSON
  const property = JSON.stringify({ add_to_main: newValue })

  formulaStore.updateSelectedFormula({
    property
  })
}
</script>

<style scoped>
.formula-metadata {
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.metadata-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.info-label {
  color: #6b7280;
  font-weight: 500;
}

.info-value {
  color: #111827;
  font-weight: 600;
}

.info-separator {
  color: #d1d5db;
  margin: 0 4px;
}

.name-input {
  flex: 0 1 300px;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
  color: #111827;
  font-weight: 600;
  background: white;
  transition: border-color 0.2s;
}

.name-input:hover {
  border-color: #9ca3af;
}

.name-input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.checkbox-container {
  margin-left: auto;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  user-select: none;
}

.checkbox-input {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #0066cc;
}

.checkbox-label:hover {
  color: #0066cc;
}
</style>

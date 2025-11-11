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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useFormulaStore } from '@/stores/formulaStore'
import MonacoEditor from '@/components/MonacoEditor.vue'

const formulaStore = useFormulaStore()
const { selectedFormula } = storeToRefs(formulaStore)

const code = ref('')
const editorTheme = ref('vs') // Use light theme
const isUpdatingFromStore = ref(false) // Flag to prevent dirty flag during programmatic updates

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
  wordWrap: 'on' as const,
  lineNumbers: 'on' as const,
  renderWhitespace: 'selection' as const,
  tabSize: 2,
  insertSpaces: true,
  folding: true,
  bracketPairColorization: {
    enabled: true
  }
}

// Watch for formula selection changes
watch(selectedFormula, (newFormula) => {
  if (newFormula && newFormula.source_code !== undefined) {
    isUpdatingFromStore.value = true
    code.value = newFormula.source_code || ''
    // Reset the flag after the update is complete
    nextTick(() => {
      isUpdatingFromStore.value = false
    })
  }
}, { immediate: true })

function handleChange(newValue: string) {
  // Only update store if this is a user-initiated change, not a programmatic update
  if (!isUpdatingFromStore.value) {
    formulaStore.updateSelectedFormula({
      source_code: newValue
    })
  }
}

// Keyboard shortcuts
function handleKeyDown(e: KeyboardEvent) {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (selectedFormula.value && formulaStore.hasUnsavedChanges) {
      formulaStore.saveFormula(selectedFormula.value)
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.formula-editor {
  height: 100%;
  width: 100%;
  background: white;
}

.empty-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
  font-size: 15px;
  background: #f9fafb;
}
</style>

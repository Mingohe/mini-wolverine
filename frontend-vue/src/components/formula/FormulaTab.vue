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
          <FormulaToolbar @test-run="handleTestRun" />
          <FormulaMetadataPanel />
          <FormulaEditor />
        </div>
      </template>
    </ResizableSplitter>

    <!-- Test Run Dialog -->
    <FormulaTestDialog
      :visible="showTestDialog"
      :formula-id="selectedFormula?.id"
      :formula-name="selectedFormula?.name || 'Untitled'"
      :source-code="selectedFormula?.source_code || ''"
      :language-id="selectedFormula?.language_id || 5"
      @close="showTestDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useFormulaStore } from '@/stores/formulaStore'
import ResizableSplitter from './ResizableSplitter.vue'
import FormulaList from './FormulaList.vue'
import FormulaToolbar from './FormulaToolbar.vue'
import FormulaMetadataPanel from './FormulaMetadataPanel.vue'
import FormulaEditor from './FormulaEditor.vue'
import FormulaTestDialog from './FormulaTestDialog.vue'

const formulaStore = useFormulaStore()
const { selectedFormula } = storeToRefs(formulaStore)

const showTestDialog = ref(false)

function handleTestRun() {
  showTestDialog.value = true
}

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

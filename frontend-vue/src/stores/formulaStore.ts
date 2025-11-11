import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { formulaService } from '@/services/formulaService'

export interface Formula {
  id: number
  name: string
  source_code: string
  language_id: number
  property?: string
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

    // Note: private_only filter is always applied on backend (private_only: 1)
    // No need to filter again on frontend

    return result
  })

  const hasUnsavedChanges = computed(() => isDirty.value)

  // Actions
  async function loadFormulas(filters?: FormulaFilters) {
    loading.value = true
    error.value = null

    try {
      // private_only is always forced to 1 in formulaService
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
        property: formulaData.property,
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

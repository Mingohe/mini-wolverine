<template>
  <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'

interface Props {
  value?: string
  language?: string
  theme?: string
  options?: monaco.editor.IStandaloneEditorConstructionOptions
}

interface Emits {
  (e: 'update:value', value: string): void
  (e: 'change', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  value: '',
  language: 'plaintext',
  theme: 'vs',
  options: () => ({})
})

const emit = defineEmits<Emits>()

const editorContainer = ref<HTMLDivElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

// Configure Monaco environment for workers
if (typeof window !== 'undefined') {
  (window as any).MonacoEnvironment = {
    getWorkerUrl: function (moduleId: string, label: string) {
      if (label === 'json') {
        return new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url).toString()
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url).toString()
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url).toString()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url).toString()
      }
      return new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url).toString()
    }
  }
}

onMounted(async () => {
  if (!editorContainer.value) return

  try {
    // Create Monaco editor
    editor = monaco.editor.create(editorContainer.value, {
      value: props.value,
      language: props.language,
      theme: props.theme,
      automaticLayout: true,
      ...props.options
    })

    // Listen for content changes
    editor.onDidChangeModelContent(() => {
      if (editor) {
        const value = editor.getValue()
        emit('update:value', value)
        emit('change', value)
      }
    })

    // Listen for language changes
    watch(() => props.language, (newLanguage) => {
      if (editor && monaco.languages.getLanguages().some(lang => lang.id === newLanguage)) {
        monaco.editor.setModelLanguage(editor.getModel()!, newLanguage)
      }
    })

    // Listen for theme changes
    watch(() => props.theme, (newTheme) => {
      if (editor) {
        monaco.editor.setTheme(newTheme)
      }
    })

    // Listen for value changes from parent
    watch(() => props.value, (newValue) => {
      if (editor && editor.getValue() !== newValue) {
        editor.setValue(newValue)
      }
    })

  } catch (error) {
    console.error('Failed to initialize Monaco editor:', error)
  }
})

onUnmounted(() => {
  if (editor) {
    editor.dispose()
    editor = null
  }
})

// Expose editor instance for parent components
defineExpose({
  editor: () => editor,
  focus: () => editor?.focus(),
  getValue: () => editor?.getValue() || '',
  setValue: (value: string) => editor?.setValue(value)
})
</script>

<style scoped>
.monaco-editor-container {
  width: 100%;
  height: 100%;
  min-height: 200px;
}
</style>

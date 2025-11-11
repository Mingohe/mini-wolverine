<template>
  <div class="dsl-query-tab">
    <div class="dsl-input-section">
      <div class="section-header">
        <h3 class="title">🔍 DSL Query Builder</h3>
        <div class="header-actions">
          <button class="btn btn-secondary" @click="showSyntaxHelp = !showSyntaxHelp">
            💡 Syntax Help
          </button>
          <button class="btn btn-secondary" @click="loadExample">
            📋 Examples
          </button>
        </div>
      </div>

      <div class="dsl-input-container" ref="inputContainerRef">
        <textarea
          ref="dslTextareaRef"
          v-model="dslInput"
          class="dsl-input"
          :class="{ 'error': parseError }"
          placeholder="Enter DSL query, e.g., fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-11-05..2025-11-06"
          rows="3"
          @input="onDSLInput"
          @keydown="handleKeydown"
          @keyup="handleKeyup"
          @click="handleTextareaClick"
          @focus="handleTextareaFocus"
        ></textarea>
        
        <!-- 自动补全下拉框 -->
        <div
          v-if="showAutocomplete"
          class="autocomplete-dropdown"
          :style="autocompleteStyle"
        >
          <div v-if="autocompleteLoading" class="autocomplete-loading">
            <span>🔍 Searching...</span>
          </div>
          <div
            v-else-if="autocompleteSuggestions.length > 0"
            v-for="(suggestion, index) in autocompleteSuggestions"
            :key="index"
            :class="['autocomplete-item', { selected: selectedSuggestionIndex === index }]"
            @click="selectSuggestion(suggestion)"
            @mouseenter="selectedSuggestionIndex = index"
          >
            <span class="suggestion-icon">{{ suggestion.icon || '📋' }}</span>
            <span class="suggestion-text">{{ suggestion.display }}</span>
            <span v-if="suggestion.description" class="suggestion-desc">{{ suggestion.description }}</span>
          </div>
          <div v-else class="autocomplete-empty">
            <span>No suggestions</span>
          </div>
        </div>
        
        <div v-if="parseError" class="error-message">
          ❌ {{ parseError.message }}
          <span v-if="parseError.suggestion" class="suggestion">
            Suggestion: {{ parseError.suggestion }}
          </span>
        </div>
        <div v-else-if="isValid" class="success-message">
          ✓ Valid DSL syntax
        </div>
      </div>

      <div class="quick-actions">
        <button class="btn btn-primary" @click="executeQuery" :disabled="!isValid || isExecuting">
          ▶ Execute
        </button>
        <button class="btn btn-secondary" @click="clearInput">
          🗑️ Clear
        </button>
        <button class="btn btn-secondary" @click="copyDSL">
          📋 Copy
        </button>
        <button class="btn btn-secondary" @click="validateDSL">
          ✓ Validate
        </button>
        <button class="btn btn-secondary" @click="showSaveDialog = true">
          💾 Save As
        </button>
      </div>

      <!-- Syntax Help Panel -->
      <div v-if="showSyntaxHelp" class="syntax-help-panel">
        <h4>DSL Syntax Quick Reference</h4>
        <div class="help-content">
          <div class="help-section">
            <strong>Query Types:</strong>
            <ul>
              <li><code>ft:</code> - Fetch by Time (single time point)</li>
              <li><code>fc:</code> - Fetch by Code (time range)</li>
              <li><code>fm:</code> - Formula Query</li>
            </ul>
          </div>
          <div class="help-section">
            <strong>Examples:</strong>
            <pre><code>fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-11-05..2025-11-06
ft:SampleQuote@0[CZCE:ap<00>] | 1h | now
fm:Ma[CZCE:ap<00>] | 5m | 2025-01-01..now | +subscribe</code></pre>
          </div>
          <div class="help-section">
            <strong>Quick Reference:</strong>
            <ul>
              <li>Namespace: <code>global::</code> or <code>private::</code></li>
              <li>Granularity: <code>1m</code>, <code>1h</code>, <code>1d</code>, or <code>3600</code></li>
              <li>Time: ISO date, timestamp, or <code>now</code></li>
            </ul>
          </div>
        </div>
        <button class="btn btn-secondary" @click="showSyntaxHelp = false">Close</button>
      </div>

      <!-- Saved Queries -->
      <div v-if="savedQueries.length > 0" class="saved-queries-section">
        <h4>📚 Saved Queries ({{ savedQueries.length }})</h4>
        <div class="saved-queries-list">
          <div
            v-for="query in savedQueries"
            :key="query.id"
            class="saved-query-item"
          >
            <span class="query-name" @click="loadQuery(query)">{{ query.name }}</span>
            <div class="query-actions">
              <button class="btn-small" @click="loadQuery(query)">Load</button>
              <button class="btn-small" @click="editQuery(query)">Edit</button>
              <button class="btn-small btn-danger" @click="deleteQuery(query.id)">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Query Results -->
    <div v-if="queryResult" class="query-results-section">
      <div class="section-header">
        <h3 class="title">📊 Query Results</h3>
        <div class="result-info">
          <span>Status: ✅ Success</span>
          <span>Records: {{ queryResult.records.length }}</span>
          <span v-if="resultFields.length > 0">Fields: {{ resultFields.length }}</span>
        </div>
      </div>
      
      <div v-if="queryResult && queryResult.records && queryResult.records.length > 0" class="results-container">
        <!-- Table View -->
        <div class="table-view">
          <div class="data-grid">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="data-header">Time</th>
                  <th v-for="field in resultFields" :key="field" class="data-header">
                    {{ field }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(record, index) in paginatedRecords" :key="index" class="data-row">
                  <td class="data-cell">{{ formatTime(record.time) }}</td>
                  <td v-for="field in resultFields" :key="field" class="data-cell">
                    {{ renderFieldValue(record[field]) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div v-if="totalPages > 1" class="pagination">
            <button 
              @click="goToPreviousPage" 
              :disabled="currentPage === 1"
              class="pagination-button"
            >
              Previous
            </button>
            <span class="pagination-info">
              Page {{ currentPage }} of {{ totalPages }} ({{ queryResult.records.length }} total records)
            </span>
            <button 
              @click="goToNextPage"
              :disabled="currentPage === totalPages" 
              class="pagination-button"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-results">
        <p>No records found</p>
      </div>
    </div>

    <!-- Save Dialog -->
    <div v-if="showSaveDialog" class="modal-overlay" @click.self="showSaveDialog = false">
      <div class="modal-content">
        <h3>💾 Save Query</h3>
        <div class="form-group">
          <label>Query Name:</label>
          <input
            v-model="saveQueryName"
            type="text"
            placeholder="ap_main_1h"
            class="form-input"
            @input="validateSaveName"
          />
          <small>Only letters, numbers, underscore, hyphen</small>
        </div>
        <div class="form-group">
          <label>Preview DSL:</label>
          <pre class="dsl-preview">{{ dslInput }}</pre>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showSaveDialog = false">Cancel</button>
          <button
            class="btn btn-primary"
            @click="saveQuery"
            :disabled="!canSave"
          >
            💾 Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { DSLParser } from '../utils/dslParser'
import { dslExecutor } from '../utils/dslExecutor'
import { useWebSocketStore } from '../stores/websocketStore'
import { useDataStore } from '../stores/dataStore'
import { formulaService } from '../services/formulaService'
import { dslAutocomplete, type AutocompleteSuggestion } from '../utils/dslAutocomplete'
import type { ParseError, SavedQuery, QueryResult } from '../types/dsl'

const dslInput = ref<string>('')
const parseError = ref<ParseError | null>(null)
const isValid = ref<boolean>(false)
const isExecuting = ref<boolean>(false)
const showSyntaxHelp = ref<boolean>(false)
const showSaveDialog = ref<boolean>(false)
const saveQueryName = ref<string>('')
const queryResult = ref<QueryResult | null>(null)
const savedQueries = ref<SavedQuery[]>([])
const wsStore = useWebSocketStore()
const dataStore = useDataStore()
const currentPage = ref<number>(1)
const pageSize = ref<number>(25) // 固定每页25条

// 自动补全相关状态
const dslTextareaRef = ref<HTMLTextAreaElement | null>(null)
const inputContainerRef = ref<HTMLElement | null>(null)
const showAutocomplete = ref<boolean>(false)
const autocompleteSuggestions = ref<AutocompleteSuggestion[]>([])
const selectedSuggestionIndex = ref<number>(0)
const autocompleteStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })
const autocompleteLoading = ref<boolean>(false)
let autocompleteDebounceTimer: number | null = null

// 验证保存名称格式
const canSave = computed(() => {
  if (!saveQueryName.value.trim()) return false
  return /^[a-zA-Z0-9_-]+$/.test(saveQueryName.value)
})

// 计算属性：提取所有字段名
const resultFields = computed(() => {
  if (!queryResult.value || queryResult.value.records.length === 0) {
    return []
  }
  
  const fields = new Set<string>()
  queryResult.value.records.forEach(record => {
    Object.keys(record).forEach(key => {
      // 排除系统字段
      if (key !== 'timestamp' && key !== 'time') {
        fields.add(key)
      }
    })
  })
  
  return Array.from(fields).sort()
})

// 计算属性：分页数据（按时间倒序排序）
const paginatedRecords = computed(() => {
  if (!queryResult.value || !queryResult.value.records.length) return []
  
  // 按时间倒序排序（最新的在前）
  const sortedRecords = [...queryResult.value.records].sort((a, b) => {
    // 优先使用 timestamp（秒级），如果没有则使用 time 字符串
    const timeA = a.timestamp || (a.time ? new Date(a.time).getTime() / 1000 : 0)
    const timeB = b.timestamp || (b.time ? new Date(b.time).getTime() / 1000 : 0)
    return timeB - timeA // 倒序：大的在前
  })
  
  // 分页
  const page = currentPage.value
  const size = pageSize.value
  const start = (page - 1) * size
  const end = start + size
  const paginated = sortedRecords.slice(start, end)
  
  console.log(`📊 Pagination: page ${page}/${totalPages.value}, showing ${paginated.length} of ${sortedRecords.length} records`)
  
  return paginated
})

// 计算属性：总页数
const totalPages = computed(() => {
  if (!queryResult.value) return 0
  return Math.ceil(queryResult.value.records.length / pageSize.value)
})

// 格式化时间
const formatTime = (timeStr: string): string => {
  if (!timeStr) return ''
  try {
    const date = new Date(timeStr)
    return date.toLocaleString()
  } catch {
    return timeStr
  }
}

// 渲染字段值
const renderFieldValue = (value: any): string => {
  if (value === null || value === undefined) {
    return 'null'
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]'
    }
    const preview = value.slice(0, 3).map(item => 
      typeof item === 'number' ? item.toFixed(3) : String(item)
    ).join(', ')
    const suffix = value.length > 3 ? `, ...${value.length - 3} more` : ''
    return `[${preview}${suffix}]`
  }
  
  if (typeof value === 'object') {
    return '{...}'
  }
  
  if (typeof value === 'number') {
    return value.toFixed(4)
  }
  
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...'
  }
  
  return String(value)
}

// DSL 输入处理
const onDSLInput = () => {
  parseError.value = null
  isValid.value = false

  if (!dslInput.value.trim()) {
    hideAutocomplete()
    return
  }

  const result = DSLParser.parse(dslInput.value)
  if ('error' in result) {
    parseError.value = result
  } else {
    isValid.value = true
  }

  // 触发自动补全检查
  checkAutocomplete()
}

// 检查是否需要显示自动补全
const checkAutocomplete = async () => {
  if (!dslTextareaRef.value) return

  const textarea = dslTextareaRef.value
  const cursorPosition = textarea.selectionStart

  // 防抖处理
  if (autocompleteDebounceTimer) {
    clearTimeout(autocompleteDebounceTimer)
  }

  autocompleteDebounceTimer = setTimeout(async () => {
    const context = dslAutocomplete.analyzeContext(dslInput.value, cursorPosition)
    
    if (context.currentSegment) {
      // 如果是票子补全（异步），显示加载状态
      if (context.currentSegment === 'code') {
        autocompleteLoading.value = true
        showAutocomplete.value = true
        autocompleteSuggestions.value = []
        updateAutocompletePosition()
      }
      
      const suggestions = await dslAutocomplete.getSuggestions(context)
      autocompleteLoading.value = false
      
      if (suggestions.length > 0) {
        autocompleteSuggestions.value = suggestions
        selectedSuggestionIndex.value = 0
        showAutocomplete.value = true
        updateAutocompletePosition()
      } else {
        hideAutocomplete()
      }
    } else {
      hideAutocomplete()
    }
  }, 200) // 200ms 防抖
}

// 更新自动补全下拉框位置
const updateAutocompletePosition = async () => {
  await nextTick()
  
  if (!dslTextareaRef.value || !inputContainerRef.value) return

  const textarea = dslTextareaRef.value
  
  // 计算光标位置的像素坐标
  const textBeforeCursor = dslInput.value.substring(0, textarea.selectionStart)
  const lines = textBeforeCursor.split('\n')

  // 创建临时元素测量文本宽度
  const measureDiv = document.createElement('div')
  measureDiv.style.position = 'absolute'
  measureDiv.style.visibility = 'hidden'
  measureDiv.style.whiteSpace = 'pre-wrap'
  measureDiv.style.font = window.getComputedStyle(textarea).font
  measureDiv.style.padding = window.getComputedStyle(textarea).padding
  measureDiv.style.width = textarea.offsetWidth + 'px'
  measureDiv.textContent = textBeforeCursor
  document.body.appendChild(measureDiv)

  const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 20
  
  // 计算光标所在行的位置
  const lineIndex = lines.length - 1
  const topOffset = lineIndex * lineHeight + lineHeight + 2
  
  autocompleteStyle.value = {
    top: `${topOffset}px`,
    left: '0px'
  }

  document.body.removeChild(measureDiv)
}

// 隐藏自动补全
const hideAutocomplete = () => {
  showAutocomplete.value = false
  autocompleteSuggestions.value = []
  selectedSuggestionIndex.value = 0
}

// 选择补全建议
const selectSuggestion = (suggestion: AutocompleteSuggestion) => {
  if (!dslTextareaRef.value) return

  const textarea = dslTextareaRef.value
  const context = dslAutocomplete.analyzeContext(dslInput.value, textarea.selectionStart)
  
  // 计算需要替换的文本范围
  let replaceStart = textarea.selectionStart
  let replaceEnd = textarea.selectionStart
  
  // 根据当前段类型确定替换范围
  if (context.currentSegment === 'command') {
    replaceStart = 0
    replaceEnd = 0
  } else if (context.currentSegment === 'namespace') {
    const match = dslInput.value.substring(0, textarea.selectionStart).match(/(fc|ft|fm):$/)
    if (match) {
      replaceStart = match.index! + match[0].length
      replaceEnd = textarea.selectionStart
    }
  } else if (context.currentSegment === 'indicator' || context.currentSegment === 'formula') {
    // 对于指标，匹配从 namespace 之后到 [、| 或光标位置之间的所有内容（包括可能已输入的 @ 和版本号）
    const beforeCursor = dslInput.value.substring(0, textarea.selectionStart)
    // 找到 namespace 结束位置（:: 或 : 之后）
    const namespaceEndMatch = beforeCursor.match(/(?:fc|ft|fm):(?:global|private)?::?/)
    if (namespaceEndMatch) {
      replaceStart = namespaceEndMatch.index! + namespaceEndMatch[0].length
      // 找到下一个分隔符（[ 或 |）的位置，如果没有则使用光标位置
      const nextSeparator = beforeCursor.indexOf('[', replaceStart)
      const nextPipe = beforeCursor.indexOf('|', replaceStart)
      let nextBoundary = beforeCursor.length
      if (nextSeparator >= 0 && nextSeparator < nextBoundary) nextBoundary = nextSeparator
      if (nextPipe >= 0 && nextPipe < nextBoundary) nextBoundary = nextPipe
      replaceEnd = nextBoundary
    }
  } else if (context.currentSegment === 'market') {
    const match = dslInput.value.substring(0, textarea.selectionStart).match(/\[([^:]*)$/)
    if (match) {
      replaceStart = match.index! + 1
      replaceEnd = textarea.selectionStart
    }
  } else if (context.currentSegment === 'code') {
    const match = dslInput.value.substring(0, textarea.selectionStart).match(/\[([^:]+):([^\]]*)$/)
    if (match) {
      replaceStart = match.index! + match[1].length + 2 // +2 for '['
      replaceEnd = textarea.selectionStart
    }
  } else if (context.currentSegment === 'granularity') {
    const match = dslInput.value.substring(0, textarea.selectionStart).match(/\|\s*([^\|]*)$/)
    if (match) {
      replaceStart = match.index! + match[0].length - (match[1]?.length || 0)
      replaceEnd = textarea.selectionStart
    }
  } else if (context.currentSegment === 'time') {
    const match = dslInput.value.substring(0, textarea.selectionStart).match(/\|\s*[^\|]+\s*\|\s*([^\|]*)$/)
    if (match) {
      replaceStart = match.index! + match[0].length - (match[1]?.length || 0)
      replaceEnd = textarea.selectionStart
    }
  }

  // 插入补全文本
  const beforeText = dslInput.value.substring(0, replaceStart)
  const afterText = dslInput.value.substring(replaceEnd)
  const insertText = suggestion.text

  // 根据段类型添加必要的分隔符
  let finalText = insertText
  if (context.currentSegment === 'market') {
    finalText = insertText + ':'
  } else if (context.currentSegment === 'code') {
    finalText = insertText + ']'
  } else if (context.currentSegment === 'granularity') {
    finalText = insertText + ' | '
  } else if (context.currentSegment === 'time') {
    // 时间格式不需要额外分隔符
  }

  dslInput.value = beforeText + finalText + afterText
  
  // 设置光标位置
  nextTick(() => {
    if (dslTextareaRef.value) {
      const newPosition = replaceStart + finalText.length
      dslTextareaRef.value.setSelectionRange(newPosition, newPosition)
      dslTextareaRef.value.focus()
    }
    onDSLInput()
    hideAutocomplete()
  })
}

// 键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  if (!showAutocomplete.value || autocompleteSuggestions.value.length === 0) {
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedSuggestionIndex.value = Math.min(
        selectedSuggestionIndex.value + 1,
        autocompleteSuggestions.value.length - 1
      )
      break
    case 'ArrowUp':
      event.preventDefault()
      selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, 0)
      break
    case 'Enter':
    case 'Tab':
      event.preventDefault()
      if (autocompleteSuggestions.value[selectedSuggestionIndex.value]) {
        selectSuggestion(autocompleteSuggestions.value[selectedSuggestionIndex.value])
      }
      break
    case 'Escape':
      event.preventDefault()
      hideAutocomplete()
      break
  }
}

// 键盘释放事件（用于触发补全检查）
const handleKeyup = (event: KeyboardEvent) => {
  // 忽略导航键
  if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
    return
  }
  
  // 延迟检查，等待输入完成
  setTimeout(() => {
    checkAutocomplete()
  }, 50)
}

// Textarea 点击事件
const handleTextareaClick = () => {
  setTimeout(() => {
    checkAutocomplete()
  }, 50)
}

// Textarea 获得焦点事件
const handleTextareaFocus = () => {
  setTimeout(() => {
    checkAutocomplete()
  }, 50)
}

// 验证 DSL
const validateDSL = () => {
  onDSLInput()
  if (isValid.value) {
    alert('✓ DSL syntax is valid!')
  }
}

// 执行查询
const executeQuery = async () => {
  if (!isValid.value) {
    alert('Please fix DSL syntax errors first')
    return
  }

  if (!wsStore.isConnected) {
    alert('WebSocket not connected. Please connect to backend first.')
    return
  }

  isExecuting.value = true
  queryResult.value = null

  try {
    // 解析 DSL
    const parseResult = DSLParser.parse(dslInput.value)
    if ('error' in parseResult) {
      alert(`Parse error: ${parseResult.message}`)
      return
    }

    console.log('📋 Query AST:', parseResult)

    // 执行查询
    const result = await dslExecutor.execute(parseResult, {
      onSuccess: (result) => {
        console.log('✅ Query executed successfully:', result)
        queryResult.value = result
      },
      onError: (error) => {
        console.error('❌ Query execution failed:', error)
        alert(`Query failed: ${error}`)
      },
      timeout: 30000 // 30 秒超时
    })

    queryResult.value = result
  } catch (error: any) {
    console.error('❌ Query execution error:', error)
    alert(`Error: ${error.message}`)
  } finally {
    isExecuting.value = false
  }
}

// 清除输入
const clearInput = () => {
  dslInput.value = ''
  parseError.value = null
  isValid.value = false
  queryResult.value = null
}

// 复制 DSL
const copyDSL = () => {
  navigator.clipboard.writeText(dslInput.value)
  alert('DSL copied to clipboard!')
}

// 加载示例
const loadExample = () => {
  dslInput.value = 'fc:global::SampleQuote@0[CZCE:ap<00>] | 1h | 2025-11-05..2025-11-06'
  onDSLInput()
}

// 保存查询
const saveQuery = () => {
  if (!canSave.value) {
    alert('Invalid query name format')
    return
  }

  const query: SavedQuery = {
    id: Date.now().toString(),
    name: saveQueryName.value.trim(),
    dsl: dslInput.value,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastUsedAt: Date.now(),
    usageCount: 0
  }

  savedQueries.value.push(query)
  saveToStorage()
  showSaveDialog.value = false
  saveQueryName.value = ''
  alert('Query saved!')
}

// 加载查询
const loadQuery = (query: SavedQuery) => {
  dslInput.value = query.dsl
  query.lastUsedAt = Date.now()
  query.usageCount = (query.usageCount || 0) + 1
  saveToStorage()
  onDSLInput()
}

// 编辑查询
const editQuery = (query: SavedQuery) => {
  dslInput.value = query.dsl
  saveQueryName.value = query.name
  onDSLInput()
  showSaveDialog.value = true
}

// 删除查询
const deleteQuery = (id: string) => {
  if (confirm('Are you sure you want to delete this query?')) {
    savedQueries.value = savedQueries.value.filter(q => q.id !== id)
    saveToStorage()
  }
}

// 验证保存名称
const validateSaveName = () => {
  // 实时验证已在 computed 中处理
}

// 保存到 localStorage
const saveToStorage = () => {
  localStorage.setItem('dsl_saved_queries', JSON.stringify(savedQueries.value))
}

// 从 localStorage 加载
const loadFromStorage = () => {
  const stored = localStorage.getItem('dsl_saved_queries')
  if (stored) {
    try {
      savedQueries.value = JSON.parse(stored)
    } catch (e) {
      console.error('Failed to load saved queries:', e)
    }
  }
}

// 监听 WebSocket 消息（用于处理响应）
watch(() => wsStore.lastMessage, (newMessage) => {
  if (!newMessage) return

  // 尝试让 dslExecutor 处理响应
  const handled = dslExecutor.handleResponse(newMessage)
  
  if (handled) {
    console.log('✅ DSL Executor handled response:', newMessage.type)
  }
})

// 分页控制函数
const goToPreviousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    console.log('📄 Go to previous page:', currentPage.value)
  }
}

const goToNextPage = () => {
  const maxPage = totalPages.value
  if (currentPage.value < maxPage) {
    currentPage.value++
    console.log('📄 Go to next page:', currentPage.value, '/', maxPage)
  }
}

// 监听查询结果变化，重置分页
watch(() => queryResult.value, () => {
  currentPage.value = 1
})

// 加载公式列表
const loadFormulaList = async () => {
  if (dataStore.formulaListLoading || dataStore.isFormulaListLoaded) {
    return // 正在加载或已加载，跳过
  }

  try {
    dataStore.formulaListLoading = true
    console.log('📋 Loading formula list...')
    
    const response = await formulaService.queryFormulas({
      privateOnly: true
    })

    if (response.success && response.formulas) {
      dataStore.setFormulaList(response.formulas)
      console.log(`✅ Formula list loaded: ${response.formulas.length} formulas`)
    } else {
      console.warn('⚠️ Failed to load formula list:', response.error)
    }
  } catch (error) {
    console.error('❌ Error loading formula list:', error)
  } finally {
    dataStore.formulaListLoading = false
  }
}

onMounted(() => {
  loadFromStorage()
  // 自动加载公式列表
  loadFormulaList()
})

onUnmounted(() => {
  // 清理执行器
  dslExecutor.cleanup()
})
</script>

<style scoped>
.dsl-query-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #212529;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.dsl-input-container {
  position: relative;
  margin-bottom: 8px;
}

.dsl-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 12px;
  resize: vertical;
  transition: border-color 0.2s;
}

.dsl-input:focus {
  outline: none;
  border-color: #0066cc;
}

.dsl-input.error {
  border-color: #dc3545;
}

.error-message {
  margin-top: 4px;
  padding: 4px 8px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 3px;
  font-size: 11px;
}

.error-message .suggestion {
  display: block;
  margin-top: 2px;
  font-style: italic;
  font-size: 10px;
}

.success-message {
  margin-top: 4px;
  padding: 4px 8px;
  background: #d4edda;
  color: #155724;
  border-radius: 3px;
  font-size: 11px;
}

.quick-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.btn {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  color: #6b7280;
  font-weight: 400;
}

.btn-primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
  font-weight: 500;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

.btn-secondary {
  background: white;
  color: #6b7280;
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
  color: #374151;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.syntax-help-panel {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}

.syntax-help-panel h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 500;
}

.help-content {
  margin-bottom: 8px;
}

.help-section {
  margin-bottom: 8px;
}

.help-section ul {
  margin: 4px 0;
  padding-left: 18px;
}

.help-section code {
  background: #e9ecef;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 11px;
}

.help-section pre {
  background: #e9ecef;
  padding: 6px 8px;
  border-radius: 3px;
  overflow-x: auto;
  font-size: 11px;
}

.saved-queries-section {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}

.saved-queries-section h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 500;
}

.saved-queries-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.saved-query-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 3px;
}

.query-name {
  cursor: pointer;
  font-weight: 500;
  color: #3b82f6;
  font-size: 12px;
}

.query-name:hover {
  text-decoration: underline;
}

.query-actions {
  display: flex;
  gap: 2px;
}

.btn-small {
  padding: 2px 6px;
  font-size: 10px;
  border: 1px solid #d1d5db;
  border-radius: 2px;
  cursor: pointer;
  background: white;
  color: #6b7280;
  transition: all 0.2s;
}

.btn-small:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.btn-danger {
  background: white;
  color: #dc2626;
  border-color: #fca5a5;
}

.btn-danger:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}

.query-results-section {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}

.result-info {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 6px;
}

.results-container {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 200px;
}

.data-grid {
  flex: 1;
  overflow: auto;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.data-header {
  background: #f9fafb;
  padding: 6px 4px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 500;
  color: #6b7280;
  position: sticky;
  top: 0;
  white-space: nowrap;
  font-size: 13px;
  z-index: 1;
}

.data-row:nth-child(even) {
  background: #f9fafb;
}

.data-row:hover {
  background: #f3f4f6;
}

.data-cell {
  padding: 4px 4px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  white-space: nowrap;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.pagination-button {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  background: white;
  color: #6b7280;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.pagination-button:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
  color: #374151;
}

.pagination-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 11px;
  color: #6b7280;
}

.empty-results {
  margin-top: 6px;
  padding: 16px;
  text-align: center;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  color: #6b7280;
  font-size: 12px;
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
  padding: 12px 16px;
  border-radius: 6px;
  min-width: 400px;
  max-width: 600px;
}

.modal-content h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
}

.form-group {
  margin-bottom: 8px;
}

.form-group label {
  display: block;
  margin-bottom: 2px;
  font-weight: 500;
  font-size: 12px;
}

.form-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 12px;
}

.form-group small {
  display: block;
  margin-top: 2px;
  color: #6b7280;
  font-size: 10px;
}

.dsl-preview {
  padding: 6px 8px;
  background: #f8f9fa;
  border: 1px solid #e5e7eb;
  border-radius: 3px;
  font-size: 11px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  overflow-x: auto;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 8px;
}

/* 自动补全下拉框 */
.autocomplete-dropdown {
  position: absolute;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  min-width: 300px;
  margin-top: 2px;
}

.autocomplete-item {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.15s;
  gap: 8px;
}

.autocomplete-item:hover,
.autocomplete-item.selected {
  background: #f3f4f6;
}

.autocomplete-item:last-child {
  border-bottom: none;
}

.suggestion-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.suggestion-text {
  flex: 1;
  font-size: 12px;
  color: #374151;
  font-weight: 500;
}

.suggestion-desc {
  font-size: 10px;
  color: #6b7280;
  font-style: italic;
}

.autocomplete-loading,
.autocomplete-empty {
  padding: 8px 12px;
  text-align: center;
  color: #6b7280;
  font-size: 11px;
}
</style>


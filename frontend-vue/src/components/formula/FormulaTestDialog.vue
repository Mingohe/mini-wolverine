<template>
  <div v-if="visible" class="dialog-overlay">
    <div class="dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <h3 class="dialog-title">Test Formula: {{ formulaName }}</h3>
        <button class="close-button" @click="handleClose">×</button>
      </div>

      <!-- Content -->
      <div class="dialog-content">
        <!-- Configuration Section -->
        <div class="config-section">
          <!-- Compact Configuration Row -->
          <div class="compact-config-row">
            <!-- Market/Code Input -->
            <div class="config-group market-code-group">
              <!-- Market Selection -->
              <div class="select-wrapper">
                <input
                  v-model="testConfig.market"
                  type="text"
                  class="form-input compact"
                  placeholder="Market (e.g., NYMEX)"
                  @focus="showMarketDropdown = true"
                  @blur="hideMarketDropdown"
                  @input="searchMarkets"
                />
                <div v-if="showMarketDropdown" class="dropdown-menu">
                  <div
                    v-for="market in filteredMarkets"
                    :key="market"
                    class="dropdown-item"
                    @click="selectMarket(market)"
                  >
                    {{ market }}
                  </div>
                </div>
              </div>
              
              <!-- Code Selection -->
              <div class="select-wrapper">
                <input
                  v-model="testConfig.code"
                  type="text"
                  class="form-input compact"
                  placeholder="Code (e.g., CL2501)"
                  @focus="showCodeDropdown = true"
                  @blur="hideCodeDropdown"
                  @input="searchCodes"
                />
                <div v-if="showCodeDropdown" class="dropdown-menu">
                  <div
                    v-for="future in filteredFutures"
                    :key="`${future.market}-${future.code}`"
                    class="dropdown-item"
                    @click="selectCode(future)"
                  >
                    <div class="future-item">
                      <div class="future-code">{{ future.code }}</div>
                      <div class="future-market">{{ future.market }}</div>
                    </div>
                    <div class="future-name">{{ future.name }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Time Range -->
            <div class="config-group time-group">
              <input
                v-model="testConfig.fromTime"
                type="datetime-local"
                class="form-input compact datetime-input"
                title="From Time"
              />
              <span class="time-separator">→</span>
              <input
                v-model="testConfig.toTime"
                type="datetime-local"
                class="form-input compact datetime-input"
                title="To Time"
              />
            </div>

            <!-- Granularity -->
            <div class="config-group granularity-group">
              <select v-model="testConfig.granularity" class="form-select compact">
                <option value="60">1min</option>
                <option value="300">5min</option>
                <option value="900">15min</option>
                <option value="1800">30min</option>
                <option value="3600">1h</option>
                <option value="86400">1day</option>
              </select>
            </div>

            <!-- Execute Button -->
            <button class="execute-button compact" @click="handleExecute" :disabled="!canExecute || isExecuting">
              {{ isExecuting ? '⏳' : '▶️' }} {{ isExecuting ? 'Running...' : 'Run' }}
            </button>
          </div>
        </div>

        <!-- Results Section -->
        <div v-if="hasResults" class="results-section">
          <div class="results-header">
            <h4 class="results-title">Results ({{ formulaData.length }})</h4>
            <div class="view-toggle">
              <button :class="['toggle-button', { active: viewMode === 'table' }]" @click="viewMode = 'table'">
                📊 Table
              </button>
              <button :class="['toggle-button', { active: viewMode === 'chart' }]" @click="viewMode = 'chart'">
                �� Chart
              </button>
            </div>
          </div>

          <!-- Table View -->
          <div v-if="viewMode === 'table'" class="table-view">
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="data-header">Timestamp</th>
                    <th v-for="field in resultFields" :key="field" class="data-header">
                      {{ field }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(record, index) in paginatedData" :key="index" class="data-row">
                    <td class="data-cell">{{ formatTimestamp(record.time_tag) }}</td>
                    <td v-for="field in resultFields" :key="field" class="data-cell">
                      {{ formatValue(record[field]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="totalPages > 1" class="pagination">
              <button @click="currentPage--" :disabled="currentPage === 1" class="pagination-button">
                Previous
              </button>
              <span class="pagination-info">Page {{ currentPage }} of {{ totalPages }}</span>
              <button @click="currentPage++" :disabled="currentPage === totalPages" class="pagination-button">
                Next
              </button>
            </div>
          </div>

          <!-- Chart View -->
          <div v-else-if="viewMode === 'chart'" class="chart-view">
            <!-- Chart Controls -->
            <div class="chart-controls">
              <div class="label-controls">
                <div
                  v-for="field in displayFields"
                  :key="field"
                  class="label-control-item"
                >
                  <label class="label-checkbox">
                    <input
                      type="checkbox"
                      v-model="labelVisibility[field]"
                      @change="updateChartLabels"
                    />
                    <span class="label-color-indicator" :style="{ backgroundColor: getFieldColor(field) }"></span>
                    <span class="label-text">{{ field }}</span>
                  </label>
                </div>
              </div>
            </div>
            
            <!-- Chart Container -->
            <div class="chart-container">
              <canvas
                ref="chartCanvas"
                class="formula-chart"
                @mousemove="handleChartMouseMove"
                @mouseleave="handleChartMouseLeave"
              ></canvas>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="executionError" class="error-state">
          <div class="error-icon">❌</div>
          <div class="error-text">{{ executionError }}</div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <div class="empty-icon">🧮</div>
          <div class="empty-text">Configure parameters and execute formula to see results</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { websocketTaskService } from '@/services/websocketTaskService'
import { ChartRenderer, type ChartConfig } from '@/utils/ChartRenderer'
import { seedService } from '@/services/seedService'

const props = defineProps<{
  visible: boolean
  formulaId?: number
  formulaName: string
  sourceCode: string
  languageId: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Test configuration
const testConfig = ref({
  market: '',
  code: '',
  fromTime: '',
  toTime: '',
  granularity: '60' // Default to 1 minute
})

// Execution state
const isExecuting = ref(false)
const hasResults = ref(false)
const executionError = ref<string | null>(null)
const formulaData = ref<any[]>([])
const resultFields = ref<string[]>([])
const displayConfiguration = ref<any>({})

// View state
const viewMode = ref<'table' | 'chart'>('table')
const currentPage = ref(1)
const pageSize = 50
const chartCanvas = ref<HTMLCanvasElement | null>(null)

// Chart type selection
const selectedChartType = ref<'line' | 'bar' | 'area' | 'scatter' | 'candlestick'>('line')

// Tooltip state
const showTooltip = ref(false)
const hoveredPoint = ref<{ x: number; y: number; data: any } | null>(null)

// Market and Code selection state
const showMarketDropdown = ref(false)
const showCodeDropdown = ref(false)
const allMarkets = ref<string[]>([])
const allFutures = ref<any[]>([])
const filteredMarkets = ref<string[]>([])
const filteredFutures = ref<any[]>([])
const loadingMarkets = ref(false)
const loadingFutures = ref(false)

// Search timeouts
let marketSearchTimeout: number | null = null
let codeSearchTimeout: number | null = null

// Label control state
const labelVisibility = ref<Record<string, boolean>>({})

const canExecute = computed(() => {
  return testConfig.value.market &&
         testConfig.value.code &&
         testConfig.value.fromTime &&
         testConfig.value.toTime &&
         props.sourceCode
})

// Get fields that should be displayed in the control panel (only those in displayConfiguration)
const displayFields = computed(() => {
  return Object.keys(displayConfiguration.value).filter(key => {
    const config = displayConfiguration.value[key]
    // Only include fields that have display configuration and are meant for charting
    return config && config.display && config.src
  })
})

const paginatedData = computed(() => {
  const sorted = [...formulaData.value].sort((a, b) => {
    const timeA = a.time_tag || a.timestamp
    const timeB = b.time_tag || b.timestamp
    return (typeof timeB === 'string' ? parseInt(timeB) : timeB) -
           (typeof timeA === 'string' ? parseInt(timeA) : timeA)
  })
  const start = (currentPage.value - 1) * pageSize
  return sorted.slice(start, start + pageSize)
})

const totalPages = computed(() => Math.ceil(formulaData.value.length / pageSize))

// Function to set default time range
function setDefaultTimeRange() {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
  
  // Format for datetime-local input (YYYY-MM-DDTHH:MM)
  testConfig.value.toTime = now.toISOString().slice(0, 16)
  testConfig.value.fromTime = oneDayAgo.toISOString().slice(0, 16)
}

// Market selection functions
async function loadMarkets() {
  loadingMarkets.value = true
  try {
    const result = await seedService.getAvailableMarkets()
    allMarkets.value = result
    filteredMarkets.value = result
  } catch (error) {
    console.error('Failed to load markets:', error)
    allMarkets.value = []
    filteredMarkets.value = []
  } finally {
    loadingMarkets.value = false
  }
}

function searchMarkets() {
  const query = testConfig.value.market.toLowerCase()
  if (query) {
    filteredMarkets.value = allMarkets.value.filter(market => 
      market.toLowerCase().includes(query)
    )
  } else {
    filteredMarkets.value = allMarkets.value
  }
  showMarketDropdown.value = true
}

function selectMarket(market: string) {
  testConfig.value.market = market
  showMarketDropdown.value = false
  // Auto-search codes for selected market
  searchCodes()
}

function hideMarketDropdown() {
  setTimeout(() => {
    showMarketDropdown.value = false
  }, 200)
}

// Code selection functions
async function loadFutures(searchPattern?: string) {
  loadingFutures.value = true
  try {
    const params: any = {}
    if (searchPattern) {
      params.pattern = searchPattern
    }
    if (testConfig.value.market) {
      params.market = testConfig.value.market
    }
    
    const result = await seedService.searchFutures(params)
    if (result.success) {
      allFutures.value = result.data
      filteredFutures.value = result.data
    } else {
      console.error('Failed to load futures:', result.message)
      allFutures.value = []
      filteredFutures.value = []
    }
  } catch (error) {
    console.error('Error loading futures:', error)
    allFutures.value = []
    filteredFutures.value = []
  } finally {
    loadingFutures.value = false
  }
}

function searchCodes() {
  if (codeSearchTimeout) {
    clearTimeout(codeSearchTimeout)
  }
  
  codeSearchTimeout = setTimeout(() => {
    const query = testConfig.value.code.toLowerCase()
    if (query) {
      filteredFutures.value = allFutures.value.filter(future => 
        future.code?.toLowerCase().includes(query) ||
        future.name?.toLowerCase().includes(query)
      )
    } else {
      filteredFutures.value = allFutures.value
    }
    showCodeDropdown.value = true
  }, 300)
}

function selectCode(future: any) {
  testConfig.value.code = future.code
  testConfig.value.market = future.market
  showCodeDropdown.value = false
}

function hideCodeDropdown() {
  setTimeout(() => {
    showCodeDropdown.value = false
  }, 200)
}

// Label control functions
function getFieldColor(field: string): string {
  // First try to get color from displayConfiguration
  if (displayConfiguration.value[field]?.display?.color) {
    return displayConfiguration.value[field].display.color
  }
  
  // Fallback to default color scheme based on field index
  const colors = ['#0066cc', '#28a745', '#dc3545', '#ffc107', '#6f42c1', '#17a2b8']
  const index = resultFields.value.indexOf(field)
  return colors[index % colors.length]
}

function updateChartLabels() {
  // Update displayConfiguration with pen visibility (showLabel controls entire pen)
  Object.keys(displayConfiguration.value).forEach(key => {
    if (displayConfiguration.value[key].display) {
      displayConfiguration.value[key].display.showLabel = labelVisibility.value[key] || false
    } else {
      displayConfiguration.value[key].display = {
        showLabel: labelVisibility.value[key] || false
      }
    }
  })
  
  // Re-render chart
  if (viewMode.value === 'chart') {
    nextTick(() => {
      renderChart()
    })
  }
}

function initializeLabelVisibility() {
  // Initialize label visibility only for display fields
  displayFields.value.forEach(field => {
    if (!(field in labelVisibility.value)) {
      labelVisibility.value[field] = true // Default to visible
    }
  })
}

function handleClose() {
  emit('close')
}

async function handleExecute() {
  if (!canExecute.value || isExecuting.value) return

  isExecuting.value = true
  hasResults.value = false
  executionError.value = null
  formulaData.value = []

  try {
    // Step 1: Register formula
    console.log('📝 Registering formula...')
    const registerResponse = await websocketTaskService.sendTask({
      type: 'register_formula',
      formulaId: props.formulaId || -999,
      sourceCode: props.sourceCode,
      languageId: props.languageId
    }, {
      timeout: 15000,
      retries: 1,
      retryDelay: 2000
    })

    if (!registerResponse.success || !registerResponse.data) {
      throw new Error(`Registration failed: ${registerResponse.error || 'Unknown error'}`)
    }

    const uuid = registerResponse.data.uuid
    console.log('✅ Registration successful:', uuid)

    // Step 2: Calculate formula
    console.log('🧮 Calculating formula...')
    const fromTimestamp = new Date(testConfig.value.fromTime).getTime()
    const toTimestamp = new Date(testConfig.value.toTime).getTime()

    const calculateResponse = await websocketTaskService.sendTask({
      type: 'calculate_formula',
      uuid,
      market: testConfig.value.market,
      code: testConfig.value.code,
      fromTime: fromTimestamp,
      toTime: toTimestamp,
      granularity: parseInt(testConfig.value.granularity),
      isRealTime: false
    }, {
      timeout: 30000,
      retries: 1,
      retryDelay: 3000
    })

    if (!calculateResponse.success || !calculateResponse.data) {
      throw new Error(`Calculation failed: ${calculateResponse.error || 'Unknown error'}`)
    }

    const responseData = calculateResponse.data
    const actualData = responseData.data?.data

    if (!actualData || !Array.isArray(actualData)) {
      throw new Error('Invalid response data structure')
    }

    // Process data
    const processedData = actualData.map((record: any, index: number) => {
      const flatRecord = {
        ...record,
        row_id: index + 1,
        timestamp: record.time_tag ? new Date(parseInt(record.time_tag)).toISOString() : new Date().toISOString(),
        time_tag: record.time_tag || record.timestamp
      }

      // Clean field names
      Object.keys(flatRecord).forEach(key => {
        if (key.startsWith('__wolverine_header_')) {
          const cleanKey = key.replace('__wolverine_header_', '')
          if (cleanKey !== 'time_tag') {
            flatRecord[cleanKey] = flatRecord[key]
          }
          delete flatRecord[key]
        }
      })

      return flatRecord
    })

    // Store display configuration
    if (responseData.data?.displayConfiguration) {
      displayConfiguration.value = responseData.data.displayConfiguration
    }

    formulaData.value = processedData
    resultFields.value = processedData.length > 0
      ? Object.keys(processedData[0]).filter(key => key !== 'timestamp' && key !== 'row_id' && key !== 'time_tag')
      : []
    
    // Initialize label visibility for display fields
    initializeLabelVisibility()

    hasResults.value = true
    currentPage.value = 1

    console.log('✅ Execution successful:', {
      recordCount: processedData.length,
      fieldCount: resultFields.value.length
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Execution failed'
    console.error('❌ Formula execution error:', errorMessage)
    executionError.value = errorMessage
  } finally {
    isExecuting.value = false
  }
}

function formatTimestamp(timestamp: string | number): string {
  const numericTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
  return new Date(numericTimestamp).toLocaleString()
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return value.toFixed(4)
  if (typeof value === 'string' && value.length > 50) return value.substring(0, 50) + '...'
  return String(value)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function updateChartType() {
  // Update displayConfiguration with the selected chart type
  Object.keys(displayConfiguration.value).forEach(key => {
    if (displayConfiguration.value[key].display) {
      displayConfiguration.value[key].display.type = selectedChartType.value
    } else {
      displayConfiguration.value[key].display = { type: selectedChartType.value }
    }
  })
  
  // Re-render chart if in chart mode
  if (viewMode.value === 'chart') {
    nextTick(() => {
      renderChart()
    })
  }
}

// Draw tooltip on chart
function drawTooltip(ctx: CanvasRenderingContext2D, point: { x: number; y: number; data: any }, margin: any, chartWidth: number, chartHeight: number) {
  const { x, y, data } = point

  const padding = 8
  const lineHeight = 16
  const maxWidth = 200

  const timestamp = data.time_tag || data.timestamp
  const numericTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
  const date = new Date(numericTimestamp)
  const timeStr = date.toLocaleString()

  const lines = [timeStr, '']

  // Only show values for visible fields (those in displayFields)
  displayFields.value.forEach(key => {
    if (data[key] !== null && data[key] !== undefined) {
      const value = data[key]
      const formattedValue = typeof value === 'number' ? value.toFixed(4) : String(value)
      lines.push(`${key}: ${formattedValue}`)
    }
  })

  ctx.font = '12px Arial'
  const textWidths = lines.map(line => ctx.measureText(line).width)
  const tooltipWidth = Math.min(maxWidth, Math.max(...textWidths) + padding * 2)
  const tooltipHeight = lines.length * lineHeight + padding * 2

  let tooltipX = x + 10
  let tooltipY = y - tooltipHeight / 2

  if (tooltipX + tooltipWidth > margin.left + chartWidth) {
    tooltipX = x - tooltipWidth - 10
  }
  if (tooltipY < margin.top) {
    tooltipY = margin.top + 10
  }
  if (tooltipY + tooltipHeight > margin.top + chartHeight) {
    tooltipY = margin.top + chartHeight - tooltipHeight - 10
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight)

  ctx.strokeStyle = '#ddd'
  ctx.lineWidth = 1
  ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight)

  ctx.fillStyle = '#333'
  ctx.font = '12px Arial'
  ctx.textAlign = 'left'

  lines.forEach((line, i) => {
    const textY = tooltipY + padding + (i + 1) * lineHeight - 2

    if (i >= 2) {
      const key = line.split(':')[0]
      const config = displayConfiguration.value[key]
      if (config?.display?.color) {
        ctx.fillStyle = config.display.color
      } else {
        ctx.fillStyle = '#333'
      }
    } else {
      ctx.fillStyle = '#333'
    }

    ctx.fillText(line, tooltipX + padding, textY)
  })

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.lineWidth = 1
  ctx.setLineDash([2, 2])

  ctx.beginPath()
  ctx.moveTo(x, margin.top)
  ctx.lineTo(x, margin.top + chartHeight)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(margin.left, y)
  ctx.lineTo(margin.left + chartWidth, y)
  ctx.stroke()

  ctx.setLineDash([])
}

// Handle mouse events on chart
function handleChartMouseMove(event: MouseEvent) {
  if (!chartCanvas.value || formulaData.value.length === 0) return

  const canvas = chartCanvas.value
  const rect = canvas.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  const margin = { top: 20, right: 20, bottom: 40, left: 60 }
  const width = rect.width
  const height = rect.height
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  if (mouseX < margin.left || mouseX > margin.left + chartWidth ||
      mouseY < margin.top || mouseY > margin.top + chartHeight) {
    showTooltip.value = false
    hoveredPoint.value = null
    renderChart()
    return
  }

  const data = formulaData.value

  let minValue = Infinity
  let maxValue = -Infinity

  Object.keys(displayConfiguration.value).forEach(key => {
    data.forEach(d => {
      const value = parseFloat(d[key]) || 0
      minValue = Math.min(minValue, value)
      maxValue = Math.max(maxValue, value)
    })
  })

  const range = maxValue - minValue
  minValue -= range * 0.1
  maxValue += range * 0.1

  const xScale = (index: number) => margin.left + (index / Math.max(1, data.length - 1)) * chartWidth
  const yScale = (value: number) => margin.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight

  // Find closest data point based on X coordinate only
  let closestIndex = 0
  let minXDistance = Infinity

  data.forEach((_d, i) => {
    const x = xScale(i)
    const xDistance = Math.abs(mouseX - x)

    if (xDistance < minXDistance) {
      minXDistance = xDistance
      closestIndex = i
    }
  })

  // Always show tooltip when mouse is in chart area
  const pointX = xScale(closestIndex)
  const pointData = data[closestIndex]

  // Show tooltip with all visible field values
  showTooltip.value = true
  hoveredPoint.value = {
    x: pointX,
    y: mouseY, // Use mouse Y position for tooltip
    data: pointData
  }
  renderChart()
}

function handleChartMouseLeave() {
  showTooltip.value = false
  hoveredPoint.value = null
  renderChart()
}

// Enhanced chart rendering with multiple chart types
let chartRenderer: ChartRenderer | null = null

function renderChart() {
  if (!chartCanvas.value || formulaData.value.length === 0) return

  const canvas = chartCanvas.value
  const container = canvas.parentElement
  if (!container) return

  const containerRect = container.getBoundingClientRect()
  const width = containerRect.width
  const height = containerRect.height || 350

  // Initialize or update chart renderer
  if (!chartRenderer) {
    chartRenderer = new ChartRenderer(canvas, {
      width,
      height,
      margin: { top: 20, right: 20, bottom: 40, left: 60 },
      showGrid: true,
      showTooltip: true
    })
  } else {
    // Update canvas size if needed
    chartRenderer = new ChartRenderer(canvas, {
      width,
      height,
      margin: { top: 20, right: 20, bottom: 40, left: 60 },
      showGrid: true,
      showTooltip: true
    })
  }

  // Convert displayConfiguration to ChartConfig format
  const chartConfig: Record<string, ChartConfig> = {}
  
  // Process only fields that are in displayConfiguration
  displayFields.value.forEach(field => {
    const config = displayConfiguration.value[field]
    if (!config || !config.display) return
    
    // Map line_style to chart type
    let chartType = selectedChartType.value
    if (config.line_style === 'bar') {
      chartType = 'bar'
    } else if (config.line_style === 'polyline') {
      chartType = 'line'
    }
    
    const color = config.display.color || '#0066cc'
    const width = config.display.width || 2
    const opacity = config.display.opacity ? parseFloat(config.display.opacity) / 100 : 1
    
    const chartConfigItem: any = {
      type: chartType,
      color: color,
      width: width,
      opacity: opacity,
      showLabel: labelVisibility.value[field] !== false
    }
    
    // For bar pens, add srcConfig for pen drawing logic
    if (config.line_style === 'bar' && config.src) {
      chartConfigItem.srcConfig = config.src
    }
    
    chartConfig[field] = chartConfigItem
  })

  // Render the chart
  chartRenderer.render(formulaData.value, chartConfig)

  // Draw tooltip if hovering over a point
  if (showTooltip.value && hoveredPoint.value) {
    drawTooltip(chartRenderer['ctx'], hoveredPoint.value, chartRenderer['options'].margin, 
                width - chartRenderer['options'].margin.left - chartRenderer['options'].margin.right, 
                height - chartRenderer['options'].margin.top - chartRenderer['options'].margin.bottom)
  }
}

watch(viewMode, (newMode) => {
  if (newMode === 'chart') {
    nextTick(() => {
      renderChart()
    })
  }
})

// Watch for dialog visibility to set default time range and load data
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    setDefaultTimeRange()
    loadMarkets()
    loadFutures()
  }
})

watch(() => [formulaData.value, displayConfiguration.value], () => {
  if (viewMode.value === 'chart') {
    nextTick(() => {
      renderChart()
    })
  }
}, { deep: true })
</script>

<style scoped>
.dialog-overlay {
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

.dialog-container {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.close-button {
  background: none;
  border: none;
  font-size: 28px;
  color: #6b7280;
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

.close-button:hover {
  background: #f3f4f6;
  color: #111827;
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.config-section {
  margin-bottom: 20px;
}

/* Compact Configuration Row */
.compact-config-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  flex-wrap: wrap;
}

.config-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.market-code-group {
  flex: 1;
  min-width: 300px;
  display: flex;
  gap: 8px;
}

.select-wrapper {
  position: relative;
  flex: 1;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 2px;
}

.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background: #f9fafb;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.future-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.future-code {
  font-weight: 600;
  color: #374151;
  font-size: 13px;
}

.future-market {
  color: #10b981;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.future-name {
  color: #6b7280;
  font-size: 11px;
  line-height: 1.2;
}

.time-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 350px;
}

.time-separator {
  color: #6b7280;
  font-weight: 500;
  font-size: 14px;
}

.granularity-group {
  min-width: 100px;
}

.form-input.compact,
.form-select.compact {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
  color: #111827;
  background: white;
  transition: border-color 0.2s;
  flex: 1;
}

.form-input.compact:focus,
.form-select.compact:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.form-input.compact.datetime-input {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 12px;
  min-width: 160px;
}

.execute-button.compact {
  padding: 6px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.execute-button.compact:hover:not(:disabled) {
  background: #218838;
}

.execute-button.compact:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.results-section {
  border-top: 2px solid #e5e7eb;
  padding-top: 10px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.results-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.controls-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.view-toggle {
  display: flex;
  gap: 8px;
}

.chart-type-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-type-label {
  font-size: 13px;
  color: #374151;
  font-weight: 500;
}

.chart-type-select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
  background: white;
  color: #374151;
  cursor: pointer;
  transition: border-color 0.2s;
}

.chart-type-select:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.chart-type-select:hover {
  border-color: #9ca3af;
}

.toggle-button {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-button:hover {
  background: #f3f4f6;
}

.toggle-button.active {
  background: #0066cc;
  color: white;
  border-color: #0066cc;
}

.table-view {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.table-container {
  max-height: 400px;
  overflow: auto;
  position: relative;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-header {
  background: #f9fafb;
  padding: 10px 12px;
  text-align: left;
  border-bottom: 2px solid #e5e7eb;
  font-weight: 600;
  color: #374151;
  position: sticky;
  top: 0;
  z-index: 10;
  white-space: nowrap;
}

.data-row:nth-child(even) {
  background: #f9fafb;
}

.data-row:hover {
  background: #e3f2fd;
}

.data-cell {
  padding: 8px 12px;
  border-bottom: 1px solid #f1f3f4;
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 11px;
  color: #374151;
}

.chart-view {
  height: 400px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允许 flex 子元素收缩 */
}

.chart-controls {
  background: #f8f9fa;
  border-bottom: 1px solid #e5e7eb;
  padding: 8px 12px;
  flex-shrink: 0;
  max-height: 60px; /* 减少最大高度，因为没有标题了 */
  overflow-y: auto; /* 如果内容过多，允许滚动 */
}

.label-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.label-control-item {
  display: flex;
  align-items: center;
}

.label-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #374151;
  transition: color 0.2s;
  padding: 2px 4px;
  border-radius: 3px;
}

.label-checkbox:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #111827;
}

.label-checkbox input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}

.label-color-indicator {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.label-text {
  font-weight: 500;
}

.chart-container {
  flex: 1;
  position: relative;
  background: #fafbfc;
  min-height: 0; /* 允许 flex 子元素收缩 */
  overflow: hidden; /* 防止内容溢出 */
}

.formula-chart {
  width: 100%;
  height: 100%;
  display: block;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.pagination-button {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.pagination-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-button:hover:not(:disabled) {
  background: #f3f4f6;
}

.pagination-info {
  font-size: 13px;
  color: #6b7280;
}

.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon,
.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-text {
  font-size: 14px;
  color: #6b7280;
}

.error-text {
  font-size: 14px;
  color: #dc3545;
  font-weight: 500;
}
</style>

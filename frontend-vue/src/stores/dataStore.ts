import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LogEntry, HistoricalDataEntry } from '@/types'

export const useDataStore = defineStore('data', () => {
  // State
  const schema = ref({})
  const marketData = ref({})
  const securities = ref({})
  const historicalData = ref(new Map())
  const logs = ref<LogEntry[]>([])
  const rawMessages = ref<any[]>([])
  const maxLogs = ref(1000)
  const maxRawMessages = ref(100)

  // Computed
  const isSchemaLoaded = computed(() => Object.keys(schema.value).length > 0)
  
  const dataCount = computed(() => {
    return Object.values(marketData.value).reduce((total, namespace) => {
      return total + (namespace ? Object.values(namespace).reduce((nsTotal, records) => {
        return nsTotal + (Array.isArray(records) ? records.length : 0)
      }, 0) : 0)
    }, 0)
  })

  // Actions
  const setSchema = (newSchema: Record<string, Record<string, any>> | null) => {
    schema.value = newSchema || {}
  }

  const setMarketData = (data: Record<string, any> | null) => {
    marketData.value = data || {}
  }

  const setSecurities = (data: Record<string, any[]> | null) => {
    securities.value = data || {}
  }

  const addHistoricalData = (key: string, data: HistoricalDataEntry) => {
    historicalData.value.set(key, data)
  }

  const clearHistoricalData = () => {
    historicalData.value.clear()
  }

  const addLog = (level: 'info' | 'success' | 'warning' | 'error', message: string, data: any = null) => {
    const logEntry: LogEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      level,
      message,
      data
    }
    
    logs.value.push(logEntry)
    
    // Maintain max logs limit
    if (logs.value.length > maxLogs.value) {
      logs.value.splice(0, logs.value.length - maxLogs.value)
    }
    
    // Also log to browser console
    const consoleMethod = level === 'error' ? 'error' : 
                         level === 'warning' ? 'warn' : 
                         level === 'success' ? 'log' : 'log'
    console[consoleMethod](`[${level.toUpperCase()}]`, message, data || '')
  }

  const clearLogs = () => {
    logs.value = []
  }

  const addRawMessage = (rawMessage: any) => {
    rawMessages.value.push(rawMessage)
    
    // Maintain max raw messages limit
    if (rawMessages.value.length > maxRawMessages.value) {
      rawMessages.value.splice(0, rawMessages.value.length - maxRawMessages.value)
    }
  }

  const clearRawMessages = () => {
    rawMessages.value = []
  }

  const exportLogs = (format = 'json') => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `mini-wolverine-logs-${timestamp}.${format}`
    
    let content
    if (format === 'json') {
      content = JSON.stringify({
        logs: logs.value,
        exported: new Date().toISOString(),
        count: logs.value.length
      }, null, 2)
    } else {
      // CSV format
      const csvHeader = 'Timestamp,Level,Message,Data\n'
      const csvRows = logs.value.map(log => 
        `"${log.timestamp.toISOString()}","${log.level}","${log.message}","${log.data ? JSON.stringify(log.data) : ''}"`
      ).join('\n')
      content = csvHeader + csvRows
    }
    
    const blob = new Blob([content], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
    
    console.log(`Logs exported as ${filename}`)
  }

  const exportHistoricalData = () => {
    if (historicalData.value.size === 0) {
      console.warn('No historical data to export')
      return
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `mini-wolverine-historical-${timestamp}.json`
    
    const exportData = {
      exported: new Date().toISOString(),
      datasets: Array.from(historicalData.value.entries()).map(([key, dataset]) => ({
        key,
        ...dataset,
        recordCount: dataset.data?.length || 0
      }))
    }
    
    const content = JSON.stringify(exportData, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
    
    console.log(`Historical data exported as ${filename}`)
  }

  return {
    // State
    schema,
    marketData,
    securities,
    historicalData,
    logs,
    rawMessages,
    maxLogs,
    maxRawMessages,
    
    // Computed
    isSchemaLoaded,
    dataCount,
    
    // Actions
    setSchema,
    setMarketData,
    setSecurities,
    addHistoricalData,
    clearHistoricalData,
    addLog,
    clearLogs,
    addRawMessage,
    clearRawMessages,
    exportLogs,
    exportHistoricalData
  }
})

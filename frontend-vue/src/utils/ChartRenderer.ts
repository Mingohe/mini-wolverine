export interface ChartConfig {
  type: 'line' | 'bar' | 'area' | 'scatter' | 'candlestick'
  color?: string
  width?: number
  fill?: boolean
  opacity?: number
  showLabel?: boolean
}

export interface ChartData {
  [key: string]: any
}

export interface ChartOptions {
  width: number
  height: number
  margin: { top: number; right: number; bottom: number; left: number }
  showGrid?: boolean
  showTooltip?: boolean
  animation?: boolean
}

export class ChartRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private options: ChartOptions

  constructor(canvas: HTMLCanvasElement, options: ChartOptions) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.options = options
    this.setupCanvas()
  }

  private setupCanvas() {
    const { width, height } = this.options
    const devicePixelRatio = window.devicePixelRatio || 1
    
    this.canvas.width = width * devicePixelRatio
    this.canvas.height = height * devicePixelRatio
    this.canvas.style.width = width + 'px'
    this.canvas.style.height = height + 'px'
    
    this.ctx.scale(devicePixelRatio, devicePixelRatio)
  }

  render(data: ChartData[], displayConfig: Record<string, ChartConfig>) {
    this.clear()
    this.drawBackground()
    this.drawGrid()
    this.drawData(data, displayConfig)
    this.drawAxes(data, displayConfig)
  }

  private clear() {
    const { width, height } = this.options
    this.ctx.clearRect(0, 0, width, height)
  }

  private drawBackground() {
    const { width, height } = this.options
    this.ctx.fillStyle = '#fafbfc'
    this.ctx.fillRect(0, 0, width, height)
  }

  private drawGrid() {
    if (!this.options.showGrid) return

    const { margin, width, height } = this.options
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    this.ctx.strokeStyle = '#eee'
    this.ctx.lineWidth = 0.5

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (i / 5) * chartHeight
      this.ctx.beginPath()
      this.ctx.moveTo(margin.left, y)
      this.ctx.lineTo(margin.left + chartWidth, y)
      this.ctx.stroke()
    }

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = margin.left + (i / 10) * chartWidth
      this.ctx.beginPath()
      this.ctx.moveTo(x, margin.top)
      this.ctx.lineTo(x, margin.top + chartHeight)
      this.ctx.stroke()
    }
  }

  private drawData(data: ChartData[], displayConfig: Record<string, ChartConfig>) {
    const { margin, width, height } = this.options
    const _chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    // Calculate data ranges
    const ranges = this.calculateRanges(data, displayConfig)
    
    const xScale = (index: number) => margin.left + (index / Math.max(1, data.length - 1)) * _chartWidth
    const yScale = (value: number) => margin.top + chartHeight - ((value - ranges.min) / (ranges.max - ranges.min)) * chartHeight

    // Draw each data series
    Object.keys(displayConfig).forEach(key => {
      const config = displayConfig[key]
      // Only draw the data series if showLabel is true (pen is visible)
      if (config.showLabel !== false) {
        this.drawDataSeries(data, key, config, xScale, yScale, margin, _chartWidth, chartHeight)
      }
    })
  }

  private drawDataSeries(
    data: ChartData[], 
    key: string, 
    config: ChartConfig, 
    xScale: (index: number) => number,
    yScale: (value: number) => number,
    margin: any,
    _chartWidth: number,
    chartHeight: number
  ) {
    const color = config.color || '#0066cc'
    const width = config.width || 2
    const opacity = config.opacity || 1

    this.ctx.strokeStyle = color
    this.ctx.fillStyle = color
    this.ctx.lineWidth = width
    this.ctx.globalAlpha = opacity

    switch (config.type) {
      case 'line':
        this.drawLineChart(data, key, xScale, yScale)
        break
      case 'bar':
        // Check if this is a bar pen (has srcConfig) or regular bar chart
        if ((config as any).srcConfig) {
          this.drawBarPen(data, key, config, xScale, yScale, margin, chartHeight)
        } else {
          this.drawBarChart(data, key, xScale, yScale, margin, chartHeight)
        }
        break
      case 'area':
        this.drawAreaChart(data, key, xScale, yScale, margin, chartHeight)
        break
      case 'scatter':
        this.drawScatterChart(data, key, xScale, yScale)
        break
      case 'candlestick':
        this.drawCandlestickChart(data, key, xScale, yScale, margin, chartHeight)
        break
    }

    this.ctx.globalAlpha = 1
  }

  private drawLineChart(data: ChartData[], key: string, xScale: (index: number) => number, yScale: (value: number) => number) {
    this.ctx.beginPath()
    let firstPoint = true

    data.forEach((d, index) => {
      const value = parseFloat(d[key]) || 0
      const x = xScale(index)
      const y = yScale(value)

      if (firstPoint) {
        this.ctx.moveTo(x, y)
        firstPoint = false
      } else {
        this.ctx.lineTo(x, y)
      }
    })

    this.ctx.stroke()
  }

  private drawBarChart(data: ChartData[], key: string, xScale: (index: number) => number, yScale: (value: number) => number, _margin: any, _chartHeight: number) {
    const barWidth = Math.max(1, (xScale(1) - xScale(0)) * 0.8)

    data.forEach((d, index) => {
      const value = parseFloat(d[key]) || 0
      const x = xScale(index) - barWidth / 2
      const y = yScale(value)
      const height = _margin.top + _chartHeight - y

      this.ctx.fillRect(x, y, barWidth, height)
    })
  }

  private drawBarPen(data: ChartData[], key: string, config: ChartConfig, xScale: (index: number) => number, yScale: (value: number) => number, _margin: any, _chartHeight: number) {
    // Get source configuration from displayConfiguration
    const srcConfig = (config as any).srcConfig
    if (!srcConfig) return

    const barWidth = Math.max(1, (xScale(1) - xScale(0)) * 0.8)

    data.forEach((d, index) => {
      // Check condition - only draw if cond == 1
      const cond = parseInt(d[srcConfig.cond]) || 0
      if (cond !== 1) return

      // Get pen positions
      const pendown = parseFloat(d[srcConfig.price1]) || 0
      const penup = parseFloat(d[srcConfig.price2]) || 0
      const width = parseFloat(d[srcConfig.width]) || barWidth

      const x = xScale(index) - width / 2
      const pendownY = yScale(pendown)
      const penupY = yScale(penup)

      if (pendownY === penupY) {
        // Draw horizontal line
        this.ctx.beginPath()
        this.ctx.moveTo(x, pendownY)
        this.ctx.lineTo(x + width, pendownY)
        this.ctx.stroke()
      } else {
        // Draw rectangle
        const rectHeight = Math.abs(penupY - pendownY)
        const rectY = Math.min(pendownY, penupY)
        
        this.ctx.fillRect(x, rectY, width, rectHeight)
      }
    })
  }

  private drawAreaChart(data: ChartData[], key: string, xScale: (index: number) => number, yScale: (value: number) => number, margin: any, chartHeight: number) {
    this.ctx.beginPath()
    this.ctx.moveTo(xScale(0), margin.top + chartHeight)

    data.forEach((d, index) => {
      const value = parseFloat(d[key]) || 0
      const x = xScale(index)
      const y = yScale(value)
      this.ctx.lineTo(x, y)
    })

    this.ctx.lineTo(xScale(data.length - 1), margin.top + chartHeight)
    this.ctx.closePath()
    this.ctx.fill()
    this.ctx.stroke()
  }

  private drawScatterChart(data: ChartData[], key: string, xScale: (index: number) => number, yScale: (value: number) => number) {
    const radius = 3

    data.forEach((d, index) => {
      const value = parseFloat(d[key]) || 0
      const x = xScale(index)
      const y = yScale(value)

      this.ctx.beginPath()
      this.ctx.arc(x, y, radius, 0, 2 * Math.PI)
      this.ctx.fill()
    })
  }

  private drawCandlestickChart(data: ChartData[], key: string, xScale: (index: number) => number, yScale: (value: number) => number, _margin: any, _chartHeight: number) {
    const candleWidth = Math.max(2, (xScale(1) - xScale(0)) * 0.6)

    data.forEach((d, index) => {
      const open = parseFloat(d[`${key}_open`]) || 0
      const high = parseFloat(d[`${key}_high`]) || 0
      const low = parseFloat(d[`${key}_low`]) || 0
      const close = parseFloat(d[key]) || 0

      const x = xScale(index)
      const openY = yScale(open)
      const highY = yScale(high)
      const lowY = yScale(low)
      const closeY = yScale(close)

      // Draw wick
      this.ctx.beginPath()
      this.ctx.moveTo(x, highY)
      this.ctx.lineTo(x, lowY)
      this.ctx.stroke()

      // Draw body
      const bodyHeight = Math.abs(closeY - openY)
      const bodyY = Math.min(openY, closeY)
      
      this.ctx.fillStyle = close >= open ? '#28a745' : '#dc3545'
      this.ctx.fillRect(x - candleWidth/2, bodyY, candleWidth, bodyHeight)
    })
  }

  private calculateRanges(data: ChartData[], displayConfig: Record<string, ChartConfig>) {
    let minValue = Infinity
    let maxValue = -Infinity

    // If no data or no display config, return default range
    if (data.length === 0 || Object.keys(displayConfig).length === 0) {
      return { min: 0, max: 100 }
    }

    // Only calculate ranges for visible data series
    Object.keys(displayConfig).forEach(key => {
      const config = displayConfig[key]
      // Only include visible series in range calculation
      if (config.showLabel !== false) {
        data.forEach(d => {
          const value = parseFloat(d[key])
          if (!isNaN(value)) {
            minValue = Math.min(minValue, value)
            maxValue = Math.max(maxValue, value)
          }
        })
      }
    })

    // If no valid values found, return default range
    if (minValue === Infinity || maxValue === -Infinity) {
      return { min: 0, max: 100 }
    }

    const range = maxValue - minValue
    return {
      min: minValue - range * 0.1,
      max: maxValue + range * 0.1
    }
  }

  private drawAxes(data: ChartData[], displayConfig: Record<string, ChartConfig>) {
    const { margin, width, height } = this.options
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    // Calculate data ranges for Y-axis labels (only for visible series)
    const ranges = this.calculateRanges(data, displayConfig)

    // Y-axis
    this.ctx.strokeStyle = '#333'
    this.ctx.lineWidth = 1
    this.ctx.beginPath()
    this.ctx.moveTo(margin.left, margin.top)
    this.ctx.lineTo(margin.left, margin.top + chartHeight)
    this.ctx.stroke()

    // X-axis
    this.ctx.beginPath()
    this.ctx.moveTo(margin.left, margin.top + chartHeight)
    this.ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight)
    this.ctx.stroke()

    // Y-axis labels
    this.ctx.fillStyle = '#333'
    this.ctx.font = '11px Arial'
    this.ctx.textAlign = 'right'

    for (let i = 0; i <= 5; i++) {
      const value = ranges.min + (i / 5) * (ranges.max - ranges.min)
      const y = margin.top + chartHeight - (i / 5) * chartHeight
      this.ctx.fillText(value.toFixed(2), margin.left - 10, y + 4)
    }

    // X-axis labels (time labels)
    this.ctx.textAlign = 'center'
    this.ctx.fillStyle = '#333'
    
    if (data.length > 0) {
      const xScale = (index: number) => margin.left + (index / Math.max(1, data.length - 1)) * chartWidth
      
      // Show labels for every 5th data point or at least 3 labels
      const step = Math.max(1, Math.floor(data.length / 3))
      
      for (let i = 0; i < data.length; i += step) {
        const x = xScale(i)
        const timeValue = data[i].time_tag || data[i].timestamp
        if (timeValue) {
          const date = new Date(parseInt(timeValue))
          const timeStr = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          })
          this.ctx.fillText(timeStr, x, margin.top + chartHeight + 20)
        }
      }
      
      // Always show the last label
      if (data.length > 1 && (data.length - 1) % step !== 0) {
        const lastIndex = data.length - 1
        const x = xScale(lastIndex)
        const timeValue = data[lastIndex].time_tag || data[lastIndex].timestamp
        if (timeValue) {
          const date = new Date(parseInt(timeValue))
          const timeStr = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          })
          this.ctx.fillText(timeStr, x, margin.top + chartHeight + 20)
        }
      }
    }
  }

}

// Chart type presets
export const CHART_PRESETS = {
  line: {
    type: 'line' as const,
    color: '#0066cc',
    width: 2
  },
  bar: {
    type: 'bar' as const,
    color: '#28a745',
    width: 1
  },
  area: {
    type: 'area' as const,
    color: '#17a2b8',
    width: 2,
    opacity: 0.3
  },
  scatter: {
    type: 'scatter' as const,
    color: '#ffc107',
    width: 1
  },
  candlestick: {
    type: 'candlestick' as const,
    color: '#6f42c1',
    width: 1
  }
}

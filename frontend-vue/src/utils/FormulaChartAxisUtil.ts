/**
 * Formula Chart X-Axis Formatter Utility
 * 
 * This utility provides smart timestamp formatting for formula chart X-axis labels
 * based on data granularity, density, and time patterns.
 * 
 * Inspired by the axis-util.ts pattern from the wolverine-dev project.
 */

export interface AxisFormatterOptions {
  granularity: number
  dataLength: number
  index: number
  previousTimestamp?: string | number
  timezone?: number
  locale?: string
}

export interface TickConfiguration {
  tickValues: number[]
  tickFormatters: Record<number, (timestamp: string | number) => string>
}

export class FormulaChartAxisUtil {
  /**
   * Format a single timestamp based on granularity and data density
   */
  static formatTimestamp(
    timestamp: string | number, 
    options: AxisFormatterOptions
  ): string {
    const { granularity, dataLength, index, previousTimestamp, locale = 'zh-CN' } = options
    
    const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp)
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    const hour = date.getHours()
    const minute = date.getMinutes()
    const dayOfWeek = date.getDay()
    
    
    // For minute-level data (60s, 300s, 900s, 1800s, 3600s)
    if (granularity <= 3600) {
      return this.formatMinuteLevelData(
        date, year, month, day, hour, minute, 
        dataLength, index, previousTimestamp
      )
    }
    // For daily data (86400s)
    else if (granularity === 86400) {
      return this.formatDailyData(
        date, year, month, day, dayOfWeek,
        dataLength, index, previousTimestamp
      )
    }
    // For weekly data (86400 * 7)
    else if (granularity === 86400 * 7) {
      return this.formatWeeklyData(
        date, year, month, dataLength, index, previousTimestamp
      )
    }
    // For monthly data (86400 * 30)
    else if (granularity === 86400 * 30) {
      return this.formatMonthlyData(
        date, year, month, index, previousTimestamp
      )
    }
    
    // Fallback
    return date.toLocaleString(locale)
  }

  /**
   * Format minute-level data (intraday)
   */
  private static formatMinuteLevelData(
    _date: Date, _year: number, month: number, day: number, hour: number, minute: number,
    dataLength: number, index: number, previousTimestamp?: string | number
  ): string {
    // Show date when it changes
    if (index === 0 || !previousTimestamp || 
        day !== new Date(typeof previousTimestamp === 'string' ? parseInt(previousTimestamp) : previousTimestamp).getDate()) {
      return `${month + 1}/${day}`
    }
    
    // Show hour when it changes and data is dense
    const prevHour = new Date(typeof previousTimestamp === 'string' ? parseInt(previousTimestamp) : previousTimestamp).getHours()
    if (hour !== prevHour) {
      let result: string
      if (dataLength < 100) {
        result = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      } else if (dataLength < 250 && minute % 15 === 0) {
        result = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      } else if (dataLength < 400 && minute % 30 === 0) {
        result = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      } else {
        result = `${hour.toString().padStart(2, '0')}`
      }
      return result
    }
    
    // Show minute for very dense data
    if (dataLength < 100 && minute % 5 === 0) {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    }
    
    // Default to hour for sparse data
    return `${hour.toString().padStart(2, '0')}`
  }

  /**
   * Format daily data
   */
  private static formatDailyData(
    _date: Date, year: number, month: number, day: number, dayOfWeek: number,
    dataLength: number, index: number, previousTimestamp?: string | number
  ): string {
    // Show year when it changes
    if (index === 0 || !previousTimestamp ||
        year !== new Date(typeof previousTimestamp === 'string' ? parseInt(previousTimestamp) : previousTimestamp).getFullYear()) {
      return `${year}年`
    }
    
    // Show month when it changes
    const prevMonth = new Date(typeof previousTimestamp === 'string' ? parseInt(previousTimestamp) : previousTimestamp).getMonth()
    if (month !== prevMonth) {
      if (dataLength < 300) {
        return `${month + 1}月`
      } else if (dataLength < 800 && month % 3 === 0) {
        return `${month + 1}月`
      } else if (dataLength < 1100 && month % 6 === 0) {
        return `${month + 1}月`
      }
    }
    
    // Show day for dense data
    if (dataLength < 100 && dayOfWeek === 1) {
      return `${day}`
    } else if (dataLength < 200 && dayOfWeek === 1 && day >= 13 && day <= 17) {
      return `${day}`
    }
    
    // Default to month
    return `${month + 1}月`
  }

  /**
   * Format weekly data
   */
  private static formatWeeklyData(
    _date: Date, year: number, month: number,
    dataLength: number, index: number, previousTimestamp?: string | number
  ): string {
    if (index === 0 || !previousTimestamp ||
        year !== new Date(typeof previousTimestamp === 'string' ? parseInt(previousTimestamp) : previousTimestamp).getFullYear()) {
      return `${year}年`
    }
    
    const prevMonth = new Date(typeof previousTimestamp === 'string' ? parseInt(previousTimestamp) : previousTimestamp).getMonth()
    if (month !== prevMonth) {
      if (dataLength < 100) {
        return `${month + 1}月`
      } else if (dataLength < 150 && month % 3 === 0) {
        return `${month + 1}月`
      } else if (dataLength < 300 && month % 6 === 0) {
        return `${month + 1}月`
      }
    }
    
    return `${month + 1}月`
  }

  /**
   * Format monthly data
   */
  private static formatMonthlyData(
    _date: Date, year: number, month: number,
    index: number, previousTimestamp?: string | number
  ): string {
    if (index === 0 || !previousTimestamp ||
        year !== new Date(typeof previousTimestamp === 'string' ? parseInt(previousTimestamp) : previousTimestamp).getFullYear()) {
      return `${year}年`
    }
    
    return `${month + 1}月`
  }

  /**
   * Generate smart tick configuration for chart X-axis
   * Similar to adjustXAxisDomain from axis-util.ts
   */
  static generateTickConfiguration(
    data: Array<{ timestamp?: string | number; time_tag?: string | number; [key: string]: any }>,
    granularity: number,
    options: {
      timezone?: number
      maxTicks?: number
      chartWidth?: number
    } = {}
  ): TickConfiguration {
    const { timezone = 0, maxTicks = 8, chartWidth = 800 } = options
    const tickValues: number[] = []
    const tickFormatters: Record<number, (timestamp: string | number) => string> = {}
    
    
    if (data.length === 0) {
      return { tickValues, tickFormatters }
    }

    // Calculate smart tick intervals based on data density
    const actualMaxTicks = Math.min(maxTicks, Math.max(3, Math.floor(chartWidth / 80)))
    const tickInterval = Math.max(1, Math.floor(data.length / actualMaxTicks))
    
    
    // Generate tick values and formatters
    for (let i = 0; i < data.length; i += tickInterval) {
      const previousTimestamp = i > 0 ? (data[i - 1].time_tag || data[i - 1].timestamp) : undefined
      
      
      tickValues.push(i)
      tickFormatters[i] = (t: string | number) => {
        // 确保时间戳是数字格式
        const numericTimestamp = typeof t === 'string' ? parseInt(t) : t
        const numericPreviousTimestamp = previousTimestamp ? (typeof previousTimestamp === 'string' ? parseInt(previousTimestamp) : previousTimestamp) : undefined
        
        const formatted = this.formatTimestamp(numericTimestamp, {
          granularity,
          dataLength: data.length,
          index: i,
          previousTimestamp: numericPreviousTimestamp,
          timezone
        })
        
        
        return formatted
      }
    }
    
    // Always include the last data point if it's not already included
    if (data.length > 0 && (data.length - 1) % tickInterval !== 0) {
      const lastIndex = data.length - 1
      const previousTimestamp = lastIndex > 0 ? (data[lastIndex - 1].time_tag || data[lastIndex - 1].timestamp) : undefined
      
      tickValues.push(lastIndex)
      tickFormatters[lastIndex] = (t: string | number) => {
        // 确保时间戳是数字格式
        const numericTimestamp = typeof t === 'string' ? parseInt(t) : t
        const numericPreviousTimestamp = previousTimestamp ? (typeof previousTimestamp === 'string' ? parseInt(previousTimestamp) : previousTimestamp) : undefined
        
        return this.formatTimestamp(numericTimestamp, {
          granularity,
          dataLength: data.length,
          index: lastIndex,
          previousTimestamp: numericPreviousTimestamp,
          timezone
        })
      }
    }
    
    return { tickValues, tickFormatters }
  }

  /**
   * Format timestamp for display in different locales
   */
  static formatTimestampForLocale(
    timestamp: string | number,
    locale: string = 'zh-CN',
    options: Intl.DateTimeFormatOptions = {}
  ): string {
    const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp)
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    }
    
    return date.toLocaleString(locale, defaultOptions)
  }

  /**
   * Get appropriate time format based on granularity
   */
  static getTimeFormatForGranularity(granularity: number): string {
    if (granularity <= 60) {
      return 'HH:mm:ss'
    } else if (granularity <= 3600) {
      return 'HH:mm'
    } else if (granularity <= 86400) {
      return 'MM/dd HH:mm'
    } else if (granularity <= 86400 * 7) {
      return 'MM/dd'
    } else if (granularity <= 86400 * 30) {
      return 'MMM yyyy'
    } else {
      return 'yyyy'
    }
  }

  /**
   * Calculate optimal tick spacing for chart
   */
  static calculateOptimalTickSpacing(
    dataLength: number,
    chartWidth: number,
    minTickSpacing: number = 60
  ): number {
    const maxTicks = Math.floor(chartWidth / minTickSpacing)
    return Math.max(1, Math.floor(dataLength / maxTicks))
  }
}

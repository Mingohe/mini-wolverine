/**
 * DSL 自动补全工具类
 * 提供智能补全建议，包括命令类型、指标/公式、市场、票子、粒度、时间等
 */

import { useDataStore } from '@/stores/dataStore'
import { seedService } from '@/services/seedService'

export interface AutocompleteSuggestion {
  text: string
  display: string
  description?: string
  type: 'command' | 'namespace' | 'indicator' | 'formula' | 'revision' | 'market' | 'code' | 'granularity' | 'time'
  icon?: string
}

export interface AutocompleteContext {
  cursorPosition: number
  currentText: string
  textBeforeCursor: string
  textAfterCursor: string
  currentSegment: 'command' | 'namespace' | 'indicator' | 'formula' | 'revision' | 'market' | 'code' | 'granularity' | 'time' | 'options' | null
  queryType?: 'fc' | 'ft' | 'fm'
  namespace?: 'global' | 'private'
  indicator?: string
  formula?: string
  market?: string
  partialInput?: string
}

export class DSLAutocomplete {
  /**
   * 延迟获取 dataStore，避免 Pinia 初始化错误
   */
  private getDataStore() {
    return useDataStore()
  }

  /**
   * 分析当前光标位置的上下文
   */
  analyzeContext(text: string, cursorPosition: number): AutocompleteContext {
    const textBeforeCursor = text.substring(0, cursorPosition)
    const textAfterCursor = text.substring(cursorPosition)
    
    // 解析查询类型
    const queryTypeMatch = textBeforeCursor.match(/(fc|ft|fm):/)
    const queryType = queryTypeMatch ? (queryTypeMatch[1] as 'fc' | 'ft' | 'fm') : undefined
    
    // 解析 namespace
    const namespaceMatch = textBeforeCursor.match(/(?:fc|ft|fm):(global|private)::/)
    const namespace = namespaceMatch ? (namespaceMatch[1] as 'global' | 'private') : undefined
    
    // 解析指标/公式名
    const nameMatch = textBeforeCursor.match(/(?:fc|ft|fm):(?:global|private)?::?([^@\[\|]+)/)
    const name = nameMatch ? nameMatch[1].trim() : undefined
    
    // 解析市场代码
    const marketCodeMatch = textBeforeCursor.match(/\[([^:]+):?([^\]]*)/)
    const market = marketCodeMatch ? marketCodeMatch[1] : undefined
    const code = marketCodeMatch && marketCodeMatch[2] ? marketCodeMatch[2] : undefined
    
    // 判断当前所在的语法段
    let currentSegment: AutocompleteContext['currentSegment'] = null
    let partialInput = ''
    
    if (!queryTypeMatch) {
      currentSegment = 'command'
    } else if (!namespace && textBeforeCursor.match(/(?:fc|ft):$/)) {
      // fc 和 ft 需要 namespace，但 fm 不需要
      currentSegment = 'namespace'
    } else if (queryType === 'fm' && textBeforeCursor.match(/fm:$/)) {
      // fm 查询不需要 namespace，直接进入公式输入
      currentSegment = 'formula'
      partialInput = ''
    } else if (textBeforeCursor.match(/@$/)) {
      currentSegment = 'revision'
    } else if (textBeforeCursor.match(/\[$/)) {
      currentSegment = 'market'
    } else if (market && !code && textBeforeCursor.match(/\[[^:]+:$/)) {
      currentSegment = 'code'
      partialInput = ''
    } else if (market && code !== undefined && textBeforeCursor.match(/\[[^:]+:[^\]]*$/)) {
      currentSegment = 'code'
      partialInput = code || ''
    } else if (textBeforeCursor.match(/\|\s*[^\|]+\s*\|\s*$/)) {
      // 先判断是否在第二个 | 之后（时间范围），这个条件要放在粒度判断之前
      currentSegment = 'time'
      // 提取时间范围的部分输入
      const timeMatch = textBeforeCursor.match(/\|\s*[^\|]+\s*\|\s*(.*)$/)
      if (timeMatch) {
        partialInput = timeMatch[1].trim()
      }
    } else if (textBeforeCursor.match(/\|\s*$/)) {
      // 在第一个 | 之后（粒度）
      currentSegment = 'granularity'
    } else if (queryType && !textBeforeCursor.match(/[@\[\|]/)) {
      // 如果已经输入了查询类型，但还没有输入 @、[ 或 |，说明正在输入指标/公式名
      if (queryType === 'fm') {
        // fm 查询不需要 namespace，直接匹配公式名
        const formulaMatch = textBeforeCursor.match(/fm:(.+)$/)
        if (formulaMatch) {
          currentSegment = 'formula'
          partialInput = formulaMatch[1].trim()
        }
      } else {
        // fc 和 ft 需要 namespace
        // 检查是否在 namespace 之后（如果有 namespace）
        const afterNamespace = namespace 
          ? textBeforeCursor.match(/(?:fc|ft):(?:global|private)::(.+)$/)
          : textBeforeCursor.match(/(?:fc|ft):(.+)$/)
        
        if (afterNamespace) {
          currentSegment = 'indicator'
          // 提取部分输入（去掉可能的空格）
          partialInput = afterNamespace[1].trim()
        } else if (textBeforeCursor.match(/(?:fc|ft):(?:global|private)?::?$/)) {
          // 刚输入完 namespace 或查询类型，准备输入指标名
          currentSegment = 'indicator'
          partialInput = ''
        }
      }
    }
    
    return {
      cursorPosition,
      currentText: text,
      textBeforeCursor,
      textAfterCursor,
      currentSegment,
      queryType,
      namespace,
      indicator: queryType !== 'fm' ? name : undefined,
      formula: queryType === 'fm' ? name : undefined,
      market,
      partialInput
    }
  }

  /**
   * 获取补全建议
   */
  async getSuggestions(context: AutocompleteContext): Promise<AutocompleteSuggestion[]> {
    if (!context.currentSegment) {
      return []
    }

    switch (context.currentSegment) {
      case 'command':
        return this.getCommandSuggestions()
      case 'namespace':
        return this.getNamespaceSuggestions()
      case 'indicator':
        return this.getIndicatorSuggestions(context)
      case 'formula':
        return this.getFormulaSuggestions(context)
      case 'revision':
        return this.getRevisionSuggestions(context)
      case 'market':
        return this.getMarketSuggestions(context)
      case 'code':
        return await this.getCodeSuggestions(context)
      case 'granularity':
        return this.getGranularitySuggestions(context)
      case 'time':
        return this.getTimeSuggestions(context)
      default:
        return []
    }
  }

  /**
   * 命令类型补全
   */
  private getCommandSuggestions(): AutocompleteSuggestion[] {
    return [
      {
        text: 'fc:',
        display: 'fc: Fetch by Code',
        description: 'Query historical data for a time range',
        type: 'command',
        icon: '📊'
      },
      {
        text: 'ft:',
        display: 'ft: Fetch by Time',
        description: 'Query data at a specific time point',
        type: 'command',
        icon: '⏰'
      },
      {
        text: 'fm:',
        display: 'fm: Formula Query',
        description: 'Query and calculate formula',
        type: 'command',
        icon: '🔢'
      }
    ]
  }

  /**
   * Namespace 补全
   */
  private getNamespaceSuggestions(): AutocompleteSuggestion[] {
    return [
      {
        text: 'global::',
        display: 'global::',
        description: 'Global namespace (public data)',
        type: 'namespace',
        icon: '🌐'
      },
      {
        text: 'private::',
        display: 'private::',
        description: 'Private namespace (user-specific data)',
        type: 'namespace',
        icon: '🔒'
      }
    ]
  }

  /**
   * 指标补全
   */
  private getIndicatorSuggestions(context: AutocompleteContext): AutocompleteSuggestion[] {
    const dataStore = this.getDataStore()
    if (!dataStore.schema || Object.keys(dataStore.schema).length === 0) {
      return []
    }

    const suggestions: AutocompleteSuggestion[] = []
    const namespace = context.namespace || 'global'
    const namespaceKey = namespace === 'global' ? '0' : '1'
    const partialInput = context.partialInput || ''
    const lowerPartial = partialInput.toLowerCase()

    const schema = dataStore.schema as any
    if (schema[namespaceKey]) {
      Object.values(schema[namespaceKey]).forEach((meta: any) => {
        const metaName = meta.name || meta.displayName || ''
        // 提取指标名（去掉 namespace 前缀）
        const indicatorName = metaName.includes('::') 
          ? metaName.split('::').pop() 
          : metaName
        
        if (indicatorName && indicatorName.toLowerCase().includes(lowerPartial)) {
          const revision = meta.revision !== undefined ? meta.revision : 0
          // text 字段包含版本号，用于插入到 DSL 中
          const textWithRevision = revision !== 0 ? `${indicatorName}@${revision}` : `${indicatorName}@0`
          suggestions.push({
            text: textWithRevision,
            display: `${indicatorName}@${revision}`,
            description: `Revision: ${revision}`,
            type: 'indicator',
            icon: '📊'
          })
        }
      })
    }

    return suggestions.slice(0, 20) // 限制返回数量
  }

  /**
   * 公式补全
   */
  private getFormulaSuggestions(context: AutocompleteContext): AutocompleteSuggestion[] {
    const dataStore = this.getDataStore()
    if (!dataStore.formulaList || dataStore.formulaList.length === 0) {
      return []
    }

    const partialInput = context.partialInput || ''
    const lowerPartial = partialInput.toLowerCase()

    return dataStore.formulaList
      .filter(formula => formula.name.toLowerCase().includes(lowerPartial))
      .slice(0, 20)
      .map(formula => ({
        text: formula.name,
        display: formula.name,
        description: formula.description || `Language: ${formula.language_id}`,
        type: 'formula',
        icon: '🔢'
      }))
  }

  /**
   * Revision 补全
   */
  private getRevisionSuggestions(context: AutocompleteContext): AutocompleteSuggestion[] {
    const dataStore = this.getDataStore()
    if (!context.indicator || !dataStore.schema) {
      return [
        { text: '0', display: '@0', description: 'Default revision', type: 'revision' },
        { text: '-1', display: '@-1', description: 'Latest revision', type: 'revision' }
      ]
    }

    const namespace = context.namespace || 'global'
    const namespaceKey = namespace === 'global' ? '0' : '1'
    const schema = dataStore.schema as any
    const revisions = new Set<number>()

    if (schema[namespaceKey]) {
      Object.values(schema[namespaceKey]).forEach((meta: any) => {
        const metaName = meta.name || meta.displayName || ''
        const indicatorName = metaName.includes('::') 
          ? metaName.split('::').pop() 
          : metaName
        
        if (indicatorName === context.indicator && meta.revision !== undefined) {
          revisions.add(meta.revision)
        }
      })
    }

    const revisionList = Array.from(revisions).sort((a, b) => b - a)
    return revisionList.map(rev => ({
      text: rev.toString(),
      display: `@${rev}`,
      description: `Revision ${rev}`,
      type: 'revision'
    }))
  }

  /**
   * 市场补全
   */
  private getMarketSuggestions(context: AutocompleteContext): AutocompleteSuggestion[] {
    const dataStore = this.getDataStore()
    if (!dataStore.marketData) {
      return []
    }

    const suggestions: AutocompleteSuggestion[] = []
    const partialInput = context.partialInput || ''
    const lowerPartial = partialInput.toLowerCase()

    const marketData = dataStore.marketData as any

    // 从 global 命名空间提取市场
    if (marketData.global) {
      Object.entries(marketData.global).forEach(([code, market]: [string, any]) => {
        if (code.toLowerCase().includes(lowerPartial) || 
            (market.name && market.name.toLowerCase().includes(lowerPartial))) {
          suggestions.push({
            text: code,
            display: `${code} - ${market.name || code}`,
            description: 'Global market',
            type: 'market',
            icon: '🌐'
          })
        }
      })
    }

    // 从 private 命名空间提取市场
    if (marketData.private) {
      Object.entries(marketData.private).forEach(([code, market]: [string, any]) => {
        if (code.toLowerCase().includes(lowerPartial) || 
            (market.name && market.name.toLowerCase().includes(lowerPartial))) {
          suggestions.push({
            text: code,
            display: `${code} - ${market.name || code}`,
            description: 'Private market',
            type: 'market',
            icon: '🔒'
          })
        }
      })
    }

    return suggestions.sort((a, b) => a.text.localeCompare(b.text)).slice(0, 20)
  }

  /**
   * 票子补全（异步，需要调用后端 API）
   */
  private async getCodeSuggestions(context: AutocompleteContext): Promise<AutocompleteSuggestion[]> {
    if (!context.market) {
      return []
    }

    try {
      const pattern = context.partialInput || ''
      const response = await seedService.searchFutures({
        market: context.market,
        pattern: pattern,
        limit: 30
      })

      if (response.success && response.data) {
        return response.data.map((item: any) => ({
          text: item.code || item.symbol,
          display: `${item.code || item.symbol} - ${item.name || ''}`,
          description: item.category || 'Future',
          type: 'code',
          icon: '📈'
        }))
      }
    } catch (error) {
      console.error('Failed to search securities:', error)
    }

    return []
  }

  /**
   * 粒度补全
   */
  private getGranularitySuggestions(context: AutocompleteContext): AutocompleteSuggestion[] {
    const partialInput = context.partialInput || ''
    const lowerPartial = partialInput.toLowerCase()
    
    const granularities: AutocompleteSuggestion[] = [
      { text: '1m', display: '1m (60s)', description: '1 Minute', type: 'granularity', icon: '⏱️' },
      { text: '5m', display: '5m (300s)', description: '5 Minutes', type: 'granularity', icon: '⏱️' },
      { text: '15m', display: '15m (900s)', description: '15 Minutes', type: 'granularity', icon: '⏱️' },
      { text: '30m', display: '30m (1800s)', description: '30 Minutes', type: 'granularity', icon: '⏱️' },
      { text: '1h', display: '1h (3600s)', description: '1 Hour', type: 'granularity', icon: '⏱️' },
      { text: '4h', display: '4h (14400s)', description: '4 Hours', type: 'granularity', icon: '⏱️' },
      { text: '1d', display: '1d (86400s)', description: '1 Day', type: 'granularity', icon: '📅' },
      { text: '1w', display: '1w (604800s)', description: '1 Week', type: 'granularity', icon: '📅' },
      { text: '1M', display: '1M (2592000s)', description: '1 Month', type: 'granularity', icon: '📅' },
      { text: '60', display: '60 (1m)', description: '60 Seconds', type: 'granularity', icon: '⏱️' },
      { text: '300', display: '300 (5m)', description: '300 Seconds', type: 'granularity', icon: '⏱️' },
      { text: '3600', display: '3600 (1h)', description: '3600 Seconds', type: 'granularity', icon: '⏱️' },
      { text: '86400', display: '86400 (1d)', description: '86400 Seconds', type: 'granularity', icon: '📅' }
    ]
    
    if (!partialInput) {
      return granularities
    }
    
    return granularities.filter(g => 
      g.text.toLowerCase().includes(lowerPartial) || 
      g.display.toLowerCase().includes(lowerPartial)
    )
  }

  /**
   * 时间格式补全
   */
  private getTimeSuggestions(context: AutocompleteContext): AutocompleteSuggestion[] {
    const partialInput = context.partialInput || ''
    const lowerPartial = partialInput.toLowerCase()
    
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0]

    const times: AutocompleteSuggestion[] = [
      { text: 'now', display: 'now', description: 'Current time', type: 'time', icon: '⚡' },
      { text: today, display: today, description: 'Today', type: 'time', icon: '📅' },
      { text: `${today}..${tomorrow}`, display: `${today}..${tomorrow}`, description: 'Today to tomorrow', type: 'time', icon: '🗓️' },
      { text: `${yesterday}..${today}`, display: `${yesterday}..${today}`, description: 'Yesterday to today', type: 'time', icon: '🗓️' },
      { text: `${weekAgo}..${today}`, display: `${weekAgo}..${today}`, description: 'Last 7 days', type: 'time', icon: '🗓️' },
      { text: '-1d', display: '-1d', description: 'Yesterday', type: 'time', icon: '⬅️' },
      { text: '-7d', display: '-7d', description: 'Last 7 days', type: 'time', icon: '⬅️' },
      { text: '-1h', display: '-1h', description: 'Last 1 hour', type: 'time', icon: '⬅️' },
      { text: '-30m', display: '-30m', description: 'Last 30 minutes', type: 'time', icon: '⬅️' }
    ]
    
    if (!partialInput) {
      return times
    }
    
    return times.filter(t => 
      t.text.toLowerCase().includes(lowerPartial) || 
      t.display.toLowerCase().includes(lowerPartial) ||
      (t.description && t.description.toLowerCase().includes(lowerPartial))
    )
  }
}

// 导出单例
export const dslAutocomplete = new DSLAutocomplete()


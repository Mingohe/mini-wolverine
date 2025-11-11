/**
 * DSL Query Executor - 执行 DSL 查询
 * 
 * 将 Query AST 转换为后端 API 调用，并处理响应
 */

import type { QueryAST, QueryResult } from '../types/dsl'
import type { WebSocketMessage } from '../types'
import { useWebSocketStore } from '../stores/websocketStore'
import { useDataStore } from '../stores/dataStore'
import { websocketTaskService } from '../services/websocketTaskService'

export interface ExecuteOptions {
  onSuccess?: (result: QueryResult) => void
  onError?: (error: string) => void
  timeout?: number // 超时时间（毫秒），默认 30 秒
}

export class DSLExecutor {
  private pendingQueries = new Map<string, {
    resolve: (result: QueryResult) => void
    reject: (error: string) => void
    timeout: ReturnType<typeof setTimeout>
    ast: QueryAST // 保存原始 AST 用于构建结果
  }>()

  /**
   * 获取 WebSocket Store（延迟获取，避免在 Pinia 初始化前调用）
   */
  private getWsStore() {
    return useWebSocketStore()
  }

  /**
   * 获取 Data Store（延迟获取，避免在 Pinia 初始化前调用）
   */
  private getDataStore() {
    return useDataStore()
  }

  /**
   * 从 schema 缓存中获取指标的所有 fields
   */
  private getFieldsFromSchema(namespace: 'global' | 'private', metaName: string, revision?: number): string[] {
    const dataStore = this.getDataStore()
    const schema = dataStore.schema as any

    if (!schema) {
      console.warn('⚠️ Schema not loaded, cannot get fields')
      return []
    }

    // 转换 namespace 为 schema key
    const namespaceKey = namespace === 'private' ? '1' : '0'

    if (!schema[namespaceKey]) {
      console.warn(`⚠️ Namespace ${namespace} not found in schema`)
      return []
    }

    const namespaceData = schema[namespaceKey]

    // 查找匹配的 meta
    let matchedMeta: any = null
    Object.values(namespaceData).forEach((metaInfo: any) => {
      // 检查 metaName 是否匹配
      const schemaMetaName = metaInfo.displayName ||
                             (metaInfo.name && metaInfo.name.includes('::') 
                               ? metaInfo.name.split('::').pop() 
                               : metaInfo.name)
      
      if (schemaMetaName === metaName) {
        // 如果指定了 revision，需要匹配 revision
        if (revision !== undefined) {
          if (metaInfo.revision === revision) {
            matchedMeta = metaInfo
          }
        } else {
          // 如果没有指定 revision，使用最新的（revision 最大的）
          if (!matchedMeta || (metaInfo.revision || 0) > (matchedMeta.revision || 0)) {
            matchedMeta = metaInfo
          }
        }
      }
    })

    if (!matchedMeta) {
      console.warn(`⚠️ Meta ${namespace}::${metaName}${revision !== undefined ? `@${revision}` : ''} not found in schema`)
      return []
    }

    // 提取所有 field names
    if (!matchedMeta.fields || !Array.isArray(matchedMeta.fields)) {
      console.warn(`⚠️ Meta ${namespace}::${metaName} has no fields`)
      return []
    }

    const fields = matchedMeta.fields
      .map((field: any) => field.name || field)
      .filter((name: string) => name) // 过滤掉空值

    console.log(`✅ Found ${fields.length} fields for ${namespace}::${metaName}${revision !== undefined ? `@${revision}` : ''}:`, fields)
    return fields
  }

  /**
   * 为 AST 补充默认 fields（如果未指定）
   */
  private enrichASTWithFields(ast: QueryAST): QueryAST {
    // 只处理指标查询（不处理公式查询）
    if (ast.type === 'formula') {
      return ast
    }

    // 如果已经指定了 fields，不需要补充
    if (ast.options?.fields && ast.options.fields.length > 0) {
      return ast
    }

    // 如果没有指标名，无法获取 fields
    if (!ast.indicator) {
      return ast
    }

    // 从 schema 中获取所有 fields
    const fields = this.getFieldsFromSchema(
      ast.namespace || 'global',
      ast.indicator,
      ast.revision
    )

    if (fields.length === 0) {
      console.warn(`⚠️ No fields found for ${ast.namespace || 'global'}::${ast.indicator}, query will use default fields`)
      return ast
    }

    // 创建新的 AST，添加 fields
    return {
      ...ast,
      options: {
        ...ast.options,
        fields
      }
    }
  }

  /**
   * 确保公式列表已加载
   */
  private async ensureFormulaListLoaded(): Promise<void> {
    const dataStore = this.getDataStore()
    
    // 如果已加载，直接返回
    if (dataStore.isFormulaListLoaded) {
      return
    }

    // 如果正在加载，等待加载完成
    if (dataStore.formulaListLoading) {
      // 简单轮询等待（最多等待 5 秒）
      const maxWait = 5000
      const startTime = Date.now()
      while (dataStore.formulaListLoading && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (dataStore.isFormulaListLoaded) {
        return
      }
    }

    // 触发加载（由组件负责加载，这里只是等待）
    console.warn('⚠️ Formula list not loaded, please wait for component to load it')
  }

  /**
   * 执行查询
   */
  async execute(ast: QueryAST, options: ExecuteOptions = {}): Promise<QueryResult> {
    const { timeout = 30000 } = options

    // 如果是公式查询，先确保公式列表已加载
    if (ast.type === 'formula') {
      await this.ensureFormulaListLoaded()
    }

    return new Promise((resolve, reject) => {
      // 生成请求 ID
      const requestId = `dsl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 设置超时
      const timeoutId = setTimeout(() => {
        this.pendingQueries.delete(requestId)
        const error = `Query timeout after ${timeout}ms`
        options.onError?.(error)
        reject(new Error(error))
      }, timeout)

      // 保存查询回调和原始 AST
      this.pendingQueries.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeoutId)
          options.onSuccess?.(result)
          resolve(result)
        },
        reject: (error) => {
          clearTimeout(timeoutId)
          options.onError?.(error)
          reject(new Error(error))
        },
        timeout: timeoutId,
        ast: ast
      })

      try {
        // 如果未指定 fields，从 schema 中获取所有 fields
        const enrichedAST = this.enrichASTWithFields(ast)

        // 根据查询类型发送不同的消息
        switch (enrichedAST.type) {
          case 'fetch_by_code':
            this.executeFetchByCode(enrichedAST, requestId)
            break
          case 'fetch_by_time':
            this.executeFetchByTime(enrichedAST, requestId)
            break
          case 'formula':
            // 公式查询是异步的，但不等待完成（通过 Promise 处理）
            this.executeFormula(enrichedAST, requestId).catch((error: any) => {
              clearTimeout(timeoutId)
              this.pendingQueries.delete(requestId)
              const errorMsg = error.message || 'Failed to execute formula query'
              options.onError?.(errorMsg)
              reject(new Error(errorMsg))
            })
            break
          default:
            throw new Error(`Unknown query type: ${enrichedAST.type}`)
        }

        // 监听响应（所有查询类型都需要监听）
        this.setupResponseListener(requestId)
      } catch (error: any) {
        clearTimeout(timeoutId)
        this.pendingQueries.delete(requestId)
        const errorMsg = error.message || 'Failed to execute query'
        options.onError?.(errorMsg)
        reject(new Error(errorMsg))
      }
    })
  }

  /**
   * 执行 fetch_by_code 查询
   * 确保 requestId 在顶层，后端会原样返回
   */
  private executeFetchByCode(ast: QueryAST, requestId: string) {
    if (!ast.from || !ast.to) {
      throw new Error('fetch_by_code requires from and to time')
    }

    // 转换 namespace: 'global' -> '0', 'private' -> '1'
    // 后端 server.js 期望字符串 '0' 或 '1'，然后会转换为 'global' 或 'private'
    const namespaceValue = ast.namespace === 'private' ? '1' : '0'

    const message: WebSocketMessage = {
      type: 'fetch_by_code',
      market: ast.market,
      code: ast.code,
      fromTime: ast.from, // 已经是秒级时间戳
      toTime: ast.to,     // 已经是秒级时间戳
      granularity: ast.granularity,
      metaName: ast.indicator || '',
      namespace: namespaceValue, // 发送 '0' 或 '1'
      revision: ast.revision !== undefined ? ast.revision : -1,
      requestId: requestId // 顶层 requestId，后端会原样返回
    } as any

    // 添加字段筛选（如果有）
    if (ast.options?.fields && ast.options.fields.length > 0) {
      message.fields = ast.options.fields
    }

    console.log('📤 Sending fetch_by_code request:', message)
    this.getWsStore().sendMessage(message)
  }

  /**
   * 执行 fetch_by_time 查询
   * 使用与 watchlist 相同的消息格式，确保 requestId 能正确返回
   */
  private executeFetchByTime(ast: QueryAST, requestId: string) {
    if (!ast.time) {
      throw new Error('fetch_by_time requires time')
    }

    // 转换 namespace: 'global' -> '0', 'private' -> '1'
    const namespaceValue = ast.namespace === 'private' ? '1' : '0'

    // 使用与 watchlist 相同的格式：params 对象 + 顶层 requestId
    // 如果 time 是 -1（表示 now），直接传 -1；否则传时间戳
    const timeTag = ast.time === -1 ? -1 : ast.time
    
    const message: WebSocketMessage = {
      type: 'fetch_by_time',
      params: {
        markets: [ast.market], // 数组格式
        codes: [ast.code],     // 数组格式
        timeTag: timeTag, // 使用 timeTag，-1 表示当前时间
        granularity: ast.granularity,
        fields: ast.options?.fields || [], // 字段数组
        metaName: ast.indicator || '',
        namespace: namespaceValue, // '0' 或 '1'
        revision: ast.revision !== undefined ? ast.revision : 0
      },
      requestId // 顶层 requestId，后端会原样返回
    } as any

    console.log('📤 Sending fetch_by_time request:', message)
    this.getWsStore().sendMessage(message)
  }

  /**
   * 执行公式查询（完整流程：查找公式 -> 注册 -> 计算）
   */
  private async executeFormula(ast: QueryAST, requestId: string): Promise<void> {
    if (!ast.from || !ast.to) {
      throw new Error('formula query requires from and to time')
    }

    if (!ast.formula) {
      throw new Error('formula query requires formula name')
    }

    const dataStore = this.getDataStore()

    // 步骤 1: 从缓存中查找公式信息
    const formula = dataStore.findFormulaByName(ast.formula)
    if (!formula) {
      throw new Error(`Formula "${ast.formula}" not found. Please refresh formula list or check formula name.`)
    }

    console.log(`📋 Found formula: ${formula.name} (ID: ${formula.id})`)

    // 步骤 2: 注册公式，获取 UUID
    const registerRequestId = `dsl_register_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const registerMessage: WebSocketMessage = {
      type: 'register_formula',
      formulaId: formula.id,
      sourceCode: formula.source_code,
      languageId: formula.language_id ?? 5, // 使用 ?? 而不是 ||，因为 0 是有效的 language_id
      requestId: registerRequestId
    } as any

    console.log('📝 Registering formula:', { formulaId: formula.id, formulaName: formula.name })

    try {
      const registerResponse = await websocketTaskService.sendTask(registerMessage, {
        timeout: 15000, // 15 秒超时
        retries: 1,
        retryDelay: 2000
      })

      if (!registerResponse.success || !registerResponse.data?.uuid) {
        throw new Error(`Formula registration failed: ${registerResponse.message || 'Unknown error'}`)
      }

      const uuid = registerResponse.data.uuid
      console.log('✅ Formula registered successfully:', { uuid, formulaId: formula.id })

      // 步骤 3: 计算公式，使用 UUID
      const calculateRequestId = requestId
      const calculateMessage: WebSocketMessage = {
        type: 'calculate_formula',
        uuid: uuid,
        market: ast.market,
        code: ast.code,
        fromTime: ast.from * 1000, // 公式查询使用毫秒级时间戳
        toTime: ast.to * 1000,     // 公式查询使用毫秒级时间戳
        granularity: ast.granularity,
        isRealTime: ast.options?.subscribe || false,
        requestId: calculateRequestId
      } as any

      console.log('📤 Sending calculate_formula request:', calculateMessage)
      this.getWsStore().sendMessage(calculateMessage)
    } catch (error: any) {
      console.error('❌ Formula execution error:', error)
      // 查找对应的 pending query 并 reject
      const query = this.pendingQueries.get(requestId)
      if (query) {
        this.pendingQueries.delete(requestId)
        clearTimeout(query.timeout)
        query.reject(error.message || 'Formula execution failed')
      }
      throw error
    }
  }

  /**
   * 设置响应监听器
   * 注意: 响应处理需要在组件中通过 watch lastMessage 调用 handleResponse
   */
  private setupResponseListener(_requestId: string) {
    // 响应处理由组件中的 watch 调用 handleResponse 方法
    // 这里只保存 requestId，等待组件调用
  }

  /**
   * 处理响应消息（由组件调用）
   */
  handleResponse(message: WebSocketMessage): boolean {
    // fetch_by_code 只根据 requestId 匹配（后端已保证返回 requestId）
    if (message.type === 'fetch_by_code_response') {
      if (!message.requestId) {
        return false // fetch_by_code 必须有 requestId
      }
      
      const query = this.pendingQueries.get(message.requestId)
      if (!query) {
        return false
      }
      
      this.handleFetchByCodeResponse(message, query, query.ast)
      return true
    }
    
    // 其他类型使用 requestId 或备用匹配
    const requestId = message.requestId || this.findMatchingRequestId(message)
    
    if (!requestId) {
      return false // 不是我们的查询响应
    }

    const query = this.pendingQueries.get(requestId)
    if (!query) {
      return false
    }

    // 处理响应
    if (message.type === 'fetch_by_time_response') {
      this.handleFetchByTimeResponse(message, query, query.ast)
      return true
    } else if (message.type === 'calculate_formula_response') {
      this.handleFormulaResponse(message, query, query.ast)
      return true
    }

    return false
  }

  /**
   * 查找匹配的请求 ID（当后端不返回 requestId 时）
   * 通过消息类型和参数匹配
   */
  private findMatchingRequestId(message: WebSocketMessage): string | null {
    // 如果没有 requestId，尝试通过消息类型和参数匹配
    const params = (message as any).queryParams || {}
    const entries = Array.from(this.pendingQueries.entries())
    
    // 按时间倒序查找（最近的请求优先）
    for (let i = entries.length - 1; i >= 0; i--) {
      const [requestId, query] = entries[i]
      
      // 类型匹配
      let typeMatch = false
      if (message.type === 'fetch_by_code_response' && query.ast.type === 'fetch_by_code') {
        typeMatch = true
      } else if (message.type === 'fetch_by_time_response' && query.ast.type === 'fetch_by_time') {
        typeMatch = true
      } else if (message.type === 'calculate_formula_response' && query.ast.type === 'formula') {
        typeMatch = true
      }
      
      if (!typeMatch) continue
      
      // 参数匹配（如果响应中有参数信息）
      if (params.market && params.code) {
        if (query.ast.market === params.market && query.ast.code === params.code) {
          return requestId
        }
      } else {
        // 如果没有参数信息，使用第一个匹配类型的请求
        return requestId
      }
    }
    
    return null
  }

  /**
   * 处理 fetch_by_code 响应
   * 只根据 requestId 匹配（后端已保证返回 requestId）
   */
  private handleFetchByCodeResponse(
    message: WebSocketMessage,
    query: { resolve: (result: QueryResult) => void; reject: (error: string) => void },
    ast: QueryAST
  ) {
    // fetch_by_code 必须有 requestId
    const requestId = message.requestId
    if (!requestId) {
      console.error('❌ fetch_by_code_response missing requestId')
      return
    }
    
    if (!message.success) {
      this.pendingQueries.delete(requestId)
      query.reject(message.message || (message as any).error || 'Query failed')
      return
    }

    const result = this.convertToQueryResult(message, 'fetch_by_code', ast)
    this.pendingQueries.delete(requestId)
    query.resolve(result)
  }

  /**
   * 处理 fetch_by_time 响应
   */
  private handleFetchByTimeResponse(
    message: WebSocketMessage,
    query: { resolve: (result: QueryResult) => void; reject: (error: string) => void },
    ast: QueryAST
  ) {
    if (!message.success) {
      const requestId = message.requestId || this.findMatchingRequestId(message)
      if (requestId) {
        this.pendingQueries.delete(requestId)
      }
      query.reject(message.message || (message as any).error || 'Query failed')
      return
    }

    const result = this.convertToQueryResult(message, 'fetch_by_time', ast)
    const requestId = message.requestId || this.findMatchingRequestId(message)
    if (requestId) {
      this.pendingQueries.delete(requestId)
    }
    query.resolve(result)
  }

  /**
   * 处理公式查询响应
   */
  private handleFormulaResponse(
    message: WebSocketMessage,
    query: { resolve: (result: QueryResult) => void; reject: (error: string) => void },
    ast: QueryAST
  ) {
    if (!message.success) {
      const requestId = message.requestId || this.findMatchingRequestId(message)
      if (requestId) {
        this.pendingQueries.delete(requestId)
      }
      query.reject(message.message || (message as any).error || 'Query failed')
      return
    }

    const result = this.convertToQueryResult(message, 'formula', ast)
    const requestId = message.requestId || this.findMatchingRequestId(message)
    if (requestId) {
      this.pendingQueries.delete(requestId)
    }
    query.resolve(result)
  }

  /**
   * 转换后端响应为 QueryResult 格式
   */
  private convertToQueryResult(
    message: WebSocketMessage,
    queryType: 'fetch_by_code' | 'fetch_by_time' | 'formula',
    ast: QueryAST
  ): QueryResult {
    // 公式查询的数据结构不同，需要特殊处理
    if (queryType === 'formula') {
      return this.convertFormulaResult(message, ast)
    }

    const data = message.data || {}
    const params = (message as any).queryParams || {}

    // 转换 records（指标查询）
    const records = (data.records || []).map((record: any) => {
      // 处理时间戳：可能是毫秒或秒
      let timestamp: number
      if (record.timestamp) {
        const timestampStr = String(record.timestamp)
        // 检测特殊值：18446744073709551615 表示 -1（now），使用当前时间
        if (timestampStr === '18446744073709551615') {
          timestamp = Date.now()
        } else {
          timestamp = typeof record.timestamp === 'string' 
            ? parseInt(record.timestamp) 
            : record.timestamp
          // 如果是秒级时间戳（10位），转换为毫秒
          if (timestamp < 10000000000) {
            timestamp = timestamp * 1000
          }
          // 如果时间戳无效（过大），使用当前时间
          if (timestamp > Number.MAX_SAFE_INTEGER || isNaN(timestamp)) {
            timestamp = Date.now()
          }
        }
      } else {
        timestamp = Date.now()
      }

      // 扁平化字段
      const flatRecord: any = {
        timestamp: Math.floor(timestamp / 1000), // 统一为秒级时间戳
        time: new Date(timestamp).toISOString()
      }

      // 如果字段在 record.fields 中，展开到顶层
      if (record.fields && typeof record.fields === 'object') {
        Object.assign(flatRecord, record.fields)
      } else {
        // 否则直接使用 record 的字段（排除 timestamp）
        Object.keys(record).forEach(key => {
          if (key !== 'timestamp') {
            flatRecord[key] = record[key]
          }
        })
      }

      return flatRecord
    })

    // 构建 QueryResult（优先使用 AST 中的信息）
    const result: QueryResult = {
      query: {
        dsl: ast.dsl,
        type: 'indicator'
      },
      metadata: {
        type: 'indicator',
        indicator: ast.indicator,
        market: ast.market,
        code: ast.code,
        namespace: ast.namespace || 'global',
        granularity: ast.granularity,
        revision: ast.revision,
        timeRange: {
          from: ast.from 
            ? new Date(ast.from * 1000).toISOString()
            : (params.fromTime 
                ? new Date(params.fromTime * 1000).toISOString()
                : ''),
          to: ast.to 
            ? new Date(ast.to * 1000).toISOString()
            : (params.toTime 
                ? new Date(params.toTime * 1000).toISOString()
                : '')
        }
      },
      records
    }

    return result
  }

  /**
   * 转换公式查询结果为 QueryResult 格式
   */
  private convertFormulaResult(message: WebSocketMessage, ast: QueryAST): QueryResult {
    const data = message.data || {}
    const formulaData = data.data || {}
    const actualData = formulaData.data || []
    const displayConfiguration = formulaData.displayConfiguration || {}

    // 转换数据记录
    const records = actualData.map((record: any) => {
      // 处理时间戳
      let timestamp: number
      if (record.timestamp) {
        const timestampStr = String(record.timestamp)
        // 检测特殊值：18446744073709551615 表示 -1（now），使用当前时间
        if (timestampStr === '18446744073709551615') {
          timestamp = Date.now()
        } else {
          timestamp = typeof record.timestamp === 'string' 
            ? parseInt(record.timestamp) 
            : record.timestamp
          // 如果是秒级时间戳（10位），转换为毫秒
          if (timestamp < 10000000000) {
            timestamp = timestamp * 1000
          }
          // 如果时间戳无效（过大），使用当前时间
          if (timestamp > Number.MAX_SAFE_INTEGER || isNaN(timestamp)) {
            timestamp = Date.now()
          }
        }
      } else {
        timestamp = Date.now()
      }

      // 构建记录对象
      const flatRecord: any = {
        timestamp: Math.floor(timestamp / 1000), // 统一为秒级时间戳
        time: new Date(timestamp).toISOString()
      }

      // 如果字段在 record.fields 中，展开到顶层
      if (record.fields && typeof record.fields === 'object') {
        Object.assign(flatRecord, record.fields)
      } else {
        // 否则直接使用 record 的字段（排除 timestamp）
        Object.keys(record).forEach(key => {
          if (key !== 'timestamp' && key !== 'time') {
            flatRecord[key] = record[key]
          }
        })
      }

      return flatRecord
    })

    // 构建 QueryResult
    const result: QueryResult = {
      query: {
        dsl: ast.dsl || '',
        type: 'formula'
      },
      metadata: {
        type: 'formula',
        formula: ast.formula,
        market: ast.market,
        code: ast.code,
        granularity: ast.granularity,
        timeRange: {
          from: ast.from ? new Date(ast.from * 1000).toISOString() : '',
          to: ast.to ? new Date(ast.to * 1000).toISOString() : ''
        }
      },
      records,
      displayConfig: displayConfiguration
    }

    return result
  }

  /**
   * 清理所有待处理的查询
   */
  cleanup() {
    this.pendingQueries.forEach((query) => {
      clearTimeout(query.timeout)
    })
    this.pendingQueries.clear()
  }
}

// 导出单例
export const dslExecutor = new DSLExecutor()


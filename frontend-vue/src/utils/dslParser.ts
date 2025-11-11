/**
 * DSL Parser - 解析统一查询 DSL 语法
 * 
 * 语法格式:
 * <query_type>:[<namespace>::]<indicator_or_formula>[@revision][market:code] | <granularity> | <time_range> | <options>
 */

import { QueryAST, QueryOptions, ParseError, QueryType, Namespace } from '../types/dsl'

export class DSLParser {
  /**
   * 解析 DSL 字符串为 Query AST
   */
  static parse(dsl: string): QueryAST | ParseError {
    try {
      const trimmed = dsl.trim()
      if (!trimmed) {
        return {
          error: 'Empty DSL',
          message: 'DSL query cannot be empty'
        }
      }

      // 解析查询类型
      const queryTypeMatch = trimmed.match(/^(ft|fc|fm):/)
      if (!queryTypeMatch) {
        return {
          error: 'Invalid query type',
          message: 'Query must start with ft:, fc:, or fm:',
          position: 0
        }
      }

      const queryType = this.parseQueryType(queryTypeMatch[1])
      let rest = trimmed.substring(queryTypeMatch[0].length)

      // 解析 namespace（可选）
      let namespace: Namespace | undefined
      let namespaceMatch = rest.match(/^(global|private)::/)
      if (namespaceMatch) {
        namespace = namespaceMatch[1] as Namespace
        rest = rest.substring(namespaceMatch[0].length)
      }

      // 解析指标/公式名
      const nameMatch = rest.match(/^([^@\[\|]+)/)
      if (!nameMatch) {
        return {
          error: 'Missing indicator/formula name',
          message: 'Indicator or formula name is required',
          position: queryTypeMatch[0].length
        }
      }

      const indicatorOrFormula = nameMatch[1].trim()
      rest = rest.substring(nameMatch[0].length)

      // 解析 revision（可选）
      let revision: number | undefined
      const revisionMatch = rest.match(/^@(-?\d+)/)
      if (revisionMatch) {
        revision = parseInt(revisionMatch[1], 10)
        rest = rest.substring(revisionMatch[0].length)
      }

      // 解析市场代码 [market:code]
      const marketCodeMatch = rest.match(/^\[([^:]+):([^\]]+)\]/)
      if (!marketCodeMatch) {
        return {
          error: 'Missing market code',
          message: 'Market code format [market:code] is required',
          position: trimmed.length - rest.length
        }
      }

      const market = marketCodeMatch[1]
      const code = marketCodeMatch[2]
      rest = rest.substring(marketCodeMatch[0].length)

      // 解析粒度 | <granularity>
      const granularityMatch = rest.match(/^\s*\|\s*([^\|]+?)(?=\s*\||$)/)
      if (!granularityMatch) {
        return {
          error: 'Missing granularity',
          message: 'Granularity is required (e.g., 1h, 5m, 3600)',
          position: trimmed.length - rest.length
        }
      }

      const granularityStr = granularityMatch[1].trim()
      const granularity = this.parseGranularity(granularityStr)
      if (granularity === null) {
        return {
          error: 'Invalid granularity',
          message: `Invalid granularity format: ${granularityStr}`,
          position: trimmed.length - rest.length + granularityMatch.index!
        }
      }

      rest = rest.substring(granularityMatch[0].length)

      // 解析时间范围 | <time_range>
      const timeRangeMatch = rest.match(/^\s*\|\s*([^\|]+?)(?=\s*\||$)/)
      if (!timeRangeMatch) {
        return {
          error: 'Missing time range',
          message: 'Time range is required',
          position: trimmed.length - rest.length
        }
      }

      const timeRangeStr = timeRangeMatch[1].trim()
      rest = rest.substring(timeRangeMatch[0].length)

      // 解析时间范围
      const timeParseResult = this.parseTimeRange(timeRangeStr, queryType)
      if ('error' in timeParseResult) {
        return timeParseResult
      }

      // 解析选项参数
      const options: QueryOptions = {}
      if (rest.trim()) {
        const optionsResult = this.parseOptions(rest.trim())
        if ('error' in optionsResult) {
          return optionsResult
        }
        Object.assign(options, optionsResult)
      }

      // 构建 Query AST
      const ast: QueryAST = {
        type: queryType,
        namespace: namespace || 'global',
        market,
        code,
        granularity,
        options: Object.keys(options).length > 0 ? options : undefined,
        dsl: trimmed
      }

      if (queryType === 'formula') {
        ast.formula = indicatorOrFormula
      } else {
        ast.indicator = indicatorOrFormula
      }

      if (revision !== undefined) {
        ast.revision = revision
      }

      // 合并选项中的 namespace 和 revision（选项优先级更高）
      if (options.namespace) {
        ast.namespace = options.namespace
      }
      if (options.revision !== undefined) {
        ast.revision = options.revision
      }

      // 设置时间相关字段
      if (queryType === 'fetch_by_time') {
        ast.time = timeParseResult.time
      } else {
        ast.from = timeParseResult.from
        ast.to = timeParseResult.to
      }

      return ast
    } catch (error: any) {
      return {
        error: 'Parse error',
        message: error.message || 'Failed to parse DSL',
        position: 0
      }
    }
  }

  /**
   * 解析查询类型
   */
  private static parseQueryType(type: string): QueryType {
    switch (type) {
      case 'ft':
        return 'fetch_by_time'
      case 'fc':
        return 'fetch_by_code'
      case 'fm':
        return 'formula'
      default:
        throw new Error(`Unknown query type: ${type}`)
    }
  }

  /**
   * 解析粒度格式
   * 支持: 1m, 5m, 1h, 1d 或 3600, 86400
   */
  private static parseGranularity(granularityStr: string): number | null {
    // 纯数字格式（秒数）
    const numMatch = granularityStr.match(/^(\d+)$/)
    if (numMatch) {
      return parseInt(numMatch[1], 10)
    }

    // 带单位格式
    const unitMatch = granularityStr.match(/^(\d+)([smhdwM])$/)
    if (!unitMatch) {
      return null
    }

    const value = parseInt(unitMatch[1], 10)
    const unit = unitMatch[2]

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
      M: 2592000
    }

    return value * (multipliers[unit] || 1)
  }

  /**
   * 解析时间范围
   */
  private static parseTimeRange(
    timeRangeStr: string,
    queryType: QueryType
  ): { time?: number; from?: number; to?: number } | ParseError {
    if (queryType === 'fetch_by_time') {
      // 单时间点
      const time = this.parseTime(timeRangeStr, queryType)
      if (time === null) {
        return {
          error: 'Invalid time format',
          message: `Invalid time format: ${timeRangeStr}`,
          position: 0
        }
      }
      return { time }
    } else {
      // 时间范围 from..to
      const rangeMatch = timeRangeStr.match(/^(.+?)\.\.(.+)$/)
      if (!rangeMatch) {
        return {
          error: 'Invalid time range format',
          message: 'Time range must be in format: from..to',
          position: 0
        }
      }

      const from = this.parseTime(rangeMatch[1].trim(), queryType)
      const to = this.parseTime(rangeMatch[2].trim(), queryType)

      if (from === null || to === null) {
        return {
          error: 'Invalid time format',
          message: `Invalid time format in range: ${timeRangeStr}`,
          position: 0
        }
      }

      return { from, to }
    }
  }

  /**
   * 解析时间字符串为 Unix 时间戳（秒）
   * 支持: ISO 日期、ISO 日期时间、Unix 时间戳（秒/毫秒）、相对时间
   */
  private static parseTime(timeStr: string, queryType?: QueryType): number | null {
    // now - 对于 fetch_by_time，返回 -1；对于其他查询类型，返回当前时间戳
    if (timeStr === 'now') {
      if (queryType === 'fetch_by_time') {
        return -1 // fetch_by_time 使用 -1 表示当前时间
      }
      return Math.floor(Date.now() / 1000) // 其他查询类型使用当前时间戳
    }

    // 相对时间 -1d, -7d
    const relativeMatch = timeStr.match(/^-(\d+)([dmh])$/)
    if (relativeMatch) {
      const value = parseInt(relativeMatch[1], 10)
      const unit = relativeMatch[2]
      const now = Math.floor(Date.now() / 1000)
      const multipliers: Record<string, number> = {
        m: 60,
        h: 3600,
        d: 86400
      }
      return now - value * (multipliers[unit] || 0)
    }

    // Unix 时间戳（毫秒级，13位数字）
    if (/^\d{13}$/.test(timeStr)) {
      return Math.floor(parseInt(timeStr, 10) / 1000)
    }

    // Unix 时间戳（秒级，10位数字）
    if (/^\d{10}$/.test(timeStr)) {
      return parseInt(timeStr, 10)
    }

    // ISO 日期时间 2025-01-01T10:00:00
    // 如果包含时区信息，直接使用；否则假设为 UTC
    const isoDateTimeMatch = timeStr.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:([+-]\d{2}:\d{2})|Z)?$/)
    if (isoDateTimeMatch) {
      // 如果已经有时区信息，直接使用
      if (timeStr.includes('Z') || timeStr.includes('+') || timeStr.includes('-')) {
        const date = new Date(timeStr)
        if (!isNaN(date.getTime())) {
          return Math.floor(date.getTime() / 1000)
        }
      } else {
        // 没有时区信息，假设为 UTC
        const date = new Date(timeStr + 'Z')
        if (!isNaN(date.getTime())) {
          return Math.floor(date.getTime() / 1000)
        }
      }
    }

    // ISO 日期 2025-01-01
    // 假设为 UTC 时间的 00:00:00
    const isoDateMatch = timeStr.match(/^\d{4}-\d{2}-\d{2}$/)
    if (isoDateMatch) {
      const date = new Date(timeStr + 'T00:00:00Z')
      if (!isNaN(date.getTime())) {
        return Math.floor(date.getTime() / 1000)
      }
    }

    return null
  }

  /**
   * 解析选项参数
   */
  private static parseOptions(optionsStr: string): QueryOptions | ParseError {
    const options: QueryOptions = {}
    const parts = optionsStr.split(/\s+/)

    for (const part of parts) {
      // fields:open,close,high,low
      if (part.startsWith('fields:')) {
        const fields = part.substring(7).split(',').map(f => f.trim()).filter(Boolean)
        if (fields.length > 0) {
          options.fields = fields
        }
        continue
      }

      // namespace:global 或 namespace:private
      if (part.startsWith('namespace:')) {
        const ns = part.substring(10).trim()
        if (ns === 'global' || ns === 'private') {
          options.namespace = ns as Namespace
        }
        continue
      }

      // revision:-1
      if (part.startsWith('revision:')) {
        const rev = part.substring(9).trim()
        const revNum = parseInt(rev, 10)
        if (!isNaN(revNum)) {
          options.revision = revNum
        }
        continue
      }

      // +subscribe 或 +real
      if (part === '+subscribe' || part === '+real') {
        options.subscribe = true
        options.realTime = true
        continue
      }

      // formulaId:-222
      if (part.startsWith('formulaId:')) {
        const id = part.substring(10).trim()
        const idNum = parseInt(id, 10)
        if (!isNaN(idNum)) {
          options.formulaId = idNum
        }
        continue
      }
    }

    return options
  }

  /**
   * 验证 DSL 语法
   */
  static validate(dsl: string): { valid: boolean; error?: ParseError } {
    const result = this.parse(dsl)
    if ('error' in result) {
      return { valid: false, error: result }
    }
    return { valid: true }
  }
}


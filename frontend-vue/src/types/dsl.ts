// DSL Query Types

export type QueryType = 'fetch_by_time' | 'fetch_by_code' | 'formula'
export type Namespace = 'global' | 'private'

export interface QueryAST {
  type: QueryType
  namespace?: Namespace
  indicator?: string
  formula?: string
  revision?: number
  market: string
  code: string
  granularity: number // 秒数
  time?: number // Unix timestamp (秒) - for fetch_by_time
  from?: number // Unix timestamp (秒) - for fetch_by_code
  to?: number // Unix timestamp (秒) - for fetch_by_code
  options?: QueryOptions
  dsl: string // 原始 DSL 语句
}

export interface QueryOptions {
  fields?: string[]
  namespace?: Namespace
  revision?: number
  subscribe?: boolean
  realTime?: boolean
  formulaId?: number
}

export interface ParseError {
  error: string
  message: string
  position?: number
  suggestion?: string
}

export interface QueryResult {
  query: {
    dsl: string
    type: 'indicator' | 'formula'
  }
  metadata: {
    type: 'indicator' | 'formula'
    indicator?: string
    formula?: string
    market: string
    code: string
    namespace?: Namespace
    granularity: number
    revision?: number
    timeRange: {
      from: string
      to: string
    }
  }
  records: Array<{
    timestamp: number
    time: string // ISO format
    [field: string]: any
  }>
  displayConfig?: {
    lines?: Array<{
      name: string
      color: string
      thickness: number
    }>
  }
}

export interface SavedQuery {
  id: string
  name: string
  dsl: string
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
  usageCount?: number
}


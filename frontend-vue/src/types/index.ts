// WebSocket message types
export interface WebSocketMessage {
  type: string
  [key: string]: any
}

export interface ConnectionStatusMessage extends WebSocketMessage {
  type: 'connection_status'
  status: 'connected' | 'disconnected'
}

export interface ClientInfoMessage extends WebSocketMessage {
  type: 'client_info'
  clientId: string
  assignedConnectionId: string
  cachedSeedsCount?: number
}

export interface SchemaMessage extends WebSocketMessage {
  type: 'schema_received' | 'schema'
  data?: Record<string, any>
  schema?: Record<string, any>
}

export interface MarketsMessage extends WebSocketMessage {
  type: 'markets_received'
  data: {
    global?: Record<string, any>
    private?: Record<string, any>
  }
}

export interface SecuritiesMessage extends WebSocketMessage {
  type: 'securities_data'
  data: Record<string, any[]>
}

export interface HistoricalDataResponse extends WebSocketMessage {
  type: 'historical_data_response'
  success: boolean
  data?: {
    records: any[]
    totalCount: number
    source: string
    processingTime?: number
  }
  params?: {
    market: string
    code: string
    metaName?: string
    namespace?: string
    granularity?: string
    fieldCount?: number
    timeRange?: string
    revision?: number
  }
  requestId?: string
  error?: string
}

export interface PoolReadyMessage extends WebSocketMessage {
  type: 'pool_ready'
  schema?: Record<string, any>
  markets?: {
    global?: Record<string, any>
    private?: Record<string, any>
  }
  securities?: Record<string, any[]>
}

// Data structure types
export interface SchemaDefinition {
  fields?: Record<string, FieldDefinition>
  revision?: number
  [key: string]: any
}

export interface FieldDefinition {
  type?: string
  description?: string
  default?: any
  [key: string]: any
}

export interface LogEntry {
  id: number
  timestamp: Date
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  data?: any | null
}

export interface HistoricalDataEntry {
  requestId: string
  market: string
  code: string
  metaName?: string
  namespace?: string
  granularity?: string
  fieldCount: number
  timeRange?: string
  data: any[]
  totalCount: number
  source: string
  processingTime?: number
  receivedAt: string
}

export interface QueryParams {
  market: string
  code: string
  namespace?: string
  metaName?: string
  granularity?: string
  timeRange?: string
  fromTime?: string
  toTime?: string
  fieldCount?: number
  revision?: string|number|any
}

export interface PoolStats {
  totalConnections: number
  availableConnections: number
  busyConnections: number
}

export interface WebSocketStats {
  messagesSent: number
  messagesReceived: number
  errors: number
  lastMessageType: string | null
  lastMessageTime: string | null
  cachedSeedsCount: number
}

export interface Credentials {
  url: string
  token: string
}

// Component prop types
export interface TreeNode {
  id: string
  name: string
  level?: number
  type?: 'namespace' | 'meta' | 'revision'
  namespace?: string
  namespaceKey?: string
  metaName?: string
  metaId?: string
  revision?: number
  isRevision?: boolean
  fullMeta?: any
  fullName?: string
  fields?: Record<string, FieldDefinition>
  children?: TreeNode[]
}

export interface TabItem {
  id: string
  label: string
}

// Store state types
export interface DataState {
  schema: Record<string, Record<string, SchemaDefinition>>
  marketData: Record<string, any>
  securities: Record<string, any[]>
  historicalData: Map<string, HistoricalDataEntry>
  logs: LogEntry[]
  rawMessages: any[]
  maxLogs: number
  maxRawMessages: number
}

export interface WebSocketState {
  backendWs: WebSocket | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  caitlynConnected: boolean
  serverUrl: string | null
  authToken: string | null
  clientId: string | null
  assignedConnectionId: string | null
  cachedSeeds: Map<string, any>
  lastSeedTimestamp: number
  poolReady: boolean
  poolStats: PoolStats
  stats: WebSocketStats
  lastMessage: WebSocketMessage | null
}

// Re-export watchlist types
export * from './watchlist'

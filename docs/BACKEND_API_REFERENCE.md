# Mini Wolverine Backend API Reference

This document provides a comprehensive reference for the backend API available to the frontend, including REST endpoints and WebSocket protocol specifications.

## Architecture Overview

The Mini Wolverine backend follows a **backend-frontend separation architecture** where:

- **Backend (Node.js)**: Handles all WASM operations, Caitlyn server communication, and data processing
- **Frontend (React)**: Pure UI layer with no WASM dependencies
- **Communication**: REST API for static data + WebSocket for real-time operations
- **Enhanced Connection Pool**: Conservative single-connection pool to prevent WASM conflicts

```
Frontend (Port 3000) ↔ Backend API (Port 4000) ↔ Caitlyn Server
```

### Key Features

- **Pre-initialized Backend**: Schema, markets, and securities loaded on startup
- **Automatic Data Delivery**: WebSocket connections receive cached data immediately
- **Enhanced Search**: Comprehensive futures search with pagination and market filtering
- **Robust Error Handling**: Detailed error responses with stack traces
- **Connection Pool Management**: Conservative configuration to prevent WASM abort errors

## Base URL

- **Development**: `http://localhost:4000`
- **WebSocket**: `ws://localhost:4000`

## Authentication

The backend handles authentication with the Caitlyn server using environment variables:
- `CAITLYN_TOKEN`: Required authentication token
- `CAITLYN_WS_URL`: Caitlyn server WebSocket URL (default: `wss://116.wolverine-box.com/tm`)
- `CAITLYN_CONNECTION_TIMEOUT`: Connection timeout in milliseconds (default: 60000)
- `CAITLYN_RECONNECT_DELAY`: Reconnection delay in milliseconds (default: 5000)
- `CAITLYN_MAX_RECONNECT_ATTEMPTS`: Maximum reconnection attempts (default: 2)

No frontend authentication is required - the backend acts as a proxy.

---

## REST API Endpoints

### Health and Status

#### `GET /api/health`

Returns backend health status and connection pool statistics.

**Response:**
```json
{
  "status": "healthy",
  "pool": {
    "totalConnections": 1,
    "activeConnections": 1,
    "availableConnections": 1,
    "pendingRequests": 0
  },
  "poolConfig": {
    "poolSize": 1,
    "maxPoolSize": 1,
    "connectionTimeout": 60000,
    "reconnectDelay": 5000,
    "maxReconnectAttempts": 2
  },
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Schema and Metadata

#### `GET /api/schema`

Returns the complete Caitlyn schema definition with metadata for all objects.

**Response:**
```json
{
  "global": {
    "3": {
      "name": "Market",
      "fields": [
        {
          "name": "trade_day",
          "type": "int32"
        },
        {
          "name": "name", 
          "type": "string"
        }
      ]
    }
  },
  "private": { /* private namespace objects */ }
}
```

#### `GET /api/markets`

Returns available markets from universe revision data.

**Response:**
```json
{
  "global": {
    "DCE": { /* market data */ },
    "SHFE": { /* market data */ },
    "CZCE": { /* market data */ }
  },
  "private": { /* private markets */ }
}
```

#### `GET /api/securities`

Returns securities data indexed by market.

**Response:**
```json
{
  "DCE": [
    {
      "codes": ["i<00>", "i<01>"],
      "names": ["Iron Ore Main", "Iron Ore Secondary"]
    }
  ],
  "SHFE": [
    {
      "codes": ["cu<00>", "cu<01>"],
      "names": ["Copper Main", "Copper Secondary"]
    }
  ]
}
```

### Market Data Queries

#### `GET /api/futures`

Alias for `/api/securities`. Returns all futures contracts.

#### `GET /api/futures/markets`

Returns array of available market names.

**Response:**
```json
["DCE", "SHFE", "CZCE", "CFFEX", "INE", "ICE", "NYMEX", "SGX", "DME", "HUOBI"]
```

#### `GET /api/futures/:market`

Returns futures contracts for a specific market.

**Parameters:**
- `market` (string): Market code (e.g., "DCE", "SHFE")

**Response:**
```json
[
  {
    "codes": ["i<00>", "i<01>"],
    "names": ["Iron Ore Main", "Iron Ore Secondary"]
  }
]
```

#### `GET /api/futures/search`

Comprehensive search endpoint for futures contracts with pattern matching and market filtering.

**Query Parameters:**
- `pattern` (string, optional): Search pattern for code, name, or abbreviation
- `market` (string, optional): Limit search to specific market
- `limit` (number, optional): Maximum results to return (default: 10)
- `offset` (number, optional): Number of results to skip for pagination (default: 0)

**Examples:**
- `/api/futures/search?pattern=iron&market=DCE`
- `/api/futures/search?pattern=copper&limit=20`
- `/api/futures/search?market=SHFE&offset=10&limit=5`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "code": "i<00>",
      "name": "Iron Ore Main Contract",
      "abbreviation": "IronOre",
      "market": "DCE"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0,
  "hasMore": false,
  "markets": ["DCE", "SHFE", "CZCE"],
  "marketStats": {
    "DCE": 1
  },
  "searchParams": {
    "pattern": "iron",
    "market": "DCE"
  }
}
```

---

## WebSocket API Protocol

Connect to `ws://localhost:4000` to establish a WebSocket connection.

### Connection Lifecycle

1. **Frontend connects** → Backend sends immediate status
2. **Backend sends cached data** (schema, markets, securities)
3. **Frontend sends requests** → Backend processes and responds
4. **Real-time data** flows continuously once subscriptions are active

### Message Format

All WebSocket messages use JSON format:

```json
{
  "type": "message_type",
  "data": { /* message-specific data */ },
  "requestId": "optional-request-id",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Frontend → Backend Messages

#### Connection Management

##### `connect`
**Deprecated** - Backend is pre-initialized, connection requests are ignored.

```json
{
  "type": "connect",
  "url": "wss://116.wolverine-box.com/tm", 
  "token": "auth-token"
}
```

##### `disconnect`
Gracefully disconnects from the Caitlyn server.

```json
{
  "type": "disconnect"
}
```

#### Data Retrieval

##### `get_schema`
Requests the current schema definition.

```json
{
  "type": "get_schema"
}
```

##### `get_client_info`
Requests client connection information.

```json
{
  "type": "get_client_info"
}
```

##### `query_cached_seeds`
Queries cached universe seeds data with optional timestamp filtering.

```json
{
  "type": "query_cached_seeds",
  "sinceTimestamp": 1672531200000
}
```

#### Historical Data Queries

##### `fetch_by_code`
Fetches historical data for a specific market/code combination using the enhanced WASM API.

```json
{
  "type": "fetch_by_code",
  "market": "DCE",
  "code": "i<00>",
  "fromTime": 1672531200,
  "toTime": 1672617600,
  "granularity": 86400,
  "fields": ["open", "close", "high", "low", "volume"],
  "metaName": "SampleQuote",
  "namespace": "global",
  "revision": -1
}
```

**Parameters:**
- `market` (string): Market code
- `code` (string): Security code  
- `fromTime` (number): Start time (Unix timestamp)
- `toTime` (number): End time (Unix timestamp)
- `granularity` (number): Time granularity in seconds
- `fields` (array): Requested field names
- `metaName` (string): Metadata type name (used as qualifiedName)
- `namespace` (string): "global" or "private" (string format, not integer)
- `revision` (number): Schema revision (-1 for latest, optional)

##### `query_historical_by_code`
Alternative historical data query format.

```json
{
  "type": "query_historical_by_code",
  "params": {
    "market": "SHFE",
    "code": "cu<00>",
    "metaID": 123,
    "granularity": 3600,
    "startTime": 1672531200000,
    "endTime": 1672617600000,
    "namespace": "global",
    "qualifiedName": "SampleQuote",
    "fields": ["close", "volume"]
  }
}
```

#### Testing and Debugging

##### `test_universe_revision`
Tests universe revision data retrieval.

```json
{
  "type": "test_universe_revision"
}
```

##### `test_universe_seeds`
Tests universe seeds data retrieval.

```json
{
  "type": "test_universe_seeds"
}
```

##### `query_historical_data`
Legacy historical data query format (deprecated in favor of `fetch_by_code`).

```json
{
  "type": "query_historical_data",
  "params": {
    "market": "DCE",
    "code": "i<00>",
    "metaID": 123,
    "namespace": "global",
    "metaName": "SampleQuote",
    "granularity": 3600,
    "startTime": 1672531200000,
    "endTime": 1672617600000,
    "fields": ["close", "volume"],
    "fieldIndices": [0, 1]
  },
  "requestId": 1672531200000
}
```

##### `request_historical`
Alternative historical data request format.

```json
{
  "type": "request_historical",
  "params": {
    "market": "DCE",
    "code": "i<00>",
    "granularity": 3600,
    "startTime": 1672531200000,
    "endTime": 1672617600000
  }
}
```

#### Real-time Subscriptions

##### `subscribe`
Subscribe to real-time data updates with automatic deduplication and broadcast to multiple subscribers.

```json
{
  "type": "subscribe",
  "markets": ["ICE", "DCE"],
  "codes": ["B<00>", "i<00>"],
  "qualifiedNames": ["global::SampleQuote"],
  "options": {
    "granularities": [86400],
    "fields": ["bid", "ask", "last", "volume"]
  },
  "requestId": "sub_123456"
}
```

**Parameters:**
- `markets` (string|array): Market code(s) - can be single string or array
- `codes` (string|array): Security code(s) - can be single string or array
- `qualifiedNames` (string|array): Fully qualified metadata type(s) including namespace (e.g., "global::SampleQuote", "private::Market")
- `options` (object): Subscription options
  - `granularities` (array): Time granularities in seconds (must match codes array length)
  - `fields` (array): Requested field names
- `requestId` (string, optional): Request identifier for correlation

**Implementation Notes:**
- Uses subscription hub for automatic deduplication and broadcast
- Supports multiple subscribers to the same market/code combination
- Real-time data is broadcast to all matching subscribers
- Backend validates connection status before accepting subscription

##### `unsubscribe`
Cancel a real-time subscription using the subscriber ID.

```json
{
  "type": "unsubscribe",
  "subscriberId": "sub_1234567890_abc123",
  "requestId": "unsub_123456"
}
```

**Parameters:**
- `subscriberId` (string): Unique subscriber ID returned from subscribe request
- `requestId` (string, optional): Request identifier for correlation

**Implementation Notes:**
- Removes subscriber from subscription hub
- If no more subscribers exist for a subscription key, the subscription is fully cancelled
- Returns success/error response confirming unsubscription status

##### `get_subscription_stats`
Get subscription statistics and monitoring information.

```json
{
  "type": "get_subscription_stats",
  "requestId": "stats_123456"
}
```

**Parameters:**
- `requestId` (string, optional): Request identifier

#### Formula Operations

##### `register_formula`
Register a formula on the server for later calculation and real-time subscription.

```json
{
  "type": "register_formula",
  "formulaId": -222,
  "sourceCode": "variable: SHORT=12;\nvariable: LONG=26;\nDIFF: EMA(CLOSE,SHORT) - EMA(CLOSE,LONG);",
  "languageId": 5,
  "requestId": "reg_123456"
}
```

**Parameters:**
- `formulaId` (number): Unique formula identifier (usually negative for user formulas)
- `sourceCode` (string): Formula source code in the specified language
- `languageId` (number): Language identifier (default: 5)
- `requestId` (string, optional): Request identifier for correlation

**Implementation Notes:**
- Requires active connection pool to Caitlyn server
- Returns UUID that can be used for formula calculation
- Formula remains registered for the session duration

##### `calculate_formula`
Calculate a registered formula for historical data with optional real-time subscription.

```json
{
  "type": "calculate_formula",
  "uuid": "formula-uuid-from-registration",
  "market": "NYMEX",
  "code": "CL<00>",
  "fromTime": 1672531200000,
  "toTime": 1672617600000,
  "granularity": 86400,
  "isRealTime": true,
  "requestId": "calc_123456"
}
```

**Parameters:**
- `uuid` (string): Formula UUID returned from registration
- `market` (string): Market code
- `code` (string): Security code
- `fromTime` (number): Start time (Unix timestamp in milliseconds)
- `toTime` (number): End time (Unix timestamp in milliseconds)
- `granularity` (number): Time granularity in seconds
- `isRealTime` (boolean): Whether to enable real-time updates (default: false)
- `requestId` (string, optional): Request identifier for correlation

**Implementation Notes:**
- Formula must be registered first using `register_formula`
- Returns historical calculation results with display configuration
- If `isRealTime` is true, establishes real-time subscription for formula updates
- Real-time data includes formula calculation results with the same structure

### Backend → Frontend Messages

#### Connection Status

##### `connection_status`
Reports connection status to Caitlyn server.

```json
{
  "type": "connection_status",
  "status": "connected",
  "message": "Connected to pre-initialized Caitlyn server"
}
```

#### Schema and Metadata

##### `schema_received`
Delivers schema definition data.

```json
{
  "type": "schema_received",
  "data": {
    "global": { /* schema objects */ },
    "private": { /* schema objects */ }
  },
  "message": "Schema available from pre-initialized backend"
}
```

##### `markets_received`  
Delivers markets data.

```json
{
  "type": "markets_received",
  "data": {
    "global": { /* markets data */ },
    "private": { /* markets data */ }
  },
  "message": "Markets data available from pre-initialized backend"
}
```

##### `securities_received`
Delivers securities data.

```json
{
  "type": "securities_received", 
  "data": {
    "DCE": [{ /* security data */ }],
    "SHFE": [{ /* security data */ }]
  },
  "message": "Securities data available from pre-initialized backend"
}
```

#### Client Information

##### `client_info`
Provides client connection details.

```json
{
  "type": "client_info",
  "clientId": "client_123456",
  "assignedConnectionId": null,
  "isConnected": true,
  "cachedSeedsCount": 60
}
```

#### Historical Data Responses

##### `fetch_by_code_response`
Response to `fetch_by_code` requests.

**Success Response:**
```json
{
  "type": "fetch_by_code_response",
  "success": true,
  "data": {
    "records": [
      {
        "timestamp": 1672531200,
        "datetime": "2025-01-01T00:00:00.000Z",
        "market": "DCE",
        "code": "i<00>",
        "open": 850.25,
        "close": 852.75,
        "high": 855.00,
        "low": 848.50,
        "volume": 12580
      }
    ],
    "totalCount": 1,
    "processingTime": "2025-01-01T12:00:00.000Z",
    "source": "caitlyn_server",
    "fieldCount": 5
  },
  "message": "Historical data fetched successfully for DCE/i<00>",
  "queryParams": {
    "market": "DCE",
    "code": "i<00>",
    "fromTime": 1672531200,
    "toTime": 1672617600,
    "granularity": 86400,
    "fieldCount": 5
  }
}
```

**Error Response:**
```json
{
  "type": "fetch_by_code_response",
  "success": false,
  "message": "Error description",
  "error": {
    "type": "ErrorType",
    "message": "Detailed error message",
    "stack": "Error stack trace"
  }
}
```

##### `historical_query_response`
Response to alternative historical data queries.

```json
{
  "type": "historical_query_response", 
  "success": true,
  "message": "Historical data retrieved for SHFE/cu<00>",
  "data": {
    "records": [/* historical records */],
    "totalCount": 50,
    "processingTime": "2025-01-01T12:00:00.000Z"
  },
  "requestId": 1672531200000,
  "params": {
    "market": "SHFE",
    "code": "cu<00>",
    "granularity": 3600,
    "timeRange": "2025-01-01T00:00:00.000Z to 2025-01-02T00:00:00.000Z"
  }
}
```

#### Testing Responses

##### `universe_revision`
Response to universe revision tests.

```json
{
  "type": "universe_revision",
  "success": true,
  "marketsCount": 10,
  "globalMarkets": ["DCE", "SHFE", "CZCE"],
  "privateMarkets": []
}
```

##### `universe_seeds`
Response to universe seeds tests.

```json
{
  "type": "universe_seeds", 
  "success": true,
  "seedsReceived": 60,
  "totalEntries": 1500
}
```

#### Real-time Subscription Responses

##### `subscription_confirmed`
Response to successful subscription requests.

```json
{
  "type": "subscription_confirmed",
  "subscriberId": "sub_1234567890_abc123",
  "message": "Real-time subscription established successfully",
  "requestId": "sub_123456",
  "subscriptionInfo": {
    "markets": ["ICE", "DCE"],
    "codes": ["B<00>", "i<00>"],
    "qualifiedNames": ["global::SampleQuote"],
    "options": {
      "granularities": [86400],
      "fields": ["bid", "ask", "last", "volume"]
    }
  }
}
```

##### `subscription_error`
Response to failed subscription requests.

```json
{
  "type": "subscription_error",
  "error": "Invalid market code provided",
  "requestId": "sub_123456",
  "details": {
    "type": "ValidationError",
    "message": "Invalid market code provided"
  }
}
```

##### `unsubscription_confirmed`
Response to successful unsubscription requests.

```json
{
  "type": "unsubscription_confirmed",
  "subscriberId": "sub_1234567890_abc123",
  "message": "Subscription cancelled successfully",
  "requestId": "unsub_123456"
}
```

##### `unsubscription_error`
Response to failed unsubscription requests.

```json
{
  "type": "unsubscription_error",
  "error": "Subscriber not found or already unsubscribed",
  "subscriberId": "sub_1234567890_abc123",
  "requestId": "unsub_123456"
}
```

##### `real_time_data`
Real-time data updates from active subscriptions.

```json
{
  "type": "real_time_data",
  "data": {
    "market": "ICE",
    "code": "B<00>",
    "metaName": "global::SampleQuote",
    "namespace": "global",
    "fields": {
      "bid": 95.25,
      "ask": 95.30,
      "last": 95.28,
      "volume": 1250
    },
    "timestamp": "1672531200000",
    "receivedAt": "2025-01-01T12:00:00.000Z"
  },
  "subscriberId": "sub_1234567890_abc123",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

##### `subscription_stats`
Response to subscription statistics requests.

```json
{
  "type": "subscription_stats",
  "data": {
    "activeSubscriptions": 3,
    "totalSubscribers": 5,
    "messagesReceived": 1250,
    "uptime": 3600,
    "subscriptions": [
      {
        "key": "ICE|B<00>|SampleQuote|global|{}",
        "subscriberCount": 2,
        "markets": ["ICE"],
        "codes": ["B<00>"],
        "qualifiedNames": ["global::SampleQuote"],
        "createdAt": "2025-01-01T10:00:00.000Z"
      }
    ]
  },
  "message": "Subscription statistics retrieved successfully",
  "requestId": "stats_123456"
}
```

##### `subscription_stats_error`
Response to failed subscription statistics requests.

```json
{
  "type": "subscription_stats_error",
  "error": "Subscription hub not available",
  "requestId": "stats_123456"
}
```

#### Error Messages

All error responses follow this format:

```json
{
  "type": "response_type",
  "success": false,
  "error": "Error description",
  "requestId": "optional-request-id"
}
```

---

## Data Models

### Historical Record

```typescript
interface HistoricalRecord {
  timestamp: number;           // Unix timestamp
  datetime: string;            // ISO date string
  market: string;              // Market code
  code: string;                // Security code
  [fieldName: string]: any;    // Dynamic fields based on request
}
```

### Market Data

```typescript
interface MarketData {
  [marketCode: string]: {
    trade_day: number;
    name: string;
    time_zone: string;
    revs: string;              // JSON string with revision data
  }
}
```

### Security Data

```typescript
interface SecurityData {
  codes: string[];             // Array of security codes
  names: string[];             // Array of security names
}

interface FuturesContract {
  code: string;                // Contract code (e.g., "i<00>")
  name: string;                // Contract name
  abbreviation?: string;       // Contract abbreviation
  market: string;              // Market code (e.g., "DCE", "SHFE")
}
```

### Schema Definition

```typescript
interface SchemaObject {
  name: string;                // Object name (e.g., "Market", "SampleQuote")
  fields: FieldDefinition[];   // Field definitions
}

interface FieldDefinition {
  name: string;                // Field name
  type: string;                // Field type
  index?: number;              // Field index
}

### Search Response

```typescript
interface SearchResponse {
  success: boolean;            // Request success status
  data: FuturesContract[];     // Array of matching contracts
  total: number;               // Total number of matches
  limit: number;               // Results per page
  offset: number;              // Results offset
  hasMore: boolean;            // Whether more results available
  markets: string[];           // Available market codes
  marketStats: {               // Results count per market
    [marketCode: string]: number;
  };
  searchParams: {              // Original search parameters
    pattern?: string;
    market?: string;
  };
}
```

---

## Error Handling

### Connection Errors

- **Not Connected**: Backend not connected to Caitlyn server
- **Pool Exhausted**: No available connections in pool
- **Timeout**: Request exceeded timeout limit
- **Authentication**: Invalid or expired token

### Data Errors

- **Invalid Parameters**: Missing or malformed request parameters
- **Schema Not Found**: Requested metadata type not available
- **Market Not Found**: Invalid market code
- **No Data**: No data available for requested time range

### Error Response Format

```json
{
  "type": "error_response",
  "success": false,
  "error": "Detailed error message",
  "errorType": "connection_error|data_error|validation_error",
  "requestId": "optional-request-id",
  "params": { /* original request parameters */ }
}
```

---

## Performance Considerations

### Connection Pool

- **Single Connection**: Backend uses 1 connection to prevent WASM conflicts
- **Pre-initialization**: Schema, markets, and securities loaded on startup
- **Shared State**: All clients share cached data for efficiency
- **Enhanced Pool**: Uses CaitlynConnectionPool with conservative configuration
- **Automatic Data Delivery**: Schema, markets, and securities sent immediately on WebSocket connection

### Data Limits

- **Record Limit**: Historical queries limited to 100 records per request
- **Field Limit**: Maximum 20 fields per request to prevent crashes
- **Timeout**: 30-second timeout for historical data requests

### Caching Strategy

- **Schema**: Cached permanently until restart
- **Markets**: Cached permanently until restart  
- **Securities**: Cached permanently until restart
- **Futures Data**: Cached permanently until restart
- **Historical Data**: Not cached (real-time requests)
- **Global Cached Seeds**: Shared across all client connections

---

## Integration Examples

### React Frontend Example

```javascript
// WebSocket connection
const ws = new WebSocket('ws://localhost:4000');

// Handle connection and automatic data delivery
ws.onopen = () => {
  console.log('Connected to backend');
  // Backend automatically sends schema, markets, and securities data
};

// Request historical data using the enhanced API
ws.send(JSON.stringify({
  type: 'fetch_by_code',
  market: 'DCE',
  code: 'i<00>',
  fromTime: Math.floor(Date.now() / 1000) - 86400,
  toTime: Math.floor(Date.now() / 1000),
  granularity: 3600,
  fields: ['open', 'close', 'high', 'low', 'volume'],
  metaName: 'SampleQuote',
  namespace: 'global',
  revision: -1
}));

// Handle all message types
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'connection_status':
      console.log('Connection status:', data.status, data.message);
      break;
      
    case 'schema_received':
      console.log('Schema loaded:', data.data);
      break;
      
    case 'markets_received':
      console.log('Markets loaded:', data.data);
      break;
      
    case 'securities_received':
      console.log('Securities loaded:', data.data);
      break;
      
    case 'fetch_by_code_response':
      if (data.success) {
        console.log('Historical data:', data.data.records);
        console.log('Query params:', data.queryParams);
      } else {
        console.error('Error:', data.error);
      }
      break;
      
    case 'subscription_confirmed':
      console.log('Subscription established:', data.subscriberId);
      console.log('Subscription info:', data.subscriptionInfo);
      break;
      
    case 'subscription_error':
      console.error('Subscription error:', data.error);
      break;
      
    case 'real_time_data':
      console.log('Real-time data received:', data.data);
      console.log('From subscriber:', data.subscriberId);
      break;
      
    case 'unsubscription_confirmed':
      console.log('Unsubscribed successfully:', data.subscriberId);
      break;
      
    case 'subscription_stats':
      console.log('Subscription statistics:', data.data);
      break;
      
    default:
      console.log('Received message:', data.type, data);
  }
};

// Subscribe to real-time data
ws.send(JSON.stringify({
  type: 'subscribe',
  markets: ['ICE', 'DCE'],
  codes: ['B<00>', 'i<00>'],
  qualifiedNames: ['SampleQuote'],
  namespace: 'global',
  options: {
    granularities: [86400],
    fields: ['bid', 'ask', 'last', 'volume']
  },
  requestId: 'sub_' + Date.now()
}));

// Get subscription statistics
ws.send(JSON.stringify({
  type: 'get_subscription_stats',
  requestId: 'stats_' + Date.now()
}));

// Handle connection errors
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket connection closed');
};
```

### REST API Example

```javascript
// Fetch available markets
const marketsResponse = await fetch('http://localhost:4000/api/futures/markets');
const markets = await marketsResponse.json();
console.log('Available markets:', markets);

// Get securities for a specific market
const securitiesResponse = await fetch(`http://localhost:4000/api/futures/${markets[0]}`);
const securities = await securitiesResponse.json();
console.log('Securities for market:', securities);

// Search for specific contracts with pagination
const searchResponse = await fetch('http://localhost:4000/api/futures/search?pattern=iron&market=DCE&limit=10&offset=0');
const searchResults = await searchResponse.json();
console.log('Search results:', searchResults);

// Search across all markets
const allMarketsSearch = await fetch('http://localhost:4000/api/futures/search?pattern=copper&limit=20');
const allResults = await allMarketsSearch.json();
console.log('Cross-market search:', allResults);
```

---

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if backend is running on port 4000
   - Verify no firewall blocking connections

2. **No Schema Data**
   - Backend may still be initializing
   - Check backend logs for Caitlyn connection status

3. **Historical Data Timeout**
   - Reduce time range or field count
   - Check Caitlyn server connectivity

4. **Empty Response**
   - Verify market/code combination exists
   - Check time range is valid

### Debug Endpoints

- `GET /api/health` - Check backend status
- `GET /api/schema` - Verify schema loaded
- WebSocket message `get_client_info` - Check client status

---

This API reference provides comprehensive coverage of the Mini Wolverine backend API for frontend integration. The backend handles all WASM operations and Caitlyn server communication, providing a clean REST and WebSocket API for the React frontend.
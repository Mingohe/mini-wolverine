# Wolverine Rails Backend Integration Guide

## Overview

This document describes the integration between the Mini Wolverine Node.js backend and the Wolverine Rails backend system for formula management and user account data.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend Vue Application (Port 3000)                            │
│ - Formula Management UI                                         │
│ - User Formula Browser                                          │
│ - Formula Editor                                                │
└─────────────────────────────────────────────────────────────────┘
                              │ WebSocket/REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Node.js Backend (Port 4000)                                     │
│ ├── CaitlynWebSocketService (Existing)                          │
│ │   └── Real-time market data from Caitlyn server              │
│ └── CaitlynBackendService (NEW)                                 │
│     └── Formula management via Rails backend                    │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Wolverine Rails Backend (v1/rails/)                             │
│ ├── API Controller                                              │
│ │   └── cmd_ar_query_formula                                   │
│ │   └── cmd_ar_save_formula                                    │
│ │   └── cmd_ar_delete_formula                                  │
│ └── TimeMachine::Formula Model                                  │
│     └── MySQL Database                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Rails Backend API Reference

### Base URL

The Rails backend is typically deployed at:
- **Development**: `http://localhost:3001` (Rails default port)
- **Production**: To be configured via environment variable

### Authentication

All API endpoints (except login/register) require token-based authentication:

**Headers:**
```http
Content-Type: application/json
```

**Query Parameters:**
```
token=<user_token>
```

The Rails backend uses a `check_token_filter` before action that validates the token:
- Checks if token exists in `tokens` table
- Verifies token hasn't expired (`expired_at > DateTime.now`)
- Sets `User.current` for the request context

**Response on Invalid Token:**
```json
{
  "status": 1,
  "error_msg": "Invalid token or token expired",
  "error_code": 2147483647
}
```

**Note:** The error field is `error_code` (not `err_code`) in the standard response format.

### API Endpoint: Query Formulas

**Endpoint:** `POST /api/cmd_ar_query_formula`

**Description:** Query formulas accessible to the current user (owned or shared).

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | User authentication token |
| `language_id` | integer | No | Filter by programming language (see Language IDs below) |
| `pattern` | string | No | Search pattern for formula name (SQL LIKE search) |
| `private_only` | integer | No | 0=all formulas, 1=only private/shared formulas |

**Language IDs:**
- `0`: Python (or other language)
- `5`: Formula DSL (Domain Specific Language for indicators)
- Other values may exist for different programming languages

**Request Example:**
```http
POST /api/cmd_ar_query_formula?token=abc123
Content-Type: application/json

{
  "language_id": 1,
  "pattern": "momentum",
  "private_only": 1
}
```

**Response Schema:**
```json
{
  "status": 0,
  "error_msg": "",
  "error_code": 0,
  "formulas": [
    {
      "id": 123,
      "user_id": 456,
      "language_id": 1,
      "name": "momentum_strategy",
      "property": "{\"description\":\"Momentum trading strategy\"}",
      "source_code": "def calculate_momentum(...):\n    ...",
      "is_lib": 0,
      "updated_at": "2024-10-15T10:30:00.000Z",
      "created_at": "2024-01-01T08:00:00.000Z",
      "share_opts": {
        "all": false,
        "user_ids": [789, 101]
      }
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | integer | 0=success, 1=error |
| `error_msg` | string | Error message (empty on success) |
| `error_code` | integer | Error code (0 on success) |
| `formulas` | array | Array of formula objects |

**Formula Object Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Formula unique identifier |
| `user_id` | integer | Owner user ID |
| `language_id` | integer | Programming language ID |
| `name` | string | Formula name |
| `property` | string | JSON string with metadata (description, tags, etc.) |
| `source_code` | string | Formula source code |
| `is_lib` | integer | Whether this is a library formula (0=no, 1=yes) |
| `updated_at` | datetime | Last update timestamp |
| `created_at` | datetime | Creation timestamp |
| `share_opts` | object/null | Sharing configuration |

**Share Options Structure:**
```json
{
  "all": false,           // Share with all users
  "user_ids": [1, 2, 3]  // Share with specific user IDs
}
```

**Access Control Logic:**

When `private_only=1`, the API filters formulas based on:
1. **Owned formulas**: `user_id == User.current.id`
2. **Shared with all**: `share_opts.all == true`
3. **Shared with user**: `User.current.id` in `share_opts.user_ids`

### API Endpoint: Save Formula

**Endpoint:** `POST /api/cmd_ar_save_formula`

**Description:** Create new formula or update existing formula.

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | User authentication token |
| `id` | integer | No | Formula ID (omit for new formula) |
| `name` | string | Yes | Formula name |
| `source_code` | string | Yes | Formula source code |
| `language_id` | integer | Yes | Programming language ID |
| `user_id` | integer | No | Owner user ID (defaults to current user) |

**Validation Rules:**
- Formula name cannot contain: `builtin`, `built-in`, or `built_in`
- Only formula owner can update existing formula

**Request Example:**
```http
POST /api/cmd_ar_save_formula?token=abc123
Content-Type: application/json

{
  "name": "my_new_strategy",
  "source_code": "def calculate():\n    return True",
  "language_id": 1
}
```

**Response:**
```json
{
  "status": 0,
  "formula": {
    "id": 124,
    "name": "my_new_strategy",
    "user_id": 456,
    "language_id": 1,
    "source_code": "def calculate():\n    return True",
    "created_at": "2024-10-15T10:45:00.000Z",
    "updated_at": "2024-10-15T10:45:00.000Z"
  }
}
```

### API Endpoint: Delete Formula

**Endpoint:** `POST /api/cmd_ar_delete_formula`

**Description:** Delete user's formula.

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | User authentication token |
| `id` | integer | Yes | Formula ID to delete |

**Access Control:**
- Only formula owner can delete
- Returns error if formula doesn't exist or unauthorized

**Request Example:**
```http
POST /api/cmd_ar_delete_formula?token=abc123
Content-Type: application/json

{
  "id": 124
}
```

**Response:**
```json
{
  "status": 0,
  "message": "Formula deleted successfully"
}
```

## Database Schema

### TimeMachine::Formula Model

**Table:** `time_machine_formulas`

**Columns:**

| Column | Type | Null | Description |
|--------|------|------|-------------|
| `id` | integer | No | Primary key |
| `user_id` | integer | No | Owner user ID |
| `language_id` | integer | No | Programming language |
| `name` | string | No | Formula name |
| `property` | text | Yes | JSON metadata |
| `source_code` | text | No | Formula code |
| `is_lib` | boolean | No | Library flag |
| `share_opts` | text | Yes | JSON sharing config |
| `status` | integer | No | Status flag |
| `created_at` | datetime | No | Creation time |
| `updated_at` | datetime | No | Update time |

**Indexes:**
- Primary key on `id`
- Index on `user_id`
- Index on `language_id`
- Index on `name`

## Implementation Plan

### Phase 1: Backend Service Creation

**File:** `backend/src/services/CaitlynBackendService.js`

**Responsibilities:**
1. HTTP client for Rails API communication
2. Token management and authentication
3. Request/response handling
4. Error handling and retries
5. Response caching (optional)

**Key Methods:**
```javascript
class CaitlynBackendService {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl
    this.token = token  // Same token used for Caitlyn server
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  async queryFormulas({ languageId, pattern, privateOnly }) {
    // POST /api/cmd_ar_query_formula?token=xxx
    const params = { token: this.token }
    const data = { language_id: languageId, pattern, private_only: privateOnly }
    const response = await this.axios.post('/api/cmd_ar_query_formula', data, { params })
    return this.handleResponse(response)
  }

  async saveFormula({ id, name, sourceCode, languageId }) {
    // POST /api/cmd_ar_save_formula?token=xxx
    const params = { token: this.token }
    const data = { id, name, source_code: sourceCode, language_id: languageId }
    const response = await this.axios.post('/api/cmd_ar_save_formula', data, { params })
    return this.handleResponse(response)
  }

  async deleteFormula(id) {
    // POST /api/cmd_ar_delete_formula?token=xxx
    const params = { token: this.token }
    const data = { id }
    const response = await this.axios.post('/api/cmd_ar_delete_formula', data, { params })
    return this.handleResponse(response)
  }

  handleResponse(response) {
    const { status, error_msg, error_code, ...data } = response.data
    if (status !== 0) {
      throw new Error(`Rails API Error: ${error_msg} (code: ${error_code})`)
    }
    return data
  }
}

// Usage in server.js:
const caitlynBackendService = new CaitlynBackendService(
  process.env.RAILS_API_URL || 'http://localhost:3001',
  process.env.CAITLYN_TOKEN  // Same token as Caitlyn server
)
```

### Phase 2: Backend API Endpoints

**File:** `backend/src/server.js`

Add new REST API endpoints:

```javascript
// Formula management endpoints
app.post('/api/formulas/query', async (req, res) => {
  const { languageId, pattern, privateOnly } = req.body
  const result = await caitlynBackendService.queryFormulas({
    languageId,
    pattern,
    privateOnly
  })
  res.json(result)
})

app.post('/api/formulas/save', async (req, res) => {
  const { id, name, sourceCode, languageId } = req.body
  const result = await caitlynBackendService.saveFormula({
    id,
    name,
    sourceCode,
    languageId
  })
  res.json(result)
})

app.post('/api/formulas/delete', async (req, res) => {
  const { id } = req.body
  const result = await caitlynBackendService.deleteFormula(id)
  res.json(result)
})
```

### Phase 3: Frontend Integration

**File:** `frontend-vue/src/services/formulaService.ts`

Create formula service for API communication:

```typescript
export class FormulaService {
  private wsStore: WebSocketStore

  async queryFormulas(options: {
    languageId?: number
    pattern?: string
    privateOnly?: boolean
  }): Promise<Formula[]> {
    // Send request via WebSocket or REST
  }

  async saveFormula(formula: FormulaData): Promise<Formula> {
    // Save formula
  }

  async deleteFormula(id: number): Promise<void> {
    // Delete formula
  }
}
```

**File:** `frontend-vue/src/stores/formulaStore.ts`

Create Pinia store for formula state management:

```typescript
export const useFormulaStore = defineStore('formula', () => {
  const formulas = ref<Formula[]>([])
  const loading = ref(false)
  const selectedFormula = ref<Formula | null>(null)

  async function loadFormulas(filters?: FormulaFilters) {
    // Load formulas from backend
  }

  async function saveFormula(formula: FormulaData) {
    // Save formula
  }

  async function deleteFormula(id: number) {
    // Delete formula
  }

  return {
    formulas,
    loading,
    selectedFormula,
    loadFormulas,
    saveFormula,
    deleteFormula
  }
})
```

### Phase 4: UI Components

**Component Structure:**
```
frontend-vue/src/components/formula/
├── FormulaList.vue           # Formula list with search/filter
├── FormulaEditor.vue         # Code editor for formula editing
├── FormulaDetails.vue        # Formula metadata display
└── FormulaToolbar.vue        # Actions (save, delete, share)
```

**Features:**
- Formula browser with search and filters
- Syntax-highlighted code editor (Monaco Editor or CodeMirror)
- Formula metadata editor (name, description, tags)
- Save/delete/share operations
- User formula vs shared formula indicators

## Configuration

### Environment Variables

**Backend (.env):**
```bash
# Rails backend connection
RAILS_API_URL=http://localhost:3001
# Note: RAILS_API_TOKEN is NOT stored in .env for security reasons
# It is passed as runtime environment variable (same token as Caitlyn server)
```

**Runtime Environment Variables:**

When starting the Node.js backend, pass the token as environment variable:

```bash
# Development
CAITLYN_TOKEN=your-user-token-here npm run dev

# Production
CAITLYN_TOKEN=your-user-token-here node backend/src/server.js
```

**Important Security Notes:**
1. **Single Token**: The same token is used for both Caitlyn Server and Rails Backend
2. **Runtime Only**: Token is passed at startup, never stored in `.env` files
3. **No Git Commit**: Ensure tokens are never committed to version control
4. **Environment Variable**: Access via `process.env.CAITLYN_TOKEN` in code

**Frontend (.env):**
```bash
# Formula management
VITE_ENABLE_FORMULA_MANAGEMENT=true
VITE_FORMULA_EDITOR_THEME=vs-dark
```

## Error Handling

### Common Error Codes

| Status | Error Code | Description | Action |
|--------|------------|-------------|--------|
| 1 | 2147483647 | Invalid or expired token | Re-authenticate user |
| 1 | 0x1001 | Invalid formula name | Show validation error |
| 1 | 0x1002 | Unauthorized access | Show permission error |
| 1 | 0x1003 | Formula not found | Refresh formula list |

### Error Response Format

```json
{
  "status": 1,
  "error_msg": "Human-readable error message",
  "error_code": 123456
}
```

**Standard Response Fields:**
- `status`: Integer (0=success, 1=error)
- `error_msg`: String (error message, empty on success)
- `error_code`: Integer (error code, 0 on success)
- `<data_field>`: Object/Array (the actual data, e.g., `formulas`, `formula`)

### Retry Strategy

- **Connection errors**: Retry up to 3 times with exponential backoff
- **Authentication errors**: Trigger re-login flow
- **Server errors (5xx)**: Retry once after 5 seconds
- **Client errors (4xx)**: No retry, show error to user

## Security Considerations

1. **Token Storage**: Store Rails token securely in backend environment variables
2. **Token Expiration**: Implement token refresh mechanism
3. **HTTPS**: Use HTTPS in production for Rails API communication
4. **Input Validation**: Validate all user inputs before sending to Rails API
5. **Rate Limiting**: Implement rate limiting for API requests
6. **Error Messages**: Don't expose internal system details in error messages

## Testing Strategy

### Unit Tests

**Backend Service Tests:**
```javascript
describe('CaitlynBackendService', () => {
  test('queryFormulas returns formula list', async () => {
    // Test formula query
  })

  test('saveFormula creates new formula', async () => {
    // Test formula creation
  })

  test('deleteFormula removes formula', async () => {
    // Test formula deletion
  })
})
```

### Integration Tests

**Backend API Tests:**
```javascript
describe('Formula API Endpoints', () => {
  test('POST /api/formulas/query returns formulas', async () => {
    // Test API endpoint
  })

  test('POST /api/formulas/save creates formula', async () => {
    // Test API endpoint
  })
})
```

### E2E Tests

**Frontend Flow Tests:**
```typescript
describe('Formula Management', () => {
  test('User can browse formulas', async () => {
    // Test formula browsing
  })

  test('User can create new formula', async () => {
    // Test formula creation
  })

  test('User can edit existing formula', async () => {
    // Test formula editing
  })
})
```

## Performance Optimization

1. **Caching**: Cache formula list for 5 minutes to reduce API calls
2. **Pagination**: Implement pagination for large formula lists
3. **Lazy Loading**: Load formula source code only when needed
4. **Debouncing**: Debounce search input to reduce API calls
5. **Compression**: Enable gzip compression for API responses

## Monitoring and Logging

### Backend Logging

```javascript
// Log all Rails API requests
logger.info('Rails API Request', {
  endpoint: '/api/cmd_ar_query_formula',
  params: { languageId, pattern },
  userId: currentUserId,
  timestamp: Date.now()
})

// Log API errors
logger.error('Rails API Error', {
  endpoint: '/api/cmd_ar_query_formula',
  error: error.message,
  statusCode: error.response?.status,
  timestamp: Date.now()
})
```

### Frontend Logging

```typescript
// Log formula operations
console.log('[FormulaStore] Loading formulas', filters)
console.log('[FormulaStore] Formula saved successfully', formula.id)
console.error('[FormulaStore] Failed to load formulas', error)
```

## Future Enhancements

1. **Formula Versioning**: Track formula changes and allow rollback
2. **Formula Testing**: Integrated backtesting for formulas
3. **Collaborative Editing**: Real-time collaboration on formulas
4. **Formula Marketplace**: Share and discover community formulas
5. **Formula Analytics**: Track formula usage and performance
6. **AI Code Suggestions**: AI-powered code completion for formulas

## References

- Rails Backend Source: `v1/rails/`
- API Controller: `v1/rails/app/controllers/api_controller.rb`
- Formula Model: `v1/rails/app/models/time_machine/formula.rb`
- Authentication Helper: `v1/rails/app/helpers/api_helper.rb`

---

**Document Version:** 1.0
**Last Updated:** 2024-10-15
**Author:** Mini Wolverine Development Team

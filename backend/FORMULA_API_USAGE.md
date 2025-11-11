# Formula Management API Usage Guide

## Overview

The backend now integrates with the Caitlyn Rails backend to provide formula management capabilities. This allows querying, creating, updating, and deleting user formulas.

## Backend Service

### CaitlynBackendService

Located at: `backend/src/services/CaitlynBackendService.js`

**Features:**
- Query formulas with filters (language, pattern, private/public)
- Save formulas (create or update)
- Delete formulas
- Health check for Rails backend connectivity

**Authentication:**
Uses the same `CAITLYN_TOKEN` as the Caitlyn WebSocket service.

## API Endpoints

### 1. Query Formulas

**Endpoint:** `POST /api/formulas/query`

**Request Body:**
```json
{
  "languageId": 5,        // Optional: Filter by language (0=Python, 5=DSL)
  "pattern": "prediction", // Optional: Search pattern for formula name
  "privateOnly": 1        // Optional: 0=all, 1=only private/shared
}
```

**Response:**
```json
{
  "success": true,
  "formulas": [
    {
      "id": 123,
      "user_id": 10006,
      "language_id": 5,
      "name": "prediction_forestyck002",
      "property": "{\"add_to_main\":true}",
      "source_code": "xref: prices = 'dce/i<00>/BlackForestYCK003/forecasts';\n...",
      "is_lib": 0,
      "updated_at": "2025-09-26T02:45:58.000Z",
      "created_at": "2025-07-10T03:29:11.000Z",
      "share_opts": null
    }
  ],
  "count": 1
}
```

### 2. Save Formula

**Endpoint:** `POST /api/formulas/save`

**Request Body:**
```json
{
  "id": 123,              // Optional: Omit for new formula
  "name": "my_formula",
  "sourceCode": "xref: a = 'market/code/meta/field';\nline: a, colorred;",
  "languageId": 5,
  "userId": 10006         // Optional: Defaults to current user
}
```

**Response:**
```json
{
  "success": true,
  "formula": {
    "id": 123,
    "name": "my_formula",
    "language_id": 5,
    "source_code": "...",
    "created_at": "2025-10-15T10:00:00.000Z",
    "updated_at": "2025-10-15T10:00:00.000Z"
  },
  "message": "Formula created successfully"
}
```

### 3. Delete Formula

**Endpoint:** `POST /api/formulas/delete`

**Request Body:**
```json
{
  "id": 123
}
```

**Response:**
```json
{
  "success": true,
  "message": "Formula deleted successfully"
}
```

### 4. Health Check

**Endpoint:** `GET /api/formulas/health`

**Response:**
```json
{
  "healthy": true,
  "message": "Rails backend is healthy"
}
```

## Testing

### Run Test Suite

```bash
# Test CaitlynBackendService directly
CAITLYN_TOKEN=your-token node backend/test-caitlyn-backend-service.js
```

**Test Coverage:**
- ✅ Health check
- ✅ Query all formulas
- ✅ Query private formulas
- ✅ Query by language ID
- ✅ Search by pattern
- ✅ Combined filters

### Test with cURL

```bash
# Query formulas
curl -X POST http://localhost:4000/api/formulas/query \
  -H "Content-Type: application/json" \
  -d '{"privateOnly": 1, "languageId": 5}'

# Health check
curl http://localhost:4000/api/formulas/health
```

## Environment Variables

```bash
# Required for both services
CAITLYN_TOKEN=your-authentication-token

# Optional: Rails backend URL (default: http://localhost:3001)
RAILS_API_URL=http://localhost:3001
```

**Important:** Token is passed at runtime, NOT stored in `.env`:

```bash
CAITLYN_TOKEN=your-token npm run dev
```

## Language IDs

| ID | Language |
|----|----------|
| 0  | Python or other |
| 5  | Formula DSL (Domain Specific Language) |

## Error Handling

### Service Not Available (503)
```json
{
  "error": "Formula service not available",
  "message": "CaitlynBackendService not initialized"
}
```

**Cause:** `CAITLYN_TOKEN` not provided at startup.

### Validation Error (400)
```json
{
  "error": "Missing required fields",
  "message": "name, sourceCode, and languageId are required"
}
```

**Cause:** Missing required fields in request.

### Rails API Error (500)
```json
{
  "error": "Failed to query formulas",
  "message": "Rails API Error: Invalid token or token expired (code: 2147483647)"
}
```

**Cause:** Invalid or expired token, or Rails backend error.

## Integration with Frontend

### Example: Query Formulas from Vue Frontend

```typescript
// frontend-vue/src/services/formulaService.ts
export async function queryFormulas(filters: {
  languageId?: number
  pattern?: string
  privateOnly?: number
}) {
  const response = await fetch('http://localhost:4000/api/formulas/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters)
  })

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.message)
  }

  return result.formulas
}
```

## Next Steps

1. ✅ Backend service implemented
2. ✅ API endpoints added to server.js
3. ✅ Test suite created
4. ⏳ Frontend integration (Vue service + store)
5. ⏳ UI components (formula browser, editor)

## References

- Full documentation: [docs/WOLVERINE_RAILS_INTEGRATION.md](../docs/WOLVERINE_RAILS_INTEGRATION.md)
- Rails API controller: `v1/rails/app/controllers/api_controller.rb`
- Formula model: `v1/rails/app/models/time_machine/formula.rb`

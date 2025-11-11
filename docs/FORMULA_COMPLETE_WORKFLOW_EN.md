# Formula Complete Workflow Documentation

## Overview

This document provides a detailed description of the complete workflow for formulas in the Mini Wolverine system, including three core steps: registration, calculation, and real-time subscription. This documentation is based on the latest code implementation, integrating the complete processes of data display and subscription management.

## Core Concepts

### Key Field Descriptions

1. **formula.id**: Original formula ID (may be negative, e.g., -222, -333, -111)
2. **formula.uuid**: Unique identifier returned by Caitlyn Server after formula registration, used for subsequent calculations and subscriptions
3. **subscriberId**: Subscription ID returned by backend after subscription request, used to identify push data and cancel subscriptions

### Data Flow

```
Formula Registration (REG) → Get formula.uuid → Execute Calculation (CAL) → Subscribe Real-time Data (SUBSCRIBE) → Get subscriberId → Receive Real-time Push
```

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Frontend (Vue/TypeScript)                                                    │
│                                                                              │
│  FormulaViewer.vue                                                           │
│  ├── registerFormula()          - Register formula to get UUID               │
│  ├── executeFormula()            - Execute formula to get historical data    │
│  ├── subscribeToRealTimeData()   - Subscribe to real-time data push          │
│  └── handleFormulaPushData()     - Handle real-time push data (minute-level  │
│                                    deduplication)                            │
│                                                                              │
│  formulaSubscriptionService.ts                                               │
│  ├── subscribe()                 - Subscription management (with UUID mapping)│
│  ├── unsubscribe()               - Cancel subscription                       │
│  └── handleWebSocketPushData()   - Route push data to callbacks              │
│                                                                              │
│  websocketTaskService.ts                                                     │
│  └── sendTask()                  - WebSocket request/response matching       │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ WebSocket over HTTP
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│ Backend (Node.js + Express)                                                  │
│                                                                              │
│  server.js (WebSocket Message Router)                                        │
│  ├── register_formula            - Forward formula registration request      │
│  ├── execute_formula             - Combined registration + calculation       │
│  ├── calculate_formula           - Standalone calculation request            │
│  ├── subscribe                   - Subscription management (Hub dedup)       │
│  └── unsubscribe                 - Cancel subscription                       │
│                                                                              │
│  CaitlynWebSocketService.js                                                  │
│  ├── registerFormula()           - Formula registration service              │
│  ├── calculateFormula()          - Formula calculation service               │
│  └── subscribeHub()              - Hub subscription (auto dedup & broadcast) │
│                                                                              │
│  CaitlynClientConnection.js (WASM Integration)                               │
│  ├── registerFormula()           - ATRegFormulaReq/Res handling              │
│  ├── calculateFormula()          - ATCalFormulaReq/Res handling              │
│  └── subscribe()                 - ATSubscribeReq/Res handling               │
│                                                                              │
│  CaitlynSubscriptionHub.js                                                   │
│  ├── subscribe()                 - Subscription deduplication & management   │
│  ├── unsubscribe()               - Subscription cleanup                      │
│  └── broadcast()                 - Real-time data broadcasting               │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ Binary Protocol (WASM)
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│ Caitlyn Server                                                               │
│                                                                              │
│  CMD_AT_REG_FORMULA              - Formula registration command              │
│  CMD_AT_CAL_FORMULA              - Formula calculation command               │
│  CMD_AT_SUBSCRIBE                - Subscription command                      │
│  CMD_AT_UNSUBSCRIBE              - Unsubscription command                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Complete Workflow Details

### Step 1: Formula Registration (CMD_AT_REG_FORMULA)

#### 1.1 Frontend Initiates Registration Request

**Location**: `frontend-vue/src/components/FormulaViewer.vue`

**Trigger Timing**:
- Automatic registration when user selects a formula
- Batch registration of all formulas during system initialization

**Request Parameters**:
```typescript
{
  type: "register_formula",
  formulaId: formula.id,           // Formula ID (e.g., -222, -333, -111)
  sourceCode: formula.source_code, // Formula source code
  languageId: formula.language_id, // Language ID (typically 5)
  requestId: `reg_${Date.now()}_${randomString()}`
}
```

**Example Formula Data**:
```javascript
const mockFormulas = [
  {
    id: -222,
    name: 'builtin-macd',
    type: 'Technical Indicator',
    language_id: 5,
    source_code: `macd: macd(close, 12, 26, 9), colorff9c00, linethick1;
macd_diff: macd(close, 12, 26, 9), color0000ff, linethick1;
macd_dea: macd(close, 12, 26, 9), colorF23456, linethick1;`,
    description: 'MACD Technical Indicator'
  }
]
```

#### 1.2 Backend Processes Registration Request

**Location**: `backend/src/server.js` (Line 820-854)

**Processing Flow**:
```javascript
case 'register_formula':
  try {
    const { formulaId, sourceCode, languageId = 5 } = data;

    logger.info(`🧮 Registering formula: ${formulaId} (language: ${languageId})`);

    // Check if connection pool is ready
    if (!caitlynService.connectionPool) {
      ws.send(JSON.stringify({
        type: 'register_formula_response',
        success: false,
        error: 'Connection pool not initialized',
        requestId: data.requestId
      }));
      break;
    }

    // Call registration service
    const result = await caitlynService.registerFormula(formulaId, sourceCode, languageId);

    ws.send(JSON.stringify({
      type: 'register_formula_response',
      success: true,
      data: result,
      requestId: data.requestId
    }));
  } catch (error) {
    logger.error('Error in register_formula:', error);
    ws.send(JSON.stringify({
      type: 'register_formula_response',
      success: false,
      error: error.message,
      requestId: data.requestId
    }));
  }
  break;
```

#### 1.3 WASM Layer Registration Processing

**Location**: `backend/src/utils/CaitlynClientConnection.js` (Line 2510-2560)

**Key Implementation**:
```javascript
async registerFormula(formulaId, sourceCode, languageId) {
  return new Promise((resolve, reject) => {
    const requestId = this.getNextSeq();

    // Create registration request
    const regReq = new this.wasmModule.ATRegFormulaReq();
    regReq.token = this.token;              // CRITICAL: Set token for authentication
    regReq.ID = String(formulaId);          // Formula ID
    regReq.languageID = parseInt(languageId); // Language ID
    regReq.sourceCode = sourceCode;         // Formula source code
    regReq.seq = parseInt(requestId);       // Request sequence number

    // Encode and send request
    const encodedRequest = regReq.encode();
    this.sendRequest(this.wasmModule.CMD_AT_REG_FORMULA, encodedRequest, requestId)
      .then((response) => {
        // Decode response
        const regRes = new this.wasmModule.ATRegFormulaRes();
        regRes.decode(response);

        if (regRes.errorCode === 0) {
          this.logger.info(`✅ Formula ${formulaId} registered with UUID: ${regRes.UUID}`);
          resolve({
            success: true,
            uuid: regRes.UUID,        // Return UUID
            formulaId: formulaId
          });
        } else {
          reject(new Error(`Registration failed with error code: ${regRes.errorCode}`));
        }

        // Cleanup WASM objects
        regReq.delete();
        regRes.delete();
      })
      .catch(reject);
  });
}
```

#### 1.4 Frontend Receives Registration Response

**Response Format**:
```javascript
{
  type: 'register_formula_response',
  success: true,
  data: {
    uuid: 'generated-uuid-string',  // UUID generated by Caitlyn Server
    formulaId: -222
  },
  requestId: 'reg_1234567890_abc'
}
```

**Frontend Processing**:
```javascript
// FormulaViewer.vue - Save UUID to formula object
if (response.success && response.data?.uuid) {
  selectedFormula.value.uuid = response.data.uuid;
  console.log(`✅ Formula registered with UUID: ${response.data.uuid}`);
}
```

### Step 2: Formula Calculation (CMD_AT_CAL_FORMULA)

#### 2.1 Frontend Initiates Calculation Request

**Location**: `frontend-vue/src/components/FormulaViewer.vue`

**Trigger Timing**:
- User clicks "Execute Formula" button
- After configuring formula, time range, and target instrument

**Request Parameters**:
```typescript
{
  type: "execute_formula",
  market: selectedFutures.value.market,      // Market code (e.g., "SHFE")
  code: selectedFutures.value.code,          // Contract code (e.g., "rb2501")
  fromTime: fromTimestamp,                   // Start timestamp (seconds)
  toTime: toTimestamp,                       // End timestamp (seconds)
  granularity: selectedGranularity.value,    // Time granularity (seconds)
  formulaCode: formulaCode.value,            // Formula source code
  formulaName: selectedFormula.value.name,   // Formula name
  formulaId: selectedFormula.value.id,       // Formula ID
  enableSubscription: enableSubscription.value, // Enable real-time subscription
  requestId: `exec_${Date.now()}_${randomString()}`
}
```

#### 2.2 Backend Processes Calculation Request

**Location**: `backend/src/server.js` (Line 856-900)

**Processing Flow** (Combined Registration + Calculation):
```javascript
case 'execute_formula':
  try {
    const { market, code, fromTime, toTime, granularity, formulaCode, formulaName, formulaId } = data;

    logger.info(`🧮 Executing formula: ${formulaName} (ID: ${formulaId}) for ${market}/${code}`);

    // Check connection pool
    if (!caitlynService.connectionPool) {
      ws.send(JSON.stringify({
        type: 'formula_execution_response',
        success: false,
        error: 'Connection pool not initialized',
        requestId: data.requestId
      }));
      break;
    }

    // Step 1: Register formula to get UUID
    const registerResult = await caitlynService.registerFormula(formulaId, formulaCode, 5);

    if (!registerResult.success) {
      ws.send(JSON.stringify({
        type: 'formula_execution_response',
        success: false,
        error: 'Formula registration failed',
        requestId: data.requestId
      }));
      break;
    }

    // Step 2: Calculate formula using UUID
    const result = await caitlynService.calculateFormula(
      registerResult.uuid,
      market,
      code,
      fromTime,
      toTime,
      granularity
    );

    // Return result (including UUID)
    ws.send(JSON.stringify({
      type: 'formula_execution_response',
      success: true,
      uuid: registerResult.uuid,  // Return UUID for subscription
      data: result.data,
      requestId: data.requestId
    }));
  } catch (error) {
    logger.error('Error in execute_formula:', error);
    ws.send(JSON.stringify({
      type: 'formula_execution_response',
      success: false,
      error: error.message,
      requestId: data.requestId
    }));
  }
  break;
```

#### 2.3 WASM Layer Calculation Processing

**Location**: `backend/src/utils/CaitlynClientConnection.js` (Line 2590-2670)

**Key Implementation**:
```javascript
async calculateFormula(uuid, market, code, beginTime, endTime, granularity, sourcecode = '') {
  return new Promise((resolve, reject) => {
    const requestId = this.getNextSeq();

    // Create calculation request
    const calReq = new this.wasmModule.ATCalFormulaReq();
    calReq.token = this.token;              // CRITICAL: Set token
    calReq.UUID = uuid;                     // Use UUID from registration
    calReq.market = market;
    calReq.seq = parseInt(requestId);

    // Set contract code (using StringVector)
    const codesVector = new this.wasmModule.StringVector();
    codesVector.push_back(code);
    calReq.codes = codesVector;

    calReq.granularity = granularity;
    calReq.beginTime = String(beginTime);
    calReq.endTime = String(endTime);
    calReq.isRealTime = 1;                  // Enable real-time mode

    // Encode and send request
    const encodedRequest = calReq.encode();
    this.sendRequest(this.wasmModule.CMD_AT_CAL_FORMULA, encodedRequest, requestId)
      .then((calRes) => {
        if (calRes.errorCode === 0) {
          this.logger.info(`✅ Formula calculation completed for ${market}/${code}`);
          const results = this.processFormulaCalculationResults(calRes, sourcecode);
          resolve({
            success: true,
            data: results,
            message: 'Formula calculation completed successfully'
          });
        } else {
          reject(new Error(`Calculation failed with error code: ${calRes.errorCode}`));
        }

        // Cleanup WASM objects
        calReq.delete();
        calRes.delete();
        codesVector.delete();
      })
      .catch(reject);
  });
}
```

#### 2.4 Calculation Result Response

**Response Format**:
```javascript
{
  type: 'formula_execution_response',
  success: true,
  uuid: 'registered-formula-uuid',    // Formula UUID (for subscription)
  data: {
    records: [
      {
        timestamp: 1704067200000,     // Millisecond timestamp
        time_tag: 1704067200000,
        fields: {
          macd: 12.34,
          macd_diff: 5.67,
          macd_dea: 8.90
        }
      },
      // ... more records
    ],
    displayConfiguration: {           // Display configuration
      lines: [
        { name: 'macd', color: '#ff9c00', thickness: 1 },
        { name: 'macd_diff', color: '#0000ff', thickness: 1 },
        { name: 'macd_dea', color: '#F23456', thickness: 1 }
      ]
    },
    metadata: {                       // Metadata
      formulaId: -222,
      market: 'SHFE',
      code: 'rb2501'
    }
  },
  requestId: 'exec_1234567890_abc'
}
```

#### 2.5 Frontend Processes Calculation Result

**Location**: `frontend-vue/src/components/FormulaViewer.vue` (Line 820-855)

```javascript
// Process formula execution response
if (newMessage.type === 'formula_execution_response') {
  if (newMessage.success && newMessage.data) {
    const responseData = newMessage.data;

    // Save formula UUID (for subsequent subscription)
    if (newMessage.uuid) {
      selectedFormula.value.uuid = newMessage.uuid;
      formulaUuid = newMessage.uuid;
    }

    // Process data records
    const processedData = responseData.records?.map((record, index) => ({
      ...record,
      ...record.fields,              // Flatten fields
      row_id: index + 1,
      timestamp: new Date(parseInt(record.timestamp)).toISOString()
    })) || [];

    // Save metadata and display configuration
    if (responseData.metadata) {
      formulaMetadata.value = responseData.metadata;
    }

    formulaData.value = processedData;
    resultFields.value = processedData.length > 0 ?
      Object.keys(processedData[0]).filter(key =>
        key !== 'timestamp' && key !== 'row_id' && key !== 'time_tag'
      ) : [];

    // If subscription is enabled, automatically start real-time subscription
    if (enableSubscription.value) {
      await subscribeToRealTimeData();
    }
  }
}
```

### Step 3: Real-time Data Subscription (CMD_AT_SUBSCRIBE)

#### 3.1 Frontend Initiates Subscription Request

**Location**: `frontend-vue/src/components/FormulaViewer.vue` (Line 857-907)

**Trigger Timing**:
- Automatic subscription after successful formula execution (if enabled)
- User checks "Enable Real-time Subscription"

**Subscription Parameters**:
```typescript
const config: FormulaSubscriptionConfig = {
  formulaId: selectedFormula.value.id,
  formulaName: selectedFormula.value.name,
  formulaCode: formulaCode.value,
  market: selectedFutures.value.market,
  code: selectedFutures.value.code,
  granularity: 0,                         // Real-time subscription fixed at 0
  languageId: selectedFormula.value.language_id || 5,
  registeredUuid: selectedFormula.value.uuid  // Use UUID from registration
};

// Subscribe via formulaSubscriptionService
const subscriptionId = await formulaSubscriptionService.subscribe(config, dataCallback);
```

#### 3.2 Subscription Service Processing

**Location**: `frontend-vue/src/services/formulaSubscriptionService.ts` (Line 120-210)

**Key Implementation**:
```typescript
async subscribe(config: FormulaSubscriptionConfig, callback?: (data: any) => void): Promise<string> {
  const requestId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const { registeredUuid } = config;

  // Check if formula is registered
  if (!registeredUuid) {
    throw new Error('Formula must be registered first');
  }

  // Create subscription info (temporarily stored under requestId)
  const subscriptionInfo: FormulaSubscriptionInfo = {
    uuid: requestId,
    config: { ...config, registeredUuid },
    status: 'pending',
    createdAt: new Date(),
    dataCount: 0
  };

  this.subscriptions.value.set(requestId, subscriptionInfo);
  this.realTimeData.value.set(requestId, []);

  // Register callback
  if (callback) {
    this.callbacks.set(requestId, callback);
  }

  try {
    // Send subscription request
    const subscribeResponse = await websocketTaskService.sendTask({
      type: "subscribe",
      markets: ["STRATEGY"],                    // Hardcoded
      codes: [registeredUuid],                  // Use formula UUID
      qualifiedNames: ["Formula::Data"],        // Hardcoded (with namespace prefix)
      options: {
        granularities: [config.granularity],    // Real-time subscription is 0
        fields: ["formula_res"],                // Formula result field
        start: 0,                               // Hardcoded
        end: 50,                                // Hardcoded
        sort: [],                               // Hardcoded
        direction: [],                          // Hardcoded
        filters: []                             // Hardcoded
      }
    }, {
      timeout: 10000,
      retries: 0,
      retryDelay: 1000
    });

    // After subscription confirmation, move all data from requestId to subscriberId
    if (subscribeResponse.type === 'subscription_confirmed' || subscribeResponse.success) {
      const subscribeUuid = subscribeResponse.subscriberId || subscribeResponse.data?.uuid;

      if (subscribeUuid) {
        subscriptionInfo.status = 'active';
        subscriptionInfo.uuid = subscribeUuid;
        subscriptionInfo.subscriberId = subscribeUuid;

        // Move subscription from requestId to subscriberId
        this.subscriptions.value.delete(requestId);
        this.subscriptions.value.set(subscribeUuid, subscriptionInfo);

        // Also move realTimeData to new key
        const existingData = this.realTimeData.value.get(requestId) || [];
        this.realTimeData.value.delete(requestId);
        this.realTimeData.value.set(subscribeUuid, existingData);

        // Move callback to new key
        if (callback) {
          this.callbacks.delete(requestId);
          this.callbacks.set(subscribeUuid, callback);
        }

        console.log(`✅ Formula subscription confirmed: ${subscribeUuid}`);
        return subscribeUuid;
      } else {
        throw new Error('No subscription UUID returned');
      }
    } else {
      throw new Error(subscribeResponse.error || 'Subscription failed');
    }
  } catch (error) {
    // Subscription failed, cleanup resources
    this.subscriptions.value.delete(requestId);
    this.realTimeData.value.delete(requestId);
    this.callbacks.delete(requestId);
    throw error;
  }
}
```

#### 3.3 Backend Subscription Processing

**Location**: `backend/src/server.js` (Line 935-1000)

**Processing Flow**:
```javascript
case 'subscribe':
  try {
    const { markets, codes, qualifiedNames, options = {} } = data;

    logger.info(`📡 [SERVER] Subscription request received:`);
    logger.info(`   📊 Markets: ${markets.join(',')}`);
    logger.info(`   🏷️ Codes: ${codes.join(',')}`);
    logger.info(`   🧬 Qualified Names: ${qualifiedNames.join(',')}`);

    if (!clientHandler.isConnected) {
      ws.send(JSON.stringify({
        type: 'subscription_error',
        error: 'Not connected to Caitlyn server',
        requestId: data.requestId
      }));
      break;
    }

    // Use Hub for subscription (auto deduplication and broadcast)
    const subscriberId = await clientHandler.subscribeHub(
      markets,
      codes,
      qualifiedNames,
      (realTimeData) => {
        // Broadcast real-time data to frontend
        ws.send(JSON.stringify({
          type: 'real_time_data',
          data: realTimeData,
          subscriberId: subscriberId,         // Subscription ID
          requestId: data.requestId,
          timestamp: new Date().toISOString()
        }));
      },
      options
    );

    logger.info(`✅ Subscription established with ID: ${subscriberId}`);

    // Send subscription confirmation
    ws.send(JSON.stringify({
      type: 'subscription_confirmed',
      subscriberId: subscriberId,
      message: 'Real-time subscription established successfully',
      requestId: data.requestId,
      subscriptionInfo: {
        markets: markets,
        codes: codes,
        qualifiedNames: qualifiedNames,
        options: options
      }
    }));
  } catch (error) {
    logger.error('Error in subscription:', error);
    ws.send(JSON.stringify({
      type: 'subscription_error',
      error: error.message,
      requestId: data.requestId
    }));
  }
  break;
```

#### 3.4 Subscription Confirmation Response

**Response Format**:
```javascript
{
  type: 'subscription_confirmed',
  subscriberId: 'sub_1234567890_abcdef',  // Subscription ID generated by backend
  message: 'Real-time subscription established successfully',
  requestId: 'sub_1234567890_xyz',
  subscriptionInfo: {
    markets: ["STRATEGY"],
    codes: ["registered-formula-uuid"],
    qualifiedNames: ["Formula::Data"],
    options: {
      granularities: [0],
      fields: ["formula_res"],
      start: 0,
      end: 50,
      sort: [],
      direction: [],
      filters: []
    }
  }
}
```

### Step 4: Real-time Push Data Processing

#### 4.1 Push Data Format

**Data Pushed from Backend**:
```javascript
{
  type: 'real_time_data',
  subscriberId: 'sub_1234567890_abcdef',  // Subscription ID
  data: {
    rawData: {
      data: [
        {
          time_tag: 1704067200000,          // Millisecond timestamp
          fields: {
            macd: 13.45,
            macd_diff: 6.78,
            macd_dea: 9.01
          }
        }
      ],
      displayConfiguration: {               // Optional: Display configuration update
        lines: [...]
      }
    }
  },
  timestamp: '2024-01-01T00:00:00.000Z',
  requestId: 'sub_1234567890_xyz'
}
```

#### 4.2 Subscription Service Routes Push Data

**Location**: `frontend-vue/src/services/formulaSubscriptionService.ts` (Line 505-530)

```typescript
// WebSocket message handling
case 'real_time_data':
  // subscriberId is at top level
  if (lastMessage.subscriberId && lastMessage.data) {
    this.handleWebSocketPushData({
      subscriberId: lastMessage.subscriberId,
      data: lastMessage.data,
      timestamp: lastMessage.data.timestamp || lastMessage.timestamp
    });
  }
  break;

// Handle push data
handleWebSocketPushData(pushData: FormulaPushData): void {
  const { subscriberId, data } = pushData;

  // Find corresponding subscription
  const subscription = this.subscriptions.value.get(subscriberId);
  if (!subscription) {
    // Silently ignore (might be another service's subscription)
    return;
  }

  // Store real-time data
  const existingData = this.realTimeData.value.get(subscriberId) || [];
  this.realTimeData.value.set(subscriberId, [...existingData, data]);

  // Call callback function
  const callback = this.callbacks.get(subscriberId);
  if (callback) {
    callback(data);
  }
}
```

#### 4.3 Frontend Processes Push Data (Minute-level Deduplication)

**Location**: `frontend-vue/src/components/FormulaViewer.vue` (Line 909-1010)

**Key Implementation**:
```typescript
const handleFormulaPushData = (data: any) => {
  console.log("📡 Formula push data received:", data);

  // Parse push data
  let recordsToProcess: any[] = [];

  if (Array.isArray(data)) {
    recordsToProcess = data;
  } else if (data.rawData?.data && Array.isArray(data.rawData.data)) {
    recordsToProcess = data.rawData.data;

    // Update display configuration
    if (data.rawData.displayConfiguration) {
      displayConfiguration.value = data.rawData.displayConfiguration;
    }
  } else if (data.data && Array.isArray(data.data)) {
    recordsToProcess = data.data;
  }

  if (recordsToProcess.length === 0) {
    console.warn("⚠️ No valid records in push data");
    return;
  }

  // Process real-time data records
  const newData = recordsToProcess.map((record: any, index: number) => ({
    ...record,
    ...record.fields,                       // Flatten fields
    row_id: index + 1,                      // Temporary ID
    timestamp: record.timestamp ?
      new Date(parseInt(record.timestamp)).toISOString() :
      new Date().toISOString(),
    time_tag: record.time_tag
  }));

  // Minute-level deduplication logic
  const normalizeToMinute = (timeTag: number) => {
    return Math.floor(timeTag / 60000) * 60000;  // Normalize to minute
  };

  const updatedData = [...formulaData.value];

  for (const newRecord of newData) {
    const newTimeMinute = normalizeToMinute(newRecord.time_tag);
    const existingIndex = updatedData.findIndex(existing => {
      const existingTimeMinute = normalizeToMinute(existing.time_tag);
      return existingTimeMinute === newTimeMinute;
    });

    if (existingIndex !== -1) {
      // Overwrite old data in same minute
      updatedData[existingIndex] = { ...newRecord };
      console.log(`🔄 Updated record at minute ${new Date(newTimeMinute).toISOString()}`);
    } else {
      // Add new data to beginning
      updatedData.unshift(newRecord);
      console.log(`➕ Added new record at minute ${new Date(newTimeMinute).toISOString()}`);
    }
  }

  // Reassign row_id
  formulaData.value = updatedData.map((record, index) => ({
    ...record,
    row_id: index + 1
  }));

  console.log(`✅ Formula data updated, total records: ${formulaData.value.length}`);
};
```

### Step 5: Cancel Subscription (CMD_AT_UNSUBSCRIBE)

#### 5.1 Frontend Initiates Unsubscription Request

**Location**: `frontend-vue/src/components/FormulaViewer.vue` (Line 1013-1050)

```typescript
const unsubscribe = async () => {
  if (!subscriberId.value) {
    console.warn("⚠️ No active subscription to cancel");
    return;
  }

  try {
    const currentSubscriptionId = subscriberId.value;
    console.log("📞 Calling unsubscribe with ID:", currentSubscriptionId);

    const success = await formulaSubscriptionService.unsubscribe(currentSubscriptionId);

    if (success) {
      isSubscribed.value = false;
      subscriberId.value = null;
      enableSubscription.value = false;
      console.log("✅ Formula subscription cancelled successfully");
    } else {
      console.error("❌ Formula unsubscription failed");
    }
  } catch (error) {
    console.error("❌ Formula unsubscription error:", error);
  }
};
```

#### 5.2 Subscription Service Processes Unsubscription

**Location**: `frontend-vue/src/services/formulaSubscriptionService.ts` (Line 244-300)

```typescript
async unsubscribe(subscriptionId: string): Promise<boolean> {
  // Find subscription using subscriberId
  const subscription = this.subscriptions.value.get(subscriptionId);
  if (!subscription) {
    console.warn(`⚠️ Formula subscription not found: ${subscriptionId}`);
    return false;
  }

  if (subscription.status === 'cancelled') {
    console.log(`ℹ️ Formula subscription already cancelled: ${subscriptionId}`);
    return true;
  }

  console.log(`⏹️ Cancelling formula subscription: ${subscriptionId}`);

  // Cleanup callbacks
  this.callbacks.delete(subscriptionId);
  this.callbacks.delete(subscription.subscriberId || '');

  try {
    // Send unsubscription request
    const response = await websocketTaskService.sendTask({
      type: 'unsubscribe',
      subscriberId: subscription.subscriberId || subscriptionId
    }, {
      timeout: 5000,
      retries: 1,
      retryDelay: 1000
    });

    // Check response
    if (response.type === 'unsubscription_confirmed' || response.success) {
      subscription.status = 'cancelled';
      console.log(`✅ Formula unsubscription confirmed: ${subscriptionId}`);
      return true;
    } else {
      console.error(`❌ Formula unsubscription failed: ${subscriptionId}`, response.error);
      return false;
    }
  } catch (error) {
    console.error(`❌ Formula unsubscription error: ${subscriptionId}`, error);
    subscription.status = 'cancelled';  // Mark as cancelled even on error
    return false;
  }
}
```

#### 5.3 Backend Processes Unsubscription

**Location**: `backend/src/server.js` (Line 1002-1030)

```javascript
case 'unsubscribe':
  try {
    const { subscriberId } = data;

    logger.info(`⏹️ [SERVER] Unsubscribe request for: ${subscriberId}`);

    if (!clientHandler.isConnected) {
      ws.send(JSON.stringify({
        type: 'unsubscription_error',
        error: 'Not connected to Caitlyn server',
        requestId: data.requestId
      }));
      break;
    }

    // Use Hub to cancel subscription
    const result = await clientHandler.unsubscribeHub(subscriberId);

    logger.info(`✅ Unsubscription successful: ${subscriberId}`);

    ws.send(JSON.stringify({
      type: 'unsubscription_confirmed',
      subscriberId: subscriberId,
      message: 'Subscription cancelled successfully',
      requestId: data.requestId
    }));
  } catch (error) {
    logger.error('Error in unsubscribe:', error);
    ws.send(JSON.stringify({
      type: 'unsubscription_error',
      error: error.message,
      subscriberId: data.subscriberId,
      requestId: data.requestId
    }));
  }
  break;
```

#### 5.4 Unsubscription Confirmation Response

**Response Format**:
```javascript
{
  type: 'unsubscription_confirmed',
  subscriberId: 'sub_1234567890_abcdef',
  message: 'Subscription cancelled successfully',
  requestId: 'unsub_1234567890_xyz'
}
```

## Key Technical Points

### 1. Token Authentication

**CRITICAL**: All Caitlyn Server requests must include the token field for authentication.

```javascript
// Formula registration
regReq.token = this.token;  // Must be set

// Formula calculation
calReq.token = this.token;  // Must be set
```

### 2. UUID Mapping Management

The entire workflow involves conversion of three types of IDs:

1. **requestId**: Temporary request ID generated by frontend (for request/response matching)
2. **formula.uuid**: Formula UUID returned by Caitlyn Server (for calculation and subscription)
3. **subscriberId**: Subscription ID generated by backend (for push data identification and unsubscription)

**Mapping Flow**:
```
requestId (temporary) → formula.uuid (after registration) → subscriberId (after subscription)
     ↓                         ↓                                ↓
Store subscription info   Use for calculation request    Use for push data matching
  (subscription)              (calculate)                  (real_time_data)
```

### 3. Subscription Key Migration

After subscription confirmation, all related data must be migrated from `requestId` to `subscriberId`:

```typescript
// Migrate subscription
this.subscriptions.value.delete(requestId);
this.subscriptions.value.set(subscriberId, subscriptionInfo);

// Migrate realTimeData
const existingData = this.realTimeData.value.get(requestId) || [];
this.realTimeData.value.delete(requestId);
this.realTimeData.value.set(subscriberId, existingData);

// Migrate callback
this.callbacks.delete(requestId);
this.callbacks.set(subscriberId, callback);
```

### 4. Hardcoded Subscription Parameters

Formula subscription uses fixed parameters (cannot be modified):

```typescript
{
  markets: ["STRATEGY"],              // Fixed as STRATEGY
  codes: [formula.uuid],              // Use formula UUID
  qualifiedNames: ["Formula::Data"],  // Fixed as Formula::Data
  options: {
    granularities: [0],               // Real-time subscription fixed at 0
    fields: ["formula_res"],          // Fixed as formula_res
    start: 0,                         // Fixed pagination parameter
    end: 50,                          // Fixed pagination parameter
    sort: [],                         // Empty array
    direction: [],                    // Empty array
    filters: []                       // Empty array
  }
}
```

### 5. Minute-level Data Deduplication

Real-time push data is deduplicated at minute granularity to avoid duplicate data within the same minute:

```typescript
const normalizeToMinute = (timeTag: number) => {
  return Math.floor(timeTag / 60000) * 60000;  // Normalize to minute
};

// Find same-minute data
const existingIndex = updatedData.findIndex(existing => {
  const existingTimeMinute = normalizeToMinute(existing.time_tag);
  return existingTimeMinute === newTimeMinute;
});

if (existingIndex !== -1) {
  // Overwrite old data
  updatedData[existingIndex] = { ...newRecord };
} else {
  // Add new data to beginning
  updatedData.unshift(newRecord);
}
```

### 6. WASM Object Lifecycle Management

All WASM objects must be deleted after use to prevent memory leaks:

```javascript
// Create objects
const regReq = new this.wasmModule.ATRegFormulaReq();
const regRes = new this.wasmModule.ATRegFormulaRes();
const codesVector = new this.wasmModule.StringVector();

try {
  // Use objects...
} finally {
  // Must delete
  regReq.delete();
  regRes.delete();
  codesVector.delete();
}
```

## Error Handling

### Common Error Types

1. **Formula Syntax Error**
   ```javascript
   {
     type: 'register_formula_response',
     success: false,
     error: 'Formula syntax error, compilation failed'
   }
   ```

2. **Calculation Timeout**
   ```javascript
   {
     type: 'formula_execution_response',
     success: false,
     error: 'Formula calculation timeout'
   }
   ```

3. **Subscription Failure**
   ```javascript
   {
     type: 'subscription_error',
     error: 'Not connected to Caitlyn server'
   }
   ```

4. **Unregistered Formula Subscription**
   ```javascript
   {
     error: 'Formula must be registered first. Please register the formula before subscribing.'
   }
   ```

### Error Handling Strategy

1. **Registration Phase**: Display syntax errors, allow users to modify code
2. **Calculation Phase**: Display calculation errors, check parameter configuration
3. **Subscription Phase**: Retry or fallback to non-real-time mode
4. **Push Phase**: Log errors, continue processing other data

## Lifecycle Management

### Component Initialization Flow

```
1. Load formula list
2. User selects formula
3. Automatically register formula (if not registered)
4. Configure parameters (market, contract, time range)
5. Execute calculation to get historical data
6. (Optional) Enable real-time subscription
7. Receive real-time push data
```

### Component Destruction Flow

```
1. Cancel all active subscriptions
2. Cleanup callback functions
3. Cleanup subscription data
4. Cleanup WASM objects
```

**Implementation Code**:
```typescript
onBeforeUnmount(async () => {
  // Cleanup all formula subscriptions
  try {
    await formulaSubscriptionService.unsubscribeAllFormulas();
  } catch (error) {
    console.error("Error cleaning up formula subscriptions:", error);
  }
});
```

## Related File Index

### Frontend Files
- `frontend-vue/src/components/FormulaViewer.vue` - Main UI component
- `frontend-vue/src/services/formulaSubscriptionService.ts` - Subscription management service
- `frontend-vue/src/services/websocketTaskService.ts` - WebSocket task service
- `frontend-vue/src/stores/websocketStore.ts` - WebSocket state management

### Backend Files
- `backend/src/server.js` - WebSocket message router
- `backend/src/services/CaitlynWebSocketService.js` - Caitlyn service wrapper
- `backend/src/utils/CaitlynClientConnection.js` - Caitlyn client connection (WASM integration)
- `backend/src/utils/CaitlynSubscriptionHub.js` - Subscription Hub (dedup & broadcast)

### Documentation Files
- `docs/CAITLYN_JS_API.md` - Caitlyn JS API documentation
- `docs/BACKEND_API_REFERENCE.md` - Backend API reference
- `docs/SVOBJECT_BEST_PRACTICES.md` - SVObject best practices

## Testing Points

### Functional Testing

1. **Registration Flow**: Verify formula registration and UUID acquisition
2. **Execution Flow**: Verify formula execution and initial data retrieval
3. **Subscription Flow**: Verify subscription request and subscription ID acquisition
4. **Push Flow**: Verify real-time data push and parsing
5. **Cancel Subscription**: Verify subscription cancellation and resource cleanup
6. **Minute Deduplication**: Verify same-minute data overwrite logic

### Error Testing

1. **Unregistered Subscription**: Verify unregistered formula cannot subscribe
2. **Network Exception**: Verify disconnect/reconnect mechanism
3. **Data Exception**: Verify handling of malformed data
4. **Concurrent Subscriptions**: Verify isolation of multiple subscriptions

## Important Notes

1. **UUID Management**: Ensure correct setup and usage of `formula.uuid` and `subscriberId`
2. **Token Authentication**: All Caitlyn requests must include token field
3. **Hardcoded Parameters**: Hardcoded parameters during subscription cannot be modified arbitrarily
4. **Sequence Dependency**: Must register first to get UUID before calculation and subscription
5. **Resource Cleanup**: Must cancel all subscriptions and cleanup WASM objects when component is destroyed
6. **Key Migration**: Must migrate data from requestId to subscriberId after subscription confirmation
7. **Minute Deduplication**: Real-time push deduplicated at minute granularity, overwriting old values
8. **Response Format**: Unsubscription response uses `type === 'unsubscription_confirmed'` instead of `success` field

## Future Optimization Directions

1. **Caching Mechanism**: Cache registration results to avoid duplicate registration
2. **Batch Operations**: Support batch registration and subscription of multiple formulas
3. **Performance Optimization**: Optimize rendering performance for large amounts of data
4. **Monitoring Statistics**: Add subscription status monitoring and performance statistics
5. **Error Recovery**: Enhance automatic retry mechanism for network exceptions
6. **Data Persistence**: Support local caching of historical data

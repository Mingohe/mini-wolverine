import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import CaitlynWebSocketService from './services/CaitlynWebSocketService.js';
import logger from './utils/logger.js';

dotenv.config();

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize services with enhanced connection pool configuration

// Connection pool configuration - Enhanced with memory leak fixes
const poolConfig = {
  poolSize: 1, 
  maxPoolSize: 1,
  connectionTimeout: parseInt(process.env.CAITLYN_CONNECTION_TIMEOUT) || 60000,
  reconnectDelay: parseInt(process.env.CAITLYN_RECONNECT_DELAY) || 5000,
  maxReconnectAttempts: parseInt(process.env.CAITLYN_MAX_RECONNECT_ATTEMPTS) || 2
};

const caitlynService = new CaitlynWebSocketService(poolConfig);

// Helper function to generate mock historical data for fetch_by_code requests
function generateMockHistoricalData(market, code, fromTime, toTime, granularity, fields = []) {
  const interval = granularity * 1000; // granularity is in seconds
  const mockRecords = [];
  
  let currentTime = fromTime * 1000; // Convert to milliseconds
  const endTime = toTime * 1000;
  let basePrice = 3000 + Math.random() * 200;
  
  // Create field definitions from provided fields
  const fieldDefs = fields.map(fieldName => ({ name: fieldName, type: 'number' }));
  
  while (currentTime <= endTime && mockRecords.length < 100) {
    const record = {};
    
    // Generate data for each requested field
    fieldDefs.forEach(field => {
      const fieldName = field.name;
      const lowerFieldName = fieldName.toLowerCase();
      
      // Generate realistic data based on field patterns
      if (lowerFieldName.includes('price') || lowerFieldName.includes('close') || lowerFieldName.includes('open')) {
        record[fieldName] = parseFloat((basePrice + (Math.random() - 0.5) * 50).toFixed(4));
      } else if (lowerFieldName.includes('high')) {
        record[fieldName] = parseFloat((basePrice + Math.random() * 25).toFixed(4));
      } else if (lowerFieldName.includes('low')) {
        record[fieldName] = parseFloat((basePrice - Math.random() * 25).toFixed(4));
      } else if (lowerFieldName.includes('volume')) {
        record[fieldName] = Math.floor(Math.random() * 50000) + 5000;
      } else if (lowerFieldName.includes('forecast')) {
        record[fieldName] = parseFloat((Math.random() * 100).toFixed(4));
      } else if (lowerFieldName.includes('confidence')) {
        record[fieldName] = parseFloat((Math.random() * 1).toFixed(4));
      } else {
        // Generic numeric data
        record[fieldName] = parseFloat((Math.random() * 1000).toFixed(4));
      }
    });
    
    // Always include basic identifiers
    record.timestamp = currentTime / 1000; // Convert back to seconds
    record.datetime = new Date(currentTime).toISOString();
    record.market = market;
    record.code = code;
    
    mockRecords.push(record);
    
    currentTime += interval;
    basePrice += (Math.random() - 0.5) * 2; // Slight drift
  }
  
  return {
    records: mockRecords,
    totalCount: mockRecords.length,
    processingTime: new Date().toISOString(),
    source: 'backend_mock_data',
    fieldCount: fieldDefs.length,
    message: `Generated ${mockRecords.length} mock records for ${market}/${code}`
  };
}

// Helper function to generate mock historical data on server side
function generateServerMockData(params) {
  const { market, code, metaID, namespace, metaName, granularity, startTime, endTime, fieldIndices } = params;
  const interval = granularity * 60 * 1000; // Convert minutes to milliseconds
  const mockRecords = [];
  
  let currentTime = startTime;
  let basePrice = 3000 + Math.random() * 200;
  
  // Get schema for proper field definitions
  const schema = caitlynService.getSharedSchema();
  let fieldDefs = [];
  
  if (schema && schema[namespace] && schema[namespace][metaID]) {
    const meta = schema[namespace][metaID];
    fieldDefs = fieldIndices ? fieldIndices.map(idx => meta.fields[idx]).filter(Boolean) : meta.fields || [];
    
    // Safety limit: prevent too many fields from being processed
    if (fieldDefs.length > 20) {
      logger.warn(`Too many fields (${fieldDefs.length}), limiting to first 20`);
      fieldDefs = fieldDefs.slice(0, 20);
    }
  }
  
  while (currentTime <= endTime && mockRecords.length < 100) { // Reduced limit to prevent frontend crash
    const record = {};
    
    // Generate data for each field definition
    fieldDefs.forEach((field, index) => {
      const fieldName = field.name || `field_${index}`;
      const lowerFieldName = fieldName.toLowerCase();
      
      // Generate realistic data based on field patterns
      if (lowerFieldName.includes('time') || lowerFieldName.includes('date')) {
        record[fieldName] = currentTime;
      } else if (lowerFieldName.includes('price') || lowerFieldName.includes('close') || lowerFieldName.includes('open')) {
        record[fieldName] = parseFloat((basePrice + (Math.random() - 0.5) * 50).toFixed(2));
      } else if (lowerFieldName.includes('high')) {
        record[fieldName] = parseFloat((basePrice + Math.random() * 25).toFixed(2));
      } else if (lowerFieldName.includes('low')) {
        record[fieldName] = parseFloat((basePrice - Math.random() * 25).toFixed(2));
      } else if (lowerFieldName.includes('volume')) {
        record[fieldName] = Math.floor(Math.random() * 50000) + 5000;
      } else if (lowerFieldName.includes('turnover') || lowerFieldName.includes('amount')) {
        record[fieldName] = parseFloat((basePrice * (Math.random() * 2000 + 1000)).toFixed(2));
      } else if (lowerFieldName.includes('code') || lowerFieldName.includes('symbol')) {
        record[fieldName] = `${code || 'SYM'}_${Math.floor(Math.random() * 100)}`;
      } else if (lowerFieldName.includes('name')) {
        record[fieldName] = `${fieldName}_${Math.floor(Math.random() * 1000)}`;
      } else {
        // Generic field data
        const fieldType = typeof field.type === 'string' ? field.type.toLowerCase() : 'unknown';
        
        if (fieldType.includes('vector') || fieldType.includes('array')) {
          // Generate array data
          const arraySize = Math.floor(Math.random() * 3) + 1;
          record[fieldName] = Array.from({ length: arraySize }, (_, i) => 
            lowerFieldName.includes('price') ? parseFloat((basePrice + i * 10).toFixed(2)) :
            lowerFieldName.includes('code') ? `${code}_${i + 1}` :
            `${fieldName}_Item_${i + 1}`
          );
        } else if (fieldType.includes('string')) {
          record[fieldName] = `${fieldName}_${Math.floor(Math.random() * 1000)}`;
        } else if (fieldType.includes('int') || fieldType.includes('number')) {
          record[fieldName] = Math.floor(Math.random() * 1000);
        } else {
          record[fieldName] = parseFloat((Math.random() * 100).toFixed(2));
        }
      }
    });
    
    // Always include basic identifiers
    record.timestamp = currentTime;
    record.datetime = new Date(currentTime).toISOString();
    record.market = market;
    record.code = code;
    
    mockRecords.push(record);
    
    currentTime += interval;
    basePrice += (Math.random() - 0.5) * 2; // Slight drift
  }
  
  return {
    records: mockRecords,
    totalCount: mockRecords.length,
    processingTime: new Date().toISOString(),
    source: 'backend_mock_data',
    fieldCount: fieldDefs.length
  };
}

// REST API Routes
app.get('/api/health', (req, res) => {
  try {
    // Get comprehensive health status including memory and pool diagnostics
    const healthStatus = caitlynService.getHealthStatus();

    // Determine overall status
    let overallStatus = 'healthy';
    if (healthStatus.pool && healthStatus.pool.totalConnections === 0) {
      overallStatus = 'degraded';
    }
    if (!healthStatus.service.isPoolInitialized) {
      overallStatus = 'initializing';
    }

    res.json({
      status: overallStatus,
      ...healthStatus,
      poolConfig: caitlynService.poolConfig,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/schema', async (req, res) => {
  const schema = caitlynService.getSharedSchema();
  res.json(schema || {});
});

app.get('/api/markets', async (req, res) => {
  const markets = caitlynService.getSharedMarkets();
  res.json(markets || {});
});

app.get('/api/securities', async (req, res) => {
  const securities = caitlynService.getSharedSecurities();
  res.json(securities || {});
});

// New API endpoints for historical data querying by code

app.get('/api/futures', async (req, res) => {
  const futures = caitlynService.getSharedFutures();
  res.json(futures || []);
});

app.get('/api/futures/markets', async (req, res) => {
  // Get actual market names from markets data (from universe revision)
  const marketsData = caitlynService.getSharedMarkets();
  if (marketsData && marketsData.global) {
    // Return array of market names from the global markets data
    const marketNames = Object.keys(marketsData.global);
    res.json(marketNames);
  } else {
    // Fallback to futures index if markets data not available
    const markets = Object.keys(caitlynService.getSharedMarkets()?.global || {});
    res.json(markets);
  }
});

// 新的综合搜索端点：支持pattern搜索和market搜索
// 注意：这个路由必须在 /api/futures/:market 之前定义，否则会被误匹配
app.get('/api/futures/search', async (req, res) => {
  try {
    logger.info('🔍 /api/futures/search endpoint called');
    const { pattern, market, limit = 10, offset = 0 } = req.query;
    logger.info('📊 Search parameters:', { pattern, market, limit, offset });
    
    // 直接从futures数组中获取数据
    const futures = caitlynService.getSharedFutures();
    logger.info('📈 Futures data available:', !!futures, futures?.length || 0);
    
    if (!futures || futures.length === 0) {
      return res.json({
        success: false,
        message: 'No futures data available',
        data: [],
        total: 0,
        markets: []
      });
    }

    let results = [];
    
    // 获取所有可用的市场列表
    const availableMarkets = [...new Set(futures.map(f => f.market))];

    // 如果指定了market参数，只搜索该市场
    if (market) {
      if (!availableMarkets.includes(market)) {
        return res.json({
          success: false,
          message: `Market '${market}' not found`,
          data: [],
          total: 0,
          markets: availableMarkets
        });
      }
      
      results = futures.filter(f => f.market === market);
      
      // 如果同时提供了pattern，进行过滤
      if (pattern) {
        const searchPattern = pattern.toLowerCase();
        results = results.filter(f => 
          f.code?.toLowerCase().includes(searchPattern) || 
          f.name?.toLowerCase().includes(searchPattern) ||
          f.abbreviation?.toLowerCase().includes(searchPattern)
        );
      }
    } else {
      // 如果没有指定market，搜索所有市场
      if (pattern) {
        const searchPattern = pattern.toLowerCase();
        results = futures.filter(f => 
          f.code?.toLowerCase().includes(searchPattern) || 
          f.name?.toLowerCase().includes(searchPattern) ||
          f.abbreviation?.toLowerCase().includes(searchPattern)
        );
      } else {
        // 如果没有pattern也没有market，返回所有数据
        results = futures;
      }
    }

    // 应用分页
    const total = results.length;
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = results.slice(startIndex, endIndex);

    // 统计每个市场的结果数量
    const marketStats = {};
    if (pattern) {
      const searchPattern = pattern.toLowerCase();
      for (const marketKey of availableMarkets) {
        const marketResults = futures.filter(f => 
          f.market === marketKey && (
            f.code?.toLowerCase().includes(searchPattern) || 
            f.name?.toLowerCase().includes(searchPattern) ||
            f.abbreviation?.toLowerCase().includes(searchPattern)
          )
        );
        if (marketResults.length > 0) {
          marketStats[marketKey] = marketResults.length;
        }
      }
    } else {
      for (const marketKey of availableMarkets) {
        marketStats[marketKey] = futures.filter(f => f.market === marketKey).length;
      }
    }

    res.json({
      success: true,
      data: paginatedResults,
      total: total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: endIndex < total,
      markets: availableMarkets,
      marketStats: marketStats,
      searchParams: {
        pattern: pattern || null,
        market: market || null
      }
    });

  } catch (error) {
    logger.error('Error in futures search:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      data: [],
      total: 0
    });
  }
});

// 获取特定市场的期货数据
// 注意：这个路由必须在 /api/futures/search 之后定义，避免路由冲突
app.get('/api/futures/:market', async (req, res) => {
  const { market } = req.params;
  const futures = caitlynService.getSharedFutures();
  const marketFutures = futures ? futures.filter(f => f.market === market) : [];
  res.json(marketFutures);
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  logger.info('New WebSocket connection from frontend - using pre-initialized Caitlyn connection');
  
  // Create a client handler for this connection (uses pre-initialized shared pool)
  const clientHandler = caitlynService.createClientHandler(ws);
  
  // Set connection status to true since we're using pre-initialized pool
  clientHandler.isConnected = true;
  
  // Immediately notify frontend that connection is ready
  ws.send(JSON.stringify({
    type: 'connection_status',
    status: 'connected',
    message: 'Connected to pre-initialized Caitlyn server'
  }));
  
  // Send schema and markets data immediately if available
  const schema = caitlynService.getSharedSchema();
  const markets = caitlynService.getSharedMarkets();
  const securities = caitlynService.getSharedSecurities();
  
  if (schema && Object.keys(schema).length > 0) {
    ws.send(JSON.stringify({
      type: 'schema_received',
      data: schema,
      message: 'Schema available from pre-initialized backend'
    }));
  }
  
  if (markets && Object.keys(markets).length > 0) {
    ws.send(JSON.stringify({
      type: 'markets_received',
      data: markets,
      message: 'Markets data available from pre-initialized backend'
    }));
  }
  
  if (securities && Object.keys(securities).length > 0) {
    ws.send(JSON.stringify({
      type: 'securities_received',
      data: securities,
      message: 'Securities data available from pre-initialized backend'
    }));
  }
  
  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    logger.debug('Received message from frontend:', data.type);
    
    switch (data.type) {
      case 'connect':
        // Reconfiguration disabled - backend is pre-initialized
        logger.info('Frontend reconfiguration request ignored - backend uses pre-configured connection');
        ws.send(JSON.stringify({
          type: 'connection_status',
          status: 'connected',
          message: 'Using pre-configured Caitlyn connection (reconfiguration disabled)'
        }));
        break;
        
      case 'query_cached_seeds':
        // Query cached seeds with optional timestamp filter
        const seedCount = await clientHandler.queryCachedSeeds(data.sinceTimestamp || 0);
        logger.info(`Sent ${seedCount} cached seeds to frontend`);
        break;
        
      case 'disconnect':
        await clientHandler.disconnect();
        break;
        
      case 'request_historical':
        await clientHandler.requestHistoricalData(data.params);
        break;
        
      case 'query_historical_data':
        // Handle the frontend's historical data query request
        if (!clientHandler.isConnected) {
          ws.send(JSON.stringify({
            type: 'historical_data_response',
            success: false,
            error: 'Not connected to Caitlyn server. Please connect first.',
            requestId: data.requestId || Date.now()
          }));
          break;
        }
        
        try {
          const params = data.params;
          const { market, code, metaID, namespace, metaName, granularity, startTime, endTime, fields, fieldIndices } = params;
          
          logger.info(`Processing historical data request for ${market}/${code}, namespace: ${namespace}, metaID: ${metaID}`);
          
          // Historical data requests now handled by connection pool
          logger.info(`Preparing historical data request for ${market}/${code}`);
          
          // Send the request to Caitlyn server and process the response
          logger.info(`Sending historical data request to Caitlyn server: ${market}/${code}`);
          
          try {
            // Send the request to the actual Caitlyn server via the connection pool
            // This should trigger a CMD_AT_FETCH_BY_CODE request
            const activeConnection = caitlynService.sharedConnectionPool?.getAvailableConnection();
            
            if (!activeConnection) {
              throw new Error('No active connection to Caitlyn server available');
            }
            
            // Send the binary request to Caitlyn server
            logger.info(`Sending binary request buffer (${requestBuffer.byteLength} bytes) to Caitlyn server`);
            activeConnection.send(requestBuffer);
            
            // For now, we'll need to handle the response asynchronously
            // The actual response will come back through the WebSocket message handler
            // For testing purposes, return a placeholder response
            ws.send(JSON.stringify({
              type: 'historical_data_response',
              success: true,
              data: {
                records: [],
                totalCount: 0,
                source: 'caitlyn_server_request_sent',
                processingTime: new Date().toISOString(),
                note: 'Request sent to Caitlyn server - response handling needs implementation'
              },
              requestId: data.requestId || Date.now(),
              message: `Historical data request sent to Caitlyn server for ${market}/${code}`,
              params: {
                market,
                code,
                metaName,
                namespace,
                granularity,
                fieldCount: fields ? fields.length : 0,
                timeRange: `${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`
              }
            }));
            
          } catch (realDataError) {
            logger.error('Error sending request to Caitlyn server:', realDataError);
            ws.send(JSON.stringify({
              type: 'historical_data_response',
              success: false,
              error: `Failed to send request to Caitlyn server: ${realDataError.message}`,
              requestId: data.requestId || Date.now()
            }));
          }
          
        } catch (error) {
          logger.error('Error processing historical data request:', error);
          ws.send(JSON.stringify({
            type: 'historical_data_response',
            success: false,
            error: `Failed to process historical data request: ${error.message}`,
            requestId: data.requestId || Date.now()
          }));
        }
        break;
        
      case 'query_historical_by_code':
        // New endpoint for historical data queries by code
        if (!clientHandler.isConnected) {
          ws.send(JSON.stringify({
            type: 'historical_query_response',
            success: false,
            error: 'Not connected to Caitlyn server. Please connect first.'
          }));
          break;
        }
        
        const { market, code, metaID, granularity, startTime, endTime, namespace, qualifiedName, fields } = data.params;
        
        // Create historical data request using proper WASM API
        // Use connection pool to fetch historical data
        try {
          const result = await caitlynService.fetchHistoricalData(market, code, {
            namespace: namespace || 0,
            qualifiedName: qualifiedName || 'SampleQuote',
            granularity: granularity,
            startTime: startTime,
            endTime: endTime,
            fields: fields
          });
          
          // Send successful response with actual data
          ws.send(JSON.stringify({
            type: 'historical_query_response',
            success: true,
            message: `Historical data retrieved for ${market}/${code}`,
            data: result,
            requestId: Date.now(),
            params: {
              market,
              code,
              granularity,
              timeRange: `${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`
            }
          }));
        } catch (error) {
          logger.error(`Historical data fetch failed for ${market}/${code}:`, error);
          ws.send(JSON.stringify({
            type: 'historical_query_response',
            success: false,
            error: error.message,
            params: { market, code }
          }));
        }
        break;
        
      case 'get_schema':
        const schema = caitlynService.getSharedSchema();
        if (!schema || Object.keys(schema).length === 0) {
          ws.send(JSON.stringify({
            type: 'schema',
            schema: null,
            error: 'Schema not yet loaded. Backend may still be initializing universe data.'
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'schema_received',
            data: schema,
            message: 'Schema loaded from pre-initialized backend'
          }));
        }
        break;
        
      case 'get_client_info':
        // Send client information using shared global cache
        ws.send(JSON.stringify({
          type: 'client_info',
          clientId: clientHandler.clientId,
          assignedConnectionId: null, // No longer using assigned connections
          isConnected: clientHandler.isConnected,
          cachedSeedsCount: caitlynService.globalCachedSeeds?.size || 0
        }));
        break;
        
      case 'test_universe_revision':
        if (!clientHandler.isConnected) {
          ws.send(JSON.stringify({
            type: 'universe_revision',
            success: false,
            error: 'Not connected to Caitlyn server. Please connect first.'
          }));
          break;
        }
        const revisionResult = await clientHandler.testUniverseRevision();
        ws.send(JSON.stringify({
          type: 'universe_revision',
          success: revisionResult.success,
          marketsCount: revisionResult.marketsCount,
          globalMarkets: revisionResult.globalMarkets,
          privateMarkets: revisionResult.privateMarkets
        }));
        break;
        
      case 'test_universe_seeds':
        if (!clientHandler.isConnected) {
          ws.send(JSON.stringify({
            type: 'universe_seeds',
            success: false,
            error: 'Not connected to Caitlyn server. Please connect first.'
          }));
          break;
        }
        const seedsResult = await clientHandler.testUniverseSeeds();
        ws.send(JSON.stringify({
          type: 'universe_seeds',
          success: seedsResult.success,
          seedsReceived: seedsResult.seedsReceived,
          totalEntries: seedsResult.totalEntries
        }));
        break;
        
      case 'fetch_by_code':
        // Handle fetch by code request from SchemaViewer
        try {
          const { market, code, fromTime, toTime, granularity, fields, metaName, namespace, revision } = data;
          
          logger.info(`📊 Fetch by code request: ${market}/${code} from ${fromTime} to ${toTime}`);
          logger.info('🔍 RAW Frontend Parameters:');
          logger.info(`   market: "${market}" (type: ${typeof market})`);
          logger.info(`   code: "${code}" (type: ${typeof code})`);
          logger.info(`   fromTime: ${fromTime} (type: ${typeof fromTime})`);
          logger.info(`   toTime: ${toTime} (type: ${typeof toTime})`);
          logger.info(`   granularity: ${granularity} (type: ${typeof granularity})`);
          logger.info(`   fields: [${fields?.map(f => `"${f}"`).join(', ') || 'none'}] (${fields?.length || 0} total)`);
          logger.info(`   metaName: "${metaName}" (type: ${typeof metaName})`);
          logger.info(`   namespace: "${namespace}" (type: ${typeof namespace})`);
          logger.info(`   revision: ${revision} (type: ${typeof revision})`);
          
          // Use the same format as working test_connection.js
          // qualifiedName should be just the metaName (e.g., 'SampleQuote')
          // namespace should be the string format (e.g., 'global', 'private')
          const qualifiedName = metaName;
          const namespaceString = namespace === '0' ? 'global' : namespace === '1' ? 'private' : `namespace_${namespace}`;
          
          logger.info(`🏗️ Using test_connection.js format:`);
          logger.info(`   qualifiedName: "${qualifiedName}" (just metaName, no namespace prefix)`);
          logger.info(`   namespace: "${namespaceString}" (string format, not integer)`);
          logger.info(`   revision: ${revision !== undefined ? parseInt(revision) : -1} (${revision !== undefined ? 'from frontend' : 'default -1'})`);
          
          // Call the fetchHistoricalData method with correct format
          const options = {
            fromTime,
            toTime, 
            granularity,
            fields,
            qualifiedName,
            namespace: namespaceString,  // Use string format like test_connection.js
            revision: revision !== undefined ? parseInt(revision) : -1,  // Pass revision parameter, default to -1
            timeout: 30000
          };
          
          logger.info('🔍 Options passed to fetchHistoricalData:', JSON.stringify(options, null, 2));
          
          const result = await caitlynService.fetchHistoricalData(market, code, options);
          
          ws.send(JSON.stringify({
            type: 'fetch_by_code_response',
            success: true,
            data: result,
            message: `Historical data fetched successfully for ${market}/${code}`,
            queryParams: { market, code, fromTime, toTime, granularity, fieldCount: fields?.length }
          }));
          
        } catch (error) {
          logger.error('Error in fetch_by_code:', error);
          
          // Send error response to frontend instead of crashing
          ws.send(JSON.stringify({
            type: 'fetch_by_code_response',
            success: false,
            message: error.message,
            error: {
              type: error.name,
              message: error.message,
              stack: error.stack
            }
          }));
        }
        break;

      case 'fetch_by_time':
        // Handle fetch by time request
        try {
          const { markets, codes, timeTag, granularity, fields, metaName, namespace, revision } = data.params || data;

          logger.info(`⏰ Fetch by time request: ${Array.isArray(markets) ? markets.join(',') : markets}/${Array.isArray(codes) ? codes.join(',') : codes} at timestamp ${timeTag}`);
          logger.info('🔍 RAW Frontend Parameters:');
          logger.info(`   markets: [${Array.isArray(markets) ? markets.map(m => `"${m}"`).join(', ') : `"${markets}"`}] (type: ${typeof markets})`);
          logger.info(`   codes: [${Array.isArray(codes) ? codes.map(c => `"${c}"`).join(', ') : `"${codes}"`}] (type: ${typeof codes})`);
          logger.info(`   timeTag: ${timeTag} (type: ${typeof timeTag})${timeTag === '-1' ? ' (latest data)' : timeTag && !isNaN(timeTag) ? ` = ${new Date(timeTag * 1000).toISOString()}` : ' (invalid)'}`);
          logger.info(`   granularity: ${granularity} (type: ${typeof granularity})`);
          logger.info(`   fields: [${fields?.map(f => `"${f}"`).join(', ') || 'none'}] (${fields?.length || 0} total)`);
          logger.info(`   metaName: "${metaName}" (type: ${typeof metaName})`);
          logger.info(`   namespace: "${namespace}" (type: ${typeof namespace})`);
          logger.info(`   revision: ${revision} (type: ${typeof revision})`);

          // Convert parameters to correct format
          const qualifiedName = metaName || 'SampleQuote';

          // Convert namespace to numeric format (expected by CaitlynClientConnection.fetchByTime)
          let namespaceNumeric;
          if (namespace === '0' || namespace === 0 || namespace === 'global') {
            namespaceNumeric = 0; // Global namespace
          } else if (namespace === '1' || namespace === 1 || namespace === 'private') {
            namespaceNumeric = 1; // Private namespace
          } else {
            namespaceNumeric = 0; // Default to global
          }

          const namespaceString = namespaceNumeric === 0 ? 'global' : 'private';

          logger.info(`🏗️ Using fetchByTime format:`);
          logger.info(`   qualifiedName: "${qualifiedName}"`);
          logger.info(`   namespace: ${namespaceNumeric} (numeric) => "${namespaceString}" (string)`);
          logger.info(`   revision: ${revision !== undefined ? parseInt(revision) : -1} (${revision !== undefined ? 'from frontend' : 'default -1'})`);

          // Call the fetchByTime method with correct format (numeric namespace)
          const options = {
            qualifiedName,
            namespace: namespaceNumeric, // Use numeric format as expected by fetchByTime
            granularity: granularity || 86400,
            fields: fields || [],
            revision: revision !== undefined ? parseInt(revision) : -1,
            timeout: 30000,
          };

          logger.info('🔍 Options passed to fetchByTime:', JSON.stringify(options, null, 2));

          const result = await caitlynService.fetchByTime(markets, codes, timeTag, options);

          // Send response back to frontend
          const response = {
            type: 'fetch_by_time_response',
            success: true,
            data: result,
            message: `Data fetched successfully${timeTag === '-1' ? ' (latest data)' : timeTag && !isNaN(timeTag) ? ` at time ${new Date(timeTag * 1000).toISOString()}` : ''}`,
            queryParams: {
              markets: Array.isArray(markets) ? markets : [markets],
              codes: Array.isArray(codes) ? codes : [codes],
              timeTag,
              granularity: granularity || 86400,
              fieldCount: fields?.length || 0
            },
            requestId: data.requestId
          };
          ws.send(JSON.stringify(response));
        } catch (error) {
          logger.error('Error in fetch_by_time:', error);

          // Send error response to frontend
          const errorResponse = {
            type: 'fetch_by_time_response',
            success: false,
            message: error.message,
            error: {
              type: error.name,
              message: error.message,
              stack: error.stack
            },
            requestId: data.requestId
          };

          ws.send(JSON.stringify(errorResponse));

        }
        break;

      case 'register_formula':
        // Handle formula registration request
        try {
          const { formulaId, sourceCode, languageId = 5 } = data;
          
          logger.info(`🧮 Registering formula: ${formulaId} (language: ${languageId})`);
          
          // Check if connection pool is available (same as fetch_by_code)
          if (!caitlynService.connectionPool) {
            ws.send(JSON.stringify({
              type: 'register_formula_response',
              success: false,
              error: 'Connection pool not initialized. Please wait for backend to initialize.',
              requestId: data.requestId
            }));
            break;
          }
          
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
        
      case 'execute_formula':
        // Handle formula execution request (register + calculate)
        try {
          const { market, code, fromTime, toTime, granularity, formulaCode, formulaName, enableSubscription, formulaId } = data;
          
          logger.info(`🧮 Executing formula: ${formulaName} (ID: ${formulaId}) for ${market}/${code}`);
          
          // Check if connection pool is available (same as fetch_by_code)
          if (!caitlynService.connectionPool) {
            ws.send(JSON.stringify({
              type: 'formula_execution_response',
              success: false,
              error: 'Connection pool not initialized. Please wait for backend to initialize.',
              requestId: data.requestId
            }));
            break;
          }
          
          // Step 1: Register the formula first
          const registerResult = await caitlynService.registerFormula(formulaId, formulaCode, 5);
          
          if (!registerResult.success) {
            ws.send(JSON.stringify({
              type: 'formula_execution_response',
              success: false,
              error: 'Formula registration failed: ' + registerResult.error,
              requestId: data.requestId
            }));
            break;
          }
          
          // Step 2: Calculate the formula data
          const calculateResult = await caitlynService.calculateFormula(
            registerResult.uuid,
            market,
            code,
            granularity,
            fromTime,
            toTime,
            false // isRealTime
          );
          ws.send(JSON.stringify({
            type: 'formula_execution_response',
            success: true,
            data: calculateResult,
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
        
      case 'calculate_formula':
        // Handle formula calculation request (legacy)
        try {
          const { uuid, market, code, fromTime, toTime, granularity, isRealTime } = data;
          const result = await caitlynService.calculateFormula(uuid, market, code, granularity, fromTime, toTime, isRealTime);
          ws.send(JSON.stringify({
            type: 'calculate_formula_response',
            success: true,
            data: result,
            requestId: data.requestId
          }));
        } catch (error) {
          logger.error('Error in calculate_formula:', error);
          ws.send(JSON.stringify({
            type: 'calculate_formula_response',
            success: false,
            error: error.message
          }));
        }
        break;  
      case 'subscribe':
        // Handle real-time subscription request
        try {
          const { markets, codes, qualifiedNames, namespace = 'global', options = {} } = data;

          logger.info(`📡 [SERVER] Subscription request received from frontend:`);
          logger.info(`   📊 Markets: ${Array.isArray(markets) ? markets.join(',') : markets}`);
          logger.info(`   🏷️ Codes: ${Array.isArray(codes) ? codes.join(',') : codes}`);
          logger.info(`   🧬 Qualified Names: ${Array.isArray(qualifiedNames) ? qualifiedNames.join(',') : qualifiedNames}`);
          logger.info(`   🔗 Namespace: ${namespace}`);
          logger.info(`   ⚙️ Options:`, JSON.stringify(options, null, 2));
          logger.info(`   📋 Full request data:`, JSON.stringify(data, null, 2));

          if (!clientHandler.isConnected) {
            ws.send(JSON.stringify({
              type: 'subscription_error',
              error: 'Not connected to Caitlyn server. Please connect first.',
              requestId: data.requestId
            }));
            break;
          }

          // Use subscription hub for automatic deduplication and broadcast
          const subscriberId = clientHandler.subscribeHub(
            markets,
            codes,
            qualifiedNames,
            (realTimeData) => {
              // Broadcast real-time data to frontend with original requestId
              ws.send(JSON.stringify({
                type: 'real_time_data',
                data: realTimeData,
                subscriberId: subscriberId,
                requestId: data.requestId, // Include original requestId from subscription request
                timestamp: new Date().toISOString()
              }));
            },
            options
          );

          logger.info(`✅ Subscription established with subscriber ID: ${subscriberId}`);

          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            subscriberId: subscriberId,
            message: 'Real-time subscription established successfully',
            requestId: data.requestId,
            subscriptionInfo: {
              markets: Array.isArray(markets) ? markets : [markets],
              codes: Array.isArray(codes) ? codes : [codes],
              qualifiedNames: Array.isArray(qualifiedNames) ? qualifiedNames : [qualifiedNames],
              options: options
            }
          }));
          
        } catch (error) {
          logger.error('Error in subscription:', error);
          
          ws.send(JSON.stringify({
            type: 'subscription_error',
            error: error.message,
            requestId: data.requestId,
            details: {
              type: error.name,
              message: error.message
            }
          }));
        }
        break;
        
      case 'unsubscribe':
        // Handle subscription cancellation request
        try {
          const { subscriberId } = data;
          
          logger.info(`📡 Unsubscribe request for subscriber ID: ${subscriberId}`);
          
          if (!subscriberId) {
            ws.send(JSON.stringify({
              type: 'unsubscription_error',
              error: 'Subscriber ID is required for unsubscription',
              requestId: data.requestId
            }));
            break;
          }
          
          const success = clientHandler.unsubscribeHub(subscriberId);
          
          if (success) {
            logger.info(`✅ Successfully unsubscribed subscriber: ${subscriberId}`);
            
            ws.send(JSON.stringify({
              type: 'unsubscription_confirmed',
              subscriberId: subscriberId,
              message: 'Subscription cancelled successfully',
              requestId: data.requestId
            }));
          } else {
            logger.warn(`⚠️ Failed to unsubscribe subscriber: ${subscriberId}`);
            
            ws.send(JSON.stringify({
              type: 'unsubscription_error',
              error: 'Subscriber not found or already unsubscribed',
              subscriberId: subscriberId,
              requestId: data.requestId
            }));
          }
          
        } catch (error) {
          logger.error('Error in unsubscription:', error);
          
          ws.send(JSON.stringify({
            type: 'unsubscription_error',
            error: error.message,
            requestId: data.requestId,
            details: {
              type: error.name,
              message: error.message
            }
          }));
        }
        break;
        
      case 'get_subscription_stats':
        // Handle subscription statistics request
        try {
          const stats = clientHandler.getHubStats();
          
          ws.send(JSON.stringify({
            type: 'subscription_stats',
            data: stats,
            message: 'Subscription statistics retrieved successfully',
            requestId: data.requestId
          }));
          
        } catch (error) {
          logger.error('Error getting subscription stats:', error);
          
          ws.send(JSON.stringify({
            type: 'subscription_stats_error',
            error: error.message,
            requestId: data.requestId
          }));
        }
        break;
        
      default:
        logger.warn(`Unknown message type: ${data.type}`);
    }
  });
  
  ws.on('close', async () => {
    logger.info('Frontend WebSocket disconnected');
    await clientHandler.cleanup();
  });
  
  ws.on('error', async (error) => {
    logger.error('Frontend WebSocket error:', error);
    await clientHandler.cleanup();
  });
});

// Initialize enhanced connection pool on startup
async function initialize() {
  const caitlynUrl = process.env.CAITLYN_WS_URL || 'wss://116.wolverine-box.com/tm';
  const caitlynToken = process.env.CAITLYN_TOKEN;
  
  if (!caitlynToken) {
    logger.error('CAITLYN_TOKEN environment variable is required');
    process.exit(1);
  }
  
  logger.info(`🚀 Initializing enhanced connection pool to: ${caitlynUrl}`);
  
  try {
    // Determine WASM paths based on environment
    const wasmJsPath = path.join(__dirname, '..', 'public', 'caitlyn_js.js');
    const wasmPath = path.join(__dirname, '..', 'public', 'caitlyn_js.wasm');
    
    // Initialize the enhanced connection pool with WASM paths
    await caitlynService.initializePoolOnce(caitlynUrl, caitlynToken, wasmJsPath, wasmPath);
    logger.info('✅ Enhanced connection pool initialized successfully');
    logger.info('⏳ Waiting for universe initialization to complete before starting server...');
    
    // Wait for pool_ready event before starting the server
    caitlynService.connectionPool.once('pool_ready', () => {
      const PORT = process.env.PORT || 4000;
      server.listen(PORT, () => {
        logger.info(`✅ Backend server ready on port ${PORT} - universe fully initialized!`);

        // Start health monitoring after server is ready
        caitlynService.startHealthMonitoring(30000); // Every 30 seconds
        logger.info('🏥 Health monitoring enabled for connection pool and memory');
      });
    });
    
  } catch (error) {
    logger.error('❌ Failed to initialize enhanced connection pool:', error);
    process.exit(1);
  }
}


initialize();
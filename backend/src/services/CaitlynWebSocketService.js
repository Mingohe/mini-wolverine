import WebSocket from 'ws';
import logger from '../utils/logger.js';
import CaitlynConnectionPool from './CaitlynConnectionPool.js';

class CaitlynWebSocketService {
  constructor(poolConfig = {}) {
    this.poolConfig = {
      poolSize: poolConfig.poolSize || process.env.CAITLYN_POOL_SIZE || 3,
      maxPoolSize: poolConfig.maxPoolSize || process.env.CAITLYN_MAX_POOL_SIZE || 5,
      connectionTimeout: poolConfig.connectionTimeout || 60000, // Longer for full initialization
      reconnectDelay: poolConfig.reconnectDelay || 5000,
      maxReconnectAttempts: poolConfig.maxReconnectAttempts || 3,
      ...poolConfig
    };
    logger.info('CaitlynWebSocketService configured with enhanced connection pool:', this.poolConfig);
    
    // Enhanced connection pool with CaitlynClientConnection
    this.connectionPool = null;
    this.isPoolInitialized = false;
    this.clients = new Set();
    this.globalToken = null;
    this.currentUrl = null;
    
    // Shared data from pool
    this.sharedSchema = null;
    this.sharedMarkets = null;
    this.sharedSecurities = null;
  }

  /**
   * Get next sequence ID for Caitlyn protocol requests
   * Ensures proper sequence tracking within 32-bit integer limits
   */
  getNextSequenceId() {
    const current = this.sequenceCounter;
    this.sequenceCounter++;
    
    // Wrap around if we reach the max value (unlikely but safe)
    if (this.sequenceCounter > this.maxSequenceId) {
      this.sequenceCounter = 1;
      logger.warn('Sequence counter wrapped around to 1');
    }
    
    return current;
  }

  // Store an already-initialized connection (simple approach)
  setInitializedConnection(ws, token) {
    this.globalToken = token;
    this.currentUrl = ws.url;
    this.initializedConnection = {
      ws: ws,
      isReady: true
    };
    this.isPoolInitialized = true;
    logger.info('✅ Initialized connection stored in service');
  }

  // Get the initialized connection
  getInitializedConnection() {
    return this.initializedConnection;
  }

  async initializePoolOnce(url, token, wasmJsPath, wasmBinaryPath) {
    if (this.isPoolInitialized) {
      logger.info('Enhanced connection pool already initialized, skipping...');
      return this.connectionPool;
    }

    if (!url || !token) {
      throw new Error('URL and token are required to initialize connection pool');
    }

    // Store URL and token
    this.currentUrl = url;
    this.globalToken = token;

    logger.info(`🚀 Initializing enhanced connection pool to: ${url}`);
    logger.info(`   WASM paths: ${wasmJsPath}, ${wasmBinaryPath}`);
    
    this.connectionPool = new CaitlynConnectionPool(this.poolConfig);
    
    // Set up pool event handlers
    this.setupPoolEventHandlers();
    
    // Initialize the pool with WASM paths
    await this.connectionPool.initialize(url, token, wasmJsPath, wasmBinaryPath);
    this.isPoolInitialized = true;
    
    logger.info('✅ Enhanced connection pool initialized successfully');
    return this.connectionPool;
  }

  /**
   * Set up event handlers for the connection pool
   */
  setupPoolEventHandlers() {
    this.connectionPool.on('pool_ready', (data) => {
      logger.info(`🎆 Pool ready with ${data.totalConnections} connections`);
      
      // Store shared data from pool
      this.sharedSchema = data.schema;
      this.sharedMarkets = data.markets;
      this.sharedSecurities = data.securities;
      
      // Broadcast to all clients
      this.broadcastToAllClients({
        type: 'pool_ready',
        schema: this.sharedSchema,
        markets: this.sharedMarkets,
        securities: this.sharedSecurities
      });
    });
    
    this.connectionPool.on('historical_data_received', (connectionId, data) => {
      logger.debug(`📊 Historical data received from connection ${connectionId}`);
      this.broadcastToAllClients({
        type: 'historical_data',
        data: data,
        connectionId: connectionId
      });
    });
    
    this.connectionPool.on('connection_error', (connectionId, error) => {
      logger.error(`❌ Connection ${connectionId} error:`, error);
      this.broadcastToAllClients({
        type: 'connection_error',
        connectionId: connectionId,
        error: error.message
      });
    });
    
    this.connectionPool.on('pool_shutdown', () => {
      logger.info('📋 Pool shutdown event received');
      this.broadcastToAllClients({
        type: 'pool_shutdown'
      });
    });
  }


  broadcastToAllClients(message) {
    for (const client of this.clients) {
      client.sendToFrontend(message);
    }
  }

  /**
   * Execute historical data fetch using the pool
   */
  async fetchHistoricalData(market, code, options = {}) {
    if (!this.connectionPool) {
      throw new Error('Connection pool not initialized');
    }
    
    try {
      const result = await this.connectionPool.executeFetchByCode(market, code, options);
      logger.info(`✅ Historical data fetch completed for ${market}/${code}`);
      return result;
    } catch (error) {
      logger.error(`❌ Historical data fetch failed for ${market}/${code}:`, error);
      throw error;
    }
  }

  /**
   * Execute fetch by time using the pool
   * Fetches data for multiple securities at a specific time point
   */
  async fetchByTime(markets, codes, timeTag, options = {}) {
    if (!this.connectionPool) {
      throw new Error('Connection pool not initialized');
    }

    try {
      const result = await this.connectionPool.executeFetchByTime(markets, codes, timeTag, options);
      logger.info(`✅ Fetch by time completed for ${Array.isArray(markets) ? markets.join(',') : markets}/${Array.isArray(codes) ? codes.join(',') : codes}`);
      return result;
    } catch (error) {
      logger.error(`❌ Fetch by time failed for ${Array.isArray(markets) ? markets.join(',') : markets}/${Array.isArray(codes) ? codes.join(',') : codes}:`, error);
      throw error;
    }
  }

  /**
   * Execute fetch by time range using the pool
   */
  async fetchByTimeRange(market, code, options = {}) {
    if (!this.connectionPool) {
      throw new Error('Connection pool not initialized');
    }
    
    try {
      const result = await this.connectionPool.executeFetchByTimeRange(market, code, options);
      logger.info(`✅ Time range fetch completed for ${market}/${code}`);
      return result;
    } catch (error) {
      logger.error(`❌ Time range fetch failed for ${market}/${code}:`, error);
      throw error;
    }
  }

  /**
   * Get shared data from pool
   */
  getSharedSchema() {
    return this.sharedSchema || this.connectionPool?.getSharedSchema();
  }

  getSharedMarkets() {
    return this.sharedMarkets || this.connectionPool?.getSharedMarkets();
  }

  getSharedSecurities() {
    return this.sharedSecurities || this.connectionPool?.getSharedSecurities();
  }

  /**
   * Get shared futures data
   */
  getSharedFutures() {
    return this.connectionPool?.getSharedFutures();
  }

  /**
   * Register a formula with Caitlyn server
   * @param {number} formulaId - Formula ID
   * @param {string} sourceCode - Formula source code
   * @param {number} languageId - Language ID (usually 5)
   * @returns {Promise<Object>} Registration result with UUID
   */
  async registerFormula(formulaId, sourceCode, languageId = 5) {
    if (!this.connectionPool) {
      throw new Error('Connection pool not initialized');
    }
    
    try {
      const result = await this.connectionPool.executeFormulaRegistration(formulaId, sourceCode, languageId);
      logger.info(`✅ Formula registration completed for formula ${formulaId}`);
      return result;
    } catch (error) {
      logger.error(`❌ Formula registration failed for formula ${formulaId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate formula data
   * @param {string} uuid - Formula UUID from registration
   * @param {string} market - Market code
   * @param {string} code - Security code
   * @param {number} granularity - Time granularity in seconds
   * @param {number} beginTime - Begin timestamp
   * @param {number} endTime - End timestamp
   * @param {boolean} isRealTime - Whether this is real-time calculation
   * @returns {Promise<Object>} Calculation result
   */
  async calculateFormula(uuid, market, code, granularity, beginTime, endTime, isRealTime = false) {
    if (!this.connectionPool) {
      throw new Error('Connection pool not initialized');
    }
    
    try {
      const result = await this.connectionPool.executeFormulaCalculation(uuid, market, code, granularity, beginTime, endTime, isRealTime);
      logger.info(`✅ Formula calculation completed for ${market}/${code}`);
      return result;
    } catch (error) {
      logger.error(`❌ Formula calculation failed for ${market}/${code}:`, error);
      throw error;
    }
  }

  createClientHandler(frontendWs) {
    const client = new ClientHandler(frontendWs, this.poolConfig, this);
    this.clients.add(client);
    return client;
  }

  removeClient(client) {
    this.clients.delete(client);
  }

  async resetConfiguration() {
    logger.info('Resetting enhanced pool configuration...');

    if (this.connectionPool) {
      await this.connectionPool.shutdown();
    }

    this.connectionPool = null;
    this.isPoolInitialized = false;
    this.currentUrl = null;
    this.globalToken = null;

    // Clear shared data
    this.sharedSchema = null;
    this.sharedMarkets = null;
    this.sharedSecurities = null;

    logger.info('Enhanced pool configuration reset complete');
  }

  /**
   * Get comprehensive health status including pool statistics
   */
  getHealthStatus() {
    const status = {
      service: {
        isPoolInitialized: this.isPoolInitialized,
        connectedClients: this.clients.size,
        hasSharedData: !!(this.sharedSchema && this.sharedMarkets)
      },
      pool: null,
      memory: {
        nodeMemory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };

    if (this.connectionPool) {
      status.pool = this.connectionPool.getStats();
    }

    return status;
  }

  /**
   * Perform health check and log warnings for potential issues
   */
  performHealthCheck() {
    const health = this.getHealthStatus();

    // Check for memory issues
    const memoryMB = health.memory.nodeMemory.heapUsed / (1024 * 1024);
    if (memoryMB > 500) { // 500MB threshold
      logger.warn(`⚠️ High memory usage: ${memoryMB.toFixed(2)}MB`);
    }

    // Check pool health
    if (health.pool) {
      if (health.pool.availableConnections === 0 && health.pool.totalConnections > 0) {
        logger.warn(`⚠️ No available connections in pool (${health.pool.busyConnections} busy)`);
      }

      if (health.pool.pendingRequests > 5) {
        logger.warn(`⚠️ High number of pending requests: ${health.pool.pendingRequests}`);
      }

      if (health.pool.totalConnections === 0) {
        logger.error(`❌ No connections in pool - service degraded`);
      }
    }

    // Check shared data
    if (this.isPoolInitialized && !health.service.hasSharedData) {
      logger.warn(`⚠️ Pool initialized but missing shared data`);
    }

    return health;
  }

  /**
   * Start periodic health monitoring
   */
  startHealthMonitoring(intervalMs = 30000) {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
    }

    this.healthMonitorInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);

    logger.info(`🏥 Health monitoring started (every ${intervalMs/1000}s)`);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
      this.healthMonitorInterval = null;
      logger.info(`🏥 Health monitoring stopped`);
    }
  }
}

class ClientHandler {
  constructor(frontendWs, poolConfig, caitlynService) {
    this.frontendWs = frontendWs;
    this.poolConfig = poolConfig;
    this.caitlynService = caitlynService;
    this.token = null;
    this.isConnected = false;
    this.clientId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    this.activeSubscriptions = new Set(); // 跟踪此客户端的所有订阅
  }

  async connectToCaitlyn(url, token, autoConnect = false) {
    if (!url || !token) {
      throw new Error('URL and token are required to connect to Caitlyn server');
    }
    
    this.token = token;
    
    logger.info(`Client ${this.clientId} connecting to Caitlyn server: ${url}`);
    
    // Use shared connection pool - initialize only once
    await this.caitlynService.initializePoolOnce(url, this.token);
    
    this.isConnected = true;
    this.sendToFrontend({
      type: 'connection_status',
      status: 'connected',
      clientId: this.clientId,
      message: `Connected to shared Caitlyn server pool`
    });
    
    this.sendToFrontend({
      type: 'handshake_success',
      message: 'Authentication successful'
    });
    
    // Send existing schema and market data if available
    const sharedSchema = this.caitlynService.getSharedSchema();
    const sharedMarkets = this.caitlynService.getSharedMarkets();
    
    if (sharedSchema && Object.keys(sharedSchema).length > 0) {
      this.sendToFrontend({
        type: 'schema_received',
        data: sharedSchema
      });
    }
    
    if (sharedMarkets && Object.keys(sharedMarkets).length > 0) {
      this.sendToFrontend({
        type: 'markets_received',
        data: sharedMarkets
      });
    }
    
    // Auto-query cached seeds if this is an auto-connect
    if (autoConnect) {
      await this.queryCachedSeeds();
    }
    
    logger.info(`Client ${this.clientId} connected to shared pool successfully`);
  }

  // Pool message handling is now done at service level

  // Keepalive is now handled by individual connections in the pool
  // These methods are kept for compatibility but do nothing
  startKeepalive() {
    logger.debug('Keepalive is managed by connection pool');
  }

  stopKeepalive() {
    logger.debug('Keepalive is managed by connection pool');
  }

  sendToFrontend(data) {
    if (this.frontendWs && this.frontendWs.readyState === WebSocket.OPEN) {
      this.frontendWs.send(JSON.stringify(data));
    }
  }

  async disconnect() {
    this.isConnected = false;
    
    this.sendToFrontend({
      type: 'connection_status',
      status: 'disconnected',
      message: 'Disconnected from Caitlyn server'
    });
  }

  async testUniverseRevision() {
    if (!this.isConnected) {
      throw new Error('Not connected to Caitlyn server');
    }

    logger.info('Testing universe revision functionality...');
    
    // Use already loaded market data from shared service
    const marketsData = this.caitlynService.getSharedMarkets();
    if (!marketsData) {
      logger.warn('No markets data available yet - shared pool may still be fetching data');
      return {
        success: false,
        marketsCount: 0,
        globalMarkets: 0,
        privateMarkets: 0,
        message: 'Markets data not yet available - shared pool initializing'
      };
    }
    
    const globalMarkets = Object.keys(marketsData.global || {}).length;
    const privateMarkets = Object.keys(marketsData.private || {}).length;
    const marketsCount = globalMarkets + privateMarkets;
    
    return {
      success: marketsCount > 0,
      marketsCount,
      globalMarkets,
      privateMarkets
    };
  }

  async testUniverseSeeds() {
    if (!this.isConnected) {
      throw new Error('Not connected to Caitlyn server');
    }

    logger.info('Testing universe seeds functionality...');
    
    // Use cached seeds data from shared service
    const cachedSeedsCount = this.caitlynService.globalCachedSeeds?.size || 0;
    let totalEntries = 0;
    
    // Count total entries in cached seeds
    for (const [key, seedData] of this.caitlynService.globalCachedSeeds || []) {
      if (seedData.data && seedData.data.seedEntries) {
        totalEntries += seedData.data.seedEntries.length;
      }
    }
    
    return {
      success: cachedSeedsCount > 0,
      seedsReceived: cachedSeedsCount,
      totalEntries
    };
  }

  // Helper method to limit markets data for testing (avoid overwhelming the server)
  limitMarketsForTesting(marketsData) {
    const limited = {};
    
    for (const namespaceStr in marketsData) {
      limited[namespaceStr] = {};
      const markets = Object.keys(marketsData[namespaceStr]);
      
      // Process all markets in namespace
      for (let i = 0; i < markets.length; i++) {
        const marketCode = markets[i];
        const marketInfo = marketsData[namespaceStr][marketCode];
        
        // Include Security data for proper futures/securities display
        if (marketInfo.revisions) {
          const qualifiedNames = Object.keys(marketInfo.revisions);
          const limitedRevisions = {};
          
          // Always include Security if available, plus first few others
          if (marketInfo.revisions['Security']) {
            limitedRevisions['Security'] = marketInfo.revisions['Security'];
          }
          
          // Add other qualified names (up to 3 total including Security)
          for (let j = 0; j < qualifiedNames.length && Object.keys(limitedRevisions).length < 3; j++) {
            const qualName = qualifiedNames[j];
            if (qualName !== 'Security') {  // Don't duplicate Security
              limitedRevisions[qualName] = marketInfo.revisions[qualName];
            }
          }
          
          limited[namespaceStr][marketCode] = {
            ...marketInfo,
            revisions: limitedRevisions
          };
        }
      }
    }
    
    return limited;
  }

  /**
   * Subscribe to real-time data using the subscription hub
   * @param {Array|string} markets - Market codes
   * @param {Array|string} codes - Security codes
   * @param {Array|string} qualifiedNames - Qualified names
   * @param {string} namespace - Namespace (default: 'global')
   * @param {Function} callback - Callback function for real-time data
   * @param {Object} options - Subscription options
   * @returns {Promise<string>} subscriber ID
   */
  async subscribeHub(markets, codes, qualifiedNames, namespace = 'global', callback, options = {}) {
    if (!this.isConnected) {
      throw new Error('Not connected to Caitlyn server');
    }

    if (!this.caitlynService.connectionPool) {
      throw new Error('Connection pool not initialized');
    }

    // Properly acquire and release connection from pool
    const { connection, connectionId } = await this.caitlynService.connectionPool.getConnection();

    try {
      const subscriberId = connection.subscribeHub(markets, codes, qualifiedNames, namespace, callback, options);

      // 记录此客户端的订阅
      this.activeSubscriptions.add(subscriberId);
      logger.info(`📝 Client ${this.clientId} recorded subscription: ${subscriberId}`);

      return subscriberId;
    } finally {
      // Always release the connection back to the pool
      this.caitlynService.connectionPool.releaseConnection(connectionId);
    }
  }

  /**
   * Unsubscribe from real-time data
   * @param {string} subscriberId - Subscriber ID returned from subscribeHub
   * @returns {Promise<boolean>} true if successfully unsubscribed
   */
  async unsubscribeHub(subscriberId) {
    if (!this.isConnected) {
      return false;
    }

    if (!this.caitlynService.connectionPool) {
      return false;
    }

    try {
      // Properly acquire and release connection from pool
      const { connection, connectionId } = await this.caitlynService.connectionPool.getConnection();
      
      try {
        const success = connection.unsubscribeHub(subscriberId);

        // 如果取消订阅成功，从客户端记录中移除
        if (success) {
          this.activeSubscriptions.delete(subscriberId);
          logger.info(`📝 Client ${this.clientId} removed subscription: ${subscriberId}`);
        }

        return success;
      } finally {
        // Always release the connection back to the pool
        this.caitlynService.connectionPool.releaseConnection(connectionId);
      }
    } catch (error) {
      logger.error('Error in unsubscribeHub:', error);
      return false;
    }
  }

  async cleanup() {
    logger.info(`🧹 Client ${this.clientId} cleanup started - ${this.activeSubscriptions.size} active subscriptions`);

    // 清理所有此客户端的订阅
    if (this.activeSubscriptions.size > 0) {
      const subscriptionsToCleanup = Array.from(this.activeSubscriptions);

      for (const subscriberId of subscriptionsToCleanup) {
        try {
          await this.unsubscribeHub(subscriberId);
          logger.info(`✅ Cleaned up subscription: ${subscriberId}`);
        } catch (error) {
          logger.error(`❌ Failed to cleanup subscription ${subscriberId}:`, error);
          // 即使失败也从记录中移除，避免重复尝试
          this.activeSubscriptions.delete(subscriberId);
        }
      }
    }

    // Remove client from service's client list
    if (this.caitlynService) {
      this.caitlynService.removeClient(this);
    }

    await this.disconnect();
    logger.info(`✅ Client ${this.clientId} cleanup completed`);
  }
  
  /**
   * Query all cached seeds data or only newer than specified timestamp
   */
  async queryCachedSeeds(sinceTimestamp = 0) {
    logger.info(`Client ${this.clientId} querying cached seeds since ${sinceTimestamp}`);
    
    const seedsToSend = [];
    
    // Use global cached seeds from service
    for (const [key, seedData] of this.caitlynService.globalCachedSeeds || []) {
      if (seedData.timestamp > sinceTimestamp) {
        seedsToSend.push({
          key,
          ...seedData
        });
      }
    }
    
    logger.info(`Sending ${seedsToSend.length} cached seeds to client ${this.clientId}`);
    
    this.sendToFrontend({
      type: 'cached_seeds_batch',
      seeds: seedsToSend,
      totalCached: this.caitlynService.globalCachedSeeds?.size || 0,
      sinceTimestamp,
      currentTimestamp: Date.now()
    });
    
    return seedsToSend.length;
  }
  
}

export default CaitlynWebSocketService;
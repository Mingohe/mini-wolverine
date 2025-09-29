import EventEmitter from 'events';
import logger from '../utils/logger.js';
import CaitlynClientConnection from '../utils/CaitlynClientConnection.js';

/**
 * Enhanced Connection Pool using CaitlynClientConnection pattern
 * 
 * This pool manages fully initialized CaitlynClientConnection instances
 * that handle their own WASM operations, initialization, and message handling.
 * 
 * Benefits:
 * - Each connection is fully autonomous with complete initialization
 * - Proven initialization pattern from CaitlynClientConnection
 * - Better resource isolation and memory management
 * - Event-driven architecture for better coordination
 */
class CaitlynConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Pool configuration
    this.poolSize = options.poolSize || 3;
    this.maxPoolSize = options.maxPoolSize || 5;
    this.connectionTimeout = options.connectionTimeout || 60000; // Longer for full initialization
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 3;
    
    // Pool state
    this.connections = new Map(); // connectionId -> CaitlynClientConnection
    this.availableConnections = new Set(); // Set of connection IDs
    this.busyConnections = new Set(); // Set of connection IDs
    this.pendingRequests = []; // Queue of {resolve, reject, timestamp}
    
    // Pool metadata
    this.connectionIdCounter = 0;
    this.url = null;
    this.token = null;
    this.isShuttingDown = false;
    this.isInitialized = false;

    // Shared data from first connection
    this.sharedSchema = null;
    this.sharedMarkets = null;
    this.sharedSecurities = null;
    this.sharedFutures = null;
  }

  /**
   * Initialize the connection pool with CaitlynClientConnection instances
   */
  async initialize(url, token, wasmJsPath = './public/caitlyn_js.js', wasmPath = './public/caitlyn_js.wasm') {
    if (this.isInitialized) {
      logger.warn('Connection pool already initialized');
      return true;
    }

    this.url = url;
    this.token = token;
    
    logger.info(`🚀 Initializing CaitlynConnectionPool with ${this.poolSize} connections`);
    logger.info(`   URL: ${url}`);
    logger.info(`   WASM paths: ${wasmJsPath}, ${wasmPath}`);
    
    // Create initial connections
    const connectionPromises = [];
    for (let i = 0; i < this.poolSize; i++) {
      connectionPromises.push(this.createConnection(wasmJsPath, wasmPath));
    }
    
    try {
      const createdConnections = await Promise.all(connectionPromises);
      const successCount = createdConnections.filter(conn => conn !== null).length;
      
      if (successCount === 0) {
        throw new Error('Failed to create any connections');
      }
      
      logger.info(`✅ Connection pool initialized with ${successCount}/${this.poolSize} connections`);
      logger.info(`⏳ Waiting for universe initialization to complete...`);
      this.isInitialized = true;
      
      // Don't emit pool_ready immediately - wait for seeds_loaded event
      // The pool_ready event will be emitted when seeds are actually loaded
      
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize connection pool:', error);
      throw error;
    }
  }

  /**
   * Create a new CaitlynClientConnection instance
   */
  async createConnection(wasmJsPath, wasmPath) {
    const connectionId = `conn_${++this.connectionIdCounter}`;
    
    logger.info(`🔧 Creating connection ${connectionId}...`);
    
    try {
      // Create CaitlynClientConnection instance
      const connection = new CaitlynClientConnection({
        url: this.url,
        token: this.token,
        logger: logger
      });

      // Set up event handlers
      this.setupConnectionEventHandlers(connection, connectionId);

      // Load WASM and connect with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Connection ${connectionId} initialization timed out`)), this.connectionTimeout);
      });

      const initPromise = (async () => {
        // Load WASM module
        await connection.loadWasmModule(wasmJsPath, wasmPath);
        logger.info(`✅ WASM loaded for connection ${connectionId}`);
        
        // Connect and initialize
        await connection.connect();
        logger.info(`✅ Connection ${connectionId} fully initialized`);
        
        return connection;
      })();

      const initializedConnection = await Promise.race([initPromise, timeoutPromise]);

      // Store connection
      this.connections.set(connectionId, initializedConnection);
      this.availableConnections.add(connectionId);
      
      // Store shared data from first successful connection
      if (!this.sharedSchema && initializedConnection.schema) {
        this.sharedSchema = initializedConnection.schema;
        this.sharedMarkets = initializedConnection.marketsData;
        this.sharedSecurities = initializedConnection.securitiesByMarket;
        this.sharedFutures = initializedConnection.futures;
        
        logger.info(`📊 Shared data captured from connection ${connectionId}`);
        logger.info(`   Schema objects: ${Object.keys(this.sharedSchema).reduce((sum, ns) => sum + Object.keys(this.sharedSchema[ns] || {}).length, 0)}`);
        logger.info(`   Markets: ${Object.keys(this.sharedMarkets.global || {}).length} global, ${Object.keys(this.sharedMarkets.private || {}).length} private`);
        logger.info(`   Securities: ${Object.keys(this.sharedSecurities).length} markets`);
        logger.info(`   Futures: ${this.sharedFutures?.length || 0} contracts`);
      }
      
      logger.info(`✅ Connection ${connectionId} added to pool (${this.connections.size} total)`);
      
      return initializedConnection;
      
    } catch (error) {
      logger.error(`❌ Failed to create connection ${connectionId}:`, error);
      return null;
    }
  }

  /**
   * Set up event handlers for a CaitlynClientConnection
   */
  setupConnectionEventHandlers(connection, connectionId) {
    // Store connection ID for reference
    connection.poolConnectionId = connectionId;
    
    // Handle connection events
    connection.on('connected', () => {
      logger.debug(`🤝 Connection ${connectionId} connected`);
      this.emit('connection_connected', connectionId);
    });
    
    connection.on('initialized', () => {
      logger.debug(`🎯 Connection ${connectionId} fully initialized`);
      this.emit('connection_initialized', connectionId);
    });
    
    connection.on('schema_loaded', (data) => {
      logger.debug(`📋 Connection ${connectionId} schema loaded`);
      this.emit('connection_schema_loaded', connectionId, data);
    });
    
    connection.on('universe_loaded', (data) => {
      logger.debug(`🌍 Connection ${connectionId} universe loaded`);
      this.emit('connection_universe_loaded', connectionId, data);
    });
    
    connection.on('seeds_loaded', (data) => {
      logger.info(`🌱 Connection ${connectionId} seeds loaded - universe initialization complete!`);
      this.emit('connection_seeds_loaded', connectionId, data);
      
      // Now that universe initialization is complete, emit pool_ready
      this.emit('pool_ready', { 
        totalConnections: this.connections.size,
        schema: this.sharedSchema,
        markets: this.sharedMarkets,
        securities: this.sharedSecurities
      });
    });
    
    connection.on('historical_data', (data) => {
      logger.debug(`📊 Connection ${connectionId} historical data received`);
      this.emit('historical_data_received', connectionId, data);
    });
    
    connection.on('error', (error) => {
      logger.error(`❌ Connection ${connectionId} error:`, error);
      this.handleConnectionError(connectionId, error);
    });
    
    connection.on('disconnected', () => {
      logger.warn(`🔌 Connection ${connectionId} disconnected`);
      this.handleConnectionDisconnected(connectionId);
    });
  }

  /**
   * Handle connection error
   */
  handleConnectionError(connectionId, error) {
    logger.error(`❌ Connection ${connectionId} error: ${error.message}`);

    // Force cleanup and removal
    this.removeConnection(connectionId);
    this.emit('connection_error', connectionId, error);

    // If we have no available connections, attempt emergency recovery
    if (this.availableConnections.size === 0 && !this.isShuttingDown) {
      logger.warn(`🚨 No available connections after error - attempting emergency recovery`);
      setTimeout(() => {
        this.attemptEmergencyRecovery();
      }, this.reconnectDelay);
    }
  }

  /**
   * Handle connection disconnection
   */
  handleConnectionDisconnected(connectionId) {
    this.removeConnection(connectionId);
    this.emit('connection_disconnected', connectionId);
    
    // DISABLED: Prevent infinite reconnection loops during WASM failures
    // if (!this.isShuttingDown) {
    //   setTimeout(() => {
    //     this.attemptReconnection(connectionId);
    //   }, this.reconnectDelay);
    // }
    
    logger.error(`❌ Connection disconnected, reconnection disabled to prevent loops`);
  }

  /**
   * Attempt emergency recovery when all connections are lost
   */
  async attemptEmergencyRecovery() {
    if (this.isShuttingDown) {
      return;
    }

    logger.info(`🆘 Attempting emergency recovery - creating single new connection`);

    try {
      // Try to create one new connection
      const newConnection = await this.createConnection('./public/caitlyn_js.js', './public/caitlyn_js.wasm');

      if (newConnection) {
        logger.info(`✅ Emergency recovery successful - created connection ${newConnection.poolConnectionId}`);

        // Process any pending requests
        while (this.pendingRequests.length > 0 && this.availableConnections.size > 0) {
          const request = this.pendingRequests.shift();
          const connectionId = this.availableConnections.values().next().value;
          const connection = this.connections.get(connectionId);

          if (connection && connection.isInitialized) {
            this.availableConnections.delete(connectionId);
            this.busyConnections.add(connectionId);
            request.resolve({ connection, connectionId });
          } else {
            request.reject(new Error('Emergency connection not ready'));
          }
        }
      } else {
        logger.error(`❌ Emergency recovery failed - could not create new connection`);
      }
    } catch (error) {
      logger.error(`❌ Emergency recovery failed:`, error);
    }
  }

  /**
   * Attempt to reconnect a failed connection - DISABLED for safety
   */
  async attemptReconnection(connectionId) {
    logger.warn(`🚫 Direct reconnection disabled for ${connectionId} to prevent WASM conflicts`);
    // Use emergency recovery instead for safer memory management
    return;
  }

  /**
   * Remove connection from pool
   */
  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Disconnect and cleanup
      connection.disconnect();
      
      // Remove from tracking
      this.connections.delete(connectionId);
      this.availableConnections.delete(connectionId);
      this.busyConnections.delete(connectionId);
      
      logger.debug(`🗑️ Connection ${connectionId} removed from pool`);
    }
  }

  /**
   * Get an available connection from the pool
   */
  async getConnection() {
    return new Promise((resolve, reject) => {
      // Check for available connection
      if (this.availableConnections.size > 0) {
        const connectionId = this.availableConnections.values().next().value;
        const connection = this.connections.get(connectionId);

        if (connection && connection.isInitialized) {
          // Move to busy
          this.availableConnections.delete(connectionId);
          this.busyConnections.add(connectionId);

          resolve({ connection, connectionId });
          return;
        }
      }

      // Attempt pool expansion if we have fewer than max connections
      if (this.connections.size < this.maxPoolSize && !this.isShuttingDown) {
        logger.info(`📈 Pool expansion: creating connection ${this.connections.size + 1}/${this.maxPoolSize}`);

        this.createConnection('./public/caitlyn_js.js', './public/caitlyn_js.wasm')
          .then(connection => {
            if (connection) {
              const connectionId = connection.poolConnectionId;

              // Move to busy immediately
              this.availableConnections.delete(connectionId);
              this.busyConnections.add(connectionId);

              resolve({ connection, connectionId });
            } else {
              reject(new Error('Failed to create new connection during expansion'));
            }
          })
          .catch(error => {
            logger.error('Pool expansion failed:', error);
            reject(error);
          });
        return;
      }

      // Queue the request with timeout
      const requestTimeout = setTimeout(() => {
        const index = this.pendingRequests.findIndex(req => req.resolve === resolve);
        if (index > -1) {
          this.pendingRequests.splice(index, 1);
        }
        reject(new Error('Connection request timed out - no connections available'));
      }, 10000); // 10 second timeout

      this.pendingRequests.push({
        resolve,
        reject,
        timestamp: Date.now(),
        timeout: requestTimeout
      });

      logger.debug(`📋 Request queued (${this.pendingRequests.length} pending)`);
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connectionIdOrObject) {
    let connectionId;
    
    if (typeof connectionIdOrObject === 'string') {
      connectionId = connectionIdOrObject;
    } else if (connectionIdOrObject && connectionIdOrObject.poolConnectionId) {
      connectionId = connectionIdOrObject.poolConnectionId;
    } else {
      logger.error('❌ Invalid connection object for release');
      return;
    }
    
    // Move from busy to available
    if (this.busyConnections.has(connectionId)) {
      this.busyConnections.delete(connectionId);
      this.availableConnections.add(connectionId);
      
      // Process pending requests
      if (this.pendingRequests.length > 0) {
        const request = this.pendingRequests.shift();
        const connection = this.connections.get(connectionId);

        // Clear the timeout since we're processing the request
        if (request.timeout) {
          clearTimeout(request.timeout);
        }

        if (connection && connection.isInitialized) {
          // Move back to busy
          this.availableConnections.delete(connectionId);
          this.busyConnections.add(connectionId);

          request.resolve({ connection, connectionId });
        } else {
          // Connection not ready, reject the request
          request.reject(new Error('Connection not available'));
        }
      }
    }
  }

  /**
   * Execute a fetch request using the pool - now uses CaitlynClientConnection.fetchByCode() directly
   */
  async executeFetchByCode(market, code, options = {}) {
    const { connection, connectionId } = await this.getConnection();
    
    try {
      // CaitlynClientConnection.fetchByCode() now returns a Promise with decoded SVObject instances
      const result = await connection.fetchByCode(market, code, options);
      return result;
      
    } catch (error) {
      throw error;
    } finally {
      // Release connection back to pool
      this.releaseConnection(connectionId);
    }
  }

  /**
   * Execute a fetch by time request using the pool
   * Fetches data for multiple securities at a specific time point
   */
  async executeFetchByTime(markets, codes, timeTag, options = {}) {
    const { connection, connectionId } = await this.getConnection();

    try {
      // CaitlynClientConnection.fetchByTime() returns a Promise with decoded data
      const result = await connection.fetchByTime(markets, codes, timeTag, options);
      return result;

    } catch (error) {
      throw error;
    } finally {
      // Release connection back to pool
      this.releaseConnection(connectionId);
    }
  }

  /**
   * Execute a fetch by time range request using the pool
   */
  async executeFetchByTimeRange(market, code, options = {}) {
    const { connection, connectionId } = await this.getConnection();
    
    try {
      await connection.fetchByTimeRange(market, code, options);
      
      // Wait for the response via event handling
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Fetch request timed out'));
        }, options.timeout || 30000);

        const handleHistoricalData = (connId, data) => {
          if (connId === connectionId) {
            clearTimeout(timeout);
            connection.off('historical_data', handleHistoricalData);
            resolve(data);
          }
        };

        connection.on('historical_data', handleHistoricalData);
      });
      
    } catch (error) {
      throw error;
    } finally {
      // Release connection back to pool
      this.releaseConnection(connectionId);
    }
  }

  /**
   * Get shared schema data
   */
  getSharedSchema() {
    return this.sharedSchema;
  }

  /**
   * Get shared markets data
   */
  getSharedMarkets() {
    return this.sharedMarkets;
  }

  /**
   * Get shared securities data
   */
  getSharedSecurities() {
    return this.sharedSecurities;
  }

  /**
   * Get shared futures data from the first connection
   */
  getSharedFutures() {
    return this.sharedFutures;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      availableConnections: this.availableConnections.size,
      busyConnections: this.busyConnections.size,
      pendingRequests: this.pendingRequests.length,
      poolSize: this.poolSize,
      maxPoolSize: this.maxPoolSize,
      isInitialized: this.isInitialized,
      hasSharedData: !!(this.sharedSchema && this.sharedMarkets)
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown() {
    this.isShuttingDown = true;
    logger.info('🛑 Shutting down CaitlynConnectionPool...');
    
    // Reject pending requests and clear timeouts
    for (const request of this.pendingRequests) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Connection pool is shutting down'));
    }
    this.pendingRequests = [];
    
    // Disconnect all connections
    const disconnectPromises = [];
    for (const [connectionId, connection] of this.connections) {
      logger.debug(`🔌 Disconnecting ${connectionId}`);
      disconnectPromises.push(
        Promise.resolve().then(() => connection.disconnect())
      );
    }
    
    try {
      await Promise.allSettled(disconnectPromises);
    } catch (error) {
      logger.error('Error during pool shutdown:', error);
    }
    
    // Clear all tracking
    this.connections.clear();
    this.availableConnections.clear();
    this.busyConnections.clear();
    
    // Clear shared data
    this.sharedSchema = null;
    this.sharedMarkets = null;
    this.sharedSecurities = null;
    this.sharedFutures = null;
    this.isInitialized = false;
    
    logger.info('✅ Connection pool shutdown complete');
    this.emit('pool_shutdown');
  }

  /**
   * Execute formula registration using the pool
   * @param {number} formulaId - Formula ID
   * @param {string} sourceCode - Formula source code
   * @param {number} languageId - Language ID (usually 5)
   * @returns {Promise<Object>} Registration result with UUID
   */
  async executeFormulaRegistration(formulaId, sourceCode, languageId = 5) {
    if (!this.isInitialized) {
      throw new Error('Connection pool not initialized');
    }

    logger.info(`🧮 Executing formula registration for formula ${formulaId}`);
    
    const { connection, connectionId } = await this.getConnection();
    
    try {
      const result = await connection.registerFormula(formulaId, sourceCode, languageId);
      logger.debug(`✅ Formula registration completed for formula ${formulaId}`);
      return result;
    } catch (error) {
      logger.error(`❌ Formula registration failed for formula ${formulaId}:`, error);
      throw error;
    } finally {
      this.releaseConnection(connectionId);
    }
  }

  /**
   * Execute formula calculation using the pool
   * @param {string} uuid - Formula UUID from registration
   * @param {string} market - Market code
   * @param {string} code - Security code
   * @param {number} granularity - Time granularity in seconds
   * @param {number} beginTime - Begin timestamp
   * @param {number} endTime - End timestamp
   * @param {boolean} isRealTime - Whether this is real-time calculation
   * @returns {Promise<Object>} Calculation result
   */
  async executeFormulaCalculation(uuid, market, code, granularity, beginTime, endTime, isRealTime = false) {
    if (!this.isInitialized) {
      throw new Error('Connection pool not initialized');
    }

    logger.info(`🧮 Executing formula calculation for ${market}/${code}`);

    const { connection, connectionId } = await this.getConnection();

    try {
      const result = await connection.calculateFormula(uuid, market, code, granularity, beginTime, endTime, isRealTime);
      logger.debug(`✅ Formula calculation completed for ${market}/${code}`);
      return result;
    } catch (error) {
      logger.error(`❌ Formula calculation failed for ${market}/${code}:`, error);
      throw error;
    } finally {
      this.releaseConnection(connectionId);
    }
  }

}

export default CaitlynConnectionPool;
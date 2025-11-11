/**
 * Caitlyn Backend Service
 *
 * Handles communication with the Caitlyn Rails backend for formula management
 * and other account-related operations.
 *
 * Authentication: Uses the same token as CaitlynWebSocketService (CAITLYN_TOKEN)
 */

import axios from 'axios';
import logger from '../utils/logger.js';

class CaitlynBackendService {
  constructor(baseUrl, token) {
    if (!baseUrl) {
      throw new Error('CaitlynBackendService: baseUrl is required');
    }
    if (!token) {
      throw new Error('CaitlynBackendService: token is required');
    }

    this.baseUrl = baseUrl;
    this.token = token;

    // Create axios instance with default config
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug(`Rails API Request: ${config.method.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('Rails API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axios.interceptors.response.use(
      (response) => {
        logger.debug(`Rails API Response: ${response.config.url}`, {
          status: response.data?.status,
          error_code: response.data?.error_code
        });
        return response;
      },
      (error) => {
        logger.error('Rails API Response Error:', {
          url: error.config?.url,
          message: error.message,
          response: error.response?.data
        });
        return Promise.reject(error);
      }
    );

    logger.info('CaitlynBackendService initialized', { baseUrl });
  }

  /**
   * Query formulas accessible to the current user
   * @param {Object} options - Query options
   * @param {number} [options.languageId] - Filter by programming language ID
   * @param {string} [options.pattern] - Search pattern for formula name
   * @param {number} [options.privateOnly] - 0=all formulas, 1=only private/shared
   * @returns {Promise<Array>} Array of formula objects
   */
  async queryFormulas({ languageId, pattern, privateOnly } = {}) {
    try {
      const params = { token: this.token };
      const data = {};

      if (languageId !== undefined) data.language_id = languageId;
      if (pattern !== undefined) data.pattern = pattern;
      if (privateOnly !== undefined) data.private_only = privateOnly;

      logger.info('Querying formulas', { languageId, pattern, privateOnly });

      const response = await this.axios.post('/api/cmd_ar_query_formula', data, { params });
      const result = this.handleResponse(response);

      logger.info(`Query formulas successful: ${result.formulas?.length || 0} formulas found`);
      return result.formulas || [];
    } catch (error) {
      logger.error('Failed to query formulas:', error.message);
      throw this.handleError(error, 'queryFormulas');
    }
  }

  /**
   * Save formula (create new or update existing)
   * @param {Object} options - Formula data
   * @param {number} [options.id] - Formula ID (omit for new formula)
   * @param {string} options.name - Formula name
   * @param {string} options.sourceCode - Formula source code
   * @param {number} options.languageId - Programming language ID
   * @param {string} [options.property] - Formula property JSON string (e.g., {"add_to_main":false})
   * @param {number} [options.userId] - Owner user ID (defaults to current user)
   * @returns {Promise<Object>} Saved formula object
   */
  async saveFormula({ id, name, sourceCode, languageId, property, userId } = {}) {
    try {
      if (!name) {
        throw new Error('Formula name is required');
      }
      if (!sourceCode) {
        throw new Error('Formula source code is required');
      }
      if (languageId === undefined) {
        throw new Error('Language ID is required');
      }

      const params = { token: this.token };
      const data = {
        name,
        source_code: sourceCode,
        language_id: languageId,
        property: property || '{"add_to_main":false}' // Default property
      };

      if (id !== undefined) data.id = id;
      if (userId !== undefined) data.user_id = userId;

      logger.info('Saving formula', { id, name, languageId });

      const response = await this.axios.post('/api/cmd_ar_save_formula', data, { params });
      const result = this.handleResponse(response);

      // Rails server returns { id }, construct complete object using the data we sent
      const savedFormula = {
        id: result.id || id, // Use returned id for new formulas, or original id for updates
        name,
        source_code: sourceCode,
        language_id: languageId,
        property: property || '{"add_to_main":false}',
        user_id: userId,
        updated_at: new Date().toISOString(),
        ...(id ? {} : { created_at: new Date().toISOString() })
      };

      logger.info('Save formula successful', { id: savedFormula.id, name });
      return savedFormula;
    } catch (error) {
      logger.error('Failed to save formula:', error.message);
      throw this.handleError(error, 'saveFormula');
    }
  }

  /**
   * Delete formula
   * @param {number} id - Formula ID to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFormula(id) {
    try {
      if (!id) {
        throw new Error('Formula ID is required');
      }

      const params = { token: this.token };
      const data = { id };

      logger.info('Deleting formula', { id });

      const response = await this.axios.post('/api/cmd_ar_delete_formula', data, { params });
      const result = this.handleResponse(response);

      logger.info('Delete formula successful', { id });
      return result;
    } catch (error) {
      logger.error('Failed to delete formula:', error.message);
      throw this.handleError(error, 'deleteFormula');
    }
  }

  /**
   * Handle successful Rails API response
   * @private
   * @param {Object} response - Axios response object
   * @returns {Object} Response data without status/error fields
   * @throws {Error} If response indicates error (status !== 0)
   */
  handleResponse(response) {
    const { status, error_msg, error_code, ...data } = response.data;

    if (status !== 0) {
      const errorMessage = error_msg || 'Unknown Rails API error';
      const errorCode = error_code || 0;
      throw new Error(`Rails API Error: ${errorMessage} (code: ${errorCode})`);
    }

    return data;
  }

  /**
   * Handle error and create appropriate error object
   * @private
   * @param {Error} error - Original error
   * @param {string} operation - Operation name for context
   * @returns {Error} Enhanced error object
   */
  handleError(error, operation) {
    if (error.response) {
      // Server responded with error status
      const { status, error_msg, error_code } = error.response.data || {};
      return new Error(
        `Rails API ${operation} failed: ${error_msg || error.message} (code: ${error_code || 'unknown'})`
      );
    } else if (error.request) {
      // Request was made but no response received
      return new Error(`Rails API ${operation} failed: No response from server (${this.baseUrl})`);
    } else {
      // Error in request setup
      return new Error(`Rails API ${operation} failed: ${error.message}`);
    }
  }

  /**
   * Health check - verify Rails backend is accessible
   * @returns {Promise<boolean>} True if backend is healthy
   */
  async healthCheck() {
    try {
      // Use a simple endpoint to check health
      const params = { token: this.token };
      const data = { private_only: 1 };

      await this.axios.post('/api/cmd_ar_query_formula', data, {
        params,
        timeout: 5000  // Shorter timeout for health check
      });

      logger.info('Rails backend health check: OK');
      return true;
    } catch (error) {
      logger.warn('Rails backend health check: FAILED', { error: error.message });
      return false;
    }
  }
}

export default CaitlynBackendService;

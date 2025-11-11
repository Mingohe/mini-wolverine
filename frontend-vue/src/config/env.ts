/**
 * Environment Configuration
 * Centralized configuration for environment variables
 */

export interface AppConfig {
  title: string
  env: string
  apiBaseUrl: string
  wsBaseUrl: string
  apiEndpoints: {
    futuresSearch: string
    schema: string
    markets: string
    securities: string
    health: string
    // Formula API endpoints
    formulaQuery: string
    formulaSave: string
    formulaDelete: string
  }
  wsConfig: {
    reconnectInterval: number
    maxReconnectAttempts: number
  }
}

/**
 * Get environment variable with fallback
 */
function getEnvVar(key: string, fallback: string = ''): string {
  return import.meta.env[key] || fallback
}

/**
 * Get environment variable as number with fallback
 */
function getEnvNumber(key: string, fallback: number = 0): number {
  const value = import.meta.env[key]
  return value ? parseInt(value, 10) : fallback
}

/**
 * Application configuration
 */
export const appConfig: AppConfig = {
  title: getEnvVar('VITE_APP_TITLE', 'Mini Wolverine'),
  env: getEnvVar('VITE_APP_ENV', 'development'),
  apiBaseUrl: getEnvVar('VITE_API_BASE_URL', 'http://localhost:4000'),
  wsBaseUrl: getEnvVar('VITE_WS_BASE_URL', 'ws://localhost:4000'),
  apiEndpoints: {
    futuresSearch: getEnvVar('VITE_API_FUTURES_SEARCH', '/api/futures/search'),
    schema: getEnvVar('VITE_API_SCHEMA', '/api/schema'),
    markets: getEnvVar('VITE_API_MARKETS', '/api/markets'),
    securities: getEnvVar('VITE_API_SECURITIES', '/api/securities'),
    health: getEnvVar('VITE_API_HEALTH', '/api/health'),
    // Formula API endpoints (all POST methods)
    formulaQuery: '/api/formulas/query',
    formulaSave: '/api/formulas/save',
    formulaDelete: '/api/formulas/delete',
  },
  wsConfig: {
    reconnectInterval: getEnvNumber('VITE_WS_RECONNECT_INTERVAL', 5000),
    maxReconnectAttempts: getEnvNumber('VITE_WS_MAX_RECONNECT_ATTEMPTS', 5),
  },
}

/**
 * Check if running in development mode
 */
export const isDevelopment = appConfig.env === 'development'

/**
 * Check if running in production mode
 */
export const isProduction = appConfig.env === 'production'

/**
 * Get full API URL for an endpoint
 */
export function getApiUrl(endpoint: string): string {
  return `${appConfig.apiBaseUrl}${endpoint}`
}

/**
 * Get full WebSocket URL
 */
export function getWsUrl(): string {
  return appConfig.wsBaseUrl
}

export default appConfig

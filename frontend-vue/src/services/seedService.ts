/**
 * Seed Service - API service for futures/securities data
 * Handles all API calls related to market data, futures, and securities
 */

import { appConfig, getApiUrl } from '@/config/env'

export interface FuturesSearchParams {
  pattern?: string
  market?: string
  limit?: number
  offset?: number
}

export interface FuturesSearchResponse {
  success: boolean
  data: FuturesItem[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  markets: string[]
  marketStats: Record<string, number>
  searchParams: {
    pattern: string | null
    market: string | null
  }
  message?: string
}

export interface FuturesItem {
  symbol: string
  name: string
  market: string
  code?: string
  category?: string
  tradeDay?: number
}

export interface SchemaResponse {
  [namespace: string]: {
    [metaId: string]: {
      name: string
      displayName?: string
      revision: number
      fields: Array<{
        name: string
        type: number
        pos?: number
        precision?: number
        multiple?: boolean
        sampleType?: number
      }>
      description?: string
    }
  }
}

export interface MarketsResponse {
  global: Record<string, any>
  private: Record<string, any>
}

export interface SecuritiesResponse {
  [market: string]: Array<{
    symbol: string
    name: string
    codes?: string[]
    names?: string[]
    categories?: string[]
  }>
}

export interface HealthResponse {
  status: string
  pool?: any
  poolConfig?: any
  timestamp: string
}

class SeedService {
  /**
   * Get the base API URL
   */
  getBaseUrl(): string {
    return appConfig.apiBaseUrl
  }

  /**
   * Get the WebSocket URL
   */
  getWsUrl(): string {
    return appConfig.wsBaseUrl
  }

  /**
   * Search futures/securities with optional filters
   */
  async searchFutures(params: FuturesSearchParams = {}): Promise<FuturesSearchResponse> {
    const searchParams = new URLSearchParams()
    
    if (params.pattern) searchParams.append('pattern', params.pattern)
    if (params.market) searchParams.append('market', params.market)
    if (params.limit) searchParams.append('limit', params.limit.toString())
    if (params.offset) searchParams.append('offset', params.offset.toString())

    const url = `${getApiUrl(appConfig.apiEndpoints.futuresSearch)}?${searchParams.toString()}`
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error searching futures:', error)
      throw new Error(`Failed to search futures: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all futures without filters
   */
  async getAllFutures(): Promise<FuturesSearchResponse> {
    return this.searchFutures()
  }

  /**
   * Get futures by market
   */
  async getFuturesByMarket(market: string): Promise<FuturesSearchResponse> {
    return this.searchFutures({ market })
  }

  /**
   * Search futures by pattern
   */
  async searchFuturesByPattern(pattern: string, market?: string): Promise<FuturesSearchResponse> {
    return this.searchFutures({ pattern, market, limit: 100 })
  }

  /**
   * Get schema data
   */
  async getSchema(): Promise<SchemaResponse> {
    try {
      const response = await fetch(getApiUrl(appConfig.apiEndpoints.schema), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching schema:', error)
      throw new Error(`Failed to fetch schema: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get markets data
   */
  async getMarkets(): Promise<MarketsResponse> {
    try {
      const response = await fetch(getApiUrl(appConfig.apiEndpoints.markets), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching markets:', error)
      throw new Error(`Failed to fetch markets: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get securities data
   */
  async getSecurities(): Promise<SecuritiesResponse> {
    try {
      const response = await fetch(getApiUrl(appConfig.apiEndpoints.securities), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching securities:', error)
      throw new Error(`Failed to fetch securities: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(getApiUrl(appConfig.apiEndpoints.health), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching health status:', error)
      throw new Error(`Failed to fetch health status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get available markets list
   */
  async getAvailableMarkets(): Promise<string[]> {
    try {
      const response = await fetch(getApiUrl('/api/futures/markets'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching available markets:', error)
      throw new Error(`Failed to fetch available markets: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get futures by specific market
   */
  async getFuturesByMarketCode(market: string): Promise<any[]> {
    try {
      const response = await fetch(getApiUrl(`/api/futures/${market}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error(`Error fetching futures for market ${market}:`, error)
      throw new Error(`Failed to fetch futures for market ${market}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Create and export a singleton instance
export const seedService = new SeedService()
export default seedService

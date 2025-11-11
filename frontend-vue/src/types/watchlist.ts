/**
 * Watchlist functionality data type definitions
 */

export interface WatchlistItem {
  market: string;        // "SHFE"
  code: string;          // "CU2405" 或 "CU<00>" (主力合约)
  name?: string;         // "沪铜2405" 或 "沪铜主力"
  category?: string;     // "Future"
  addedAt: Date;
}

export interface WatchlistGroup {
  id: string;
  name: string;
  type: 'builtin' | 'custom';  // 内建组或自定义组
  items: WatchlistItem[];
  createdAt: Date;
  updatedAt: Date;
  color?: string;        // 可选的颜色标识
}

export interface MarketQuote {
  market: string;
  code: string;
  timestamp: number;
  fields: Record<string, any>;  // Dynamic fields - accept any field from any meta
}

export interface FutureContract {
  market: string;
  code: string;
  name?: string;
  category?: string;
  multiplier?: number;
  marginRatio?: number;
  minChangePrice?: number;
  abbreviation?: string;
}

// 排序配置
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// 搜索结果项
export interface SearchResultItem {
  market: string;
  code: string;
  name?: string;
  category?: string;
  abbreviation?: string;
}
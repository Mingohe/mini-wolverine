# Vue Watchlist Frontend Implementation Design

## Project Overview

Based on Mini Wolverine Vue Frontend's Watchlist functionality design, referencing mature interaction patterns from Angular Screener, implementing modern futures instrument management and market data display features.

## 总体架构设计

### 界面布局
```
┌──────────────────────────────────────────────────────────────┐
│                    Toolbar (工具栏)                           │
│  [新建自选] [编辑] [删除] [导入] [导出] [全局搜索: Ctrl+K]      │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                 │
│  左侧面板   │                主体区域                          │
│            │                                                 │
│ 自选组管理  │              票子行情表格                        │
│            │                                                 │
│ □ 内建组   │  Market | Code  | Name    | Close | Volume |... │
│   • 全市场 │  SHFE   | CU2405| 沪铜2405| 73850 | 12589  |... │
│   • 上期所 │  DCE    | C2405 | 玉米2405| 2890  | 45123  |... │
│   • 大商所 │  ...                                           │
│            │                                                 │
│ □ 自定义组 │              SampleQuote 数据展示               │
│   • 我的自选1│                                               │
│   • 我的自选2│                                               │
│   • 能源板块 │                                               │
│                                                             │
└────────────┴─────────────────────────────────────────────────┘
```

## 核心组件设计

### 1. WatchlistTab.vue (主组件)
```vue
<template>
  <div class="watchlist-container">
    <!-- 工具栏 -->
    <WatchlistToolbar
      @create-group="createGroup"
      @edit-group="editGroup"
      @delete-group="deleteGroup"
      @import-data="importData"
      @export-data="exportData"
      @toggle-spotlight="toggleSpotlight"
    />

    <!-- 主内容区 -->
    <div class="watchlist-content">
      <!-- 左侧自选组管理 -->
      <WatchlistSidebar
        :groups="watchlistGroups"
        :selected-group="selectedGroup"
        @select-group="selectGroup"
        @add-item="addItemToGroup"
        @remove-item="removeItemFromGroup"
      />

      <!-- 右侧行情表格 -->
      <WatchlistTable
        :items="selectedGroupItems"
        :loading="isLoading"
        :data="marketData"
        @refresh="refreshData"
        @sort="sortData"
      />
    </div>

    <!-- 全局搜索覆盖层 -->
    <Spotlight
      v-if="spotlightVisible"
      :futures="allFutures"
      :watchlist-groups="watchlistGroups"
      @add-to-watchlist="addToWatchlist"
      @close="closeSpotlight"
    />
  </div>
</template>
```

### 2. 数据模型定义
```typescript
interface WatchlistItem {
  market: string;        // "SHFE"
  code: string;          // "CU2405" 或 "CU<00>" (主力合约)
  name?: string;         // "沪铜2405" 或 "沪铜主力"
  category?: string;     // "Future"
  addedAt: Date;
}

interface WatchlistGroup {
  id: string;
  name: string;
  type: 'builtin' | 'custom';  // 内建组或自定义组
  items: WatchlistItem[];
  createdAt: Date;
  updatedAt: Date;
  color?: string;        // 可选的颜色标识
}

interface MarketQuote {
  market: string;
  code: string;
  timestamp: number;
  fields: {
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
    turnover: number;
    change?: number;
    changeRate?: number;
  };
}
```

### 3. WatchlistSidebar.vue (左侧面板)
```vue
<template>
  <div class="watchlist-sidebar">
    <div class="sidebar-header">
      <h3>Watchlist Management</h3>
    </div>

    <!-- 内建组 -->
    <div class="group-section">
      <h4 class="section-title">内建</h4>
      <div
        v-for="group in builtinGroups"
        :key="group.id"
        :class="['group-item', { active: selectedGroup?.id === group.id }]"
        @click="selectGroup(group)"
      >
        <span class="group-icon">📊</span>
        <span class="group-name">{{ group.name }}</span>
        <span class="group-count">({{ group.items.length }})</span>
      </div>
    </div>

    <!-- 自定义组 -->
    <div class="group-section">
      <h4 class="section-title">自选</h4>
      <div
        v-for="group in customGroups"
        :key="group.id"
        :class="['group-item', { active: selectedGroup?.id === group.id }]"
        @click="selectGroup(group)"
      >
        <span class="group-icon" :style="`color: ${group.color}`">●</span>
        <span class="group-name">{{ group.name }}</span>
        <span class="group-count">({{ group.items.length }})</span>
        <button class="group-delete" @click.stop="deleteGroup(group)">×</button>
      </div>
    </div>

    <!-- 添加新组按钮 -->
    <button class="add-group-btn" @click="createNewGroup">
      + 新建自选组
    </button>
  </div>
</template>
```

### 4. Spotlight.vue (全局搜索)
```vue
<template>
  <div class="spotlight-overlay" @click="close">
    <div class="spotlight-modal" @click.stop>
      <div class="spotlight-header">
        <span class="spotlight-icon">🔍</span>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="搜索期货品种 (ESC 取消)"
          class="spotlight-input"
          @input="performSearch"
          @keydown="handleKeydown"
        />
      </div>

      <div class="spotlight-results" v-if="searchResults.length > 0">
        <div
          v-for="(item, index) in searchResults"
          :key="`${item.market}-${item.code}`"
          :class="['result-item', { selected: selectedIndex === index }]"
          @click="selectItem(item)"
          @mouseover="selectedIndex = index"
        >
          <div class="item-info">
            <span class="item-code">{{ item.code }}</span>
            <span class="item-name">{{ item.name }}</span>
            <span class="item-market">{{ item.market }}</span>
          </div>

          <!-- 添加到自选的下拉菜单 -->
          <div class="item-actions">
            <select @click.stop @change="addToWatchlist(item, $event.target.value)">
              <option value="">添加到...</option>
              <option v-for="group in watchlistGroups" :key="group.id" :value="group.id">
                {{ group.name }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div class="spotlight-footer" v-if="searchQuery.length === 0">
        <div class="shortcut-hints">
          <span>输入品种代码或名称进行搜索</span>
          <div class="shortcuts">
            <kbd>↑↓</kbd> 选择 <kbd>Enter</kbd> 确定 <kbd>ESC</kbd> 取消
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

### 5. WatchlistTable.vue (行情表格)
```vue
<template>
  <div class="watchlist-table-container">
    <div class="table-header">
      <h3>{{ selectedGroup?.name || '选择自选组' }}</h3>
      <div class="table-actions">
        <button @click="refreshData" :disabled="loading">
          {{ loading ? '刷新中...' : '刷新数据' }}
        </button>
        <button @click="exportData">导出</button>
      </div>
    </div>

    <div class="table-content" v-if="items.length > 0">
      <table class="quote-table">
        <thead>
          <tr>
            <th @click="sort('market')">市场</th>
            <th @click="sort('code')">代码</th>
            <th @click="sort('name')">名称</th>
            <th @click="sort('close')" class="number">最新价</th>
            <th @click="sort('change')" class="number">涨跌</th>
            <th @click="sort('changeRate')" class="number">涨跌幅</th>
            <th @click="sort('volume')" class="number">成交量</th>
            <th @click="sort('turnover')" class="number">成交额</th>
            <th class="actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sortedItems" :key="`${item.market}-${item.code}`">
            <td>{{ item.market }}</td>
            <td class="code">{{ item.code }}</td>
            <td>{{ item.name }}</td>
            <td class="number">{{ formatPrice(getQuoteField(item, 'close')) }}</td>
            <td :class="['number', getChangeClass(item)]">
              {{ formatChange(getQuoteField(item, 'change')) }}
            </td>
            <td :class="['number', getChangeClass(item)]">
              {{ formatPercent(getQuoteField(item, 'changeRate')) }}
            </td>
            <td class="number">{{ formatVolume(getQuoteField(item, 'volume')) }}</td>
            <td class="number">{{ formatAmount(getQuoteField(item, 'turnover')) }}</td>
            <td class="actions">
              <button @click="removeFromWatchlist(item)" title="移除">×</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty-state" v-else>
      <div class="empty-icon">📈</div>
      <div class="empty-text">
        {{ selectedGroup ? '暂无自选品种' : '请选择一个自选组' }}
      </div>
      <button v-if="selectedGroup" @click="toggleSpotlight" class="add-first-btn">
        添加第一个品种
      </button>
    </div>
  </div>
</template>
```

## 数据管理设计

### 1. IndexedDB 存储结构
```javascript
// 数据库名: WatchlistDB
// 版本: 1

// 对象存储: watchlistGroups
{
  keyPath: 'id',
  indexes: [
    { name: 'type', keyPath: 'type' },
    { name: 'createdAt', keyPath: 'createdAt' }
  ]
}

// 对象存储: watchlistItems
{
  keyPath: 'id', // 复合键: `${groupId}_${market}_${code}`
  indexes: [
    { name: 'groupId', keyPath: 'groupId' },
    { name: 'market', keyPath: 'market' },
    { name: 'addedAt', keyPath: 'addedAt' }
  ]
}
```

### 2. Pinia Store 设计
```typescript
// stores/watchlistStore.ts
export const useWatchlistStore = defineStore('watchlist', {
  state: () => ({
    groups: [] as WatchlistGroup[],
    selectedGroupId: null as string | null,
    marketData: new Map<string, MarketQuote>(),
    loading: false,
    spotlightVisible: false,
    lastUpdateTime: 0
  }),

  getters: {
    selectedGroup(): WatchlistGroup | null {
      return this.groups.find(g => g.id === this.selectedGroupId) || null;
    },

    builtinGroups(): WatchlistGroup[] {
      return this.groups.filter(g => g.type === 'builtin');
    },

    customGroups(): WatchlistGroup[] {
      return this.groups.filter(g => g.type === 'custom');
    },

    selectedGroupItems(): WatchlistItem[] {
      return this.selectedGroup?.items || [];
    }
  },

  actions: {
    async loadWatchlistsFromDB() {
      // 从 IndexedDB 加载自选组数据
    },

    async saveWatchlistToDB(group: WatchlistGroup) {
      // 保存自选组到 IndexedDB
    },

    async fetchMarketData(items: WatchlistItem[]) {
      // 使用 fetchByTime API 批量获取行情数据
    },

    async addToWatchlist(groupId: string, item: WatchlistItem) {
      // 添加品种到自选组
    },

    async removeFromWatchlist(groupId: string, itemKey: string) {
      // 从自选组移除品种
    }
  }
});
```

## API 集成设计

### 1. 批量获取行情数据
```javascript
// 使用后端的 fetchByTime API (需要实现)
async function fetchWatchlistQuotes(items: WatchlistItem[]) {
  const markets = [...new Set(items.map(item => item.market))];
  const codes = items.map(item => item.code);
  const timeTag = Date.now();

  const response = await wsStore.sendMessage({
    type: 'fetch_by_time',
    markets: markets,
    codes: codes,
    time_tag: timeTag,
    qualified_name: 'SampleQuote',
    namespace: '0',
    revision: -1,
    fields: ['open', 'close', 'high', 'low', 'volume', 'turnover']
  });

  return response.data;
}
```

### 2. 全局快捷键支持
```javascript
// 在 main.ts 或 App.vue 中注册全局快捷键
document.addEventListener('keydown', (event) => {
  // Ctrl+K 或 Cmd+K 打开搜索
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    watchlistStore.showSpotlight();
  }

  // ESC 关闭搜索
  if (event.key === 'Escape') {
    watchlistStore.hideSpotlight();
  }
});
```

## 交互流程设计

### 1. 添加品种到自选流程
```
用户操作: Ctrl+K → 输入搜索关键词 → 选择品种 → 选择目标自选组
系统响应: 搜索匹配 → 显示结果列表 → 添加到组 → 保存到IndexedDB → 更新UI
```

### 2. 查看自选行情流程
```
用户操作: 点击左侧自选组 → 查看右侧行情表格 → 点击刷新
系统响应: 加载组内品种 → 发送fetchByTime请求 → 更新表格数据 → 显示最新行情
```

### 3. 管理自选组流程
```
用户操作: 工具栏点击"新建自选" → 输入组名 → 确定
系统响应: 创建新组对象 → 保存到IndexedDB → 更新左侧列表 → 选中新组
```

## 样式设计要点

### 1. 响应式布局
- 桌面版：左右分栏布局，左侧300px固定宽度
- 移动版：上下布局，左侧面板可折叠
- 平板版：自适应宽度，保持良好可读性

### 2. 视觉风格
- 延续现有 Vue 应用的设计语言
- 使用 PrimeVue 组件保持一致性
- 行情数据使用等宽字体确保对齐
- 涨跌数据使用红绿颜色区分

### 3. 交互反馈
- Loading 状态显示
- 错误状态处理
- 成功操作提示
- 键盘操作支持

## 实现优先级

### Phase 1: 核心功能
1. ✅ 基础组件结构搭建
2. ✅ IndexedDB 存储实现
3. ✅ 自选组管理功能
4. ✅ 基础行情表格展示

### Phase 2: 搜索功能
1. ✅ 全局 Spotlight 搜索
2. ✅ 期货品种搜索和筛选
3. ✅ 添加到自选组功能

### Phase 3: 数据集成
1. ✅ fetchByTime API 集成
2. ✅ 实时数据更新
3. ✅ 错误处理和重试机制

### Phase 4: 增强功能
1. ⭕ 数据导入导出
2. ⭕ 自选组排序拖拽
3. ⭕ 高级筛选和排序
4. ⭕ 个性化设置

## 技术依赖

- **Vue 3**: 核心框架
- **TypeScript**: 类型安全
- **Pinia**: 状态管理
- **PrimeVue**: UI 组件库
- **IndexedDB**: 本地存储
- **WebSocket**: 后端通信

## 总结

This design solution comprehensively considers user experience, technical feasibility, and system scalability, referencing mature Screener interaction patterns and combining modern Vue technology stack to provide a complete watchlist functionality solution for Mini Wolverine.

The solution supports flexible watchlist group management, efficient batch data retrieval, intuitive search and add workflows, and reliable data persistence storage, meeting the core needs of futures traders for watchlist management.
/**
 * IndexedDB utility class - for watchlist data persistence storage
 */

import type { WatchlistGroup, WatchlistItem } from '@/types/watchlist'

const DB_NAME = 'WatchlistDB'
const DB_VERSION = 1
const GROUPS_STORE = 'watchlistGroups'
const ITEMS_STORE = 'watchlistItems'

class WatchlistDB {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建自选组存储
        if (!db.objectStoreNames.contains(GROUPS_STORE)) {
          const groupStore = db.createObjectStore(GROUPS_STORE, { keyPath: 'id' })
          groupStore.createIndex('type', 'type', { unique: false })
          groupStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // 创建自选项目存储
        if (!db.objectStoreNames.contains(ITEMS_STORE)) {
          const itemStore = db.createObjectStore(ITEMS_STORE, { keyPath: 'id' })
          itemStore.createIndex('groupId', 'groupId', { unique: false })
          itemStore.createIndex('market', 'market', { unique: false })
          itemStore.createIndex('addedAt', 'addedAt', { unique: false })
        }
      }
    })
  }

  // 获取所有自选组
  async getAllGroups(): Promise<WatchlistGroup[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([GROUPS_STORE], 'readonly')
      const store = transaction.objectStore(GROUPS_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const groups = (request.result || []).map((group: any) => ({
          ...group,
          createdAt: new Date(group.createdAt),
          updatedAt: new Date(group.updatedAt),
          items: group.items.map((item: any) => ({
            ...item,
            addedAt: new Date(item.addedAt)
          }))
        }))
        resolve(groups)
      }

      request.onerror = () => {
        reject(new Error('Failed to get groups'))
      }
    })
  }

  // 保存自选组
  async saveGroup(group: WatchlistGroup): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([GROUPS_STORE], 'readwrite')
      const store = transaction.objectStore(GROUPS_STORE)

      // Convert Date objects to ISO strings for IndexedDB storage
      const serializableGroup = {
        ...group,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        items: group.items.map(item => ({
          ...item,
          addedAt: item.addedAt.toISOString()
        }))
      }

      const request = store.put(serializableGroup)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to save group'))
      }
    })
  }

  // 删除自选组
  async deleteGroup(groupId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([GROUPS_STORE], 'readwrite')
      const store = transaction.objectStore(GROUPS_STORE)
      const request = store.delete(groupId)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to delete group'))
      }
    })
  }

  // 获取指定组的所有项目
  async getGroupItems(groupId: string): Promise<WatchlistItem[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITEMS_STORE], 'readonly')
      const store = transaction.objectStore(ITEMS_STORE)
      const index = store.index('groupId')
      const request = index.getAll(groupId)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        reject(new Error('Failed to get group items'))
      }
    })
  }

  // 添加项目到组
  async addItemToGroup(groupId: string, item: WatchlistItem): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITEMS_STORE], 'readwrite')
      const store = transaction.objectStore(ITEMS_STORE)

      const itemWithId = {
        ...item,
        id: `${groupId}_${item.market}_${item.code}`,
        groupId
      }

      const request = store.put(itemWithId)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to add item to group'))
      }
    })
  }

  // 从组中移除项目
  async removeItemFromGroup(groupId: string, market: string, code: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITEMS_STORE], 'readwrite')
      const store = transaction.objectStore(ITEMS_STORE)
      const itemId = `${groupId}_${market}_${code}`
      const request = store.delete(itemId)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to remove item from group'))
      }
    })
  }

  // 清空数据库
  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return Promise.all([
      this.clearStore(GROUPS_STORE),
      this.clearStore(ITEMS_STORE)
    ]).then(() => {})
  }

  private async clearStore(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error(`Failed to clear store ${storeName}`))
      }
    })
  }
}

// 创建全局实例
export const watchlistDB = new WatchlistDB()

export default WatchlistDB
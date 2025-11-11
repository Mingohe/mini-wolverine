import { ref } from 'vue'
import type { WebSocketMessage } from '@/types'

export interface TaskCallback {
  resolve: (value: any) => void
  reject: (error: any) => void
  timeout?: number
  timestamp: number
}

export interface TaskOptions {
  timeout?: number // 超时时间（毫秒），默认 30 秒
  retries?: number // 重试次数，默认 0
  retryDelay?: number // 重试延迟（毫秒），默认 1000
}

export interface PendingTask {
  seq: string
  type: string
  callback: TaskCallback
  options: TaskOptions
  retryCount: number
  originalMessage: WebSocketMessage
  timestamp: number
}

class WebSocketTaskService {
  private pendingTasks = ref<Map<string, PendingTask>>(new Map())
  private wsStore: any = null
  private nextSeq = 1
  private cleanupInterval: number | null = null

  // 初始化服务
  initialize(wsStore: any): void {
    this.wsStore = wsStore
    console.log('📡 WebSocketTaskService initialized')
    
    // 设置消息监听
    this.setupMessageListener()
    
    // 启动清理任务
    this.startCleanupTask()
  }

  // 生成唯一的序列号
  private generateSeq(): string {
    return (this.nextSeq++).toString()
  }

  // 设置 WebSocket 消息监听
  private setupMessageListener(): void {
    if (!this.wsStore) {
      console.warn('⚠️ WebSocketTaskService not initialized')
      return
    }

    // 监听 WebSocket store 的消息变化
    this.wsStore.$subscribe((_mutation: any, state: any) => {
      const lastMessage = state.lastMessage
      if (!lastMessage) return

      this.handleIncomingMessage(lastMessage)
    })
  }

  // 处理接收到的消息
  private handleIncomingMessage(message: WebSocketMessage): void {
    // 统一使用 requestId 进行匹配
    const requestId = message.requestId
    
    if (!requestId) {
      // 没有 requestId 的消息，可能是广播消息，不处理
      return
    }

    // 查找对应的待处理任务
    const pendingTask = this.pendingTasks.value.get(requestId)

    if (!pendingTask) {
      // Silently ignore - this might be a real-time push (not a task response)
      return
    }

    console.log(`📨 Task response received for requestId: ${requestId}`, message.type)

    // 清除超时定时器
    if (pendingTask.callback.timeout) {
      clearTimeout(pendingTask.callback.timeout)
    }

    // 从待处理任务中移除
    this.pendingTasks.value.delete(requestId)

    // 根据消息类型处理回调
    if (message.success !== false && !message.error) {
      // 成功响应
      pendingTask.callback.resolve(message)
    } else {
      // 错误响应
      const error = message.error || message.message || 'Unknown error'
      pendingTask.callback.reject(new Error(error))
    }
  }

  // 发送任务并等待响应
  async sendTask<T = any>(
    message: WebSocketMessage, 
    options: TaskOptions = {}
  ): Promise<T> {
    if (!this.wsStore) {
      throw new Error('WebSocketTaskService not initialized')
    }

    if (!this.wsStore.isConnected) {
      throw new Error('Not connected to backend WebSocket')
    }

    const seq = this.generateSeq()
    const defaultOptions: TaskOptions = {
      timeout: 30000, // 30 秒默认超时
      retries: 0,
      retryDelay: 1000
    }

    const finalOptions = { ...defaultOptions, ...options }

    return new Promise<T>((resolve, reject) => {
      // 设置超时定时器
      const timeout = setTimeout(() => {
        this.handleTaskTimeout(seq)
      }, finalOptions.timeout)

      // 创建回调对象
      const callback: TaskCallback = {
        resolve: (value: any) => {
          clearTimeout(timeout)
          resolve(value)
        },
        reject: (error: any) => {
          clearTimeout(timeout)
          reject(error)
        },
        timeout,
        timestamp: Date.now()
      }

      // 创建待处理任务，使用 requestId 作为 key
      const pendingTask: PendingTask = {
        seq,
        type: message.type,
        callback,
        options: finalOptions,
        retryCount: 0,
        originalMessage: { 
          ...message, 
          requestId: seq  // 统一使用 requestId，与后端保持一致
        },
        timestamp: Date.now()
      }

      // 添加到待处理任务队列，使用 requestId 作为 key
      this.pendingTasks.value.set(seq, pendingTask)

      console.log(`📤 Sending task with requestId: ${seq}`, message.type)

      // 发送消息
      this.wsStore.sendMessage(pendingTask.originalMessage)
    })
  }

  // 处理任务超时
  private handleTaskTimeout(requestId: string): void {
    const pendingTask = this.pendingTasks.value.get(requestId)
    if (!pendingTask) return

    console.warn(`⏰ Task timeout for requestId: ${requestId}`, pendingTask.type)

    // 检查是否需要重试
    if (pendingTask.retryCount < pendingTask.options.retries!) {
      pendingTask.retryCount++
      console.log(`🔄 Retrying task ${requestId} (attempt ${pendingTask.retryCount})`)
      
      // 延迟后重试
      setTimeout(() => {
        this.wsStore.sendMessage(pendingTask.originalMessage)
      }, pendingTask.options.retryDelay)
      
      // 重新设置超时
      pendingTask.callback.timeout = setTimeout(() => {
        this.handleTaskTimeout(requestId)
      }, pendingTask.options.timeout)
      
      return
    }

    // 重试次数用完，任务失败
    this.pendingTasks.value.delete(requestId)
    pendingTask.callback.reject(new Error(`Task timeout after ${pendingTask.options.timeout}ms`))
  }

  // 取消任务
  cancelTask(requestId: string): boolean {
    const pendingTask = this.pendingTasks.value.get(requestId)
    if (!pendingTask) return false

    console.log(`❌ Cancelling task: ${requestId}`)

    // 清除超时定时器
    if (pendingTask.callback.timeout) {
      clearTimeout(pendingTask.callback.timeout)
    }

    // 从待处理任务中移除
    this.pendingTasks.value.delete(requestId)

    // 拒绝回调
    pendingTask.callback.reject(new Error('Task cancelled'))

    return true
  }

  // 取消所有任务
  cancelAllTasks(): void {
    console.log(`❌ Cancelling all pending tasks (${this.pendingTasks.value.size})`)
    
    this.pendingTasks.value.forEach((_task, requestId) => {
      this.cancelTask(requestId)
    })
  }

  // 获取待处理任务统计
  getPendingTasksStats() {
    const tasks = Array.from(this.pendingTasks.value.values())
    
    return {
      total: tasks.length,
      byType: tasks.reduce((acc, task) => {
        acc[task.type] = (acc[task.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      oldestTask: tasks.length > 0 ? Math.min(...tasks.map(t => t.timestamp)) : null,
      newestTask: tasks.length > 0 ? Math.max(...tasks.map(t => t.timestamp)) : null
    }
  }

  // 启动清理任务
  private startCleanupTask(): void {
    // 每 5 分钟清理一次超时的任务
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTasks()
    }, 5 * 60 * 1000)
  }

  // 清理过期的任务
  private cleanupExpiredTasks(): void {
    const now = Date.now()
    const maxAge = 10 * 60 * 1000 // 10 分钟

    this.pendingTasks.value.forEach((task, requestId) => {
      if (now - task.timestamp > maxAge) {
        console.warn(`🧹 Cleaning up expired task: ${requestId}`)
        this.cancelTask(requestId)
      }
    })
  }

  // 销毁服务
  destroy(): void {
    console.log('🗑️ Destroying WebSocketTaskService')
    
    // 取消所有待处理任务
    this.cancelAllTasks()
    
    // 清除清理定时器
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    // 清理引用
    this.wsStore = null
  }
}

// 创建单例实例
export const websocketTaskService = new WebSocketTaskService()

// 导出类用于测试
export { WebSocketTaskService }

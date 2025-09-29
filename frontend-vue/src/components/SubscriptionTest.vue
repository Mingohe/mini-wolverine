<template>
  <div class="subscription-test">
    <h2>📡 Subscription Test Page</h2>
    
    <div class="test-section">
      <h3>🧪 Test Real-time Subscription</h3>
      <p>Testing with NYMEX/CL&lt;00&gt; SampleQuote data (should have real-time updates)</p>
      
      <div class="test-controls">
        <button 
          @click="startTest" 
          :disabled="isSubscribed"
          class="btn btn-primary"
        >
          Start Test Subscription
        </button>
        
        <button 
          @click="stopTest" 
          :disabled="!isSubscribed"
          class="btn btn-danger"
        >
          Stop Test Subscription
        </button>
      </div>
      
      <div class="test-status">
        <p><strong>Status:</strong> {{ isSubscribed ? '🟢 Subscribed' : '🔴 Not Subscribed' }}</p>
        <p><strong>Subscriber ID:</strong> {{ subscriberId || 'None' }}</p>
        <p><strong>Messages Received:</strong> {{ messageCount }}</p>
        <p><strong>Last Update:</strong> {{ lastUpdate || 'Never' }}</p>
      </div>
    </div>
    
    <div class="test-results">
      <h3>📊 Test Results</h3>
      <div class="messages-container">
        <div 
          v-for="(message, index) in messages" 
          :key="index"
          class="message-item"
        >
          <div class="message-header">
            <span class="timestamp">{{ message.timestamp }}</span>
            <span class="message-type">{{ message.type }}</span>
          </div>
          <div class="message-content">
            <pre>{{ JSON.stringify(message.data, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { subscriptionService } from '../services/subscriptionService'
import { useWebSocketStore } from '../stores/websocketStore'

const wsStore = useWebSocketStore()

// Test state
const isSubscribed = ref(false)
const subscriberId = ref(null)
const messageCount = ref(0)
const lastUpdate = ref(null)
const messages = ref([])

// Test parameters
const testParams = {
  markets: ["NYMEX"],
  codes: ["CL<00>"],
  qualifiedNames: ["global::SampleQuote"],
  namespace: "global",
  options: {
    granularities: [86400],
    fields: ["open", "close", "low", "high", "volume"],
    start: 0,
    end: 10,
    sort: [],
    direction: [],
    filters: []
  }
}

const startTest = async () => {
  try {
    console.log('🧪 Starting subscription test with params:', testParams)

    // 使用 subscriptionService 的新方法，带有实时数据回调
    const subscriptionId = await subscriptionService.subscribeWithCallback(
      testParams,
      (realTimeData) => {
        // 处理实时数据回调
        console.log('📊 Real-time data received via callback:', realTimeData)

        messageCount.value++
        lastUpdate.value = new Date().toLocaleTimeString()

        const messageData = {
          timestamp: new Date().toLocaleTimeString(),
          type: 'real_time_data',
          data: realTimeData.data || realTimeData
        }

        messages.value.unshift(messageData)

        // Keep only last 20 messages
        if (messages.value.length > 20) {
          messages.value = messages.value.slice(0, 20)
        }
      }
    )

    subscriberId.value = subscriptionId
    isSubscribed.value = true
    console.log('✅ Test subscription established with callback:', subscriptionId)

  } catch (error) {
    console.error('❌ Test subscription failed:', error)
    alert('Test subscription failed: ' + error.message)
  }
}

const stopTest = async () => {
  if (!subscriberId.value) return

  try {
    console.log('⏹️ Stopping test subscription:', subscriberId.value)

    // 使用 subscriptionService 取消订阅，会自动清理回调
    const success = await subscriptionService.unsubscribe(subscriberId.value)

    if (success) {
      isSubscribed.value = false
      subscriberId.value = null
      console.log('✅ Test subscription stopped and callbacks cleared')
    } else {
      console.warn('⚠️ Unsubscription may have failed, but marking as stopped')
      isSubscribed.value = false
      subscriberId.value = null
    }

  } catch (error) {
    console.error('❌ Test unsubscription failed:', error)
    alert('Test unsubscription failed: ' + error.message)
  }
}

// Lifecycle
onMounted(() => {
  // 初始化 subscriptionService
  subscriptionService.initialize(wsStore)
  console.log('📡 SubscriptionTest component mounted and service initialized')
})

onUnmounted(() => {
  // 停止订阅并清理
  if (isSubscribed.value) {
    stopTest()
  }
  console.log('📡 SubscriptionTest component unmounted')
})
</script>

<style scoped>
.subscription-test {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.test-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.test-controls {
  margin: 15px 0;
}

.btn {
  padding: 10px 20px;
  margin-right: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.test-status {
  background: white;
  padding: 15px;
  border-radius: 4px;
  margin-top: 15px;
}

.test-status p {
  margin: 5px 0;
}

.test-results {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
}

.messages-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
}

.message-item {
  border-bottom: 1px solid #dee2e6;
  padding: 10px;
}

.message-item:last-child {
  border-bottom: none;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 12px;
  color: #6c757d;
}

.timestamp {
  font-weight: 500;
}

.message-type {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.message-content pre {
  margin: 0;
  font-size: 11px;
  background: #f8f9fa;
  padding: 8px;
  border-radius: 3px;
  overflow-x: auto;
}
</style>

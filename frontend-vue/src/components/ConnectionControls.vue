<template>
  <div class="container">
    <div class="connection-row">
      <div class="connection-info">
        <div class="status-dot" :class="{ connected: isConnected && caitlynConnected }"></div>
        <div>
          <div class="connection-text">{{ connectionStatus }}</div>
          <div class="connection-status">{{ connectionDetails }}</div>
        </div>
      </div>
      
      <button
        class="btn"
        :class="isConnected && caitlynConnected ? 'btn-danger' : 'btn-primary'"
        @click="handleAction"
        :disabled="isConnecting"
      >
        {{ getButtonText() }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useWebSocketStore } from '../stores/websocketStore'

const wsStore = useWebSocketStore();

// Use storeToRefs to maintain reactivity when destructuring
const {
  isConnected,
  caitlynConnected,
  isConnecting,
  connectionStatus,
  connectionDetails
} = storeToRefs(wsStore)

// Actions don't need to be reactive, so we can destructure them directly
const {
  connectToBackend,
  disconnectFromBackend
} = wsStore

const handleAction = () => {
  console.log('🔘 ConnectionControls: Button clicked', {
    isConnected: isConnected.value,
    caitlynConnected: caitlynConnected.value,
    isConnecting: isConnecting.value
  })
  
  if (!isConnected.value) {
    console.log('🔌 ConnectionControls: Starting connection...')
    connectToBackend()
  } else if (isConnected.value && !caitlynConnected.value) {
    // If stuck in connecting state, allow reset
    console.log('Backend is ready, Caitlyn connection should initialize automatically')
    // If it's been stuck for too long, allow manual reset
    setTimeout(() => {
      if (isConnected.value && !caitlynConnected.value) {
        console.log('⚠️ Connection seems stuck, allowing manual reset')
      }
    }, 5000)
  } else {
    console.log('🔌 ConnectionControls: Disconnecting...')
    disconnectFromBackend()
  }
}

const getButtonText = () => {
  if (!isConnected.value) return 'Connect'
  if (isConnected.value && !caitlynConnected.value) return 'Connecting...'
  return 'Disconnect'
}
</script>

<style scoped>
.container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.connection-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

@media (max-width: 768px) {
  .connection-row {
    flex-direction: column;
    align-items: stretch;
  }
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc3545;
}

.status-dot.connected {
  background: #28a745;
}

.connection-text {
  font-size: 14px;
  color: #212529;
  font-weight: 500;
}

.connection-status {
  font-size: 12px;
  color: #6c757d;
}

.btn {
  background: #0066cc;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:hover:not(:disabled) {
  background: #0052a3;
}

.btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-danger {
  background: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}
</style>

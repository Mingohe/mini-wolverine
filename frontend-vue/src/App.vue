<template>
  <div class="wrapper">
    <header class="header">
      <h1 class="title">Mini Wolverine</h1>
      <p class="subtitle">Financial Data Processing Platform with Schema & Revision Management</p>
    </header>
    
    <ConnectionControls />
    <TabSection />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useWebSocketStore } from './stores/websocketStore'
import ConnectionControls from './components/ConnectionControls.vue'
import TabSection from './components/TabSection.vue'

const isInitialized = ref<boolean>(false)
const initError = ref<string | null>(null)
const wsStore = useWebSocketStore()

onMounted(async () => {
  try {
    // Initialize application
    console.log('🚀 Mini Wolverine Vue App initializing...')
    
    // Check for basic browser capabilities
    const capabilities = {
      webSocket: typeof WebSocket !== 'undefined'
    }

    console.log('Browser capabilities:', capabilities)

    if (!capabilities.webSocket) {
      throw new Error('WebSocket not supported in this browser')
    }

    // Load saved credentials and initialize connection
    wsStore.loadSavedCredentials()
    wsStore.initializeConnection()

    isInitialized.value = true
    console.log('✅ Mini Wolverine Vue App initialized successfully')
    
  } catch (error: any) {
    console.error('❌ Failed to initialize Mini Wolverine:', error)
    initError.value = error.message
  }
})
</script>

<style scoped>
.wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  background: #f8f9fa;
}

.header {
  margin-bottom: 24px;
  text-align: center;
}

.title {
  margin: 0 0 8px 0;
  color: #212529;
  font-size: 24px;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  color: #6c757d;
  font-size: 14px;
}
</style>

<template>
  <div class="resizable-splitter" ref="containerRef">
    <div class="left-panel" :style="{ width: leftWidth + 'px' }">
      <slot name="left"></slot>
    </div>

    <div
      class="resize-handle"
      @mousedown="startResize"
      @touchstart="startResize"
    >
      <div class="resize-handle-icon"></div>
    </div>

    <div class="right-panel">
      <slot name="right"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  minLeftWidth: {
    type: Number,
    default: 240
  },
  maxLeftWidth: {
    type: Number,
    default: 600
  },
  defaultLeftWidth: {
    type: Number,
    default: 320
  }
})

const emit = defineEmits<{
  resize: [width: number]
}>()

const containerRef = ref<HTMLElement | null>(null)
const leftWidth = ref(props.defaultLeftWidth)
const isResizing = ref(false)

function startResize(e: MouseEvent | TouchEvent) {
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  e.preventDefault()
}

function handleResize(e: MouseEvent | TouchEvent) {
  if (!isResizing.value || !containerRef.value) return

  const containerRect = containerRef.value.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const newWidth = clientX - containerRect.left

  // Constrain width within min/max bounds
  if (newWidth >= props.minLeftWidth && newWidth <= props.maxLeftWidth) {
    leftWidth.value = newWidth
    emit('resize', newWidth)
  }
}

function stopResize() {
  if (isResizing.value) {
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
}

onMounted(() => {
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.addEventListener('touchmove', handleResize)
  document.addEventListener('touchend', stopResize)

  // Restore saved width from localStorage
  const savedWidth = localStorage.getItem('formula-splitter-width')
  if (savedWidth) {
    const width = parseInt(savedWidth, 10)
    if (width >= props.minLeftWidth && width <= props.maxLeftWidth) {
      leftWidth.value = width
    }
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', handleResize)
  document.removeEventListener('touchend', stopResize)

  // Save width to localStorage
  localStorage.setItem('formula-splitter-width', leftWidth.value.toString())
})
</script>

<style scoped>
.resizable-splitter {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: #f9fafb;
}

.left-panel {
  flex-shrink: 0;
  overflow: auto;
  border-right: 1px solid #e5e7eb;
  background: white;
}

.resize-handle {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background: #e5e7eb;
  position: relative;
  transition: background-color 0.2s;
}

.resize-handle:hover {
  background: #0066cc;
}

.resize-handle-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 40px;
  background: #9ca3af;
  border-radius: 1px;
}

.resize-handle:hover .resize-handle-icon {
  background: white;
}

.right-panel {
  flex: 1;
  overflow: auto;
  background: white;
}
</style>

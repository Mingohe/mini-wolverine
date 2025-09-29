<template>
  <div class="group-dialog-overlay" @click="handleOverlayClick">
    <div class="group-dialog" @click.stop>
      <!-- 标题栏 -->
      <div class="dialog-header">
        <h3 class="dialog-title">
          {{ mode === 'create' ? 'Create New Watchlist' : 'Edit Watchlist' }}
        </h3>
        <button class="close-btn" @click="$emit('cancel')">×</button>
      </div>

      <!-- 表单内容 -->
      <div class="dialog-content">
        <div class="form-group">
          <label class="form-label">Group Name <span class="required">*</span></label>
          <input
            ref="nameInput"
            v-model="formData.name"
            type="text"
            class="form-input"
            placeholder="Enter watchlist name"
            maxlength="20"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Identifier Color</label>
          <div class="color-options">
            <label
              v-for="color in colorOptions"
              :key="color.value"
              :class="['color-option', { selected: formData.color === color.value }]"
            >
              <input
                type="radio"
                :value="color.value"
                v-model="formData.color"
              />
              <span class="color-dot" :style="{ backgroundColor: color.value }"></span>
              <span class="color-name">{{ color.name }}</span>
            </label>
          </div>
        </div>

        <!-- 编辑模式下显示统计信息 -->
        <div v-if="mode === 'edit' && group" class="group-stats">
          <div class="stat-row">
            <span>Items included:</span>
            <strong>{{ group.items?.length || 0 }} items</strong>
          </div>
          <div class="stat-row">
            <span>Created at:</span>
            <span>{{ formatDate(group.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="$emit('cancel')">
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click="handleSubmit"
          :disabled="!isFormValid"
        >
          {{ mode === 'create' ? 'Create' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import type { WatchlistGroup } from '@/types/watchlist'

// Props
interface Props {
  mode: 'create' | 'edit'
  group: WatchlistGroup | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'save': [data: { name: string; color?: string }]
  'cancel': []
}>()

// Refs
const nameInput = ref<HTMLInputElement>()

// 表单数据
const formData = ref({
  name: '',
  color: '#0066cc'
})

// 颜色选项
const colorOptions = [
  { name: 'Blue', value: '#0066cc' },
  { name: 'Green', value: '#28a745' },
  { name: 'Orange', value: '#fd7e14' },
  { name: 'Red', value: '#dc3545' },
  { name: 'Purple', value: '#6f42c1' },
  { name: 'Cyan', value: '#20c997' },
  { name: 'Pink', value: '#e83e8c' },
  { name: 'Gray', value: '#6c757d' }
]

// 计算属性
const isFormValid = computed(() => {
  return formData.value.name.trim().length > 0
})

// 监听props变化
watch(() => props.group, (newGroup) => {
  if (newGroup && props.mode === 'edit') {
    formData.value = {
      name: newGroup.name,
      color: newGroup.color || '#0066cc'
    }
  }
}, { immediate: true })

// 生命周期
onMounted(() => {
  nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
})

// 方法
const handleSubmit = () => {
  if (!isFormValid.value) return

  emit('save', {
    name: formData.value.name.trim(),
    color: formData.value.color
  })
}

const handleOverlayClick = () => {
  emit('cancel')
}

const formatDate = (date: Date): string => {
  if (!date) return 'Unknown'
  return new Date(date).toLocaleString('en-US')
}
</script>

<style scoped>
.group-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  padding: 20px;
}

.group-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 400px;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.dialog-content {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
  font-size: 13px;
}

.required {
  color: #ef4444;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #1f2937;
  background: white;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.color-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.color-option {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: white;
}

.color-option:hover {
  border-color: #d1d5db;
  background: #f9fafb;
}

.color-option.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.color-option input {
  display: none;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 6px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.color-name {
  font-size: 12px;
  color: #4b5563;
  font-weight: 400;
}

.group-stats {
  background: #f9fafb;
  border-radius: 6px;
  padding: 12px;
  margin-top: 4px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
}

.stat-row:last-child {
  margin-bottom: 0;
}

.stat-row span:first-child {
  color: #6b7280;
}

.stat-row strong {
  color: #1f2937;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  min-width: 70px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

/* 响应式 */
@media (max-width: 640px) {
  .group-dialog {
    max-width: none;
    margin: 10px;
  }

  .color-options {
    grid-template-columns: repeat(2, 1fr);
  }

  .dialog-footer {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
  }
}
</style>
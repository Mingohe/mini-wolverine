# 表格排序改进 - 实时数据可见性优化

## 问题描述

在表格模式下，订阅的实时数据按时间正序排列，新数据会追加到表格底部，用户可能看不到最新的数据变化。

## 解决方案

### 1. 时间倒序排列

将表格数据按时间倒序排列，确保最新的数据显示在顶部：

```typescript
const paginatedData = computed(() => {
  // 按时间倒序排列（最新的数据在前）
  const sortedData = [...formulaData.value].sort((a, b) => {
    const timeA = a.time_tag || a.timestamp
    const timeB = b.time_tag || b.timestamp
    
    // 转换为数字时间戳进行比较
    const timestampA = typeof timeA === 'string' ? parseInt(timeA) : timeA
    const timestampB = typeof timeB === 'string' ? parseInt(timeB) : timeB
    
    return timestampB - timestampA // 倒序：新的在前
  })
  
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return sortedData.slice(start, end)
})
```

### 2. 自动跳转到第一页

当接收到新的实时数据时，自动跳转到第一页，确保用户能看到最新数据：

```typescript
// 在 WebSocket 消息处理中
formulaData.value = [...formulaData.value, ...newData]

// 跳转到第一页以显示最新数据
if (viewMode.value === 'table') {
  currentPage.value = 1
}

// 在订阅 Store 数据处理中
formulaData.value = [...formulaData.value, ...newFormulaData]

// 跳转到第一页以显示最新数据
if (viewMode.value === 'table') {
  currentPage.value = 1
}
```

### 3. 排序指示器

在表格头部添加排序指示器，让用户知道数据是按时间倒序排列的：

```html
<th class="data-header">
  Timestamp
  <span class="sort-indicator">↓</span>
</th>
```

```css
.sort-indicator {
  color: #0066cc;
  font-size: 12px;
  margin-left: 4px;
  font-weight: bold;
}
```

## 技术细节

### 时间戳处理

支持多种时间戳格式：
- `time_tag`：数字时间戳（优先使用）
- `timestamp`：字符串或数字时间戳（备用）

```typescript
const timeA = a.time_tag || a.timestamp
const timeB = b.time_tag || b.timestamp

// 转换为数字时间戳进行比较
const timestampA = typeof timeA === 'string' ? parseInt(timeA) : timeA
const timestampB = typeof timeB === 'string' ? parseInt(timeB) : timeB
```

### 排序逻辑

```typescript
return timestampB - timestampA // 倒序：新的在前
```

- `timestampB - timestampA`：倒序排列
- 最新时间戳的数据排在前面
- 确保实时数据立即可见

## 用户体验改进

### 1. 实时数据可见性
- ✅ 新数据立即显示在表格顶部
- ✅ 用户无需滚动到底部查看最新数据
- ✅ 实时订阅状态清晰可见

### 2. 自动导航
- ✅ 接收到新数据时自动跳转到第一页
- ✅ 确保用户始终看到最新数据
- ✅ 减少手动操作需求

### 3. 视觉指示
- ✅ 排序指示器显示当前排序方式
- ✅ 蓝色箭头表示倒序排列
- ✅ 清晰的视觉反馈

## 兼容性

### 图表模式
- ✅ 图表模式不受影响
- ✅ 保持原有的时间正序排列
- ✅ 图表渲染逻辑不变

### 分页功能
- ✅ 分页功能正常工作
- ✅ 排序后的数据正确分页
- ✅ 页码计算准确

### 数据格式
- ✅ 支持多种时间戳格式
- ✅ 向后兼容现有数据
- ✅ 处理字符串和数字时间戳

## 测试场景

### 1. 基本排序
- 执行公式获取历史数据
- 验证数据按时间倒序排列
- 确认最新数据在顶部

### 2. 实时订阅
- 启用实时订阅
- 接收新的实时数据
- 验证新数据出现在表格顶部
- 确认自动跳转到第一页

### 3. 分页功能
- 数据量超过一页
- 验证分页正常工作
- 确认排序在分页中保持一致

### 4. 视图切换
- 在表格和图表模式间切换
- 验证排序只影响表格模式
- 确认图表模式保持原有行为

## 总结

这次改进解决了实时数据可见性问题：

1. **时间倒序排列**：最新数据显示在表格顶部
2. **自动页面跳转**：新数据到达时自动显示在第一页
3. **视觉指示器**：清晰显示当前排序方式
4. **向后兼容**：不影响现有功能和图表模式

用户现在可以立即看到最新的订阅数据，大大提升了实时数据监控的用户体验。

# Formula Chart Axis Utility

This directory contains utility functions for the Formula Viewer component, specifically for handling chart X-axis formatting.

## FormulaChartAxisUtil.ts

A comprehensive utility class for formatting chart X-axis labels based on data granularity, density, and time patterns. This utility is inspired by the `axis-util.ts` pattern from the wolverine-dev project.

### Features

- **Smart Timestamp Formatting**: Automatically formats timestamps based on granularity and data density
- **Multi-granularity Support**: Handles minute-level, hourly, daily, weekly, and monthly data
- **Tick Configuration**: Generates optimal tick positions and formatters for chart rendering
- **Locale Support**: Supports different locales for timestamp formatting
- **Timezone Awareness**: Handles timezone offsets for accurate time display

### Usage

#### Basic Timestamp Formatting

```typescript
import { FormulaChartAxisUtil } from '@/utils/FormulaChartAxisUtil'

const formatted = FormulaChartAxisUtil.formatTimestamp(timestamp, {
  granularity: 3600, // 1 hour
  dataLength: 100,
  index: 0,
  timezone: -8, // UTC-8
  locale: 'zh-CN'
})
```

#### Generate Tick Configuration

```typescript
const tickConfig = FormulaChartAxisUtil.generateTickConfiguration(data, granularity, {
  timezone: -8,
  maxTicks: 8,
  chartWidth: 800
})

// Use the configuration
tickConfig.tickValues.forEach(tickIndex => {
  const formatter = tickConfig.tickFormatters[tickIndex]
  const label = formatter(data[tickIndex].timestamp)
  // Draw label on chart
})
```

#### Locale-specific Formatting

```typescript
const formatted = FormulaChartAxisUtil.formatTimestampForLocale(
  timestamp, 
  'en-US', 
  { year: 'numeric', month: 'short', day: 'numeric' }
)
```

### Granularity Support

The utility supports the following granularities:

- **≤ 3600 seconds (≤ 1 hour)**: Minute-level formatting with smart hour/minute display
- **86400 seconds (1 day)**: Daily formatting with year/month/day display
- **604800 seconds (1 week)**: Weekly formatting with year/month display
- **2592000 seconds (1 month)**: Monthly formatting with year/month display

### Integration with FormulaViewer.vue

The FormulaViewer component has been updated to use this utility:

1. **Import**: Added import for `FormulaChartAxisUtil`
2. **Format Function**: Replaced the inline `formatTimestamp` function with a call to the utility
3. **Chart Rendering**: Updated chart rendering to use `generateTickConfiguration` for better X-axis formatting

### Example File

See `FormulaChartAxisUtil.example.ts` for comprehensive usage examples including:

- Basic timestamp formatting
- Tick configuration generation
- Different granularity handling
- Locale-specific formatting
- Chart integration patterns

### API Reference

#### `formatTimestamp(timestamp, options)`

Formats a single timestamp based on granularity and context.

**Parameters:**
- `timestamp`: string | number - The timestamp to format
- `options`: AxisFormatterOptions - Configuration options

**Returns:** string - Formatted timestamp string

#### `generateTickConfiguration(data, granularity, options)`

Generates tick positions and formatters for chart X-axis.

**Parameters:**
- `data`: Array of data objects with timestamps
- `granularity`: number - Time granularity in seconds
- `options`: Configuration options

**Returns:** TickConfiguration - Object with tickValues and tickFormatters

#### `formatTimestampForLocale(timestamp, locale, options)`

Formats timestamp using Intl.DateTimeFormat.

**Parameters:**
- `timestamp`: string | number - The timestamp to format
- `locale`: string - Locale string (e.g., 'zh-CN', 'en-US')
- `options`: Intl.DateTimeFormatOptions - Formatting options

**Returns:** string - Locale-formatted timestamp

#### `calculateOptimalTickSpacing(dataLength, chartWidth, minTickSpacing)`

Calculates optimal spacing between ticks based on data density and chart width.

**Parameters:**
- `dataLength`: number - Number of data points
- `chartWidth`: number - Width of the chart in pixels
- `minTickSpacing`: number - Minimum spacing between ticks (default: 60)

**Returns:** number - Optimal tick spacing

### Migration from Inline Formatting

The original inline `formatTimestamp` function in FormulaViewer.vue has been replaced with a call to the utility:

**Before:**
```typescript
const formatTimestamp = (timestamp, granularity, dataLength, index) => {
  // 80+ lines of inline formatting logic
}
```

**After:**
```typescript
const formatTimestamp = (timestamp, granularity, dataLength, index) => {
  const previousTimestamp = index > 0 ? formulaData.value[index - 1]?.timestamp : undefined
  
  return FormulaChartAxisUtil.formatTimestamp(timestamp, {
    granularity,
    dataLength,
    index,
    previousTimestamp,
    timezone: -(new Date().getTimezoneOffset() / 60),
    locale: 'zh-CN'
  })
}
```

This provides better maintainability, reusability, and testability while maintaining the same functionality.

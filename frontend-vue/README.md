# Mini Wolverine Frontend - Vue 3 + Vite + TypeScript

This is the Vue 3 + Vite + TypeScript version of the Mini Wolverine frontend, providing a modern, type-safe, reactive interface for the financial data processing platform.

## Features

- **Vue 3 Composition API** - Modern reactive framework
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and development server
- **Pinia** - State management (replaces React Context)
- **WebSocket Integration** - Real-time data streaming
- **Schema Viewer** - Interactive schema and revision management
- **Historical Data Query** - Query and visualize historical market data
- **Responsive Design** - Mobile-friendly interface

## Project Structure

```
frontend-vue/
├── src/
│   ├── components/          # Vue components
│   │   ├── ConnectionControls.vue
│   │   ├── TabSection.vue
│   │   ├── SchemaViewer.vue
│   │   └── HistoricalDataQuery.vue
│   ├── stores/              # Pinia stores (state management)
│   │   ├── dataStore.ts
│   │   └── websocketStore.ts
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   └── storage.ts
│   ├── App.vue              # Main application component
│   ├── main.ts              # Application entry point
│   ├── style.css            # Global styles
│   └── vite-env.d.ts        # Vite environment types
├── public/                  # Static assets
├── Dockerfile.dev           # Development Docker configuration
├── Dockerfile.prod          # Production Docker configuration
├── nginx.conf               # Nginx configuration for production
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── tsconfig.node.json       # TypeScript configuration for Node.js
└── package.json             # Dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3001`

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_BACKEND_WS_URL=ws://localhost:4000
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production (with type checking)
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint

## Docker Support

### Development

```bash
docker build -f Dockerfile.dev -t mini-wolverine-vue-dev .
docker run -p 3001:3001 mini-wolverine-vue-dev
```

### Production

```bash
docker build -f Dockerfile.prod -t mini-wolverine-vue-prod .
docker run -p 80:80 mini-wolverine-vue-prod
```

## Architecture

### State Management

The application uses Pinia stores instead of React Context:

- **dataStore** - Manages schema, market data, securities, and logs
- **websocketStore** - Handles WebSocket connections and real-time data

### Components

- **ConnectionControls** - WebSocket connection management
- **TabSection** - Main tabbed interface
- **SchemaViewer** - Interactive schema browser with field definitions
- **HistoricalDataQuery** - Query interface for historical data

### Key Differences from React Version

1. **State Management**: Pinia stores replace React Context
2. **Reactivity**: Vue's reactive system instead of React hooks
3. **Template Syntax**: Vue's template syntax instead of JSX
4. **Build Tool**: Vite instead of Create React App
5. **Styling**: Scoped CSS instead of styled-components
6. **Type Safety**: TypeScript for better development experience
7. **Type Definitions**: Comprehensive type definitions for WebSocket messages and data structures

## API Integration

The Vue frontend connects to the same backend WebSocket API as the React version:

- WebSocket connection to backend
- Real-time schema updates
- Historical data queries
- Market data streaming
- Connection pool management

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Contributing

1. Follow Vue 3 Composition API patterns
2. Use Pinia for state management
3. Maintain consistency with the React version's functionality
4. Add proper TypeScript types for all new code
5. Use strict TypeScript configuration
6. Test WebSocket connectivity thoroughly
7. Run type checking before committing: `npm run type-check`

## License

Same as the main Mini Wolverine project.

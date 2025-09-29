# Environment Setup Guide

This guide explains how to configure environment variables for the Mini Wolverine frontend application.

## Environment Files

The application uses environment variables to configure API endpoints and other settings. You need to create environment files based on your deployment environment.

### Development Environment

Create a `.env.development` file in the `frontend-vue` directory:

```bash
# Development Environment Configuration
VITE_APP_TITLE=Mini Wolverine - Development
VITE_APP_ENV=development

# Backend API Configuration
VITE_API_BASE_URL=http://localhost:4000
VITE_WS_BASE_URL=ws://localhost:4000

# API Endpoints
VITE_API_FUTURES_SEARCH=/api/futures/search
VITE_API_SCHEMA=/api/schema
VITE_API_MARKETS=/api/markets
VITE_API_SECURITIES=/api/securities
VITE_API_HEALTH=/api/health

# WebSocket Configuration
VITE_WS_RECONNECT_INTERVAL=5000
VITE_WS_MAX_RECONNECT_ATTEMPTS=5
```

### Production Environment

Create a `.env.production` file in the `frontend-vue` directory:

```bash
# Production Environment Configuration
VITE_APP_TITLE=Mini Wolverine
VITE_APP_ENV=production

# Backend API Configuration
VITE_API_BASE_URL=https://your-production-api.com
VITE_WS_BASE_URL=wss://your-production-ws.com

# API Endpoints
VITE_API_FUTURES_SEARCH=/api/futures/search
VITE_API_SCHEMA=/api/schema
VITE_API_MARKETS=/api/markets
VITE_API_SECURITIES=/api/securities
VITE_API_HEALTH=/api/health

# WebSocket Configuration
VITE_WS_RECONNECT_INTERVAL=5000
VITE_WS_MAX_RECONNECT_ATTEMPTS=5
```

## Environment Variables Reference

### Application Configuration

- `VITE_APP_TITLE`: Application title displayed in the browser
- `VITE_APP_ENV`: Environment identifier (development/production)

### Backend Configuration

- `VITE_API_BASE_URL`: Base URL for HTTP API calls
- `VITE_WS_BASE_URL`: Base URL for WebSocket connections

### API Endpoints

- `VITE_API_FUTURES_SEARCH`: Endpoint for searching futures/securities
- `VITE_API_SCHEMA`: Endpoint for fetching schema data
- `VITE_API_MARKETS`: Endpoint for fetching markets data
- `VITE_API_SECURITIES`: Endpoint for fetching securities data
- `VITE_API_HEALTH`: Endpoint for health checks

### WebSocket Configuration

- `VITE_WS_RECONNECT_INTERVAL`: Interval between reconnection attempts (milliseconds)
- `VITE_WS_MAX_RECONNECT_ATTEMPTS`: Maximum number of reconnection attempts

## Quick Setup

1. Copy the example file:
   ```bash
   cp env.example .env.development
   ```

2. Modify the values in `.env.development` according to your development setup

3. For production, create `.env.production` with your production URLs

## Vite Configuration

The application uses Vite's built-in environment variable support. All variables prefixed with `VITE_` are automatically available in the application code.

The Vite configuration includes proxy settings for development:
- `/api/*` requests are proxied to the backend API
- `/ws/*` requests are proxied to the WebSocket server

## Service Usage

The application uses the `seedService` for all API calls. The service automatically uses the configured environment variables:

```typescript
import { seedService } from '@/services/seedService'

// Search futures
const result = await seedService.searchFutures({ pattern: 'AAPL' })

// Get all futures
const allFutures = await seedService.getAllFutures()

// Get schema
const schema = await seedService.getSchema()
```

## Troubleshooting

### Common Issues

1. **API calls failing**: Check that `VITE_API_BASE_URL` is correct and the backend is running
2. **WebSocket connection issues**: Verify `VITE_WS_BASE_URL` and ensure the WebSocket server is accessible
3. **Environment variables not loading**: Make sure the file is named correctly (`.env.development` or `.env.production`) and is in the `frontend-vue` directory

### Development vs Production

- **Development**: Uses localhost URLs and includes development-specific settings
- **Production**: Uses production URLs and optimized settings for performance

Make sure to use the correct environment file for your deployment target.

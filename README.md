# 🐺 Mini Wolverine

**Empowering Financial Researchers and Engineers with Wolverine's Global Data Infrastructure**

A modern full-stack financial data processing application that enables financial researchers and engineers to leverage the powerful Wolverine ecosystem through a lightweight WASM binding (< 1MB). This **backend-frontend architecture** allows users to build fully functioning, rich visualization systems on top of Wolverine's comprehensive global datasets without the tedious work of building base infrastructure.

**Core Philosophy**: Fully functioning, minimized, and **AI-friendly** - perfect for AI coding agents like Cursor and Claude Code.

## 🚀 One-Click Setup (For AI Agents & Humans)

**If you have received these files**: `README.md`, `docker-compose.yml`, `Makefile`, `setup.sh`, `setup.ps1`

You can use them to set up the development environment in one command:

**Quick Start:**
```bash
# Linux/Mac/Git Bash/WSL
./setup.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File setup.ps1

# Or using Makefile (if Make is installed)
make setup
```

**What the setup script does:**
1. ✅ Caches existing files (`README.md`, `Makefile`, `docker-compose.yml`) if they exist
2. ✅ Clones the repository (dev branch) to current directory
3. ✅ Handles file conflicts intelligently
4. ✅ Restores cached files if needed

**After setup:**
1. Edit `.env` file and set your `CAITLYN_TOKEN` (the setup script creates this file for you)
2. Run `make dev` to start the development environment

**For AI Agents:**
- All setup instructions are in this README.md
- File caching logic is documented in setup scripts
- Platform detection is handled automatically
- See "⚠️ Important: File Management During Setup" section for details

## 🎯 Project Vision

Mini Wolverine bridges the gap between complex financial infrastructure and practical application development:

- **🌍 Global Market Access**: Connect to different financial markets in real-time
- **🔧 Minimal Infrastructure**: Lightweight WASM binding eliminates heavy infrastructure work
- **🎨 Rich Visualization**: Build sophisticated financial dashboards and analysis tools
- **📈 Trading & Automation**: Simplified trading, backtesting, and automated execution features
- **🤖 AI-Ready Development**: Designed for AI coding agents and collaborative development
- **📚 Comprehensive Documentation**: Rich documentation ecosystem for rapid development

**Architecture**: Backend WASM + Vue 3 Frontend + WebSocket Proxy + AI Coding Agent Ready

## 🚀 Quick Start Guide

### ⚠️ Important: File Management During Setup

Before cloning the repository, this project uses a **file caching mechanism** to handle conflicts with existing files (`README.md`, `Makefile`, `docker-compose.yml`). Here's how it works:

**File Caching Logic:**
1. **Before cloning**: If these files exist in your current directory, they will be cached in `.setup-cache/`
2. **After cloning**: 
   - If the cloned repository contains these files → **Delete cached files** (use repo versions)
   - If the cloned repository is missing these files → **Restore cached files** (keep your versions)

**Why this matters:**
- `git clone` creates a new directory, but you may want to clone directly into your current directory
- These files (`README.md`, `Makefile`, `docker-compose.yml`) are essential for setup
- The caching ensures you don't lose important configuration while getting the latest code

**For AI Agents:**
When setting up this project, implement the file caching logic:
1. Check if `README.md`, `Makefile`, `docker-compose.yml` exist in current directory
2. If they exist, cache them to `.setup-cache/` before cloning
3. After cloning, check if these files exist in the cloned repository
4. If they exist in repo → remove cache; if missing → restore from cache

### Method 1: Using Setup Script (Recommended for Beginners)

**Automatic Setup (Handles file caching automatically):**

**For Linux/Mac/Git Bash/WSL:**
```bash
# 1. Download and run the bash setup script
curl -o setup.sh https://raw.githubusercontent.com/Mingohe/mini-wolverine/dev/setup.sh
chmod +x setup.sh
./setup.sh

# Or if you already have the script:
./setup.sh
```

**For Windows (PowerShell):**
```powershell
# 1. Download and run the PowerShell setup script
Invoke-WebRequest -Uri https://raw.githubusercontent.com/Mingohe/mini-wolverine/dev/setup.ps1 -OutFile setup.ps1
powershell -ExecutionPolicy Bypass -File setup.ps1

# Or if you already have the script:
powershell -ExecutionPolicy Bypass -File setup.ps1
```

**For Windows (Git Bash):**
```bash
# Git Bash can use the bash script
curl -o setup.sh https://raw.githubusercontent.com/Mingohe/mini-wolverine/dev/setup.sh
chmod +x setup.sh
./setup.sh
```

**Using Makefile (Cross-platform):**
```bash
# Makefile will detect your platform and use the appropriate script
make setup
```

The setup script will:
- ✅ Cache existing files (`README.md`, `Makefile`, `docker-compose.yml`) if they exist
- ✅ Clone the repository (dev branch) to current directory
- ✅ Handle file conflicts intelligently
- ✅ Restore cached files if needed

**Manual Setup (If you prefer manual control):**

```bash
# 1. Cache existing files (if they exist)
mkdir -p .setup-cache
[ -f README.md ] && cp README.md .setup-cache/README.md
[ -f Makefile ] && cp Makefile .setup-cache/Makefile
[ -f docker-compose.yml ] && cp docker-compose.yml .setup-cache/docker-compose.yml

# 2. Clone repository to current directory
git clone -b dev https://github.com/Mingohe/mini-wolverine.git .

# 3. Check if files exist in cloned repo and handle cache
if [ -f README.md ] && [ -f Makefile ] && [ -f docker-compose.yml ]; then
    # Files exist in repo, remove cache
    rm -rf .setup-cache
else
    # Files missing, restore from cache
    [ -f .setup-cache/README.md ] && cp .setup-cache/README.md README.md
    [ -f .setup-cache/Makefile ] && cp .setup-cache/Makefile Makefile
    [ -f .setup-cache/docker-compose.yml ] && cp .setup-cache/docker-compose.yml docker-compose.yml
    rm -rf .setup-cache
fi

# 4. Edit .env file and set CAITLYN_TOKEN (setup script creates this file)
# 5. Start development environment
make dev
```

### Method 2: Using Makefile (After Setup)

**After cloning and setting up files:**

```bash
# 1. Configure CAITLYN_TOKEN (see Step 2 below)

# 2. Start development environment
make dev

# 3. Access services
# - Vue Frontend: http://localhost:3002
# - Backend API: http://localhost:4000/api/health
```

### Method 3: Using Docker Compose Directly

**After cloning and setting up files:**

```bash
# 1. Edit .env file and set CAITLYN_TOKEN (setup script creates this file)
nano .env  # or notepad .env on Windows

# 2. Start all services
docker compose up -d

# 3. Check service status
docker compose ps

# 4. View logs
docker compose logs -f
```

### Common Makefile Commands

```bash
# View all available commands
make help

# Start development environment (with hot reload)
make dev

# Stop all services
make stop

# Restart services
make restart

# Check service health status
make health

# Run connectivity tests
make test

# View logs
make vue-logs      # Vue frontend logs
make backend-logs  # Backend logs
make logs          # All service logs

# Git commands
make git-pull      # Pull latest code
make git-status    # View Git status
make git-update    # Pull code and rebuild containers

# Cleanup and rebuild
make clean         # Clean containers and volumes
make build         # Rebuild all containers
make rebuild       # Clean + rebuild + start
```

### ⚠️ Important: Configure CAITLYN_TOKEN

**CAITLYN_TOKEN is the authentication key for the backend to connect to the Wolverine service. It must be set for normal operation!**

**Setup script automatically creates a `.env` file for you. You just need to:**

1. **Edit the `.env` file** and replace `your_caitlyn_token_here` with your actual token:
   ```bash
   # Linux/Mac
   nano .env
   
   # Windows
   notepad .env
   ```

2. **Set your CAITLYN_TOKEN** in the `.env` file:
   ```
   CAITLYN_TOKEN=your_actual_token_here
   ```

3. **Start the development environment**:
   ```bash
   make dev
   ```

**How to get your CAITLYN_TOKEN:**
- Contact your administrator
- Check Wolverine service documentation
- The token is required for backend authentication


## 🏗️ Architecture Overview

### Backend-Frontend Separation

```
Vue 3 Frontend (Port 3002)        Node.js Backend (Port 4000)
├── Vue 3 + TypeScript            ├── Express REST API
├── WebSocket to Backend          ├── WebSocket Server
├── Pinia State Management       ├── WasmService (Caitlyn WASM)
├── Vite Build Tool              ├── CaitlynWebSocketService
└── No WASM dependencies          └── All caitlyn_js.wasm processing
          │                                   │
          └─────── WebSocket API ─────────────┘
                           │
                    External Caitlyn Server
                   wss://116.wolverine-box.com/tm
```

### Tech Stack

**Frontend (Vue 3)**:
- Vue 3 with Composition API
- TypeScript for type safety
- Pinia for state management
- Vite for fast development and building
- WebSocket client for backend communication
- Responsive design with modern UI/UX

**Backend (Node.js)**:
- Express REST API server
- WebSocket proxy to Caitlyn servers
- Complete WASM integration (caitlyn_js.wasm)
- Winston logging and error handling
- Memory management for WASM objects

**Infrastructure**:
- Docker Compose multi-service setup
- Hot reload for both frontend and backend
- Environment-based configuration

### Project Structure

```
mini-wolverine/
├── frontend-vue/               # Vue 3 Frontend (No WASM)
│   ├── src/
│   │   ├── components/         # Vue UI components
│   │   │   ├── DSLQueryTab.vue # DSL unified query interface
│   │   │   ├── WatchlistTab.vue # Watchlist
│   │   │   ├── SchemaViewer.vue # Schema browser
│   │   │   └── ...             # Other components
│   │   ├── stores/             # Pinia state management
│   │   │   ├── websocketStore.ts # WebSocket connection
│   │   │   ├── dataStore.ts    # Data storage
│   │   │   └── ...             # Other stores
│   │   ├── services/           # API services
│   │   ├── utils/              # Utility functions
│   │   │   ├── dslParser.ts    # DSL parser
│   │   │   ├── dslExecutor.ts  # DSL executor
│   │   │   └── dslAutocomplete.ts # DSL autocomplete
│   │   └── App.vue             # Main Vue component
│   └── Dockerfile.dev          # Frontend container
├── backend/                     # Node.js + WASM Backend
│   ├── src/
│   │   ├── services/
│   │   │   ├── WasmService.js   # All WASM operations
│   │   │   ├── CaitlynWebSocketService.js  # Caitlyn server proxy
│   │   │   └── CaitlynConnectionPool.js    # Connection pooling
│   │   ├── utils/
│   │   │   └── StructValueWrapper.js  # WASM object utilities
│   │   └── server.js            # Express + WebSocket server
│   ├── public/
│   │   ├── caitlyn_js.js        # WASM JavaScript wrapper
│   │   └── caitlyn_js.wasm      # WebAssembly binary
│   ├── test-*.js                # Comprehensive test suite
│   └── Dockerfile.dev           # Backend container
├── docs/                        # Comprehensive documentation
│   ├── CAITLYN_JS_API.md        # Complete API reference
│   ├── UNIVERSE_INITIALIZATION.md  # Protocol documentation
│   ├── WEBSOCKET_DATA_MANIPULATION_GUIDE.md  # Advanced patterns
│   └── test.js                  # Reference implementation
├── examples/
│   └── test.js                  # Universe initialization demo
├── docker-compose.yml           # Multi-service orchestration
├── Makefile                     # Development command shortcuts
├── start-backend.sh            # Backend startup script
├── start-frontend-vue.sh       # Frontend startup script
└── CLAUDE.md                    # Detailed project guide
```

## ✨ Features

### 🌟 AI-Powered Financial Development
- **🤖 AI Coding Agent Ready**: Optimized for Cursor, Claude Code, and other AI development tools
- **📚 Rich Documentation**: Comprehensive guides enable AI agents to understand and extend the system
- **🔄 Rapid Iteration**: Hot reload and structured architecture perfect for AI-assisted development
- **💡 Extensible Design**: Clean separation allows AI agents to add features without complexity

### 🎯 Wolverine Integration Excellence
- **🪶 Lightweight WASM**: < 1MB binding provides full Wolverine ecosystem access
- **🌍 Global Market Coverage**: 10+ major financial markets (CFFEX, DCE, SHFE, NYMEX, etc.)
- **⚡ Real-time Processing**: Live market data streaming with minimal latency
- **📊 Complete Protocol**: Full NetPackage encoding/decoding with 576 schema objects
- **🔗 WebSocket Proxy**: Intelligent backend proxy eliminates infrastructure complexity
- **📈 Trading Integration**: Simplified versions of Wolverine's flagship trading and automation features

### 🚀 Production-Ready Architecture
- **🏗️ Backend-Frontend Separation**: Vue 3 UI + Node.js WASM processing
- **💾 Memory Management**: Proper WASM object lifecycle and cleanup patterns
- **🔄 Connection Pooling**: Efficient connection management with automatic reconnection
- **📈 Historical Data**: ATFetchByCode and ATFetchByTime implementation
- **🛡️ Error Recovery**: Production-ready error handling and logging
- **🐳 Docker Integration**: Complete containerized development environment

### 🎨 Visualization & User Experience
- **📱 Responsive Design**: Modern Vue 3 UI with TypeScript
- **📝 DSL Query Interface**: Unified query language for all data operations
- **🔤 Auto-completion**: Intelligent suggestions for DSL input
- **📊 Rich Data Display**: Table views with pagination, charts, and real-time updates
- **📤 Data Export**: JSON export functionality for further analysis
- **🎛️ Interactive Controls**: Connection management and data exploration tools
- **🔍 Schema Explorer**: Visual exploration of available data structures

## 🔧 Development Workflow

### Complete Development Environment

```bash
# Start complete development environment (recommended)
make dev

# Or use Docker Compose
docker compose up -d

# Service descriptions:
# - Backend: Node.js + WASM processing (port 4000)
# - Frontend: Vue 3 development server (port 3002)
# - Hot reload: Both backend and frontend support auto-reload
```

### Backend Development

```bash
# View backend logs
make backend-logs

# Backend features:
# - All WASM operations (schema, universe, data fetching)
# - WebSocket proxy to Caitlyn server
# - Memory management and cleanup
# - Winston logging (configurable levels)
# - Hot reload: Files in backend/src/ auto-restart on change
```

### Frontend Development

```bash
# View frontend logs
make vue-logs

# Frontend features:
# - Vue 3 + TypeScript, no WASM dependencies
# - Connect to backend via WebSocket
# - Pinia state management
# - Real-time updates from backend processed data
# - Responsive design
# - Hot reload: Files in frontend-vue/src/ auto-refresh on change
```

### Local Development (Without Docker)

```bash
# Start backend
./start-backend.sh

# Start frontend (new terminal)
./start-frontend-vue.sh
```


## 🎮 Detailed Startup Steps (Beginner's Guide)

### Prerequisites

- **Docker Desktop** (Mac/Windows) or **Docker Engine** (Linux)
- **Git** (for cloning code)
- **Make** (built-in on Mac/Linux, needs installation on Windows)
- **CAITLYN_TOKEN** (Wolverine service authentication key, must be configured)

### ⚠️ Important: Get CAITLYN_TOKEN

Before starting services, you need to:

1. **Get your CAITLYN_TOKEN** (contact administrator or check Wolverine service documentation)
2. **Set environment variable** or modify configuration file (see instructions below)

### Step 1: Clone Code and Handle File Conflicts

**⚠️ Important: File Caching Mechanism**

Before cloning, you need to handle potential conflicts with existing files (`README.md`, `Makefile`, `docker-compose.yml`). The project uses a caching mechanism to preserve important files.

**Option A: Using Setup Script (Recommended)**

**For Linux/Mac/Git Bash/WSL:**
```bash
# Download and run bash setup script
curl -o setup.sh https://raw.githubusercontent.com/Mingohe/mini-wolverine/dev/setup.sh
chmod +x setup.sh
./setup.sh
```

**For Windows (PowerShell):**
```powershell
# Download and run PowerShell setup script
Invoke-WebRequest -Uri https://raw.githubusercontent.com/Mingohe/mini-wolverine/dev/setup.ps1 -OutFile setup.ps1
powershell -ExecutionPolicy Bypass -File setup.ps1
```

**For Windows (Git Bash):**
```bash
# Git Bash can use the bash script
curl -o setup.sh https://raw.githubusercontent.com/Mingohe/mini-wolverine/dev/setup.sh
chmod +x setup.sh
./setup.sh
```

**Using Makefile (Cross-platform):**
```bash
# Makefile will detect your platform
make setup
```

**Option B: Manual Setup**

```bash
# 1. Cache existing files (if they exist in current directory)
mkdir -p .setup-cache
[ -f README.md ] && cp README.md .setup-cache/README.md && echo "✅ Cached README.md"
[ -f Makefile ] && cp Makefile .setup-cache/Makefile && echo "✅ Cached Makefile"
[ -f docker-compose.yml ] && cp docker-compose.yml .setup-cache/docker-compose.yml && echo "✅ Cached docker-compose.yml"

# 2. Clone repository (dev branch) to current directory
git clone -b dev https://github.com/Mingohe/mini-wolverine.git .

# 3. Handle file conflicts
# Check if all three files exist in cloned repository
if [ -f README.md ] && [ -f Makefile ] && [ -f docker-compose.yml ]; then
    echo "✅ All files found in repository, removing cache..."
    rm -rf .setup-cache
else
    echo "⚠️  Some files missing in repository, restoring from cache..."
    [ -f .setup-cache/README.md ] && cp .setup-cache/README.md README.md && echo "✅ Restored README.md"
    [ -f .setup-cache/Makefile ] && cp .setup-cache/Makefile Makefile && echo "✅ Restored Makefile"
    [ -f .setup-cache/docker-compose.yml ] && cp .setup-cache/docker-compose.yml docker-compose.yml && echo "✅ Restored docker-compose.yml"
    rm -rf .setup-cache
fi
```

**File Caching Logic Explained:**

1. **Before Clone**: Cache `README.md`, `Makefile`, `docker-compose.yml` if they exist in current directory
2. **After Clone**: 
   - **If files exist in repo** → Delete cache (use repository versions)
   - **If files missing in repo** → Restore from cache (preserve your versions)

**Why this is needed:**
- These files are essential for project setup and configuration
- `git clone` may overwrite or miss these files
- Caching ensures you don't lose important local configurations

### Step 2: Configure CAITLYN_TOKEN

**⚠️ Must be configured, otherwise backend cannot connect to Wolverine service!**

```bash
# Method 1: Use environment variable (recommended)
export CAITLYN_TOKEN=your_caitlyn_token_here

# Method 2: Create .env file
echo "CAITLYN_TOKEN=your_caitlyn_token_here" > .env

# Method 3: Directly modify CAITLYN_TOKEN value in docker-compose.yml
```

### Step 3: Start Development Environment

**Simplest way (recommended):**

```bash
# One-command start (auto-build and start all services)
make dev
```

**Or use Docker Compose:**

```bash
# Start all services
docker compose up -d

# Check service status
docker compose ps
```

### Step 4: Verify Services Running

```bash
# Method 1: Use Makefile health check
make health

# Method 2: Access via browser
# Vue Frontend: http://localhost:3002
# Backend API: http://localhost:4000/api/health
```

### Step 5: View Logs (Optional)

```bash
# View all service logs
make logs

# Or view separately
make vue-logs      # Vue frontend logs
make backend-logs   # Backend logs
```

### Service Access Addresses

After successful startup, you can access via the following addresses:

- **Vue Frontend Interface**: http://localhost:3002
- **Backend Health Check**: http://localhost:4000/api/health
- **Backend Schema API**: http://localhost:4000/api/schema
- **Backend Markets API**: http://localhost:4000/api/markets
- **WebSocket Connection**: ws://localhost:4000

### Hot Reload Instructions

**Backend Hot Reload**:
- ✅ Configured with nodemon, files in `backend/src/` will auto-restart
- After code changes, check `make backend-logs` to see auto-restart logs

**Frontend Hot Reload**:
- ✅ Configured with Vite HMR, files in `frontend-vue/src/` will auto-refresh
- After code changes, browser will automatically refresh to show latest content

### Update Code

```bash
# Pull latest code
make git-pull

# Pull code and rebuild containers (recommended)
make git-update

# Then restart services
make restart
```

### Stop Services

```bash
# Stop all services
make stop

# Or use Docker Compose
docker compose down
```

### Frequently Asked Questions

**Q: `make: docker-compose: No such file or directory`**
- A: Newer Docker versions use `docker compose` (without hyphen), already fixed. If still having issues, please update Docker Desktop.

**Q: Port is already in use**
- A: Check port usage: `lsof -i :4000` or `lsof -i :3002`, stop the process using the port.

**Q: Container startup failed**
- A: View logs: `make logs` or `docker compose logs`, check error messages.

**Q: How to modify code?**
- A: Directly modify local files, both backend and frontend support hot reload, changes take effect automatically.

**Q: How to reset environment?**
- A: Run `make clean` to clean all containers and volumes, then `make dev` to restart.

## 🤖 AI-Powered Development

### Perfect for AI Coding Agents

Mini Wolverine is specifically designed to work seamlessly with AI coding agents like **Cursor** and **Claude Code**:

**Why AI Agents Love Mini Wolverine:**
- **📚 Rich Documentation**: Comprehensive `docs/` folder provides context for AI understanding
- **🏗️ Clean Architecture**: Clear separation of concerns makes it easy for AI to navigate
- **🔧 Modular Design**: Each component has single responsibility, perfect for AI modification
- **📋 Reference Implementations**: Complete examples guide AI agents in proper patterns
- **🧪 Comprehensive Testing**: Full test suite validates AI-generated changes
- **📝 Structured Codebase**: Consistent patterns and naming conventions

**AI Development Workflow:**
```bash
# 1. AI Agent analyzes documentation
# docs/ folder provides complete system understanding

# 2. AI Agent identifies extension points
# Clean interfaces in services/ and components/

# 3. AI Agent implements features
# Following established patterns and memory management

# 4. AI Agent validates with testing
# Comprehensive test suite ensures correctness
```

### AI-Assisted Feature Development

## 🔧 Adding New Features

### Backend WASM Features (AI-Friendly)

```javascript
// backend/src/services/WasmService.js
class WasmService {
  // Add new WASM operation
  processNewDataType(content) {
    const response = new this.module.NewDataTypeResponse();
    response.setCompressor(this.compressor);
    response.decode(content);
    
    // Process data...
    const results = response.getData();
    
    // Always cleanup WASM objects
    response.delete();
    return results;
  }
  
  createNewRequest(params) {
    const request = new this.module.NewDataTypeRequest(
      params.token,
      params.sequence,
      params.market,
      params.symbol
    );
    
    const pkg = new this.module.NetPackage();
    const encoded = pkg.encode(this.module.CMD_NEW_DATA_TYPE, request.encode());
    
    // Copy to regular ArrayBuffer for WebSocket
    const buffer = new ArrayBuffer(encoded.byteLength);
    new Uint8Array(buffer).set(new Uint8Array(encoded));
    
    // Cleanup
    request.delete();
    pkg.delete();
    
    return buffer;
  }
}
```

### Frontend Vue Features

```vue
<!-- frontend-vue/src/components/NewFeature.vue -->
<template>
  <div class="container">
    <h3>New Feature</h3>
    <button @click="handleNewRequest" :disabled="!isConnected">
      Request New Data
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWebSocketStore } from '@/stores/websocketStore'
import { useDataStore } from '@/stores/dataStore'

const wsStore = useWebSocketStore()
const dataStore = useDataStore()

const isConnected = computed(() => wsStore.isConnected)

const handleNewRequest = () => {
  if (wsStore.isConnected) {
    // Send request to backend using DSL
    wsStore.sendMessage({
      type: 'dsl_query',
      dsl: 'fc:global::SampleQuote@0[DCE:i2501] | 1m | 2025-01-01..2025-01-31'
    })
  }
}
</script>

<style scoped>
.container {
  padding: 20px;
  background: var(--card-background);
  border-radius: var(--border-radius);
}
</style>
```

## 🔌 Integration Architecture

### Backend-Frontend Communication

```javascript
// Frontend → Backend WebSocket Messages
const wsActions = useBackendWebSocket();

// Connect to Caitlyn server via backend
wsActions.connectToCaitlyn({
  url: 'wss://116.wolverine-box.com/tm',
  token: 'your-auth-token'
});

// Request historical data
wsActions.sendMessage(JSON.stringify({
  type: 'request_historical',
  params: {
    market: 'DCE',
    symbol: 'i2501',
    granularity: 86400,  // Daily
    from: '2025-01-01',
    to: '2025-08-31'
  }
}));

// Backend processes WASM and responds
```

### WASM Memory Management

```javascript
// backend/src/services/WasmService.js - CRITICAL PATTERNS

// ✅ CORRECT: Always delete WASM objects
processData(content) {
  const response = new this.module.ATFetchSVRes();
  response.setCompressor(this.compressor);
  response.decode(content);
  
  const results = response.results();
  // Process results...
  
  // CRITICAL: Delete WASM objects
  response.delete();  // Always delete
  return processedData;
}

// ✅ CORRECT: Schema-based field access
processStructValue(sv) {
  // Use schema to determine field positions
  const tradeDay = sv.getInt32(0);    // Field 0: trade_day
  const name = sv.getString(1);       // Field 1: name
  const revisions = sv.getString(7);  // Field 7: revs
  
  // Always cleanup
  sv.delete();
}
```

### Historical Data System

```typescript
// Complete flow: Frontend → Backend → Caitlyn → WASM → Response

// 1. Frontend requests data using DSL
import { dslExecutor } from '@/utils/dslExecutor'

const result = await dslExecutor.execute(
  'fc:global::SampleQuote@0[SHFE:au2502] | 1h | 2025-01-01..2025-01-31',
  {
    onSuccess: (data) => {
      // Data received and processed
      console.log('Records:', data.records)
    },
    onError: (error) => {
      console.error('Query failed:', error)
    }
  }
)

// 2. Backend processes with WASM
// - DSL Parser parses query string
// - DSL Executor creates ATFetchByCode request
// - Sends to Caitlyn server via WebSocket
// - Receives binary response
// - Decodes with WASM compressor
// - Extracts StructValue data
// - Converts to JSON format
// - Sends response to frontend

// 3. Frontend receives processed data
import { watch } from 'vue'
import { useDataStore } from '@/stores/dataStore'

const dataStore = useDataStore()

watch(() => dataStore.queryResult, (result) => {
  if (result && result.records.length > 0) {
    // Display charts, tables, export options
    console.log('Data updated:', result.records)
  }
})
```

## 🏗️ Backend WASM Architecture

### Complete WASM Integration

The backend provides full Caitlyn WASM functionality:

**Core Services**:
- **WasmService**: All WASM operations (schema, universe, data processing)
- **CaitlynWebSocketService**: WebSocket proxy with connection pooling
- **CaitlynConnectionPool**: Efficient connection management
- **StructValueWrapper**: Python-like interface for WASM objects

### Protocol Implementation

```javascript
// Complete Caitlyn protocol support:

// 1. Authentication
handshake: { cmd: 20512, token: 'auth', protocol: 1 }

// 2. Schema Definition (server push)
NET_CMD_GOLD_ROUTE_DATADEF → 576 metadata objects

// 3. Universe Revision
CMD_AT_UNIVERSE_REV → Market metadata with revisions JSON

// 4. Universe Seeds (per market)
CMD_AT_UNIVERSE_SEEDS → Seed data for each market/qualified_name

// 5. Historical Data Fetching
CMD_AT_FETCH_BY_CODE → Time series data with compression
CMD_AT_FETCH_BY_TIME → Point-in-time data retrieval

// 6. Real-time Data
CMD_AT_SUBSCRIBE → Live market data streaming
```

### Production Features

- **Memory Management**: Proper WASM object lifecycle with cleanup
- **Error Recovery**: Automatic reconnection and error handling
- **Logging**: Structured Winston logging with debug levels
- **Testing**: Comprehensive test suite for all WASM operations
- **Schema Processing**: Dynamic field mapping and validation
- **Connection Pooling**: Efficient resource management

## 📊 Data Processing & Visualization

### Real-time Market Data

**Current Implementation**:
- **Schema Viewer**: 576 metadata objects across global/private namespaces
- **Market Data**: 10+ global markets (DCE, SHFE, CFFEX, NYMEX, etc.)
- **Historical Data**: ATFetchByCode integration with time series
- **Live Updates**: WebSocket streaming with real-time processing
- **Export System**: JSON export for historical datasets

### Market Coverage

```javascript
// Supported Markets (discovered via universe initialization)
const globalMarkets = [
  'CFFEX',  // China Financial Futures Exchange
  'CZCE',   // Zhengzhou Commodity Exchange  
  'DCE',    // Dalian Commodity Exchange
  'DME',    // Dubai Mercantile Exchange
  'HUOBI',  // Huobi Exchange
  'ICE',    // Intercontinental Exchange
  'INE',    // Shanghai International Energy Exchange
  'NYMEX',  // New York Mercantile Exchange
  'SGX',    // Singapore Exchange
  'SHFE'    // Shanghai Futures Exchange
];

// Each market supports multiple qualified names:
// Commodity, Dividend, Futures, Holiday, Security, Stock
```

### Advanced Visualization Ready

```jsx
// Recharts integration for financial charts
import { LineChart, CandlestickChart, XAxis, YAxis } from 'recharts';

function FinancialChart({ historicalData }) {
  return (
    <CandlestickChart width={1000} height={400} data={historicalData}>
      <XAxis dataKey="timestamp" />
      <YAxis domain={['dataMin', 'dataMax']} />
      <Candlestick dataKey={['open', 'high', 'low', 'close']} />
    </CandlestickChart>
  );
}
```

## 🐳 Docker Compose Guide

### Quick Start with Docker Compose

Docker Compose provides a simple way to manage all services in the project. **We recommend using Makefile commands** for easier service management.

#### Prerequisites

- Docker Desktop (Mac/Windows) or Docker Engine (Linux)
- Docker Compose V2 (comes with newer Docker versions)
- Make (built-in on Mac/Linux, needs installation on Windows)

#### Step 1: Configure CAITLYN_TOKEN

Before starting, you must configure your CAITLYN_TOKEN:

**Option 1: Environment Variable (Recommended)**
```bash
export CAITLYN_TOKEN=your_caitlyn_token_here
make dev
```

**Option 2: .env File**
```bash
# Create .env file in project root
echo "CAITLYN_TOKEN=your_caitlyn_token_here" > .env
make dev
```

**Option 3: Direct Edit**
Edit `docker-compose.yml` and replace `${CAITLYN_TOKEN}` with your actual token.

#### Step 2: Start Services

**Using Makefile (Recommended):**
```bash
# Start all services in development mode
make dev
```

**Or using Docker Compose directly:**
```bash
# Start all services in detached mode
docker compose up -d

# Or start with logs visible
docker compose up
```

#### Step 3: Verify Services

**Using Makefile (Recommended):**
```bash
# Check service health status
make health

# Run connectivity tests
make test
```

**Or using Docker Compose directly:**
```bash
# Check service status
docker compose ps

# Expected output:
# NAME                          STATUS              PORTS
# mini-wolverine-backend-dev    Up                  0.0.0.0:4000->4000/tcp
# mini-wolverine-vue-dev        Up                  0.0.0.0:3002->3002/tcp
```

#### Step 4: Access Services

- **Vue Frontend**: http://localhost:3002
- **Backend API**: http://localhost:4000/api/health
- **Backend Schema API**: http://localhost:4000/api/schema
- **Backend Markets API**: http://localhost:4000/api/markets
- **WebSocket**: ws://localhost:4000

### Common Commands

#### Using Makefile (Recommended)

```bash
# Service Management
make dev              # Start development environment
make stop             # Stop all services
make restart          # Restart all services
make clean            # Clean containers and volumes
make build            # Rebuild all containers
make rebuild          # Clean + rebuild + start

# Viewing Logs
make logs             # View all service logs
make vue-logs         # View Vue frontend logs
make backend-logs     # View backend logs

# Service Status
make health            # Check service health
make test              # Run connectivity tests
```

#### Using Docker Compose Directly

If you prefer using Docker Compose commands directly:

**Service Management:**
```bash
# Start services
docker compose up -d              # Start in background
docker compose up                 # Start with logs

# Stop services
docker compose stop               # Stop but keep containers
docker compose down               # Stop and remove containers
docker compose down -v            # Stop and remove containers + volumes

# Restart services
docker compose restart            # Restart all services
docker compose restart backend     # Restart specific service
docker compose restart vue-app    # Restart Vue frontend
```

**Viewing Logs:**
```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend    # Backend logs
docker compose logs -f vue-app    # Vue frontend logs

# View last N lines
docker compose logs --tail=100 backend
```

**Service Status and Health:**
```bash
# Check service status
docker compose ps

# Check service health
curl http://localhost:4000/api/health

# View resource usage
docker compose top
```

**Rebuilding Services:**
```bash
# Rebuild all services
docker compose build

# Rebuild specific service
docker compose build backend
docker compose build vue-app

# Rebuild and restart
docker compose up -d --build
```

**Environment Variables:**
```bash
# Override environment variables
CAITLYN_TOKEN=your_token docker compose up -d

# Use .env file (automatically loaded)
# Create .env file with:
# CAITLYN_TOKEN=your_token_here
docker compose up -d
```

### Service Configuration

The `docker-compose.yml` defines two services:

#### Backend Service

- **Container Name**: `mini-wolverine-backend-dev`
- **Port**: `4000:4000`
- **Hot Reload**: Yes (nodemon watches `backend/src/`)
- **Volumes**:
  - `./backend/src:/app/src` - Source code (hot reload)
  - `./backend/public:/app/public` - Public assets
  - `/app/node_modules` - Dependencies (excluded from host)

#### Vue Frontend Service

- **Container Name**: `mini-wolverine-vue-dev`
- **Port**: `3002:3002`
- **Hot Reload**: Yes (Vite HMR watches `frontend-vue/src/`)
- **Volumes**:
  - `./frontend-vue/src:/app/src` - Source code (hot reload)
  - `./frontend-vue/public:/app/public` - Public assets
  - `/app/node_modules` - Dependencies (excluded from host)

### Troubleshooting

#### Services Won't Start

```bash
# Check logs for errors
docker compose logs

# Verify Docker is running
docker ps

# Check port availability
lsof -i :4000
lsof -i :3002
```

#### CAITLYN_TOKEN Issues

```bash
# Verify token is set
docker compose config | grep CAITLYN_TOKEN

# Check if backend can connect
docker compose logs backend | grep -i "token\|auth\|connect"
```

#### Hot Reload Not Working

```bash
# Restart services
docker compose restart

# Rebuild containers
docker compose up -d --build

# Check volume mounts
docker compose config | grep volumes
```

#### Clean Start

```bash
# Stop and remove everything
docker compose down -v

# Remove images (optional)
docker compose down --rmi all

# Start fresh
docker compose up -d --build
```

### Production Deployment

For production, use a separate production configuration:

```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Start production services
docker compose -f docker-compose.prod.yml up -d
```

**Note**: Production configuration should use optimized builds, proper environment variables, and production-ready settings.

## 🚢 Deployment & Configuration

### Development Environment Deployment

**Using Makefile (Recommended):**

```bash
# Start development environment
make dev

# Check service status
make health

# View logs
make vue-logs      # Vue frontend
make backend-logs   # Backend service
```

**Using Docker Compose:**

See the [Docker Compose Guide](#-docker-compose-guide) section above for detailed instructions.

### Production Environment Deployment

```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Start production services
docker compose -f docker-compose.prod.yml up -d
```

### Environment Configuration

```bash
# .env file configuration

# Backend Configuration
PORT=4000
LOG_LEVEL=info
CAITLYN_WS_URL=wss://116.wolverine-box.com/tm

# ⚠️ Important: Must set your CAITLYN_TOKEN to connect to backend service
# Please contact administrator to get your authentication token
CAITLYN_TOKEN=your-caitlyn-auth-token

CAITLYN_CONNECTION_TIMEOUT=30000
CAITLYN_RECONNECT_DELAY=5000
CAITLYN_MAX_RECONNECT_ATTEMPTS=3

# Frontend Configuration  
VITE_API_BASE_URL=http://localhost:4000
VITE_WS_BASE_URL=ws://localhost:4000
CHOKIDAR_USEPOLLING=true  # For Docker file watching

# Production overrides
# VITE_API_BASE_URL=https://your-domain.com
# VITE_WS_BASE_URL=wss://your-domain.com
# LOG_LEVEL=warn
```

### Production Considerations

- **Security**: Proper CORS and WebSocket security headers
- **Performance**: Connection pooling and WASM memory management
- **Monitoring**: Winston logging with structured output
- **Scaling**: Backend can handle multiple frontend connections
- **Health**: REST API endpoints for service monitoring

## 🔧 Configuration

### Docker Compose Configuration

- **development**: Vue 3 dev server with hot reload
- **production**: Optimized build with Nginx

### Environment Variables

#### Vue App
- `VITE_API_BASE_URL`: Backend API base URL
- `VITE_WS_BASE_URL`: WebSocket server URL
- `NODE_ENV`: Environment (development/production)
- `CHOKIDAR_USEPOLLING`: Enable file watching in Docker

#### Backend
- `WS_PORT`: WebSocket server port (default: 3009)
- `NODE_ENV`: Server environment

## 📚 Comprehensive Documentation

### Essential Reading
- **[CLAUDE.md](./CLAUDE.md)** - Complete project guide with architecture details
- **[docs/CAITLYN_JS_API.md](./docs/CAITLYN_JS_API.md)** - Complete WASM API reference
- **[docs/UNIVERSE_INITIALIZATION.md](./docs/UNIVERSE_INITIALIZATION.md)** - Protocol initialization guide
- **[docs/WEBSOCKET_DATA_MANIPULATION_GUIDE.md](./docs/WEBSOCKET_DATA_MANIPULATION_GUIDE.md)** - Advanced data manipulation

### Reference Implementations
- **[examples/test.js](./examples/test.js)** - Complete universe initialization demo
- **[backend/test-backend-core.js](./backend/test-backend-core.js)** - Full integration test
- **[backend/src/utils/StructValueWrapper.js](./backend/src/utils/StructValueWrapper.js)** - Python-like WASM interface

### API Documentation
- **REST API**: `GET /api/health`, `/api/schema`, `/api/markets`
- **WebSocket API**: Backend-frontend message protocol
- **WASM Integration**: Complete command constants and class references

### Development Guides
- **Memory Management**: Proper WASM object cleanup patterns
- **Schema Processing**: Dynamic field mapping and validation
- **Error Handling**: Production-ready error recovery strategies

## 🤝 Contributing

### Development Environment Setup

```bash
# 1. Clone repository
git clone https://github.com/Mingohe/mini-wolverine.git
cd mini-wolverine

# 2. Switch to dev branch (Important!)
git checkout dev

# 3. Start development environment
make dev

# 4. Start developing
# After code changes, backend and frontend will auto-reload
```

### Code Standards

- **Vue 3**: Use Composition API and `<script setup>`
- **TypeScript**: All new code uses TypeScript
- **State Management**: Use Pinia stores
- **Styling**: Use Scoped CSS or Tailwind CSS
- **Error Handling**: Add appropriate error handling and user prompts
- **Code Formatting**: Follow ESLint and Prettier configuration

### Submitting Code

```bash
# 1. Pull latest code
make git-pull

# 2. Create new branch
git checkout -b feature/your-feature-name

# 3. Commit changes
git add .
git commit -m "feat: add your feature description"

# 4. Push to remote
git push origin feature/your-feature-name
```

### Testing

```bash
# Run connectivity tests
make test

# Check service health status
make health
```

## 📄 License

This project is designed as a demonstration and reference implementation. See individual component licenses for specific terms.

## 🚀 Current Status & Future Opportunities

### ✅ Fully Functioning Foundation

**Core Infrastructure (Production Ready)**:
- ✅ **Wolverine Integration**: Complete WASM binding (< 1MB) with 576 schema objects
- ✅ **Global Market Access**: Real-time connection to 10+ financial markets
- ✅ **AI-Ready Architecture**: Optimized for Cursor, Claude Code, and AI development
- ✅ **Rich Documentation**: Comprehensive guides enabling rapid AI-assisted development
- ✅ **Memory Management**: Production-grade WASM object lifecycle handling
- ✅ **Testing Suite**: Complete validation framework for reliable development

**User Experience (Complete)**:
- ✅ **Responsive UI**: Modern Vue 3 interface with real-time updates
- ✅ **DSL Query System**: Unified query language for indicators and formulas
- ✅ **Auto-completion**: Intelligent DSL input suggestions
- ✅ **WebSocket Communication**: Seamless backend-frontend data flow  
- ✅ **Data Visualization**: Interactive tables, charts, and export functionality
- ✅ **Docker Development**: Hot reload environment for rapid iteration

**Developer Experience (AI-Optimized)**:
- ✅ **Clean Codebase**: Structured architecture perfect for AI navigation
- ✅ **Reference Implementations**: Complete examples guide proper patterns
- ✅ **Environment Configuration**: Flexible deployment scenarios
- ✅ **Error Handling**: Production-ready recovery and logging

### 🎯 Roadmap: Trading & Automation Features

**🔥 Upcoming: Simplified Trading Suite**
Mini Wolverine will include **simplified and minimized** versions of Wolverine's flagship trading capabilities:

**📈 Trading Operations (Slim Implementation)**:
- **Manual Trading**: Simplified order entry and management interface
- **Portfolio Management**: Real-time position tracking and P&L monitoring  
- **Risk Controls**: Basic risk management and position sizing tools
- **Order Types**: Support for market, limit, stop, and conditional orders

**🤖 Automated Strategy Execution (Minimized)**:
- **Strategy Builder**: Visual strategy construction with drag-and-drop components
- **Backtesting Engine**: Streamlined historical strategy validation
- **Paper Trading**: Risk-free strategy testing with live market data
- **Auto-Execution**: Simplified automated order execution system

**⚡ Real-time Automation (AI-Friendly)**:
- **Signal Processing**: Real-time market signal detection and processing
- **Event-Driven Trading**: Automated responses to market events and conditions
- **Performance Analytics**: Real-time strategy performance monitoring
- **Alert System**: Customizable notifications for trading opportunities

**🎯 Integration Philosophy**: 
All trading features will maintain Mini Wolverine's core principles:
- **Lightweight Implementation**: Slim versions of flagship Wolverine features
- **AI-Assisted Development**: Easy for AI agents to understand and extend
- **Production Ready**: Fully functional despite being minimized
- **Rich Documentation**: Comprehensive guides for rapid development

### 🚀 AI-Assisted Extension Opportunities

**Enhanced Visualization (AI-Friendly)**:
- Advanced charting libraries (Recharts/D3.js integration)
- Technical indicators and financial analysis tools
- Real-time candlestick and multi-timeframe charts
- Custom dashboard creation with drag-and-drop

**Advanced Analytics (Perfect for AI Development)**:
- Machine learning model integration
- Quantitative research and model validation
- Risk management and portfolio optimization
- Market sentiment analysis and correlation studies

**Enterprise Features (Scalable Architecture)**:
- Multi-user authentication and sessions
- Real-time collaborative analysis and trading
- Advanced data export (CSV, Excel, PDF reports)
- Performance monitoring and alerting systems

### 🎉 Mission: Complete Financial Trading Platform

**Mini Wolverine** delivers a **complete, minimized, and AI-friendly** financial infrastructure that empowers researchers and engineers to build sophisticated trading and analysis applications on Wolverine's global data ecosystem **without infrastructure complexity**.

**Current Status**: Production-ready data processing and visualization platform
**Next Phase**: Adding simplified trading, backtesting, and automated execution capabilities from Wolverine's flagship features

**Perfect for**: 
- **Financial Researchers**: Access to global market data and analysis tools
- **Quantitative Analysts**: Backtesting and strategy development platform
- **Algorithmic Traders**: Automated execution and risk management systems
- **Fintech Developers**: Complete trading infrastructure foundation
- **AI Coding Agents**: Structured, documented codebase for rapid extension

---

**Mini Wolverine** - A modern, scalable foundation for financial data applications. Built with Vue 3, TypeScript, WebAssembly, and Docker for professional development workflows.
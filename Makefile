# Mini Wolverine - Makefile for common development tasks

.PHONY: help start stop restart logs clean dev build test health

# Default target
help:
	@echo "Mini Wolverine Development Commands:"
	@echo ""
	@echo "  make start     - Start all services in production mode"
	@echo "  make dev       - Start services in development mode (with hot reload)"
	@echo "  make stop      - Stop all services"
	@echo "  make restart   - Restart all services"
	@echo "  make logs      - View logs from all services"
	@echo "  make clean     - Clean up containers and volumes"
	@echo "  make build     - Rebuild all containers"
	@echo "  make health    - Check service health"
	@echo "  make test      - Run basic connectivity tests"
	@echo ""
	@echo "Development Helpers:"
	@echo "  make install-backend - Install backend dependencies"
	@echo "  make install-vue     - Install Vue frontend dependencies"
	@echo "  make run-backend     - Run backend in development mode"
	@echo "  make run-vue         - Run Vue frontend in development mode"
	@echo ""

# Start all services
start:
	@echo "🚀 Starting Mini Wolverine services..."
	docker-compose up -d
	@echo "✅ Services started!"
	@echo "🌐 Frontend: http://localhost:8080"
	@echo "📡 WebSocket: ws://localhost:3009"

# Development mode with hot reload
dev:
	@echo "🛠️  Starting Mini Wolverine in development mode..."
	docker-compose --profile development up -d
	@echo "✅ Development environment ready!"
	@echo "🌐 Frontend: http://localhost:8080"
	@echo "🔄 React Dev Server: http://localhost:3000 (with hot reload)"
	@echo "🔄 Vue Dev Server: http://localhost:3001 (with hot reload)"
	@echo "📡 WebSocket: ws://localhost:3009"

# Stop all services
stop:
	@echo "🛑 Stopping Mini Wolverine services..."
	docker-compose down
	@echo "✅ Services stopped!"

# Restart services
restart: stop start

# View logs
logs:
	@echo "📄 Viewing service logs (press Ctrl+C to exit)..."
	docker-compose logs -f

# Clean up
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	docker-compose down -v --remove-orphans
	docker system prune -f
	@echo "✅ Cleanup completed!"

# Build containers
build:
	@echo "🔨 Building containers..."
	docker-compose build --no-cache
	@echo "✅ Build completed!"

# Health check
health:
	@echo "🏥 Checking service health..."
	@echo ""
	@echo "Frontend (Nginx):"
	@curl -s -o /dev/null -w "  Status: %{http_code}\n" http://localhost:8080 || echo "  Status: Unavailable"
	@echo ""
	@echo "WebSocket Server:"
	@curl -s http://localhost:3009/health | python3 -m json.tool 2>/dev/null || echo "  Status: Unavailable"
	@echo ""

# Basic connectivity tests
test:
	@echo "🧪 Running basic connectivity tests..."
	@echo ""
	
	@echo "1. Testing HTTP frontend..."
	@if curl -s -f http://localhost:8080 > /dev/null; then \
		echo "  ✅ Frontend HTTP accessible"; \
	else \
		echo "  ❌ Frontend HTTP failed"; \
	fi
	
	@echo ""
	@echo "2. Testing WebSocket server HTTP API..."
	@if curl -s -f http://localhost:3009/health > /dev/null; then \
		echo "  ✅ WebSocket server HTTP accessible"; \
	else \
		echo "  ❌ WebSocket server HTTP failed"; \
	fi
	
	@echo ""
	@echo "3. Testing WebSocket connection..."
	@timeout 5 node -e " \
		const WebSocket = require('ws'); \
		const ws = new WebSocket('ws://localhost:3009'); \
		ws.on('open', () => { console.log('  ✅ WebSocket connection successful'); process.exit(0); }); \
		ws.on('error', (err) => { console.log('  ❌ WebSocket connection failed:', err.message); process.exit(1); }); \
	" 2>/dev/null || echo "  ❌ WebSocket connection test failed (install nodejs or check connection)"
	
	@echo ""
	@echo "Test completed!"

# Development helpers
install-backend:
	@echo "📦 Installing backend dependencies..."
	cd backend && npm install
	@echo "✅ Backend dependencies installed!"

install-vue:
	@echo "📦 Installing Vue frontend dependencies..."
	cd frontend-vue && npm install
	@echo "✅ Vue frontend dependencies installed!"

run-backend:
	@echo "🚀 Running backend in development mode..."
	cd backend && npm run dev

run-vue:
	@echo "🚀 Running Vue frontend in development mode..."
	cd frontend-vue && npm run dev

frontend-logs:
	docker-compose logs -f web-server

backend-logs:
	docker-compose logs -f websocket-server

dev-logs:
	docker-compose logs -f dev-server

# Quick commands
up: start
down: stop
rebuild: clean build start
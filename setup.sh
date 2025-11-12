#!/bin/bash

# Mini Wolverine - Setup Script
# This script helps set up the development environment by handling file caching
# and git clone operations intelligently.

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CACHE_DIR="$SCRIPT_DIR/.setup-cache"
FILES_TO_CACHE=("README.md" "Makefile" "docker-compose.yml")

echo "🔧 Mini Wolverine Setup Script"
echo "=============================="
echo ""

# Function to cache files
cache_files() {
    echo "📦 Caching existing files..."
    mkdir -p "$CACHE_DIR"
    
    for file in "${FILES_TO_CACHE[@]}"; do
        if [ -f "$SCRIPT_DIR/$file" ]; then
            cp "$SCRIPT_DIR/$file" "$CACHE_DIR/$file"
            echo "  ✅ Cached: $file"
        else
            echo "  ℹ️  File not found (will be created): $file"
        fi
    done
    echo ""
}

# Function to restore cached files
restore_cached_files() {
    echo "📥 Restoring cached files..."
    for file in "${FILES_TO_CACHE[@]}"; do
        if [ -f "$CACHE_DIR/$file" ] && [ ! -f "$SCRIPT_DIR/$file" ]; then
            cp "$CACHE_DIR/$file" "$SCRIPT_DIR/$file"
            echo "  ✅ Restored: $file"
        fi
    done
    echo ""
}

# Function to remove cached files if they exist in repo
remove_cached_files() {
    echo "🗑️  Removing cached files (found in repository)..."
    for file in "${FILES_TO_CACHE[@]}"; do
        if [ -f "$CACHE_DIR/$file" ] && [ -f "$SCRIPT_DIR/$file" ]; then
            rm "$CACHE_DIR/$file"
            echo "  ✅ Removed cache: $file"
        fi
    done
    echo ""
}

# Function to clean up cache directory
cleanup_cache() {
    if [ -d "$CACHE_DIR" ]; then
        if [ -z "$(ls -A "$CACHE_DIR")" ]; then
            rmdir "$CACHE_DIR"
            echo "🧹 Cleaned up empty cache directory"
        fi
    fi
}

# Main setup logic
main() {
    # Step 1: Check if we're in a git repository
    if [ -d ".git" ]; then
        echo "✅ Already in a git repository"
        echo ""
        
        # Check if files exist in repo
        all_exist=true
        for file in "${FILES_TO_CACHE[@]}"; do
            if [ ! -f "$file" ]; then
                all_exist=false
                break
            fi
        done
        
        if [ "$all_exist" = true ]; then
            echo "✅ All required files exist in repository"
            cleanup_cache
            exit 0
        else
            echo "⚠️  Some required files are missing, checking cache..."
            restore_cached_files
            cleanup_cache
            exit 0
        fi
    fi
    
    # Step 2: Cache existing files if they exist
    cache_files
    
    # Step 3: Clone repository
    echo "📥 Cloning repository..."
    echo "Repository: https://github.com/Mingohe/mini-wolverine.git"
    echo "Branch: dev"
    echo ""
    
    # Clone to temporary directory first
    TEMP_DIR=$(mktemp -d)
    git clone -b dev https://github.com/Mingohe/mini-wolverine.git "$TEMP_DIR"
    
    # Move files from temp directory to current directory
    echo "📋 Copying files to current directory..."
    cp -r "$TEMP_DIR"/* "$SCRIPT_DIR/" 2>/dev/null || true
    cp -r "$TEMP_DIR"/.* "$SCRIPT_DIR/" 2>/dev/null || true
    
    # Clean up temp directory
    rm -rf "$TEMP_DIR"
    
    echo "✅ Repository cloned successfully"
    echo ""
    
    # Step 4: Check if files exist in cloned repo
    echo "🔍 Checking for cached files in repository..."
    files_in_repo=0
    for file in "${FILES_TO_CACHE[@]}"; do
        if [ -f "$SCRIPT_DIR/$file" ]; then
            files_in_repo=$((files_in_repo + 1))
            echo "  ✅ Found in repo: $file"
        fi
    done
    
    # Step 5: Handle cached files
    if [ $files_in_repo -eq ${#FILES_TO_CACHE[@]} ]; then
        # All files exist in repo, remove cache
        remove_cached_files
    else
        # Some files missing, restore from cache
        restore_cached_files
    fi
    
    # Step 6: Cleanup
    cleanup_cache
    
    # Step 7: Create .env file template
    if [ ! -f ".env" ]; then
        echo "📝 Creating .env file template..."
        cat > .env << 'EOF'
# Mini Wolverine - Environment Configuration
# ⚠️ IMPORTANT: Set your CAITLYN_TOKEN below
# Get your token from: Contact administrator or check Wolverine service documentation

CAITLYN_TOKEN=your_caitlyn_token_here

# Optional: Override default values
# PORT=4000
# LOG_LEVEL=info
# CAITLYN_WS_URL=wss://116.wolverine-box.com/tm
EOF
        echo "  ✅ Created .env file"
        echo ""
    else
        echo "ℹ️  .env file already exists, skipping creation"
        echo ""
    fi
    
    echo ""
    echo "✅ Setup completed!"
    echo ""
    echo "📋 Next steps (REQUIRED):"
    echo ""
    echo "  1. Edit .env file and set your CAITLYN_TOKEN:"
    echo "     nano .env  (or use your preferred editor)"
    echo "     Replace 'your_caitlyn_token_here' with your actual token"
    echo ""
    echo "  2. Start development environment:"
    echo "     make dev"
    echo ""
    echo "  3. Access services:"
    echo "     - Vue Frontend: http://localhost:3002"
    echo "     - Backend API: http://localhost:4000/api/health"
    echo ""
    echo "📚 For detailed instructions, see README.md"
    echo ""
}

# Run main function
main


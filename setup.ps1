# Mini Wolverine - Setup Script (PowerShell for Windows)
# This script helps set up the development environment by handling file caching
# and git clone operations intelligently.

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CacheDir = Join-Path $ScriptDir ".setup-cache"
$FilesToCache = @("README.md", "Makefile", "docker-compose.yml")

Write-Host "🔧 Mini Wolverine Setup Script (PowerShell)" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Function to cache files
function Cache-Files {
    Write-Host "📦 Caching existing files..." -ForegroundColor Yellow
    
    if (-not (Test-Path $CacheDir)) {
        New-Item -ItemType Directory -Path $CacheDir | Out-Null
    }
    
    foreach ($file in $FilesToCache) {
        $filePath = Join-Path $ScriptDir $file
        if (Test-Path $filePath) {
            Copy-Item $filePath (Join-Path $CacheDir $file) -Force
            Write-Host "  ✅ Cached: $file" -ForegroundColor Green
        } else {
            Write-Host "  ℹ️  File not found (will be created): $file" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

# Function to restore cached files
function Restore-CachedFiles {
    Write-Host "📥 Restoring cached files..." -ForegroundColor Yellow
    foreach ($file in $FilesToCache) {
        $cachedFile = Join-Path $CacheDir $file
        $targetFile = Join-Path $ScriptDir $file
        if ((Test-Path $cachedFile) -and (-not (Test-Path $targetFile))) {
            Copy-Item $cachedFile $targetFile -Force
            Write-Host "  ✅ Restored: $file" -ForegroundColor Green
        }
    }
    Write-Host ""
}

# Function to remove cached files if they exist in repo
function Remove-CachedFiles {
    Write-Host "🗑️  Removing cached files (found in repository)..." -ForegroundColor Yellow
    foreach ($file in $FilesToCache) {
        $cachedFile = Join-Path $CacheDir $file
        $targetFile = Join-Path $ScriptDir $file
        if ((Test-Path $cachedFile) -and (Test-Path $targetFile)) {
            Remove-Item $cachedFile -Force
            Write-Host "  ✅ Removed cache: $file" -ForegroundColor Green
        }
    }
    Write-Host ""
}

# Function to clean up cache directory
function Cleanup-Cache {
    if (Test-Path $CacheDir) {
        $items = Get-ChildItem $CacheDir
        if ($items.Count -eq 0) {
            Remove-Item $CacheDir -Force
            Write-Host "🧹 Cleaned up empty cache directory" -ForegroundColor Gray
        }
    }
}

# Main setup logic
function Main {
    # Step 1: Check if we're in a git repository
    if (Test-Path ".git") {
        Write-Host "✅ Already in a git repository" -ForegroundColor Green
        Write-Host ""
        
        # Check if files exist in repo
        $allExist = $true
        foreach ($file in $FilesToCache) {
            if (-not (Test-Path $file)) {
                $allExist = $false
                break
            }
        }
        
        if ($allExist) {
            Write-Host "✅ All required files exist in repository" -ForegroundColor Green
            Cleanup-Cache
            exit 0
        } else {
            Write-Host "⚠️  Some required files are missing, checking cache..." -ForegroundColor Yellow
            Restore-CachedFiles
            Cleanup-Cache
            exit 0
        }
    }
    
    # Step 2: Cache existing files if they exist
    Cache-Files
    
    # Step 3: Clone repository
    Write-Host "📥 Cloning repository..." -ForegroundColor Cyan
    Write-Host "Repository: https://github.com/Mingohe/mini-wolverine.git"
    Write-Host "Branch: dev"
    Write-Host ""
    
    # Clone to temporary directory first
    $TempDir = Join-Path $env:TEMP "mini-wolverine-$(New-Guid)"
    New-Item -ItemType Directory -Path $TempDir | Out-Null
    
    try {
        git clone -b dev https://github.com/Mingohe/mini-wolverine.git $TempDir
        
        # Copy files from temp directory to current directory
        Write-Host "📋 Copying files to current directory..." -ForegroundColor Cyan
        Get-ChildItem $TempDir -Force | ForEach-Object {
            $targetPath = Join-Path $ScriptDir $_.Name
            if ($_.PSIsContainer) {
                if (-not (Test-Path $targetPath)) {
                    Copy-Item $_.FullName $targetPath -Recurse -Force
                }
            } else {
                Copy-Item $_.FullName $targetPath -Force
            }
        }
        
        Write-Host "✅ Repository cloned successfully" -ForegroundColor Green
        Write-Host ""
    } finally {
        # Clean up temp directory
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Step 4: Check if files exist in cloned repo
    Write-Host "🔍 Checking for cached files in repository..." -ForegroundColor Cyan
    $filesInRepo = 0
    foreach ($file in $FilesToCache) {
        if (Test-Path $file) {
            $filesInRepo++
            Write-Host "  ✅ Found in repo: $file" -ForegroundColor Green
        }
    }
    
    # Step 5: Handle cached files
    if ($filesInRepo -eq $FilesToCache.Count) {
        # All files exist in repo, remove cache
        Remove-CachedFiles
    } else {
        # Some files missing, restore from cache
        Restore-CachedFiles
    }
    
    # Step 6: Cleanup
    Cleanup-Cache
    
    # Step 7: Create .env file template
    $envFile = Join-Path $ScriptDir ".env"
    if (-not (Test-Path $envFile)) {
        Write-Host "📝 Creating .env file template..." -ForegroundColor Cyan
        $envContent = @"
# Mini Wolverine - Environment Configuration
# ⚠️ IMPORTANT: Set your CAITLYN_TOKEN below
# Get your token from: Contact administrator or check Wolverine service documentation

CAITLYN_TOKEN=your_caitlyn_token_here

# Optional: Override default values
# PORT=4000
# LOG_LEVEL=info
# CAITLYN_WS_URL=wss://116.wolverine-box.com/tm
"@
        $envContent | Out-File -FilePath $envFile -Encoding utf8
        Write-Host "  ✅ Created .env file" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "ℹ️  .env file already exists, skipping creation" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host ""
    Write-Host "✅ Setup completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps (REQUIRED):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1. Edit .env file and set your CAITLYN_TOKEN:" -ForegroundColor Yellow
    Write-Host "     notepad .env  (or use your preferred editor)" -ForegroundColor Gray
    Write-Host "     Replace 'your_caitlyn_token_here' with your actual token" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Start development environment:" -ForegroundColor Yellow
    Write-Host "     make dev" -ForegroundColor Gray
    Write-Host "     (If make is not available, use: docker compose up -d)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Access services:" -ForegroundColor Yellow
    Write-Host "     - Vue Frontend: http://localhost:3002" -ForegroundColor Gray
    Write-Host "     - Backend API: http://localhost:4000/api/health" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📚 For detailed instructions, see README.md" -ForegroundColor Cyan
    Write-Host ""
}

# Run main function
Main


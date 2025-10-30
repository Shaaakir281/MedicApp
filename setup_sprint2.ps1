<#
setup_sprint2.ps1

Usage (PowerShell):
  .\setup_sprint2.ps1          # run full setup (backend env, docker services, migrations, start server)
  .\setup_sprint2.ps1 -SkipFrontend  # skip frontend npm install

Notes:
- Run this script from Windows PowerShell (not from Anaconda Prompt) to create a clean venv
- If WeasyPrint fails on Windows, use WSL or run only backend without PDF generation
#>

param(
    [switch]$SkipFrontend
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RepoRoot 'backend'
$FrontendDir = Join-Path $RepoRoot 'frontend'
$VenvDir = Join-Path $BackendDir '.venv'

Write-Info "Repo root: $RepoRoot"
Write-Info "Backend dir: $BackendDir"

# 1) Ensure a system Python is available
$pyCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyCmd) {
    Write-Err "Python not found in PATH. Install Python 3.11+ and re-run this script."
    exit 1
}

# 2) Create venv if missing
if (-not (Test-Path $VenvDir)) {
    Write-Info "Creating virtual environment in $VenvDir"
    & python -m venv $VenvDir
} else {
    Write-Info "Virtual environment already exists at $VenvDir"
}

$PythonExe = Join-Path $VenvDir 'Scripts\python.exe'
if (-not (Test-Path $PythonExe)) {
    Write-Err "Python executable not found in venv ($PythonExe). Ensure venv creation succeeded."
    exit 1
}

# 3) Upgrade pip and install backend requirements
Write-Info "Upgrading pip and installing backend requirements"
& $PythonExe -m pip install --upgrade pip
& $PythonExe -m pip install -r (Join-Path $BackendDir 'requirements.txt')

# 4) Copy .env.example to .env if missing
$envExample = Join-Path $BackendDir '.env.example'
$envFile = Join-Path $BackendDir '.env'
if ((Test-Path $envExample) -and -not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Info "Copied .env.example -> .env (please edit $envFile if you need to change DATABASE_URL/JWT_SECRET_KEY)"
} else {
    Write-Info ".env already exists or .env.example missing"
}

# 5) Start Postgres + Redis via Docker Compose
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Info "Starting Docker Compose services (Postgres, Redis, backend)"
    Push-Location $BackendDir
    docker compose up -d
    Pop-Location
} else {
    Write-Warn "Docker not found. Please start Postgres and Redis manually or install Docker."
}

# 6) Wait for Postgres to accept connections on localhost:5432
Write-Info "Waiting for Postgres to be ready (checking localhost:5432)"
$tries = 0
while ($tries -lt 60) {
    $res = Test-NetConnection -ComputerName '127.0.0.1' -Port 5432 -WarningAction SilentlyContinue
    if ($res.TcpTestSucceeded) { break }
    Start-Sleep -Seconds 2
    $tries++
}
if ($tries -ge 60) { Write-Warn "Postgres did not become ready after waiting. Migrations may fail." }

# 7) Run Alembic migrations
Write-Info "Applying Alembic migrations"
Push-Location $BackendDir
& $PythonExe -m alembic upgrade head
$alembicExit = $LASTEXITCODE
Pop-Location
if ($alembicExit -ne 0) { Write-Warn "Alembic command returned non-zero ($alembicExit). Check logs above." }

# 8) Optionally install frontend deps
if (-not $SkipFrontend) {
    if (Test-Path $FrontendDir) {
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            Write-Info "Installing frontend dependencies (npm)"
            Push-Location $FrontendDir
            npm install
            Pop-Location
        } else {
            Write-Warn "npm not found. Skipping frontend installation."
        }
    }
}

# 9) Start backend dev server (uvicorn) in background
Write-Info "Starting backend (uvicorn) in background"
Start-Process -FilePath $PythonExe -ArgumentList "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000" -WorkingDirectory $BackendDir -NoNewWindow

Write-Info "Setup complete. Backend should be reachable at http://127.0.0.1:8000/docs"
Write-Info "If you need to generate a prescription PDF: create an appointment, then POST /prescriptions/{appointment_id}"

Write-Info "Notes: If WeasyPrint fails on Windows, consider using WSL or run only the backend without PDF generation."

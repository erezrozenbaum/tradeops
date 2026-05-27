#Requires -Version 5.1
<#
.SYNOPSIS
    TradeOps AI — Local Production Deployment Script

.DESCRIPTION
    Fully automated deployment of TradeOps AI on a Windows machine.

    What it does:
      1. Verifies system requirements (Windows build, disk space, RAM)
      2. Checks for Docker Desktop — downloads and installs it if missing
      3. Waits for the Docker daemon to be ready
      4. Generates cryptographic secrets automatically
      5. Prompts for your Anthropic API key (with step-by-step instructions)
      6. Builds Docker images and starts all services (DB, cache, backend, frontend)
      7. Waits for health checks and prints access URLs

    Run from the repository root:
        .\deploy.ps1

    Other modes:
        .\deploy.ps1 -Stop       # Stop all services
        .\deploy.ps1 -Update     # Rebuild + restart (keep secrets)
        .\deploy.ps1 -Reset      # Wipe secrets and regenerate everything
        .\deploy.ps1 -Monitoring # Also start Prometheus + Grafana

.NOTES
    Requires: Windows 10 version 2004 (build 19041) or later, or Windows 11
    Requires: 15 GB free disk space, 6 GB RAM
    Internet connection required on first run.
#>

[CmdletBinding()]
param (
    [switch]$Stop,
    [switch]$Update,
    [switch]$Reset,
    [switch]$Monitoring
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'   # Suppresses Invoke-WebRequest progress bar

# ── Constants ─────────────────────────────────────────────────────────────────

$MIN_DISK_GB           = 15
$MIN_RAM_GB            = 6
$DOCKER_DOWNLOAD_URL   = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe'
$DOCKER_INSTALLER_PATH = "$env:TEMP\DockerDesktopInstaller.exe"
$DOCKER_WAIT_SECS      = 150
$HEALTH_WAIT_SECS      = 180

$SCRIPT_ROOT     = $PSScriptRoot
$COMPOSE_FILE    = Join-Path $SCRIPT_ROOT 'infra\docker-compose.deploy.yml'
$ENV_FILE        = Join-Path $SCRIPT_ROOT '.env.deploy'

$FRONTEND_URL    = 'http://localhost:3000'
$BACKEND_URL     = 'http://localhost:8000'
$GRAFANA_URL     = 'http://localhost:3001'

# ── Output helpers ─────────────────────────────────────────────────────────────

function Write-Step ([string]$msg) {
    Write-Host "`n  $([char]9670) $msg" -ForegroundColor Cyan
}

function Write-Ok ([string]$msg) {
    Write-Host "    $([char]10003) $msg" -ForegroundColor Green
}

function Write-Warn ([string]$msg) {
    Write-Host "    $([char]9888) $msg" -ForegroundColor Yellow
}

function Write-Info ([string]$msg) {
    Write-Host "    $([char]183) $msg" -ForegroundColor Gray
}

function Write-Fail ([string]$msg) {
    Write-Host "`n  $([char]10007) $msg`n" -ForegroundColor Red
    exit 1
}

function Write-Banner {
    Clear-Host
    $cyan = [ConsoleColor]::Cyan
    $dark = [ConsoleColor]::DarkCyan
    $gray = [ConsoleColor]::DarkGray

    Write-Host ''
    Write-Host '      _______ ______  ___    ____  ______ ____  ____  _____  ' -ForegroundColor $cyan
    Write-Host '     |__   __|  __  |/   \  |  _ \|  ____|  _ \|  _ \/ ____|' -ForegroundColor $cyan
    Write-Host '        | |  | |__) | /^\ \ | | | | |__  | | | | |_) \___ \ ' -ForegroundColor $cyan
    Write-Host '        | |  |  _  / / ___ \| | | |  __| | | | |  __/ ___) |' -ForegroundColor $cyan
    Write-Host '        |_|  |_| \_\/_/   \_\_| |_|_____||___/ |_|   |____/ ' -ForegroundColor $cyan
    Write-Host '                                                               ' -ForegroundColor $cyan
    Write-Host '                 AI  —  Deployment Script v3.14.0             ' -ForegroundColor $dark
    Write-Host ''
    Write-Host '  Personal Financial Intelligence Platform                      ' -ForegroundColor $gray
    Write-Host '  Powered by Claude AI (Anthropic)                              ' -ForegroundColor $gray
    Write-Host ''
}

# ── Utilities ─────────────────────────────────────────────────────────────────

function New-SecureHex ([int]$bytes = 32) {
    $buf = [byte[]]::new($bytes)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return [System.BitConverter]::ToString($buf).Replace('-', '').ToLower()
}

function New-AlphanumPassword ([int]$length = 24) {
    # Excludes chars that can break connection strings: @ / : # ? + = & [ ] { }
    $chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return -join ((1..$length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

function Read-EnvFile ([string]$path) {
    $map = @{}
    if (-not (Test-Path $path)) { return $map }
    Get-Content $path | Where-Object { $_ -match '^\s*([^#=\s][^=]*)=(.*)' } | ForEach-Object {
        $parts = $_ -split '=', 2
        if ($parts.Count -eq 2) {
            $map[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
    return $map
}

function Test-DockerInstalled {
    return $null -ne (Get-Command 'docker' -ErrorAction SilentlyContinue)
}

function Test-DockerRunning {
    try {
        $null = & docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Wait-ForDocker ([int]$timeoutSecs = 150) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSecs) {
        if (Test-DockerRunning) { return $true }
        Start-Sleep -Seconds 5
        Write-Host '.' -NoNewline -ForegroundColor DarkGray
    }
    Write-Host ''
    return $false
}

function Wait-ForHttp ([string]$url, [int]$timeoutSecs = 180) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSecs) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 4 -ErrorAction Stop
            if ($r.StatusCode -lt 500) { return $true }
        } catch {}
        Start-Sleep -Seconds 5
        Write-Host '.' -NoNewline -ForegroundColor DarkGray
    }
    Write-Host ''
    return $false
}

function Invoke-Compose ([string[]]$args) {
    $allArgs = @('-f', $COMPOSE_FILE, '--env-file', $ENV_FILE) + $args
    & docker compose @allArgs
    return $LASTEXITCODE
}

# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

Write-Banner

# ── Guard: must run from repo root ─────────────────────────────────────────────

if (-not (Test-Path (Join-Path $SCRIPT_ROOT 'infra\docker-compose.deploy.yml'))) {
    Write-Fail "Cannot find infra\docker-compose.deploy.yml.`n  Make sure you are running this script from the TradeOps repository root."
}

# ── Special modes ──────────────────────────────────────────────────────────────

if ($Stop) {
    Write-Step 'Stopping TradeOps AI'
    if (-not (Test-Path $ENV_FILE)) { Write-Fail '.env.deploy not found — nothing to stop.' }
    $rc = Invoke-Compose @('down')
    if ($rc -eq 0) { Write-Ok 'All services stopped.' } else { Write-Fail 'docker compose down failed.' }
    exit 0
}

if ($Update) {
    Write-Step 'Updating TradeOps AI (rebuild + restart)'
    if (-not (Test-Path $ENV_FILE)) { Write-Fail '.env.deploy not found — run .\deploy.ps1 first to set up.' }
    $rc = Invoke-Compose @('up', '-d', '--build')
    if ($rc -eq 0) {
        Write-Ok "Update complete — $FRONTEND_URL"
    } else {
        Write-Fail "docker compose up failed (exit $rc). Check logs with:`n  docker compose -f infra\docker-compose.deploy.yml logs"
    }
    exit 0
}

# ── Intro ──────────────────────────────────────────────────────────────────────

Write-Host '  This script will install and launch TradeOps AI on your machine.' -ForegroundColor White
Write-Host ''
Write-Host '  Steps:  1. System check   2. Docker Desktop   3. Secrets & API key' -ForegroundColor DarkGray
Write-Host '          4. Build images   5. Start services   6. Health check' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  First-run time: 10–20 minutes (building Docker images).' -ForegroundColor DarkGray
Write-Host '  Subsequent starts: ~30 seconds (cached layers).' -ForegroundColor DarkGray
Write-Host ''
$null = Read-Host '  Press ENTER to begin (Ctrl+C to cancel)'

# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 1 — System requirements
# ══════════════════════════════════════════════════════════════════════════════

Write-Step 'Checking system requirements'

# ── Windows version ────────────────────────────────────────────────────────────

$build = [System.Environment]::OSVersion.Version.Build
if ($build -lt 19041) {
    Write-Fail ("Windows 10 version 2004 (build 19041) or later is required.`n" +
                "  Your build: $build`n" +
                "  Please run Windows Update before continuing.")
}
Write-Ok "Windows build $build — supported"

# ── Disk space (C: drive — Docker image store) ─────────────────────────────────

$cDrive = Get-PSDrive C -ErrorAction SilentlyContinue
if (-not $cDrive) { $cDrive = Get-PSDrive (Split-Path $SCRIPT_ROOT -Qualifier).TrimEnd(':') }
$freeGB = [math]::Round($cDrive.Free / 1GB, 1)

if ($freeGB -lt $MIN_DISK_GB) {
    Write-Fail ("Insufficient disk space.`n" +
                "  Found:    $freeGB GB free`n" +
                "  Required: $MIN_DISK_GB GB`n`n" +
                "  Free up space by:`n" +
                "    • Running Disk Cleanup (cleanmgr.exe)`n" +
                "    • Removing unused Docker images: docker system prune -a`n" +
                "    • Deleting large files from Downloads or Recycle Bin`n`n" +
                "  Then re-run this script.")
}
Write-Ok "${freeGB} GB free on C:\ — sufficient"

# ── RAM ────────────────────────────────────────────────────────────────────────

$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ramGB -lt $MIN_RAM_GB) {
    Write-Warn "${ramGB} GB RAM detected — recommended minimum is $MIN_RAM_GB GB. Performance may be degraded."
} else {
    Write-Ok "${ramGB} GB RAM — sufficient"
}

# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 2 — Docker Desktop
# ══════════════════════════════════════════════════════════════════════════════

Write-Step 'Checking Docker Desktop'

if (-not (Test-DockerInstalled)) {

    Write-Host ''
    Write-Host '  Docker Desktop is not installed.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Docker Desktop is required to run TradeOps AI. It provides:' -ForegroundColor White
    Write-Host '    • A Linux container engine (via WSL2)' -ForegroundColor Gray
    Write-Host '    • Isolated environments for PostgreSQL, Redis, backend, and frontend' -ForegroundColor Gray
    Write-Host '    • Easy service management and log access' -ForegroundColor Gray
    Write-Host ''
    Write-Host '  The installer is ~600 MB and requires administrator access (UAC prompt).' -ForegroundColor Gray
    Write-Host '  Docker Desktop may require a system reboot after installation.' -ForegroundColor Yellow
    Write-Host ''

    $choice = Read-Host '  Download and install Docker Desktop automatically? [Y/n]'
    if ($choice -ieq 'n') {
        Write-Fail ("Docker Desktop is required.`n" +
                    "  Download it from: https://www.docker.com/products/docker-desktop/`n" +
                    "  After installing, re-run this script.")
    }

    # Download
    Write-Host ''
    Write-Info "Downloading Docker Desktop (~600 MB)..."
    Write-Info "Source:      $DOCKER_DOWNLOAD_URL"
    Write-Info "Destination: $DOCKER_INSTALLER_PATH"
    Write-Host ''

    try {
        $wc = [System.Net.WebClient]::new()
        $wc.DownloadFile($DOCKER_DOWNLOAD_URL, $DOCKER_INSTALLER_PATH)
    } catch {
        Write-Fail ("Download failed: $_`n" +
                    "  Check your internet connection and try again.`n" +
                    "  Or download manually from: https://www.docker.com/products/docker-desktop/")
    }
    Write-Ok 'Download complete'

    # Install
    Write-Host ''
    Write-Info 'Launching Docker Desktop installer...'
    Write-Info 'A User Account Control (UAC) prompt will appear — click Yes to allow.'
    Write-Info 'Use all default options. Enable WSL2 backend when asked.'
    Write-Host ''

    try {
        $proc = Start-Process `
            -FilePath $DOCKER_INSTALLER_PATH `
            -ArgumentList 'install', '--quiet', '--accept-license' `
            -Wait -PassThru
    } catch {
        Write-Fail "Could not launch installer: $_`n  Try running the installer manually: $DOCKER_INSTALLER_PATH"
    }

    # Exit codes: 0 = success, 1 = reboot needed
    if ($proc.ExitCode -notin 0, 1) {
        Write-Fail ("Docker Desktop installation failed (exit code $($proc.ExitCode)).`n" +
                    "  Try installing manually from: https://www.docker.com/products/docker-desktop/`n" +
                    "  Common causes: antivirus blocking the installer, no admin rights.")
    }

    Write-Ok 'Docker Desktop installed successfully'
    Write-Host ''
    Write-Host '  ╔═══════════════════════════════════════════════════════════╗' -ForegroundColor Yellow
    Write-Host '  ║                                                           ║' -ForegroundColor Yellow
    Write-Host '  ║   A system REBOOT is required to complete the setup.      ║' -ForegroundColor Yellow
    Write-Host '  ║   After rebooting, re-run this script to continue.        ║' -ForegroundColor Yellow
    Write-Host '  ║                                                           ║' -ForegroundColor Yellow
    Write-Host '  ║   Command to re-run:  .\deploy.ps1                        ║' -ForegroundColor Yellow
    Write-Host '  ║                                                           ║' -ForegroundColor Yellow
    Write-Host '  ╚═══════════════════════════════════════════════════════════╝' -ForegroundColor Yellow
    Write-Host ''

    $reboot = Read-Host '  Reboot now? [Y/n]'
    if ($reboot -ine 'n') {
        Restart-Computer -Force
    } else {
        Write-Info 'Reboot skipped. Re-run this script after rebooting.'
        exit 0
    }
}

Write-Ok 'Docker Desktop is installed'

# ── Ensure Docker daemon is running ────────────────────────────────────────────

if (-not (Test-DockerRunning)) {
    Write-Warn 'Docker daemon is not running — attempting to start Docker Desktop...'

    $desktopExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    if (-not (Test-Path $desktopExe)) {
        # Try 32-bit path as fallback
        $desktopExe = 'C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe'
    }

    if (Test-Path $desktopExe) {
        Start-Process $desktopExe -ErrorAction SilentlyContinue
        Write-Host ''
        Write-Info "Waiting up to $DOCKER_WAIT_SECS seconds for Docker to become ready..."
        Write-Host -NoNewline '    '
        $started = Wait-ForDocker -timeoutSecs $DOCKER_WAIT_SECS
        Write-Host ''
        if (-not $started) {
            Write-Fail ("Docker Desktop did not start within $DOCKER_WAIT_SECS seconds.`n" +
                        "  Please start Docker Desktop manually from the Start menu,`n" +
                        "  wait for the whale icon to appear in the taskbar, then re-run this script.")
        }
        Write-Ok 'Docker daemon is ready'
    } else {
        Write-Fail ("Docker Desktop executable not found.`n" +
                    "  Please start Docker Desktop manually from the Start menu,`n" +
                    "  wait for the whale icon in the taskbar, then re-run this script.")
    }
} else {
    Write-Ok 'Docker daemon is running'
}

# ── Verify docker compose plugin ───────────────────────────────────────────────

$composeOut = & docker compose version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail ("The 'docker compose' plugin is not available.`n" +
                "  Update Docker Desktop to version 4.x or later from:`n" +
                "  https://www.docker.com/products/docker-desktop/")
}
$composeVer = ($composeOut | Select-String 'v\d+\.\d+').Matches[0].Value
Write-Ok "Docker Compose $composeVer"

# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 3 — Secrets and configuration
# ══════════════════════════════════════════════════════════════════════════════

Write-Step 'Setting up secrets and configuration'

$existingEnv = Read-EnvFile $ENV_FILE
$useExisting = $false

if ((Test-Path $ENV_FILE) -and -not $Reset) {
    Write-Host ''
    Write-Info 'Existing .env.deploy found.'
    $keep = Read-Host '    Keep existing secrets? [Y/n]'
    if ($keep -ine 'n') {
        Write-Ok 'Using existing configuration'
        $useExisting = $true
    } else {
        Write-Info 'Regenerating all secrets and credentials...'
    }
}

# ── Generate or load secrets ───────────────────────────────────────────────────

if ($useExisting) {
    $pgPassword   = $existingEnv['POSTGRES_PASSWORD']
    $secretKey    = $existingEnv['SECRET_KEY']
    $anthropicKey = $existingEnv['ANTHROPIC_API_KEY']
    $alphaKey     = $existingEnv['ALPHA_VANTAGE_API_KEY']
    $smtpHost     = $existingEnv['SMTP_HOST']
    $smtpPort     = $existingEnv['SMTP_PORT']
    $smtpUser     = $existingEnv['SMTP_USER']
    $smtpPass     = $existingEnv['SMTP_PASS']
} else {
    # Cryptographically secure secrets
    $pgPassword = New-AlphanumPassword 24
    $secretKey  = New-SecureHex 32
    Write-Ok 'Generated POSTGRES_PASSWORD (24 chars alphanumeric)'
    Write-Ok 'Generated SECRET_KEY (256-bit secure random)'
    $anthropicKey = ''
    $alphaKey     = ''
    $smtpHost     = ''
    $smtpPort     = '587'
    $smtpUser     = ''
    $smtpPass     = ''
}

# ── Anthropic API key ──────────────────────────────────────────────────────────

$needsAnthropicKey = (-not $useExisting) -or
                     (-not $anthropicKey) -or
                     ($anthropicKey -in @('sk-ant-...', '', 'your-key-here'))

if ($needsAnthropicKey) {
    Write-Host ''
    Write-Host '  ╔════════════════════════════════════════════════════════════════════╗' -ForegroundColor Cyan
    Write-Host '  ║              ANTHROPIC API KEY — REQUIRED                         ║' -ForegroundColor Cyan
    Write-Host '  ╠════════════════════════════════════════════════════════════════════╣' -ForegroundColor Cyan
    Write-Host '  ║                                                                    ║' -ForegroundColor Cyan
    Write-Host '  ║  TradeOps AI uses Claude (by Anthropic) to power:                 ║' -ForegroundColor Cyan
    Write-Host '  ║    • Command Center AI analysis (daily financial intelligence)     ║' -ForegroundColor Cyan
    Write-Host '  ║    • AI Coach (personalized financial guidance)                    ║' -ForegroundColor Cyan
    Write-Host '  ║    • Market Research reports and strategy analysis                 ║' -ForegroundColor Cyan
    Write-Host '  ║    • Behavioral risk explanations and recommendations              ║' -ForegroundColor Cyan
    Write-Host '  ║                                                                    ║' -ForegroundColor Cyan
    Write-Host '  ║  How to get your free API key (takes about 2 minutes):             ║' -ForegroundColor White
    Write-Host '  ║                                                                    ║' -ForegroundColor White
    Write-Host '  ║   1.  Open this URL in your browser:                               ║' -ForegroundColor White
    Write-Host '  ║       https://console.anthropic.com                                ║' -ForegroundColor Yellow
    Write-Host '  ║                                                                    ║' -ForegroundColor White
    Write-Host '  ║   2.  Click "Sign Up" — use your email or Google account           ║' -ForegroundColor White
    Write-Host '  ║                                                                    ║' -ForegroundColor White
    Write-Host '  ║   3.  In the left sidebar, click "API Keys"                        ║' -ForegroundColor White
    Write-Host '  ║                                                                    ║' -ForegroundColor White
    Write-Host '  ║   4.  Click "+  Create Key"                                        ║' -ForegroundColor White
    Write-Host '  ║       Name it anything, e.g. "TradeOps"                            ║' -ForegroundColor White
    Write-Host '  ║                                                                    ║' -ForegroundColor White
    Write-Host '  ║   5.  Copy the key — it starts with:  sk-ant-                      ║' -ForegroundColor White
    Write-Host '  ║       (You can only see it once — save it somewhere safe!)         ║' -ForegroundColor Yellow
    Write-Host '  ║                                                                    ║' -ForegroundColor Cyan
    Write-Host '  ║  Cost:  New accounts receive $5 free credit (~1,600 AI reports)   ║' -ForegroundColor Gray
    Write-Host '  ║         Claude Sonnet 4 costs ~$0.003 per Command Center report    ║' -ForegroundColor Gray
    Write-Host '  ║         For personal use, $5 credit covers months of usage         ║' -ForegroundColor Gray
    Write-Host '  ║                                                                    ║' -ForegroundColor Cyan
    Write-Host '  ╚════════════════════════════════════════════════════════════════════╝' -ForegroundColor Cyan
    Write-Host ''

    do {
        $anthropicKey = (Read-Host '  Paste your Anthropic API key (starts with sk-ant-)').Trim()
        if (-not $anthropicKey.StartsWith('sk-ant-')) {
            Write-Host '    Invalid key format. Anthropic API keys always start with "sk-ant-".' -ForegroundColor Yellow
            Write-Host '    Make sure you copied the full key without extra spaces.' -ForegroundColor Gray
        }
    } while (-not $anthropicKey.StartsWith('sk-ant-'))

    Write-Ok 'Anthropic API key accepted'
}

# ── Alpha Vantage (optional) ───────────────────────────────────────────────────

$needsAlphaKey = (-not $useExisting) -or (-not $alphaKey)

if ($needsAlphaKey) {
    Write-Host ''
    Write-Host '  ── Optional: Alpha Vantage API Key (market data prices) ──────────────' -ForegroundColor DarkGray
    Write-Host '  Provides live/daily stock price data for portfolio valuation.' -ForegroundColor Gray
    Write-Host '  Free tier: 25 API calls per day — enough for personal use.' -ForegroundColor Gray
    Write-Host ''
    Write-Host '  To get a free key:' -ForegroundColor Gray
    Write-Host '    1. Open: https://www.alphavantage.co/support/#api-key' -ForegroundColor Gray
    Write-Host '    2. Fill in the form — no credit card required' -ForegroundColor Gray
    Write-Host '    3. The key arrives instantly on the page' -ForegroundColor Gray
    Write-Host ''
    Write-Host '  Press ENTER to skip (portfolio prices will use cached data).' -ForegroundColor DarkGray
    $alphaKey = (Read-Host '  Alpha Vantage API key [optional, press ENTER to skip]').Trim()
    if ($alphaKey) {
        Write-Ok 'Alpha Vantage key saved'
    } else {
        Write-Info 'Skipped — portfolio prices will use cached/demo data'
    }
}

# ── Email alerts (optional) ────────────────────────────────────────────────────

$needsSmtp = (-not $useExisting) -or (-not $smtpHost)

if ($needsSmtp) {
    Write-Host ''
    Write-Host '  ── Optional: Email Alerts (weekly digest, critical notifications) ────' -ForegroundColor DarkGray
    Write-Host '  Sends you a weekly financial summary and critical alerts (e.g. low emergency fund).' -ForegroundColor Gray
    Write-Host '  Uses Gmail with an App Password (not your main password).' -ForegroundColor Gray
    Write-Host ''
    Write-Host '  Press ENTER to skip email configuration.' -ForegroundColor DarkGray
    $setupEmail = (Read-Host '  Configure email alerts? [y/N]').Trim()

    if ($setupEmail -ieq 'y') {
        Write-Host ''
        Write-Host '  Gmail App Password setup:' -ForegroundColor Gray
        Write-Host '    1. Open: https://myaccount.google.com/security' -ForegroundColor Gray
        Write-Host '    2. Under "How you sign in to Google", click "2-Step Verification"' -ForegroundColor Gray
        Write-Host '    3. Scroll to the bottom and click "App passwords"' -ForegroundColor Gray
        Write-Host '    4. Select "Mail" + "Windows Computer" and click Generate' -ForegroundColor Gray
        Write-Host '    5. Copy the 16-character password shown (no spaces)' -ForegroundColor Gray
        Write-Host ''

        $smtpUser = (Read-Host '  Your Gmail address (e.g. you@gmail.com)').Trim()
        $smtpPass = (Read-Host '  Gmail App Password (16 chars, no spaces)').Trim()
        $smtpHost = 'smtp.gmail.com'
        $smtpPort = '587'
        Write-Ok 'Email alerts configured (Gmail SMTP)'
    } else {
        Write-Info 'Email alerts skipped — you can configure them later by re-running this script with -Reset'
    }
}

# ── Write .env.deploy ──────────────────────────────────────────────────────────

$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
@"
# TradeOps AI — Deployment Configuration
# Auto-generated by deploy.ps1 on $timestamp
#
# IMPORTANT: This file contains secrets. Keep it private.
#            Never commit it to version control.
#            Store a backup in a password manager.

# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_PASSWORD=$pgPassword

# ── Application security ──────────────────────────────────────────────────────
SECRET_KEY=$secretKey

# ── AI (required for all AI features) ────────────────────────────────────────
ANTHROPIC_API_KEY=$anthropicKey

# ── Market data (optional — 25 calls/day free at alphavantage.co) ─────────────
ALPHA_VANTAGE_API_KEY=$alphaKey

# ── Email alerts (optional — leave blank to disable) ─────────────────────────
SMTP_HOST=$smtpHost
SMTP_PORT=$smtpPort
SMTP_USER=$smtpUser
SMTP_PASS=$smtpPass
ALERT_FROM_EMAIL=noreply@tradeops.local
"@ | Set-Content -Path $ENV_FILE -Encoding UTF8

Write-Ok "Configuration saved to .env.deploy"
Write-Info '(Keep this file private — it contains your secrets)'

# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 4 — Build and launch
# ══════════════════════════════════════════════════════════════════════════════

Write-Step 'Building and launching TradeOps AI'

Write-Host ''
Write-Host '  About to build Docker images and start all services:' -ForegroundColor White
Write-Host '    • PostgreSQL 16   — financial database' -ForegroundColor Gray
Write-Host '    • Redis 7         — AI summary cache' -ForegroundColor Gray
Write-Host '    • Backend (FastAPI / Python 3.11) — API + AI engine' -ForegroundColor Gray
Write-Host '    • Frontend (Next.js 14) — web application' -ForegroundColor Gray
Write-Host ''
Write-Host '  First build: 10–20 minutes (downloading base images, installing dependencies).' -ForegroundColor DarkGray
Write-Host '  Rebuild (after code update): 2–5 minutes (cached layers).' -ForegroundColor DarkGray
Write-Host ''
$null = Read-Host '  Press ENTER to start building (Ctrl+C to cancel)'
Write-Host ''

$rc = Invoke-Compose @('up', '-d', '--build')
if ($rc -ne 0) {
    Write-Host ''
    Write-Fail ("docker compose up failed (exit code $rc).`n" +
                "  Review the output above for the specific error.`n`n" +
                "  Common causes:`n" +
                "    • Port 3000 or 8000 already in use — stop other apps using those ports`n" +
                "    • Docker out of disk space — run: docker system prune -f`n" +
                "    • Build error in source code — check output above`n`n" +
                "  View full logs with:`n" +
                "    docker compose -f infra\docker-compose.deploy.yml logs")
}

# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 5 — Health checks
# ══════════════════════════════════════════════════════════════════════════════

Write-Step 'Waiting for services to become healthy'

Write-Host ''
Write-Info "Checking backend API ($BACKEND_URL/health)..."
Write-Host -NoNewline '    '
$backendOk = Wait-ForHttp "$BACKEND_URL/health" -timeoutSecs $HEALTH_WAIT_SECS
Write-Host ''

if ($backendOk) {
    Write-Ok 'Backend API is healthy'
} else {
    Write-Warn 'Backend health check timed out — still starting.'
    Write-Info "Check with: docker compose -f infra\docker-compose.deploy.yml logs backend"
}

Write-Host ''
Write-Info "Checking frontend ($FRONTEND_URL)..."
Write-Host -NoNewline '    '
$frontendOk = Wait-ForHttp $FRONTEND_URL -timeoutSecs $HEALTH_WAIT_SECS
Write-Host ''

if ($frontendOk) {
    Write-Ok 'Frontend is healthy'
} else {
    Write-Warn 'Frontend health check timed out — may still be building.'
    Write-Info "Check with: docker compose -f infra\docker-compose.deploy.yml logs frontend"
}

# ══════════════════════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════════════════════

Write-Host ''
Write-Host '  ╔═══════════════════════════════════════════════════════════════════╗' -ForegroundColor Green
Write-Host '  ║                                                                   ║' -ForegroundColor Green
if ($frontendOk -and $backendOk) {
Write-Host '  ║   TradeOps AI is running!                                         ║' -ForegroundColor Green
} else {
Write-Host '  ║   TradeOps AI is starting up... (services still loading)          ║' -ForegroundColor Yellow
}
Write-Host '  ║                                                                   ║' -ForegroundColor Green
Write-Host '  ╚═══════════════════════════════════════════════════════════════════╝' -ForegroundColor Green
Write-Host ''
Write-Host "  Application:   $FRONTEND_URL" -ForegroundColor White
Write-Host "  Backend API:   $BACKEND_URL/docs  (Swagger UI)" -ForegroundColor Gray
if ($Monitoring) {
Write-Host "  Grafana:       $GRAFANA_URL  (admin / tradeops)" -ForegroundColor Gray
}
Write-Host ''
Write-Host '  ── First-time setup ──────────────────────────────────────────────' -ForegroundColor DarkGray
Write-Host '  1. Open http://localhost:3000 in your browser' -ForegroundColor Gray
Write-Host '  2. Click "Register" and create your account' -ForegroundColor Gray
Write-Host '  3. Follow the Onboarding Wizard to set up your investor profile' -ForegroundColor Gray
Write-Host '  4. Add your financial data — the Command Center AI will activate' -ForegroundColor Gray
Write-Host ''
Write-Host '  ── Useful commands ───────────────────────────────────────────────' -ForegroundColor DarkGray
Write-Host '  Stop all services:     .\deploy.ps1 -Stop' -ForegroundColor Gray
Write-Host '  Update (rebuild):      .\deploy.ps1 -Update' -ForegroundColor Gray
Write-Host '  Reconfigure secrets:   .\deploy.ps1 -Reset' -ForegroundColor Gray
Write-Host '  View live logs:        docker compose -f infra\docker-compose.deploy.yml logs -f' -ForegroundColor Gray
Write-Host '  Service status:        docker compose -f infra\docker-compose.deploy.yml ps' -ForegroundColor Gray
Write-Host '  Backup database:       docker exec tradeops-db-1 pg_dump -U tradeops tradeops > backup.sql' -ForegroundColor Gray
Write-Host ''
Write-Host '  ── Data persistence ──────────────────────────────────────────────' -ForegroundColor DarkGray
Write-Host '  Your data is stored in Docker volumes (survive restarts and updates):' -ForegroundColor Gray
Write-Host '  • postgres_data — all your financial data, profiles, and history' -ForegroundColor Gray
Write-Host '  • redis_data    — AI summary cache (rebuilt automatically if cleared)' -ForegroundColor Gray
Write-Host ''

# Open browser if everything is healthy
if ($frontendOk) {
    $openBrowser = Read-Host '  Open TradeOps AI in your browser now? [Y/n]'
    if ($openBrowser -ine 'n') {
        Start-Process $FRONTEND_URL
    }
}

Write-Host ''

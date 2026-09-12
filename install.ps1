# DJ Media Console - one-time setup for a new Windows computer.
#
# Paste this whole script into a PowerShell window on the new computer and
# press Enter. It will:
#   1. Check for Git and Node.js (and tell you where to get them if missing)
#   2. Clone (or update) the app from GitHub
#   3. Install dependencies (this downloads Electron - needs internet)
#   4. Create a "DJ Media Console" shortcut on the Desktop
#
# Your video files are NOT part of this - once it's installed, open the app
# and assign clips to keys from wherever your videos live on this computer.

$ErrorActionPreference = 'Stop'

$RepoUrl      = 'https://github.com/Evangrobbelaar/dj-media-console.git'
$InstallDir   = Join-Path $env:USERPROFILE 'dj-media-console'
$DesktopDir   = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopDir 'DJ Media Console.lnk'

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "    FAILED: $msg" -ForegroundColor Red }
function Test-CommandExists { param($name) [bool](Get-Command $name -ErrorAction SilentlyContinue) }

Write-Step "Checking for Git"
if (-not (Test-CommandExists git)) {
    Write-Fail "Git is not installed."
    Write-Host "    Install it from https://git-scm.com/download/win, then run this script again." -ForegroundColor Yellow
    exit 1
}
Write-Ok (git --version)

Write-Step "Checking for Node.js"
if (-not (Test-CommandExists node)) {
    Write-Fail "Node.js is not installed."
    Write-Host "    Install the LTS version from https://nodejs.org, then run this script again." -ForegroundColor Yellow
    exit 1
}
Write-Ok (node --version)

Write-Step "Getting the app"
if (Test-Path (Join-Path $InstallDir '.git')) {
    Write-Host "    Already cloned at $InstallDir - pulling latest changes..."
    Push-Location $InstallDir
    git pull --ff-only
    $gitExit = $LASTEXITCODE
    Pop-Location
    if ($gitExit -ne 0) {
        Write-Fail "git pull failed - see the error above."
        exit 1
    }
} else {
    Write-Host "    This is a private repo - a browser window may open asking you to sign in to GitHub." -ForegroundColor Yellow
    git clone $RepoUrl $InstallDir
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "git clone failed - see the error above."
        exit 1
    }
}
Write-Ok "App present at $InstallDir"

Write-Step "Installing dependencies (downloads Electron, roughly 150-250MB)"
Push-Location $InstallDir
npm install
$npmExit = $LASTEXITCODE
Pop-Location
if ($npmExit -ne 0) {
    Write-Fail "npm install failed - see the error above."
    exit 1
}
Write-Ok "Dependencies installed"

Write-Step "Verifying the Electron binary"
$ElectronExe = Join-Path $InstallDir 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $ElectronExe)) {
    Write-Fail "electron.exe not found at $ElectronExe"
    exit 1
}
Write-Ok "Found $ElectronExe"

Write-Step "Creating Desktop shortcut"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $ElectronExe
$Shortcut.Arguments = '.'
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.IconLocation = $ElectronExe
$Shortcut.Description = 'DJ Media Console'
$Shortcut.Save()
Write-Ok "Shortcut created: $ShortcutPath"

Write-Host "`nDone. Double-click 'DJ Media Console' on the Desktop to launch it." -ForegroundColor Green
Write-Host "First run: click key tiles to assign your video clips, then click Launch Output." -ForegroundColor Yellow

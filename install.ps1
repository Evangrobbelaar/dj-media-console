# DJ Media Console - one-time setup for a new Windows computer.
#
# Open PowerShell (NOT Command Prompt - "irm"/winget etc. only exist in
# PowerShell), paste this whole script in, and press Enter. It will:
#   1. Install Git and Node.js via winget if they're not already present
#      (winget ships built into Windows 10/11 - a UAC prompt may appear,
#      click Yes)
#   2. Clone (or update) the app from GitHub
#   3. Install dependencies (this downloads Electron - needs internet)
#   4. Create a "DJ Media Console" shortcut on the Desktop
#
# Your video files are NOT part of this - once it's installed, open the app
# and assign clips to keys from wherever your videos live on this computer.

$ErrorActionPreference = 'Stop'
# Process-scoped only: doesn't touch system policy, doesn't need admin, and
# means any .ps1 shim invoked below (e.g. npm.ps1) isn't blocked by the
# machine's default "Restricted" policy.
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$RepoUrl      = 'https://github.com/Evangrobbelaar/dj-media-console.git'
$InstallDir   = Join-Path $env:USERPROFILE 'dj-media-console'
$DesktopDir   = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopDir 'DJ Media Console.lnk'

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "    FAILED: $msg" -ForegroundColor Red }
function Test-CommandExists { param($name) [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Sync-PathFromRegistry {
    $machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath    = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"
}

function Ensure-Tool {
    param($CommandName, $WingetId, $FriendlyName, $ManualUrl)

    if (Test-CommandExists $CommandName) {
        Write-Ok (& $CommandName --version)
        return $true
    }

    Write-Host "    $FriendlyName not found." -ForegroundColor Yellow

    if (Test-CommandExists winget) {
        Write-Host "    Installing $FriendlyName via winget - a Windows security prompt may appear, click Yes..." -ForegroundColor Yellow
        winget install --id $WingetId -e --source winget --accept-package-agreements --accept-source-agreements
        Sync-PathFromRegistry
    } else {
        Write-Host "    winget is not available on this computer either." -ForegroundColor Yellow
    }

    if (Test-CommandExists $CommandName) {
        Write-Ok "$FriendlyName installed: $(& $CommandName --version)"
        return $true
    }

    Write-Fail "$FriendlyName still not available."
    Write-Host "    Install it manually from $ManualUrl, then close this window, open a NEW PowerShell window, and run this script again." -ForegroundColor Yellow
    return $false
}

Write-Step "Checking for Git"
if (-not (Ensure-Tool -CommandName 'git' -WingetId 'Git.Git' -FriendlyName 'Git' -ManualUrl 'https://git-scm.com/download/win')) {
    exit 1
}

Write-Step "Checking for Node.js"
if (-not (Ensure-Tool -CommandName 'node' -WingetId 'OpenJS.NodeJS.LTS' -FriendlyName 'Node.js' -ManualUrl 'https://nodejs.org')) {
    exit 1
}

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
    if ((Test-Path $InstallDir) -and -not (Test-Path (Join-Path $InstallDir '.git'))) {
        Write-Host "    $InstallDir exists but isn't a git repo (probably a failed earlier attempt) - removing it first."
        Remove-Item -Recurse -Force $InstallDir
    }
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
# Call npm.cmd explicitly, not "npm" - PowerShell resolves bare "npm" to
# npm.ps1, which is a script and subject to execution policy even after the
# Bypass above touches something unexpected. The .cmd shim is not.
& npm.cmd install
$npmExit = $LASTEXITCODE
Pop-Location
if ($npmExit -ne 0) {
    Write-Fail "npm install failed (exit code $npmExit) - see the error above."
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

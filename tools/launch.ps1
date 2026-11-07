# AstroDash Launcher: builds the game if needed, starts a local server if it
# isn't running, and opens the game in the system's default browser.
# The desktop shortcut "AstroDash Launcher" runs this script (see tools/make-shortcut.ps1).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = 4173
$url = "http://localhost:$port"

# Shortcuts start with a minimal environment: pick up the current PATH (node, npm).
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

function Fail([string]$message) {
  Add-Type -AssemblyName System.Windows.Forms
  [void][System.Windows.Forms.MessageBox]::Show($message, 'AstroDash Launcher', 'OK', 'Error')
  exit 1
}

function Test-Server {
  try { return (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { return $false }
}

Set-Location $root
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Fail 'Node.js was not found. Install it from https://nodejs.org and try again.' }

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) { Fail 'npm install failed.' }
}

# Rebuild when the game has never been built or the sources changed since the last build.
$built = Join-Path $root 'dist\index.html'
$stale = -not (Test-Path $built)
if (-not $stale) {
  $builtAt = (Get-Item $built).LastWriteTime
  $newer = Get-ChildItem -Path (Join-Path $root 'src'), (Join-Path $root 'index.html'), (Join-Path $root 'package.json') -Recurse -File |
    Where-Object { $_.LastWriteTime -gt $builtAt } | Select-Object -First 1
  $stale = $null -ne $newer
}
if ($stale) {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { Fail 'The build failed. Run "npm run build" in the project folder to see the errors.' }
}

# Start the server in a minimized window (close that window to stop the game server).
if (-not (Test-Server)) {
  Start-Process cmd.exe -ArgumentList '/c', "title AstroDash server && npm.cmd run preview -- --port $port --strictPort" -WorkingDirectory $root -WindowStyle Minimized
  $deadline = (Get-Date).AddSeconds(30)
  while (-not (Test-Server)) {
    if ((Get-Date) -gt $deadline) { Fail "The game server did not start on port $port. Is another program using that port?" }
    Start-Sleep -Milliseconds 300
  }
}

Start-Process $url   # opens in the system's default browser

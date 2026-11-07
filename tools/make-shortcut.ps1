# Creates the "AstroDash Launcher" shortcut (on the Desktop by default).
#   powershell -ExecutionPolicy Bypass -File tools/make-shortcut.ps1 [-Folder <path>]
param([string]$Folder = [Environment]::GetFolderPath('Desktop'))

$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot 'launch.ps1'
$lnk = Join-Path $Folder 'AstroDash Launcher.lnk'

$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut($lnk)
$s.TargetPath = (Get-Command powershell.exe).Source
$s.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$s.WorkingDirectory = $root
$s.WindowStyle = 7 # minimized
$s.Description = 'Launch AstroDash in your default browser'
$s.IconLocation = "$env:SystemRoot\System32\imageres.dll,109" # a rocket-ish "play" icon from Windows
$s.Save()
Write-Output "Created $lnk"

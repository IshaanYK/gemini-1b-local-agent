$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath   = Join-Path $scriptDir "START_AGENT.bat"
$icoPath   = Join-Path $scriptDir "gemini_agent.ico"
$lnkPath   = "$env:USERPROFILE\Desktop\Start Gemini Agent.lnk"

$WScriptShell = New-Object -ComObject WScript.Shell
$shortcut = $WScriptShell.CreateShortcut($lnkPath)
$shortcut.TargetPath       = "cmd.exe"
$shortcut.Arguments        = "/c `"$batPath`""
$shortcut.WorkingDirectory = $scriptDir
$shortcut.IconLocation     = "$icoPath, 0"
$shortcut.Description      = "Start Gemini Local Agent"
$shortcut.WindowStyle      = 1
$shortcut.Save()

Write-Host "Shortcut created at: $lnkPath" -ForegroundColor Green
Write-Host "Icon applied: $icoPath" -ForegroundColor Cyan

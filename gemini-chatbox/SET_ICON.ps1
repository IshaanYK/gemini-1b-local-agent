$batPath   = "$env:USERPROFILE\Desktop\START_AGENT.bat"
$icoPath   = "C:\Users\ISHAAN SEN\.gemini\antigravity-ide\scratch\gemini-chatbox\gemini_agent.ico"
$lnkPath   = "$env:USERPROFILE\Desktop\Start Gemini Agent.lnk"

$WScriptShell = New-Object -ComObject WScript.Shell
$shortcut = $WScriptShell.CreateShortcut($lnkPath)
$shortcut.TargetPath       = "cmd.exe"
$shortcut.Arguments        = "/c `"$batPath`""
$shortcut.WorkingDirectory = "C:\Users\ISHAAN SEN\.gemini\antigravity-ide\scratch\gemini-chatbox"
$shortcut.IconLocation     = "$icoPath, 0"
$shortcut.Description      = "Start Gemini Local Agent"
$shortcut.WindowStyle      = 1
$shortcut.Save()

Write-Host "Shortcut created at: $lnkPath" -ForegroundColor Green
Write-Host "Icon applied: $icoPath" -ForegroundColor Cyan

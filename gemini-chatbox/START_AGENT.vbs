' START_AGENT.vbs — Silent launcher for Gemini 1B Local Agent
' Runs proxy + backend completely hidden (no console windows), then opens browser.

Dim WshShell, FSO, ScriptDir, PROXY_DIR, CHATBOX_DIR, INDEX_HTML
Set WshShell = CreateObject("WScript.Shell")
Set FSO      = CreateObject("Scripting.FileSystemObject")

ScriptDir   = FSO.GetParentFolderName(WScript.ScriptFullName)
CHATBOX_DIR = ScriptDir
PROXY_DIR   = FSO.GetAbsolutePathName(ScriptDir & "\..\gemini-web2api")
INDEX_HTML  = CHATBOX_DIR & "\index.html"

' --- Helper: check if port is already listening ---
Function PortInUse(port)
    Dim oExec
    Set oExec = WshShell.Exec("cmd /c netstat -ano | findstr :" & port & " | findstr LISTENING")
    PortInUse = (InStr(oExec.StdOut.ReadAll(), "LISTENING") > 0)
End Function

' --- 1. Launch Web2API proxy on :8081 silently ---
If Not PortInUse(8081) Then
    WshShell.Run "cmd /c cd /d """ & PROXY_DIR & """ && python gemini_web2api.py > proxy.log 2>&1", 0, False
    WScript.Sleep 3000
End If

' --- 2. Launch Agent Backend on :5000 silently ---
If Not PortInUse(5000) Then
    WshShell.Run "cmd /c cd /d """ & CHATBOX_DIR & """ && python agent_backend.py > backend.log 2>&1", 0, False
    WScript.Sleep 2000
End If

' --- 3. Open UI in default browser ---
WshShell.Run "explorer """ & INDEX_HTML & """", 1, False

Set WshShell = Nothing
Set FSO      = Nothing

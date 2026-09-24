' START_AGENT.vbs — Silent launcher for Gemini 1B Local Agent
' Runs proxy + backend completely hidden (no console windows), then opens browser.

Dim WshShell, FSO, ScriptDir, PROXY_DIR, CHATBOX_DIR, INDEX_HTML, PYTHON_EXE
Set WshShell = CreateObject("WScript.Shell")
Set FSO      = CreateObject("Scripting.FileSystemObject")

ScriptDir   = FSO.GetParentFolderName(WScript.ScriptFullName)
CHATBOX_DIR = ScriptDir
PROXY_DIR   = FSO.GetAbsolutePathName(ScriptDir & "\..\gemini-web2api")
INDEX_HTML  = CHATBOX_DIR & "\index.html"

' --- Find Python Executable ---
Function FindPython()
    Dim localAppData, candidatePaths, p
    localAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
    
    candidatePaths = Array(_
        localAppData & "\Programs\Python\Python311\python.exe", _
        localAppData & "\Programs\Python\Python312\python.exe", _
        localAppData & "\Programs\Python\Python313\python.exe", _
        localAppData & "\Programs\Python\Python310\python.exe", _
        "C:\Program Files\Python311\python.exe", _
        "C:\Program Files\Python312\python.exe", _
        "C:\Python311\python.exe", _
        "C:\Python312\python.exe" _
    )
    
    For Each p In candidatePaths
        If FSO.FileExists(p) Then
            FindPython = p
            Exit Function
        End If
    Next
    FindPython = "python.exe"
End Function

PYTHON_EXE = FindPython()

' --- Helper: check if port is already listening ---
Function PortInUse(port)
    Dim oExec, outStr
    Set oExec = WshShell.Exec("cmd /c netstat -ano | findstr /C:"":" & port & " "" | findstr LISTENING")
    outStr = oExec.StdOut.ReadAll()
    PortInUse = (InStr(outStr, "LISTENING") > 0)
End Function

' --- 1. Launch Web2API proxy on :8081 silently ---
If Not PortInUse(8081) Then
    WshShell.Run "cmd /c ""cd /d """ & PROXY_DIR & """ && start /B """" """ & PYTHON_EXE & """ gemini_web2api.py > proxy.log 2>&1""", 0, False
    WScript.Sleep 2500
End If

' --- 2. Launch Agent Backend on :5000 silently ---
If Not PortInUse(5000) Then
    WshShell.Run "cmd /c ""cd /d """ & CHATBOX_DIR & """ && start /B """" """ & PYTHON_EXE & """ agent_backend.py > backend.log 2>&1""", 0, False
    WScript.Sleep 2000
End If

' --- 3. Open UI in default browser ---
WshShell.Run "cmd /c start http://127.0.0.1:5000", 0, False

Set WshShell = Nothing
Set FSO      = Nothing

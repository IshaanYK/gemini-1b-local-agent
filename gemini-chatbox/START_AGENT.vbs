' START_AGENT.vbs — Silent launcher for Gemini 1B Local Agent
' Runs proxy + backend completely hidden, then opens the browser.
' No CMD or Python windows will ever appear.

Dim WshShell
Set WshShell = CreateObject("WScript.Shell")

Dim PROXY_DIR  : PROXY_DIR  = "C:\Users\ISHAAN SEN\.gemini\antigravity-ide\scratch\gemini-web2api"
Dim CHATBOX_DIR: CHATBOX_DIR= "C:\Users\ISHAAN SEN\.gemini\antigravity-ide\scratch\gemini-chatbox"
Dim INDEX_HTML : INDEX_HTML = CHATBOX_DIR & "\index.html"

' --- Helper: check if a port is already in use ---
Function PortInUse(port)
    Dim oExec, sLine
    Set oExec = WshShell.Exec("cmd /c netstat -ano | findstr :" & port & " | findstr LISTENING")
    PortInUse = (InStr(oExec.StdOut.ReadAll(), "LISTENING") > 0)
End Function

' --- 1. Launch Web2API proxy on :8081 (hidden, no window) ---
If Not PortInUse(8081) Then
    WshShell.Run "cmd /c cd /d """ & PROXY_DIR & """ && pythonw gemini_web2api.py", 0, False
    WScript.Sleep 3000
End If

' --- 2. Launch Agent Backend on :5000 (hidden, no window) ---
If Not PortInUse(5000) Then
    WshShell.Run "cmd /c cd /d """ & CHATBOX_DIR & """ && pythonw agent_backend.py", 0, False
    WScript.Sleep 2000
End If

' --- 3. Open the UI in the default browser ---
WshShell.Run "explorer """ & INDEX_HTML & """", 1, False

Set WshShell = Nothing

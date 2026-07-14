' Launch Game - 匣中珠光
Option Explicit
Dim WshShell, FSO, scriptDir, port, found
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir
port = "8765"
found = False

' Try Python
If Not found Then
  If CheckCommand("python --version") Then
    WshShell.Run "cmd /c python -m http.server " & port & " --bind 127.0.0.1", 0, False
    found = True
  End If
End If

' Try py (Windows Python Launcher)
If Not found Then
  If CheckCommand("py --version") Then
    WshShell.Run "cmd /c py -m http.server " & port & " --bind 127.0.0.1", 0, False
    found = True
  End If
End If

' Try Node.js
If Not found Then
  If CheckCommand("npx --version") Then
    WshShell.Run "cmd /c npx http-server -p " & port & " -a 127.0.0.1 -c-1", 0, False
    found = True
  End If
End If

If Not found Then
  MsgBox "Failed to start server!" & vbCrLf & vbCrLf & _
    "Please install Python or Node.js:" & vbCrLf & _
    "  - Python: https://www.python.org/downloads/" & vbCrLf & _
    "  - Node.js: https://nodejs.org/" & vbCrLf & vbCrLf & _
    "Or: Double-click index.html to play in 2D mode", _
    48, "Launch Failed"
  WScript.Quit 1
End If

' Wait for server
WScript.Sleep 2000

' Open browser
On Error Resume Next
Dim browserPath
browserPath = ""
Err.Clear
browserPath = WshShell.RegRead("HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
If Err.Number <> 0 Or browserPath = "" Then
  Err.Clear
  browserPath = WshShell.RegRead("HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
End If
If Err.Number <> 0 Or browserPath = "" Then
  Err.Clear
  browserPath = WshShell.RegRead("HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe\")
End If
Err.Clear
On Error GoTo 0

If browserPath <> "" Then
  WshShell.Run """" & browserPath & """ http://127.0.0.1:" & port & "/index.html", 1, False
Else
  WshShell.Run "rundll32 url.dll,FileProtocolHandler http://127.0.0.1:" & port & "/index.html", 1, False
End If

Function CheckCommand(cmd)
  Dim objExec, output
  On Error Resume Next
  Set objExec = WshShell.Exec(cmd)
  If Err.Number <> 0 Then
    CheckCommand = False
    Exit Function
  End If
  output = objExec.StdOut.ReadAll & objExec.StdErr.ReadAll
  If Err.Number <> 0 Then
    CheckCommand = False
  Else
    CheckCommand = (Len(output) > 0)
  End If
  Err.Clear
  On Error GoTo 0
End Function

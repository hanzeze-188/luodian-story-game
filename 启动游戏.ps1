# 启动游戏.ps1 - 双击启动本地服务器并打开浏览器
# 用法：右键 -> 使用PowerShell运行  或  双击
$ErrorActionPreference = "SilentlyContinue"

# 获取脚本所在目录
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$port = 8765
$started = $false

# 先杀掉占用端口的旧进程
try {
    $procs = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($procs) {
        Stop-Process -Id $procs -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
} catch {}

# 尝试 Python
if (-not $started) {
    $py = Get-Command python -ErrorAction SilentlyContinue
    if ($py) {
        Start-Process python -ArgumentList "-m","http.server",$port,"--bind","127.0.0.1" -WindowStyle Hidden
        Start-Sleep -Seconds 3
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/index.html" -UseBasicParsing -TimeoutSec 2 -Method Head
            if ($r.StatusCode -eq 200) { $started = $true }
        } catch {}
    }
}

# 尝试 Python3
if (-not $started) {
    $py3 = Get-Command python3 -ErrorAction SilentlyContinue
    if ($py3) {
        Start-Process python3 -ArgumentList "-m","http.server",$port,"--bind","127.0.0.1" -WindowStyle Hidden
        Start-Sleep -Seconds 3
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/index.html" -UseBasicParsing -TimeoutSec 2 -Method Head
            if ($r.StatusCode -eq 200) { $started = $true }
        } catch {}
    }
}

# 尝试 Node.js
if (-not $started) {
    $npx = Get-Command npx -ErrorAction SilentlyContinue
    if ($npx) {
        Start-Process npx -ArgumentList "http-server","-p",$port,"-a","127.0.0.1" -WindowStyle Hidden
        Start-Sleep -Seconds 5
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/index.html" -UseBasicParsing -TimeoutSec 2 -Method Head
            if ($r.StatusCode -eq 200) { $started = $true }
        } catch {}
    }
}

if (-not $started) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "未能启动本地服务器！`n`n请先安装 Python 或 Node.js：`nPython: https://www.python.org/downloads/`nNode.js: https://nodejs.org/`n`n安装后重新运行此脚本即可。",
        "启动失败 - 缺少运行环境",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Exclamation
    ) | Out-Null
    exit 1
}

# 打开浏览器
Start-Process "http://127.0.0.1:$port/index.html"

param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectDir
)

$ErrorActionPreference = 'SilentlyContinue'

$bridgeDir = Join-Path $ProjectDir 'runtime\installer-bridge'
$napcatRequestFile = Join-Path $bridgeDir 'launch-napcat.req'
$napcatAckFile = Join-Path $bridgeDir 'launch-napcat.ack'
$prismRequestFile = Join-Path $bridgeDir 'launch-prism.req'
$prismAckFile = Join-Path $bridgeDir 'launch-prism.ack'
$stopFile = Join-Path $bridgeDir 'stop.req'
$napcatStart = Join-Path $ProjectDir 'napcat-start.bat'
$prismStart = Join-Path $ProjectDir 'start.bat'

New-Item -ItemType Directory -Force -Path $bridgeDir | Out-Null
Remove-Item $napcatRequestFile, $napcatAckFile, $prismRequestFile, $prismAckFile, $stopFile -Force -ErrorAction SilentlyContinue

while ($true) {
    if (Test-Path $stopFile) {
        Remove-Item $napcatRequestFile, $napcatAckFile, $prismRequestFile, $prismAckFile, $stopFile -Force -ErrorAction SilentlyContinue
        break
    }

    if (Test-Path $napcatRequestFile) {
        Remove-Item $napcatAckFile -Force -ErrorAction SilentlyContinue

        if (Test-Path $napcatStart) {
            Start-Process -FilePath $napcatStart -WorkingDirectory $ProjectDir | Out-Null
            Set-Content -Path $napcatAckFile -Value ([DateTime]::Now.ToString('o')) -Encoding UTF8
        }

        Remove-Item $napcatRequestFile -Force -ErrorAction SilentlyContinue
    }

    if (Test-Path $prismRequestFile) {
        Remove-Item $prismAckFile -Force -ErrorAction SilentlyContinue

        if (Test-Path $prismStart) {
            Start-Process -FilePath $prismStart -WorkingDirectory $ProjectDir | Out-Null
            Set-Content -Path $prismAckFile -Value ([DateTime]::Now.ToString('o')) -Encoding UTF8
        }

        Remove-Item $prismRequestFile -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Milliseconds 300
}

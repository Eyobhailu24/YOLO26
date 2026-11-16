param([int]$Port = 8000, [switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) {
    throw 'Create the Python environment first. See README.md.'
}
& $taskPython -c 'import fastapi, uvicorn, cloudinary, dotenv'
if ($LASTEXITCODE -ne 0) {
    throw 'Install the dashboard dependencies: .\.venv\Scripts\python.exe -m pip install -r requirements-web.txt'
}
if (-not $SkipBuild) {
    Push-Location -LiteralPath (Join-Path $PSScriptRoot 'frontend')
    try {
        if (-not (Test-Path -LiteralPath 'node_modules')) {
            & npm.cmd ci --include=dev
            if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        }
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath 'frontend/dist/index.html')) { throw 'Build the frontend before using -SkipBuild.' }
Write-Host "YOLO26 Studio: http://127.0.0.1:$Port"
Write-Host 'Keep this terminal open. Press Ctrl+C to stop.'
& $taskPython -m uvicorn backend.app:app --host 127.0.0.1 --port $Port
exit $LASTEXITCODE

# run-backend.ps1 — arranca el bot + la API (Windows PowerShell)
# Uso:  .\run-backend.ps1
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\backend"

if (-not (Test-Path ".\.venv")) {
    Write-Host "Creando entorno virtual..." -ForegroundColor Cyan
    python -m venv .venv
    .\.venv\Scripts\python -m pip install --upgrade pip
    .\.venv\Scripts\pip install -r requirements.txt
}

if (-not (Test-Path ".\.env")) {
    Write-Host "No existe backend\.env — cópialo de .env.example y rellénalo." -ForegroundColor Red
    exit 1
}

Write-Host "Arrancando bot + API..." -ForegroundColor Green
.\.venv\Scripts\python main.py

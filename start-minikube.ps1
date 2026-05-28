#Requires -Version 5.1
<#
.SYNOPSIS
    Sobe o ambiente completo do TemperaturaVS2 no Minikube.
.DESCRIPTION
    Equivalente ao "docker-compose up --build" para o Kubernetes local.
    Verifica pré-requisitos, inicia Minikube, faz build das imagens e faz deploy de tudo.
.PARAMETER SkipBuild
    Pula o build das imagens Docker (usa as imagens já existentes no Minikube).
.PARAMETER SkipDeploy
    Pula o kubectl apply (só faz o build das imagens).
.PARAMETER Rebuild
    Força rebuild de todas as imagens mesmo que já existam (--no-cache).
.EXAMPLE
    .\start-minikube.ps1
    .\start-minikube.ps1 -SkipBuild
    .\start-minikube.ps1 -Rebuild
#>
param(
    [switch]$SkipBuild,
    [switch]$SkipDeploy,
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

# ─── Helpers ──────────────────────────────────────────────────────────────────

function Write-Step  { param($n, $msg) Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg)     Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn  { param($msg)     Write-Host "    AVISO  $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg)     Write-Host "    ERRO  $msg" -ForegroundColor Red; exit 1 }

function Test-Command {
    param($cmd)
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ─── Banner ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ████████╗███████╗███╗   ███╗██████╗ " -ForegroundColor Blue
Write-Host "  ╚══██╔══╝██╔════╝████╗ ████║██╔══██╗" -ForegroundColor Blue
Write-Host "     ██║   █████╗  ██╔████╔██║██████╔╝" -ForegroundColor Blue
Write-Host "     ██║   ██╔══╝  ██║╚██╔╝██║██╔═══╝ " -ForegroundColor Blue
Write-Host "     ██║   ███████╗██║ ╚═╝ ██║██║     " -ForegroundColor Blue
Write-Host "     ╚═╝   ╚══════╝╚═╝     ╚═╝╚═╝     " -ForegroundColor Blue
Write-Host ""
Write-Host "  TemperaturaVS2 — Minikube Startup" -ForegroundColor White
Write-Host "  $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" -ForegroundColor DarkGray
Write-Host ""

# ─── PASSO 1: Pré-requisitos ──────────────────────────────────────────────────

Write-Step "1/7" "Verificando pré-requisitos..."

if (-not (Test-Command "docker")) { Write-Fail "Docker não encontrado. Instale o Docker Desktop." }
Write-Ok "Docker $(docker --version --format '{{.Version}}' 2>&1)"

if (-not (Test-Command "minikube")) { Write-Fail "Minikube não encontrado. Execute: winget install Kubernetes.minikube" }
Write-Ok "Minikube $(minikube version --short 2>&1)"

if (-not (Test-Command "kubectl")) { Write-Fail "kubectl não encontrado. Execute: winget install Kubernetes.kubectl" }
Write-Ok "kubectl $(kubectl version --client --short 2>&1)"

# ─── PASSO 2: Docker Desktop ──────────────────────────────────────────────────

Write-Step "2/7" "Verificando Docker Desktop..."

$dockerRunning = $false
try {
    docker ps > $null 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerRunning = $true }
} catch {}

if (-not $dockerRunning) {
    Write-Warn "Docker Desktop não está rodando. Iniciando..."
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue

    Write-Host "    Aguardando Docker Desktop iniciar" -NoNewline
    $timeout = 60
    while ($timeout -gt 0) {
        Start-Sleep -Seconds 3
        $timeout -= 3
        Write-Host "." -NoNewline
        try {
            docker ps > $null 2>&1
            if ($LASTEXITCODE -eq 0) { break }
        } catch {}
    }
    Write-Host ""

    docker ps > $null 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Fail "Docker Desktop não iniciou. Abra manualmente e tente novamente." }
}
Write-Ok "Docker Desktop rodando"

# ─── PASSO 3: Minikube ────────────────────────────────────────────────────────

Write-Step "3/7" "Iniciando Minikube..."

$mkStatus = minikube status --format "{{.Host}}" 2>&1
if ($mkStatus -match "Running") {
    Write-Ok "Minikube já está rodando"
} else {
    Write-Host "    Iniciando cluster (pode levar ~2 minutos)..." -ForegroundColor DarkGray
    minikube start --memory=4096 --cpus=4 --driver=docker 2>&1 | ForEach-Object {
        if ($_ -match "Done|kubectl|Enabled|Starting|Pulling|Preparing") {
            Write-Host "    $_" -ForegroundColor DarkGray
        }
    }
    if ($LASTEXITCODE -ne 0) { Write-Fail "Minikube não iniciou. Verifique os logs acima." }
    Write-Ok "Cluster criado"
}

# Habilitar addons
$addons = minikube addons list --output json 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
$ingressEnabled = ($addons | Where-Object { $_.Name -eq "ingress" } | Select-Object -ExpandProperty Status) -eq "enabled"
if (-not $ingressEnabled) {
    Write-Host "    Habilitando addon ingress..." -ForegroundColor DarkGray
    minikube addons enable ingress 2>&1 | Out-Null
    Write-Ok "Addon ingress habilitado"
} else {
    Write-Ok "Addon ingress já habilitado"
}

minikube addons enable metrics-server 2>&1 | Out-Null
Write-Ok "Addon metrics-server habilitado"

# ─── PASSO 4: Contexto Docker → Minikube ──────────────────────────────────────

Write-Step "4/7" "Configurando contexto Docker para o Minikube..."

& minikube -p minikube docker-env --shell powershell | Invoke-Expression
Write-Ok "Docker apontando para: $(docker info --format '{{.Name}}' 2>&1)"

# ─── PASSO 5: Build das imagens ───────────────────────────────────────────────

if (-not $SkipBuild) {
    Write-Step "5/7" "Build das imagens Docker..."

    $buildArgs = if ($Rebuild) { "--no-cache" } else { "" }

    $services = @(
        @{ Name = "api-weather";  Tag = "api-weather:local";  Path = "api-weather" },
        @{ Name = "api-location"; Tag = "api-location:local"; Path = "api-location" },
        @{ Name = "api-person";   Tag = "api-person:local";   Path = "api-person" },
        @{ Name = "frontend";     Tag = "frontend:local";     Path = "frontend" }
    )

    foreach ($svc in $services) {
        Write-Host "    Building $($svc.Tag)..." -NoNewline

        $buildCmd = "docker build -t $($svc.Tag) $(Join-Path $ROOT $svc.Path)"
        if ($Rebuild) { $buildCmd += " --no-cache" }

        $output = Invoke-Expression "$buildCmd 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Write-Host " FALHOU" -ForegroundColor Red
            Write-Host ($output | Select-Object -Last 10 | Out-String) -ForegroundColor Red
            Write-Fail "Build de $($svc.Tag) falhou."
        }
        Write-Host " OK" -ForegroundColor Green
    }
} else {
    Write-Step "5/7" "Build pulado (--SkipBuild)"
}

# ─── PASSO 6: Deploy no Kubernetes ────────────────────────────────────────────

if (-not $SkipDeploy) {
    Write-Step "6/7" "Aplicando manifests Kubernetes..."

    Set-Location $ROOT

    # Namespace
    kubectl apply -f k8s/namespace.yaml 2>&1 | Out-Null
    Write-Ok "Namespace temperaturaapp"

    # Infra
    kubectl apply -f k8s/configmaps/ 2>&1 | Out-Null
    Write-Ok "ConfigMaps (prometheus, otel-collector, grafana)"

    kubectl apply -f k8s/volumes/ 2>&1 | Out-Null
    Write-Ok "PersistentVolumeClaims (MongoDB, SQLite x3)"

    # Secret da API key
    if (Test-Path "k8s/secrets/api-keys.yaml") {
        kubectl apply -f k8s/secrets/api-keys.yaml 2>&1 | Out-Null
        Write-Ok "Secret api-keys"
    } else {
        Write-Warn "k8s/secrets/api-keys.yaml não encontrado — api-weather pode falhar sem a OPENWEATHER_API_KEY"
    }

    # Deployments e Services
    kubectl apply -f k8s/deployments/ 2>&1 | Out-Null
    Write-Ok "Deployments (10 serviços)"

    kubectl apply -f k8s/services/ 2>&1 | Out-Null
    Write-Ok "Services"

    kubectl apply -f k8s/ingress/ 2>&1 | Out-Null
    Write-Ok "Ingress"

} else {
    Write-Step "6/7" "Deploy pulado (--SkipDeploy)"
}

# ─── PASSO 7: Aguardar pods e exibir URLs ─────────────────────────────────────

Write-Step "7/7" "Aguardando pods ficarem prontos..."

Write-Host "    (pode levar até 2 minutos para MongoDB e RabbitMQ inicializarem)" -ForegroundColor DarkGray

# Aguarda em loop mostrando o progresso
$maxWait  = 180
$interval = 10
$elapsed  = 0

while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds $interval
    $elapsed += $interval

    $pods    = kubectl get pods -n temperaturaapp --no-headers 2>&1
    $total   = ($pods | Measure-Object -Line).Lines
    $running = ($pods | Where-Object { $_ -match "1/1\s+Running" } | Measure-Object -Line).Lines
    $failed  = ($pods | Where-Object { $_ -match "Error|CrashLoop|OOMKilled" } | Measure-Object -Line).Lines

    Write-Host "    $elapsed`s  —  $running/$total prontos" -ForegroundColor DarkGray

    if ($failed -gt 0) {
        Write-Host ""
        Write-Warn "Pods com erro detectados:"
        $pods | Where-Object { $_ -match "Error|CrashLoop|OOMKilled" } | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        Write-Host "    Para diagnosticar: kubectl describe pod -l app=<nome> -n temperaturaapp" -ForegroundColor Yellow
    }

    if ($running -ge $total -and $total -gt 0) { break }
}

# Status final
Write-Host ""
Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray
$pods = kubectl get pods -n temperaturaapp --no-headers 2>&1
$pods | ForEach-Object {
    $color = if ($_ -match "1/1\s+Running") { "Green" } elseif ($_ -match "0/1\s+Running") { "Yellow" } else { "Red" }
    Write-Host "  $_" -ForegroundColor $color
}
Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray

# URLs — no Windows com driver Docker o IP interno não é acessível diretamente.
# Usamos port-forward para expor cada serviço no localhost.
Write-Host ""
Write-Host "  Cluster no ar!" -ForegroundColor Green
Write-Host ""
Write-Host "  No Windows com driver Docker, use port-forward para acessar os servicos." -ForegroundColor Yellow
Write-Host "  Abra um terminal separado e execute:" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  # Frontend      -> http://localhost:8080" -ForegroundColor DarkGray
Write-Host "  kubectl port-forward svc/frontend    8080:80   -n temperaturaapp" -ForegroundColor White
Write-Host ""
Write-Host "  # Grafana        -> http://localhost:3000  (admin / admin123)" -ForegroundColor DarkGray
Write-Host "  kubectl port-forward svc/grafana     3000:3000 -n temperaturaapp" -ForegroundColor White
Write-Host ""
Write-Host "  # Prometheus     -> http://localhost:9090" -ForegroundColor DarkGray
Write-Host "  kubectl port-forward svc/prometheus  9090:9090 -n temperaturaapp" -ForegroundColor White
Write-Host ""
Write-Host "  # RabbitMQ UI    -> http://localhost:15672  (guest / guest)" -ForegroundColor DarkGray
Write-Host "  kubectl port-forward svc/rabbitmq   15672:15672 -n temperaturaapp" -ForegroundColor White
Write-Host ""
Write-Host "  Ou abra direto no browser (abre tunnel automatico):" -ForegroundColor DarkGray
Write-Host "    minikube service frontend   -n temperaturaapp" -ForegroundColor White
Write-Host "    minikube service grafana    -n temperaturaapp" -ForegroundColor White
Write-Host "    minikube service prometheus -n temperaturaapp" -ForegroundColor White
Write-Host ""
Write-Host "  Para parar o cluster:" -ForegroundColor DarkGray
Write-Host "    .\stop-minikube.ps1" -ForegroundColor DarkGray
Write-Host ""

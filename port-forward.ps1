#Requires -Version 5.1
<#
.SYNOPSIS
    Abre port-forwards dos servicos do TemperaturaVS2.
.DESCRIPTION
    Sem parametros: abre todos os servicos em janelas PowerShell separadas.
    Com -Service: abre apenas o servico especificado na janela atual.
.PARAMETER Service
    Nome do servico a abrir. Valores: frontend, grafana, prometheus, rabbitmq,
    api-weather, api-location, api-person, all (padrao).
.PARAMETER NoWindow
    Roda todos os port-forwards em background sem abrir novas janelas
    (util em ambientes sem interface grafica).
.EXAMPLE
    .\port-forward.ps1                      # abre todos em janelas separadas
    .\port-forward.ps1 -Service grafana     # so o Grafana nesta janela
    .\port-forward.ps1 -Service all         # todos em janelas separadas
    .\port-forward.ps1 -NoWindow            # todos em background
#>
param(
    [ValidateSet("all","frontend","grafana","prometheus","rabbitmq","api-weather","api-location","api-person")]
    [string]$Service = "all",

    [switch]$NoWindow
)

$NS = "temperaturaapp"

# Tabela de servicos: nome -> local:remoto, url, descricao
$SERVICES = [ordered]@{
    "frontend"     = @{ Ports = "8080:80";      Url = "http://localhost:8080";  Desc = "Frontend React" }
    "grafana"      = @{ Ports = "3000:3000";    Url = "http://localhost:3000";  Desc = "Grafana  (admin / admin123)" }
    "prometheus"   = @{ Ports = "9090:9090";    Url = "http://localhost:9090";  Desc = "Prometheus" }
    "rabbitmq"     = @{ Ports = "15672:15672";  Url = "http://localhost:15672"; Desc = "RabbitMQ UI  (guest / guest)" }
    "api-weather"  = @{ Ports = "3001:3001";    Url = "http://localhost:3001";  Desc = "api-weather  /weather?city=SaoPaulo" }
    "api-location" = @{ Ports = "3002:3002";    Url = "http://localhost:3002";  Desc = "api-location  /location" }
    "api-person"   = @{ Ports = "3003:3003";    Url = "http://localhost:3003";  Desc = "api-person  POST /person" }
}

# --- Modo: servico unico na janela atual ----------------------------------------

if ($Service -ne "all") {
    $svc = $SERVICES[$Service]
    Write-Host ""
    Write-Host "  Port-forward: $Service" -ForegroundColor Cyan
    Write-Host "  $($svc.Url)  -  $($svc.Desc)" -ForegroundColor White
    Write-Host "  (pressione Ctrl+C para encerrar)" -ForegroundColor DarkGray
    Write-Host ""
    kubectl port-forward "svc/$Service" $svc.Ports -n $NS
    exit
}

# --- Modo: todos os servicos ----------------------------------------------------

$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

# Verifica se o cluster esta rodando
$clusterOk = $false
try {
    kubectl get ns $NS --no-headers 2>&1 | Out-Null
    $clusterOk = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $clusterOk) {
    Write-Host ""
    Write-Host "  ERRO: namespace '$NS' nao encontrado." -ForegroundColor Red
    Write-Host "  Suba o cluster primeiro: .\start-minikube.ps1" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "  TemperaturaVS2 - Port Forwards" -ForegroundColor Cyan
Write-Host ""

if ($NoWindow) {
    # -- Background jobs (sem janelas novas) -------------------------------------
    $jobs = @()
    foreach ($name in $SERVICES.Keys) {
        $svc = $SERVICES[$name]

        $job = Start-Job -ScriptBlock {
            param($n, $p, $ns)
            kubectl port-forward "svc/$n" $p -n $ns 2>&1
        } -ArgumentList $name, $svc.Ports, $NS

        $jobs += $job
        Write-Host "  [bg] $($svc.Url)  <->  svc/$name" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "  Todos os port-forwards ativos em background." -ForegroundColor White
    Write-Host "  Para encerrar: Get-Job | Stop-Job; Get-Job | Remove-Job" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Ou pressione qualquer tecla para encerrar todos agora..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    $jobs | Stop-Job
    $jobs | Remove-Job
    Write-Host "  Port-forwards encerrados." -ForegroundColor Yellow

} else {
    # -- Abre uma janela PowerShell por servico ----------------------------------
    foreach ($name in $SERVICES.Keys) {
        $svc = $SERVICES[$name]

        $title = "pf :: $name :: $($svc.Url)"
        $cmd   = "kubectl port-forward svc/$name $($svc.Ports) -n $NS"

        $psCmd = @"
`$Host.UI.RawUI.WindowTitle = '$title'
Write-Host ''
Write-Host '  $($svc.Desc)' -ForegroundColor Cyan
Write-Host '  $($svc.Url)' -ForegroundColor White
Write-Host '  (pressione Ctrl+C para encerrar)' -ForegroundColor DarkGray
Write-Host ''
$cmd
Write-Host ''
Write-Host '  Conexao encerrada. Pode fechar esta janela.' -ForegroundColor Yellow
pause
"@
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $psCmd -WindowStyle Normal
        Start-Sleep -Milliseconds 300
        Write-Host "  Aberta  $($svc.Url)  ($name)" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "  $($SERVICES.Count) janelas abertas." -ForegroundColor White
    Write-Host ""
    Write-Host "  URLs:" -ForegroundColor DarkGray
    foreach ($name in $SERVICES.Keys) {
        $svc = $SERVICES[$name]
        Write-Host "    $($svc.Url.PadRight(28)) $($svc.Desc)" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "  Para fechar tudo de uma vez:" -ForegroundColor DarkGray
    Write-Host "    Get-Process powershell | Where-Object MainWindowTitle -like 'pf :: *' | Stop-Process" -ForegroundColor DarkGray
    Write-Host ""
}

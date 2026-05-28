#Requires -Version 5.1
<#
.SYNOPSIS
    Para o ambiente do TemperaturaVS2 no Minikube.
.PARAMETER Hard
    Deleta o cluster Minikube completamente (equivalente a "docker-compose down -v").
.PARAMETER Namespace
    Remove apenas o namespace temperaturaapp, mantendo o Minikube rodando.
.EXAMPLE
    .\stop-minikube.ps1              # Para o Minikube (mantém os dados)
    .\stop-minikube.ps1 -Namespace   # Remove só o namespace (Minikube continua)
    .\stop-minikube.ps1 -Hard        # Deleta o cluster inteiro
#>
param(
    [switch]$Hard,
    [switch]$Namespace
)

$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

Write-Host ""
Write-Host "  TemperaturaVS2 — Minikube Stop" -ForegroundColor White
Write-Host ""

if ($Hard) {
    $confirm = Read-Host "  ATENCAO: isso vai deletar o cluster inteiro e todos os dados. Confirmar? (s/N)"
    if ($confirm -ne "s") { Write-Host "  Cancelado." -ForegroundColor Yellow; exit 0 }
    Write-Host "  Deletando cluster Minikube..." -ForegroundColor Red
    minikube delete 2>&1
    Write-Host "  Cluster deletado. Use .\start-minikube.ps1 para recriar." -ForegroundColor Green

} elseif ($Namespace) {
    Write-Host "  Removendo namespace temperaturaapp..." -ForegroundColor Yellow
    kubectl delete namespace temperaturaapp 2>&1
    Write-Host "  Namespace removido. Minikube continua rodando." -ForegroundColor Green
    Write-Host "  Use .\start-minikube.ps1 -SkipBuild para redeployar." -ForegroundColor DarkGray

} else {
    Write-Host "  Parando Minikube (dados preservados)..." -ForegroundColor Yellow
    minikube stop 2>&1
    Write-Host "  Minikube parado. Use .\start-minikube.ps1 para retomar." -ForegroundColor Green
}

Write-Host ""

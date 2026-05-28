# Como subir o TemperaturaVS2 com Minikube

Guia de estudo completo: do Docker Desktop até os serviços rodando no Kubernetes local.

---

## O que é o Minikube?

O **Minikube** cria um cluster Kubernetes completo dentro de um único container Docker (ou VM). É a forma mais simples de aprender e testar Kubernetes localmente, sem precisar de infra em nuvem.

```
Você (browser)
      │
      ▼
Docker Desktop              ← executa no Windows
      │
      └─▶ container "minikube"    ← é o "nó" do cluster
                │
                ├─▶ pod/api-weather
                ├─▶ pod/api-location
                ├─▶ pod/api-person
                ├─▶ pod/frontend
                ├─▶ pod/mongodb
                ├─▶ pod/redis
                ├─▶ pod/rabbitmq
                ├─▶ pod/prometheus
                ├─▶ pod/grafana
                └─▶ pod/otel-collector
```

---

## Pré-requisitos

Antes de rodar qualquer comando, verifique que tem instalado:

```powershell
docker   --version   # Docker Desktop 24+
minikube version     # Minikube 1.32+
kubectl  version --client  # kubectl 1.28+
```

Se faltar algum:

```powershell
# Instalar via winget
winget install Kubernetes.minikube
winget install Kubernetes.kubectl

# Docker Desktop: baixar em https://www.docker.com/products/docker-desktop/
```

---

## Por que o Docker Desktop precisa estar aberto?

O Minikube usa o Docker Desktop como **driver** — ou seja, o cluster inteiro roda dentro de um container Docker. Se o Docker Desktop estiver fechado, o Minikube não consegue criar nem iniciar o container do cluster.

**Sequência de dependências:**

```
Windows
  └─▶ Docker Desktop (daemon rodando)
            └─▶ container "minikube" (o cluster)
                      └─▶ pods (api-weather, mongodb, etc.)
```

> **Dica:** O Docker Desktop inicia automaticamente com o Windows se você habilitar nas configurações (⚙ Settings → General → "Start Docker Desktop when you sign in").

---

## Subindo tudo com um comando

```powershell
# Na raiz do projeto
.\start-minikube.ps1
```

O script faz tudo automaticamente:

| Passo | O que faz |
|---|---|
| 1 | Verifica se Docker, Minikube e kubectl estão instalados |
| 2 | Verifica se o Docker Desktop está rodando (e tenta iniciá-lo) |
| 3 | Inicia o cluster Minikube (`minikube start`) |
| 4 | Habilita os addons `ingress` e `metrics-server` |
| 5 | Aponta o Docker para o daemon **dentro do Minikube** |
| 6 | Faz `docker build` das 4 imagens (api-weather, api-location, api-person, frontend) |
| 7 | Aplica todos os manifests Kubernetes (`kubectl apply`) em ordem |
| 8 | Aguarda os pods ficarem prontos e exibe os comandos de acesso |

### Opções do script

```powershell
.\start-minikube.ps1              # fluxo completo
.\start-minikube.ps1 -SkipBuild   # pula o docker build (usa imagens já existentes)
.\start-minikube.ps1 -Rebuild     # força rebuild do zero (--no-cache)
.\start-minikube.ps1 -SkipDeploy  # só builda, não aplica no cluster
```

---

## Por que usar `kubectl port-forward` e não o IP direto?

Quando o Minikube roda com **driver Docker no Windows**, o cluster fica dentro de um container Docker. O IP retornado por `minikube ip` (ex: `192.168.49.2`) é um IP da **rede interna do Docker** — não é acessível diretamente pelo browser do Windows.

```
Windows (browser)
      │
      │  ✗ NÃO alcança 192.168.49.2 diretamente
      │
Docker network (172.17.0.0/16)
      └─▶ container minikube (192.168.49.2)
                └─▶ pods
```

O `kubectl port-forward` cria um **túnel** entre o seu `localhost` e o pod/service dentro do cluster:

```
Windows (browser)
      │
      │  localhost:3000
      ▼
kubectl port-forward ──────────────▶ svc/grafana:3000 (dentro do cluster)
```

---

## Acessando os serviços

### O que faz cada serviço de observabilidade?

---

#### Prometheus

**O que é:** banco de dados de séries temporais especializado em métricas. Ele periodicamente faz uma requisição HTTP GET em `/metrics` de cada serviço (scraping) e armazena os valores com timestamp.

**No projeto:** coleta métricas das três APIs a cada 15 segundos — total de requisições, latência, hits/misses do cache Redis, mensagens publicadas no RabbitMQ.

```
api-weather:3001/metrics  ──┐
api-location:3002/metrics ──┼──▶ Prometheus (armazena) ──▶ Grafana (visualiza)
api-person:3003/metrics   ──┘
```

**Quando acessar:** quando quiser fazer queries manuais em PromQL, ver se os targets estão UP/DOWN, ou verificar se as métricas estão chegando antes de configurar um dashboard.

**URL:** http://localhost:9090  
**Seção mais útil para estudar:** Status → Targets (mostra se cada API está sendo coletada)

---

#### Grafana

**O que é:** ferramenta de visualização de métricas e logs. Conecta no Prometheus como fonte de dados e renderiza os valores em painéis com gráficos, tabelas e alertas.

**No projeto:** já vem com um dashboard pré-configurado ("TemperaturaVS2 Overview") provisionado via ConfigMap — não precisa configurar nada na mão.

```
Prometheus (dados brutos)
      │
      ▼
Grafana (dashboard visual)
  ├── Total de requisições por serviço (gráfico de barras)
  ├── Latência P95 ao longo do tempo (linha)
  ├── Cache hit rate do Redis (gauge)
  └── Mensagens RabbitMQ por routing key (linha)
```

**Quando acessar:** para monitorar o comportamento das APIs enquanto usa o frontend — é a visão operacional do sistema.

**URL:** http://localhost:3000  
**Credenciais:** `admin` / `admin123`  
**Dashboard:** Dashboards → TemperaturaVS2 → Overview

---

#### RabbitMQ Management UI

**O que é:** painel web do próprio RabbitMQ que mostra o estado interno do broker de mensagens em tempo real.

**No projeto:** toda vez que você consulta clima, localização ou pessoa, a API publica um evento numa fila. O painel mostra quantas mensagens já passaram, quantas estão na fila aguardando consumo e o throughput em tempo real.

```
api-weather  ──▶ exchange "climate-events"  ──▶ audit-queue
api-location ──▶ exchange "location-events" ──▶ audit-queue
api-person   ──▶ exchange "person-events"   ──▶ audit-queue
                                             └──▶ analytics-queue
```

**Quando acessar:** para verificar se os eventos estão sendo publicados, ver o conteúdo das mensagens nas filas, e entender o fluxo event-driven na prática.

**URL:** http://localhost:15672  
**Credenciais:** `guest` / `guest`  
**Seções mais úteis:** Queues (ver mensagens acumuladas), Exchanges (ver o roteamento), Overview (throughput em tempo real)

---

#### OpenTelemetry Collector

**O que é:** intermediário que recebe traces distribuídos das APIs (via protocolo OTLP) e os repassa para ferramentas de análise. Um trace representa o caminho completo de uma requisição — da entrada na API até o retorno, incluindo cada chamada ao Redis, MongoDB e RabbitMQ.

**No projeto:** recebe spans das três APIs e os exporta para o Prometheus (métricas) e para logs. Se Jaeger fosse adicionado, os traces ficariam visíveis graficamente.

**Não tem UI própria** — seus dados aparecem no Prometheus e poderiam aparecer no Jaeger.

---

### Opção A — port-forward por script (recomendado)

Um único comando abre todos os port-forwards em janelas separadas:

```powershell
.\port-forward.ps1
```

Ou para um serviço específico:

```powershell
.\port-forward.ps1 -Service grafana
.\port-forward.ps1 -Service prometheus
.\port-forward.ps1 -Service frontend
.\port-forward.ps1 -Service rabbitmq
```

---

### Opção B — port-forward manual (um terminal por serviço)

Cada comando **bloqueia o terminal** enquanto o túnel estiver ativo. Fechar o terminal encerra o acesso.

```powershell
# Frontend → http://localhost:8080
kubectl port-forward svc/frontend    8080:80    -n temperaturaapp

# Grafana → http://localhost:3000  (admin / admin123)
kubectl port-forward svc/grafana     3000:3000  -n temperaturaapp

# Prometheus → http://localhost:9090
kubectl port-forward svc/prometheus  9090:9090  -n temperaturaapp

# RabbitMQ UI → http://localhost:15672  (guest / guest)
kubectl port-forward svc/rabbitmq   15672:15672 -n temperaturaapp

# api-weather direto → http://localhost:3001/weather?city=SaoPaulo
kubectl port-forward svc/api-weather 3001:3001  -n temperaturaapp
```

> O port-forward fica ativo enquanto o terminal estiver aberto. Fechar o terminal encerra o túnel.

### Opção C — minikube service (abre o browser automaticamente)

```powershell
minikube service frontend   -n temperaturaapp
minikube service grafana    -n temperaturaapp
minikube service prometheus -n temperaturaapp
minikube service rabbitmq   -n temperaturaapp
```

O `minikube service` cria um túnel temporário e abre a URL no browser. Funciona bem para acessos pontuais.

---

## Fluxo completo explicado passo a passo

### 1. Docker Desktop inicia o daemon

O Docker Desktop sobe um daemon Linux dentro do WSL2. É ele que executa todos os containers.

### 2. `minikube start` cria o cluster

```powershell
minikube start --memory=4096 --cpus=4 --driver=docker
```

Isso cria um container Docker chamado `minikube` que contém:
- `etcd` — banco de estado do cluster
- `kube-apiserver` — API do Kubernetes
- `kube-scheduler` — decide em qual nó cada pod roda
- `kube-controller-manager` — mantém o estado desejado

### 3. Contexto Docker aponta para o Minikube

```powershell
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
```

Após isso, todo `docker build` e `docker images` acontece **dentro do container do Minikube**, não no Docker Desktop local. É por isso que as imagens precisam ser buildadas depois deste passo — caso contrário, o Kubernetes não as encontra.

### 4. `docker build` cria as imagens dentro do Minikube

```powershell
docker build -t api-weather:local ./api-weather
```

A imagem fica disponível dentro do cluster com a tag `api-weather:local`. Os deployments usam `imagePullPolicy: Never` — ou seja, o Kubernetes nunca tenta baixar da internet, só usa o que já está localmente.

### 5. `kubectl apply` cria os recursos

```powershell
kubectl apply -f k8s/namespace.yaml    # cria o namespace "temperaturaapp"
kubectl apply -f k8s/configmaps/       # configurações do Prometheus, OTel, Grafana
kubectl apply -f k8s/volumes/          # reserva espaço em disco (PVCs)
kubectl apply -f k8s/secrets/          # chaves de API (base64)
kubectl apply -f k8s/deployments/      # cria os pods
kubectl apply -f k8s/services/         # expõe os pods internamente (e alguns externamente via NodePort)
kubectl apply -f k8s/ingress/          # roteamento HTTP por hostname
```

### 6. Pods inicializam em sequência

O Kubernetes não garante ordem de startup, mas os healthchecks (readiness probes) garantem que as APIs só recebem tráfego quando estiverem prontas. A ordem esperada:

```
redis        (~5s)   ← mais rápido, imagem alpine pequena
mongodb      (~20s)  ← inicializa o banco
rabbitmq     (~30s)  ← aguarda readiness probe "ping"
api-weather  (~15s)  ← aguarda rabbitmq + mongodb (retry automático)
api-location (~15s)  ← idem
api-person   (~15s)  ← idem
frontend     (~10s)  ← nginx simples
prometheus   (~10s)
grafana      (~20s)
otel-collector (~5s)
```

---

## O que é um Pod?

Um **pod** é a menor unidade do Kubernetes — é o container (ou grupo de containers) rodando dentro do cluster. Cada serviço do projeto tem um pod próprio:

```
Deployment/api-weather
    └─▶ Pod/api-weather-6f8ff8ff8d-jsbxq   ← nome gerado automaticamente
              └─▶ Container: api-weather    ← o processo Node.js rodando
                      └─▶ porta 3001
                      └─▶ /data/api-weather.db  (volume SQLite)
```

A relação entre os conceitos:

| Conceito | Analogia Docker | Responsabilidade |
|---|---|---|
| **Pod** | `docker run` | Executa o(s) container(s) |
| **Deployment** | `docker-compose service` | Garante que N pods estejam rodando |
| **Service** | porta publicada (`-p 3001:3001`) | Expõe o pod na rede |
| **Namespace** | projeto do compose | Isola recursos por ambiente |

### Ciclo de vida de um pod

```
Pending   → o Kubernetes achou um nó pra ele mas a imagem ainda está baixando
Running   → container iniciado, mas pode ainda não estar aceitando tráfego
Ready     → passou no readiness probe, está recebendo requisições
Failed    → saiu com código de erro e não vai reiniciar sozinho
CrashLoopBackOff → saiu com erro, Kubernetes tentou reiniciar várias vezes
                   e agora aguarda um tempo crescente entre tentativas
```

A coluna `READY` no `kubectl get pods` mostra `1/1` quando o pod está pronto para receber tráfego:

```
NAME                          READY   STATUS    RESTARTS   AGE
api-weather-6f8ff8ff8d-jsbxq  1/1     Running   0          5m
mongodb-78f9d8d599-gz9mq      0/1     Running   0          2m   ← ainda inicializando
```

---

## Como monitorar se os pods caíram

### Visualização contínua (watch)

```powershell
# Atualiza a lista de pods a cada 2 segundos
kubectl get pods -n temperaturaapp -w
```

Fique de olho nas colunas:
- **READY** — `0/1` significa que o container está rodando mas ainda não passou no healthcheck
- **STATUS** — `CrashLoopBackOff` ou `Error` indicam problema
- **RESTARTS** — um número alto (>3) indica que o pod fica caindo e reiniciando

### Ver o que aconteceu com um pod que caiu

```powershell
# 1. Identificar qual pod está com problema
kubectl get pods -n temperaturaapp

# 2. Ver os logs do pod atual
kubectl logs deployment/api-weather -n temperaturaapp

# 3. Ver os logs da execução ANTERIOR (quando ele crashou)
kubectl logs deployment/api-weather -n temperaturaapp --previous

# 4. Ver os eventos do pod — mostra erros de startup, falhas de probe, etc.
kubectl describe pod -l app=api-weather -n temperaturaapp
```

O `describe` mostra uma seção `Events` no final que é a mais útil para diagnóstico:

```
Events:
  Warning  BackOff    2m    kubelet  Back-off restarting failed container
  Warning  Failed     2m    kubelet  Error: secret "api-keys" not found
  Normal   Pulled     3m    kubelet  Container image already present
```

### Decodificando os status de erro

| Status | Causa mais comum | Como resolver |
|---|---|---|
| `CrashLoopBackOff` | Processo Node.js saiu com erro | Ver logs: `kubectl logs ... --previous` |
| `CreateContainerError` | Secret ou ConfigMap não existe | `kubectl get secret -n temperaturaapp` |
| `OOMKilled` | Pod usou mais memória do que o limite | Aumentar `limits.memory` no deployment |
| `Pending` | Sem recursos no nó (CPU/RAM) | `kubectl describe pod ...` → seção Events |
| `ImagePullBackOff` | Imagem não encontrada | Verificar se buildou com contexto do Minikube |
| `0/1 Running` | Healthcheck falhando | Ver logs do processo iniciando |

### Monitorar todos os serviços de uma vez

```powershell
# Resumo do estado de todos os pods — executar quando quiser um "snapshot"
kubectl get pods -n temperaturaapp -o wide

# Ver eventos de erro dos últimos 10 minutos no namespace inteiro
kubectl get events -n temperaturaapp --sort-by=.lastTimestamp `
  | Where-Object { $_ -match "Warning" }

# Uso de CPU e memória por pod (requer metrics-server habilitado)
kubectl top pods -n temperaturaapp
```

### Loop de monitoramento manual

Se quiser ficar de olho no cluster enquanto testa a aplicação, rode em um terminal separado:

```powershell
# Atualiza a cada 5 segundos
while ($true) {
    Clear-Host
    Write-Host "$(Get-Date -Format 'HH:mm:ss') — Pods em temperaturaapp" -ForegroundColor Cyan
    kubectl get pods -n temperaturaapp
    Start-Sleep -Seconds 5
}
```

---

## Comandos de diagnóstico úteis

```powershell
# Ver estado de todos os pods
kubectl get pods -n temperaturaapp

# Ver logs de um serviço em tempo real
kubectl logs -f deployment/api-weather -n temperaturaapp

# Ver logs do pod anterior (quando crashou)
kubectl logs deployment/api-weather -n temperaturaapp --previous

# Descrever um pod (eventos, erros de startup, variáveis de ambiente)
kubectl describe pod -l app=api-weather -n temperaturaapp

# Entrar dentro de um pod
kubectl exec -it deployment/api-weather -n temperaturaapp -- sh

# Ver eventos recentes de erro no namespace
kubectl get events -n temperaturaapp --sort-by=.lastTimestamp | Select-Object -Last 20
```

---

## Parando o ambiente

```powershell
# Para o Minikube (dados preservados, rápido de retomar)
.\stop-minikube.ps1

# Remove só o namespace (Minikube continua rodando)
.\stop-minikube.ps1 -Namespace

# Deleta o cluster inteiro
.\stop-minikube.ps1 -Hard
```

Para retomar depois de parar:

```powershell
.\start-minikube.ps1 -SkipBuild   # imagens ainda existem, só sobe o cluster
```

---

## Problemas comuns

### "docker: command not found" ou "Cannot connect to Docker daemon"

Docker Desktop não está rodando. Abra o Docker Desktop e aguarde a baleia aparecer na barra do sistema antes de rodar o script.

### Pod em `CrashLoopBackOff`

```powershell
kubectl logs deployment/<nome> -n temperaturaapp --previous
```

Causa mais comum: variável de ambiente faltando (ex: `OPENWEATHER_API_KEY` não configurada no secret).

### Pod em `CreateContainerError` (secret inválido)

O valor no `k8s/secrets/api-keys.yaml` precisa estar em **base64**. Para gerar:

```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("sua_chave_aqui"))
```

Cole o resultado no yaml e re-aplique:

```powershell
kubectl apply -f k8s/secrets/api-keys.yaml
kubectl rollout restart deployment/api-weather -n temperaturaapp
```

### `192.168.49.2:30080` não abre no browser

IP interno do Docker, não acessível no Windows. Use port-forward:

```powershell
kubectl port-forward svc/frontend 8080:80 -n temperaturaapp
# Acesse: http://localhost:8080
```

### Minikube muito lento

O cluster usa 4GB de RAM. Se a máquina tiver pouca memória disponível, reduza:

```powershell
minikube start --memory=2048 --cpus=2 --driver=docker
```

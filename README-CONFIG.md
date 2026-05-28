# README-CONFIG — Configuração e Uso

Guia completo para configurar, executar e operar o **TemperaturaVS2** localmente com Minikube ou Docker Compose.

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [APIs externas gratuitas](#2-apis-externas-gratuitas)
3. [Configuração do .env](#3-configuração-do-env)
4. [Opção A — Docker Compose (dev rápido)](#4-opção-a--docker-compose-dev-rápido)
5. [Opção B — Minikube (Kubernetes local)](#5-opção-b--minikube-kubernetes-local)
6. [Acessar os serviços](#6-acessar-os-serviços)
7. [Usar a aplicação](#7-usar-a-aplicação)
8. [Observabilidade — Grafana e Prometheus](#8-observabilidade--grafana-e-prometheus)
9. [RabbitMQ — Mensageria](#9-rabbitmq--mensageria)
10. [Redis — Cache](#10-redis--cache)
11. [Banco de dados](#11-banco-de-dados)
12. [CI/CD — GitHub Actions](#12-cicd--github-actions)
13. [Skills do Claude Code](#13-skills-do-claude-code)
14. [Comandos úteis](#14-comandos-úteis)
15. [Solução de problemas](#15-solução-de-problemas)

---

## 1. Pré-requisitos

### Ferramentas obrigatórias

| Ferramenta | Versão mínima | Verificar |
|---|---|---|
| Docker Desktop | 24+ | `docker --version` |
| Node.js | 20+ | `node --version` |
| Git | qualquer | `git --version` |

### Ferramentas para Minikube (Opção B)

| Ferramenta | Versão mínima | Verificar |
|---|---|---|
| Minikube | 1.32+ | `minikube version` |
| kubectl | 1.28+ | `kubectl version --client` |

### Instalação no Windows (via Chocolatey)

```powershell
# Instalar Chocolatey (executar no PowerShell como Administrador)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Instalar ferramentas
choco install minikube kubernetes-cli -y

# Docker Desktop: baixar manualmente em https://www.docker.com/products/docker-desktop/
```

---

## 2. APIs externas gratuitas

O projeto usa duas APIs externas. Ambas têm plano gratuito.

### OpenWeatherMap (obrigatória para api-weather)

1. Acesse **openweathermap.org** e crie uma conta gratuita
2. Vá em **API Keys** no painel
3. Copie a chave padrão (ou crie uma nova)
4. Plano gratuito: **1.000 requisições/dia**

### ip-api.com (sem chave)

Usada pela `api-location` para geolocalização por IP. **Não precisa de cadastro.** Limite: 45 req/min.

---

## 3. Configuração do .env

```powershell
# Na raiz do projeto
Copy-Item .env.example .env
```

Abra o arquivo `.env` e preencha:

```bash
# Obrigatório — sua chave do OpenWeatherMap
OPENWEATHER_API_KEY=cole_sua_chave_aqui

# Os demais já têm valores padrão para desenvolvimento local
RABBITMQ_URL=amqp://guest:guest@localhost:5672
MONGODB_URI=mongodb+srv://guilhermesantannait:Tree2026Tere@cluster0.7j5tz4z.mongodb.net/temperaturadb
REDIS_URL=redis://localhost:6379
SQLITE_PATH=./data/transactions.db
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
VITE_PROMETHEUS_URL=http://localhost:9090
```

---

## 4. Opção A — Docker Compose (dev rápido)

A forma mais rápida de rodar tudo localmente, sem precisar do Minikube.

### Subir o ambiente

```bash
docker-compose -f docker-compose.dev.yaml up --build
```

Para rodar em background:

```bash
docker-compose -f docker-compose.dev.yaml up --build -d
```

### Verificar se está tudo rodando

```bash
docker-compose -f docker-compose.dev.yaml ps
```

Todos os serviços devem estar com status `running (healthy)`.

### Parar o ambiente

```bash
docker-compose -f docker-compose.dev.yaml down

# Para apagar também os volumes (banco de dados e cache):
docker-compose -f docker-compose.dev.yaml down -v
```

### Endereços com Docker Compose

| Serviço | Endereço |
|---|---|
| Frontend | http://localhost:8080 |
| api-weather | http://localhost:3001 |
| api-location | http://localhost:3002 |
| api-person | http://localhost:3003 |
| RabbitMQ UI | http://localhost:15672 (guest / guest) |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (admin / admin123) |
| OTel Collector gRPC | localhost:4317 |
| OTel Collector HTTP | localhost:4318 |

> **Nota:** O Grafana está na porta `3001` no docker-compose para não conflitar com a `api-weather`. Use `http://localhost:3001` para Grafana e `http://localhost:3001` para a api. No Minikube eles ficam em portas separadas.

---

## 5. Opção B — Minikube (Kubernetes local)

### 5.1 Iniciar o Minikube

```powershell
# Iniciar com recursos suficientes
minikube start --memory=4096 --cpus=4 --driver=docker

# Habilitar addons necessários
minikube addons enable ingress
minikube addons enable metrics-server

# Verificar status
minikube status
```

### 5.2 Apontar o Docker para o Minikube

Isso faz com que os `docker build` sejam feitos dentro do cluster, sem precisar de registry externo.

```powershell
# Windows PowerShell
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Verificar (deve aparecer o daemon do Minikube)
docker info | Select-String "Name"
```

> **Importante:** esse comando precisa ser reexecutado toda vez que abrir um novo terminal.

### 5.3 Build das imagens

```powershell
docker build -t api-weather:local  ./api-weather
docker build -t api-location:local ./api-location
docker build -t api-person:local   ./api-person
docker build -t frontend:local     ./frontend
```

### 5.4 Criar o Secret com a chave da API

```powershell
# Gerar o valor base64 da sua chave
$key = "cole_sua_openweather_key_aqui"
$encoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($key))
Write-Host "Base64: $encoded"
```

Abra o arquivo [k8s/secrets/api-keys.yaml](k8s/secrets/api-keys.yaml) e substitua o valor de `OPENWEATHER_API_KEY` pelo base64 gerado acima.

Ou use o kubectl diretamente (sem editar o arquivo):

```bash
kubectl create secret generic api-keys \
  --from-literal=OPENWEATHER_API_KEY="sua_chave_aqui" \
  --namespace=temperaturaapp
```

### 5.5 Deploy de tudo no cluster

```bash
# Namespace primeiro
kubectl apply -f k8s/namespace.yaml

# Infraestrutura
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/volumes/
kubectl apply -f k8s/secrets/api-keys.yaml

# Deployments e Services
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/

# Ingress (opcional — acesso por hostname)
kubectl apply -f k8s/ingress/
```

### 5.6 Aguardar os pods ficarem prontos

```bash
# Acompanhar em tempo real
kubectl get pods -n temperaturaapp -w

# Ou aguardar com timeout
kubectl wait --for=condition=ready pod --all -n temperaturaapp --timeout=180s
```

A ordem de inicialização esperada é:
1. `mongodb`, `redis`, `rabbitmq` ficam prontos primeiro
2. `otel-collector`, `prometheus` sobem em seguida
3. `api-weather`, `api-location`, `api-person` sobem depois (dependem do rabbitmq/mongodb)
4. `frontend`, `grafana` sobem por último

---

## 6. Acessar os serviços

### Via Minikube (abre no navegador)

```bash
# Frontend
minikube service frontend -n temperaturaapp

# Grafana
minikube service grafana -n temperaturaapp

# RabbitMQ Management UI
minikube service rabbitmq -n temperaturaapp

# Prometheus
minikube service prometheus -n temperaturaapp
```

### Via port-forward (alternativa)

```bash
# Frontend
kubectl port-forward svc/frontend 8080:80 -n temperaturaapp

# Grafana
kubectl port-forward svc/grafana 3000:3000 -n temperaturaapp

# Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n temperaturaapp

# RabbitMQ Management
kubectl port-forward svc/rabbitmq 15672:15672 -n temperaturaapp

# api-weather (para testes diretos)
kubectl port-forward svc/api-weather 3001:3001 -n temperaturaapp
```

### Tabela de portas no Minikube (NodePort)

| Serviço | NodePort | Como acessar |
|---|---|---|
| Frontend | 30080 | `minikube service frontend -n temperaturaapp` |
| Grafana | 30300 | `minikube service grafana -n temperaturaapp` |
| Prometheus | 30090 | `minikube service prometheus -n temperaturaapp` |
| RabbitMQ UI | 30672 | `minikube service rabbitmq -n temperaturaapp` |

---

## 7. Usar a aplicação

### Página de Clima

1. Acesse o frontend → aba **Clima**
2. Digite o nome de uma cidade (ex: `São Paulo`, `Londres`, `Tokyo`)
3. Clique em **Buscar**
4. Verá a temperatura atual + gráfico de previsão para 5 dias
5. O resultado é cacheado no Redis por **10 minutos**

### Página de Localização

1. Acesse aba **Localização**
2. Clique em **Localizar** sem preencher nada — retorna sua localização pelo IP atual
3. Ou informe um IP específico (ex: `8.8.8.8`)
4. Resultado cacheado no Redis por **24 horas**

### Página de Pessoa

1. Acesse aba **Pessoa**
2. Informe nome e data de nascimento
3. Recebe: idade em anos/meses/dias, total de dias vividos, signo do zodíaco, dias até o próximo aniversário
4. Se for aniversário hoje, aparece o parabéns

### Página de Telemetria

1. Acesse aba **Telemetria**
2. Mostra métricas consultadas diretamente do **Prometheus**
3. Requer que `VITE_PROMETHEUS_URL` aponte para o Prometheus acessível pelo navegador
4. Para Minikube: rode `kubectl port-forward svc/prometheus 9090:9090 -n temperaturaapp` e configure `VITE_PROMETHEUS_URL=http://localhost:9090`
5. Auto-refresh a cada 30 segundos

### Página de Histórico

1. Acesse aba **Histórico**
2. Mostra as últimas 20 consultas de cada serviço (dados do **MongoDB**)
3. Alterne entre Clima, Localização e Pessoas pelas abas

---

## 8. Observabilidade — Grafana e Prometheus

### Grafana

**Acesso:** `minikube service grafana -n temperaturaapp`
**Credenciais:** `admin` / `admin123`

O dashboard **TemperaturaVS2 Overview** é provisionado automaticamente via ConfigMap e mostra:
- Total de requisições por serviço
- Cache hit rate do Redis
- Latência P95 de cada rota
- Taxa de requisições ao longo do tempo (gráfico de série temporal)
- Mensagens publicadas no RabbitMQ

### Prometheus

**Acesso:** `minikube service prometheus -n temperaturaapp`

Exemplos de queries úteis:

```promql
# Requisições totais por serviço
sum by (job) (http_requests_total)

# Taxa de requisições por minuto
rate(http_requests_total[5m])

# Latência P95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Cache hit rate
sum(cache_hits_total) / (sum(cache_hits_total) + sum(cache_misses_total)) * 100

# Mensagens publicadas no RabbitMQ
sum by (routing_key) (rabbitmq_messages_published_total)
```

### OpenTelemetry

O **OTel Collector** recebe traces de todos os serviços via OTLP (HTTP na porta 4318) e expõe métricas para o Prometheus na porta 8889. Os traces aparecem como logs no collector (modo `logging`). Para visualização completa de traces, adicione o Jaeger ao cluster:

```bash
# Adicionar Jaeger (opcional)
kubectl apply -f https://github.com/jaegertracing/jaeger-operator/releases/latest/download/jaeger-operator.yaml -n temperaturaapp
```

---

## 9. RabbitMQ — Mensageria

### Acessar a Management UI

```
URL:   minikube service rabbitmq -n temperaturaapp  (porta 15672)
User:  guest
Pass:  guest
```

### Exchanges criados

| Exchange | Tipo | Quem publica |
|---|---|---|
| `climate-events` | topic | api-weather |
| `location-events` | topic | api-location |
| `person-events` | topic | api-person |

### Filas criadas

| Fila | Consome de | Finalidade |
|---|---|---|
| `audit-queue` | todos os exchanges | Auditoria de todos os eventos |
| `analytics-queue` | climate-events | Analytics de clima |
| `notification-queue` | weather.queried | Notificações futuras |

### Routing keys

```
weather.queried            → consulta de temperatura atual
weather.forecast.queried   → consulta de previsão
location.queried           → consulta de localização
person.queried             → consulta de dados pessoais
```

### Ver mensagens na fila via CLI

```bash
kubectl exec -it deployment/rabbitmq -n temperaturaapp -- \
  rabbitmqctl list_queues name messages
```

### Relação com Azure (referência)

| Azure | Local (RabbitMQ) |
|---|---|
| Service Bus Queue | Queue no RabbitMQ |
| Service Bus Topic (Subscription) | Exchange type=topic + binding |
| Event Hub (Consumer Group) | Exchange type=fanout + fila separada por consumer |
| Event Hub Capture | Consumer que persiste no MongoDB/SQLite |

---

## 10. Redis — Cache

Redis roda como container local — **sem criar conta**.

### Acessar o Redis CLI

```bash
# Minikube
kubectl exec -it deployment/redis -n temperaturaapp -- redis-cli

# Docker Compose
docker-compose -f docker-compose.dev.yaml exec redis redis-cli
```

### Comandos úteis no Redis CLI

```bash
# Listar todas as chaves
KEYS *

# Ver o valor de uma chave
GET weather:sao_paulo

# Ver TTL restante (em segundos)
TTL weather:sao_paulo

# Ver um CSV cacheado
GET csv:weather:sao_paulo:2024-01-15

# Quantas chaves existem
DBSIZE

# Limpar tudo (use com cuidado)
FLUSHDB
```

### Chaves e TTLs

| Padrão da chave | TTL | Conteúdo |
|---|---|---|
| `weather:<cidade>` | 600s (10 min) | JSON da temperatura atual |
| `forecast:<cidade>:<dias>` | 1800s (30 min) | JSON da previsão |
| `location:<ip>` | 86400s (24 h) | JSON da localização |
| `csv:weather:<cidade>:<data>` | 3600s (1 h) | CSV da consulta de clima |
| `csv:location:<ip>` | 3600s (1 h) | CSV da localização |

---

## 11. Banco de dados

### MongoDB

Armazena o JSON completo de cada consulta.

```bash
# Acessar o mongo shell
kubectl exec -it deployment/mongodb -n temperaturaapp -- mongosh temperaturadb

# Ver coleções
show collections

# Ver últimas consultas de clima
db.weatherqueries.find().sort({ timestamp: -1 }).limit(5).pretty()

# Ver localizações
db.locationqueries.find().sort({ timestamp: -1 }).limit(5).pretty()

# Ver consultas de pessoas
db.personqueries.find().sort({ timestamp: -1 }).limit(5).pretty()

# Contar registros
db.weatherqueries.countDocuments()
```

### SQLite

Cada API tem seu próprio arquivo `.db` no PersistentVolume `/data`.

```bash
# Acessar o arquivo SQLite da api-weather
kubectl exec -it deployment/api-weather -n temperaturaapp -- sh
# Dentro do pod:
sqlite3 /data/api-weather.db

# Ver transações
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;

# Contar por endpoint
SELECT endpoint, COUNT(*) as total FROM transactions GROUP BY endpoint;

# Duração média por endpoint
SELECT endpoint, ROUND(AVG(duration_ms), 2) as avg_ms FROM transactions GROUP BY endpoint;
```

---

## 12. CI/CD — GitHub Actions

Os workflows ficam em `.github/workflows/` e são acionados automaticamente.

### ci-backend.yaml

**Trigger:** push ou PR nos diretórios `api-weather/**`, `api-location/**`, `api-person/**`

**Jobs:**
1. `test` (paralelo por serviço): instala dependências → lint → `npm test`
2. `build` (apenas na branch `main`): build Docker → push para GHCR (GitHub Container Registry)

### ci-frontend.yaml

**Trigger:** push ou PR em `frontend/**`

**Jobs:**
1. `test`: instala → lint → `npm test` → `npm run build` → salva artefato
2. `docker` (apenas na branch `main`): build Docker → push para GHCR

### Configurar o repositório

Para o push de imagens funcionar, o repositório precisa estar no GitHub com o Actions habilitado. Não é necessária nenhuma configuração adicional de secrets — o `GITHUB_TOKEN` é provisionado automaticamente.

Para visualizar as imagens publicadas: `https://github.com/<usuario>?tab=packages`

### Rodar localmente (Act)

Para testar os workflows localmente sem push:

```bash
# Instalar Act
choco install act-cli -y

# Simular o CI do backend
act push --job test -W .github/workflows/ci-backend.yaml
```

---

## 13. Skills do Claude Code

O projeto tem 5 skills prontas em `.claude/commands/`. Use no terminal do Claude Code:

| Skill | O que faz |
|---|---|
| `/start` | Inicia Minikube + configura Docker context + build de todas as imagens + deploy completo |
| `/deploy <serviço>` | Rebuild e rollout de um serviço específico (ex: `/deploy api-weather`) ou `/deploy all` |
| `/status` | Exibe estado de todos os pods, services, PVCs e URLs de acesso |
| `/logs <serviço>` | Logs do serviço (ex: `/logs api-weather --follow`) |
| `/teardown` | Remove o namespace (ou para/deleta o cluster com `--all` / `--hard`) |

---

## 14. Comandos úteis

### Minikube

```bash
# Status do cluster
minikube status

# Abrir dashboard web
minikube dashboard

# IP do cluster (para configurar /etc/hosts se usar ingress)
minikube ip

# Listar URLs dos serviços expostos
minikube service list -n temperaturaapp

# Pausar o cluster (libera memória sem deletar)
minikube pause

# Retomar
minikube unpause

# Parar
minikube stop
```

### kubectl — Operações comuns

```bash
# Ver todos os pods
kubectl get pods -n temperaturaapp

# Ver logs de um serviço
kubectl logs -f deployment/api-weather -n temperaturaapp

# Reiniciar um deployment (útil após rebuild de imagem)
kubectl rollout restart deployment/api-weather -n temperaturaapp

# Verificar status do rollout
kubectl rollout status deployment/api-weather -n temperaturaapp

# Entrar dentro de um pod
kubectl exec -it deployment/api-weather -n temperaturaapp -- sh

# Ver variáveis de ambiente de um pod
kubectl exec deployment/api-weather -n temperaturaapp -- env

# Descrever um pod (útil para debugar inicialização)
kubectl describe pod -l app=api-weather -n temperaturaapp

# Ver eventos recentes
kubectl get events -n temperaturaapp --sort-by=.lastTimestamp | tail -20

# Escalar um deployment
kubectl scale deployment/api-weather --replicas=2 -n temperaturaapp
```

### Testar as APIs diretamente

```bash
# Temperatura atual (após port-forward svc/api-weather 3001:3001)
curl "http://localhost:3001/weather?city=São Paulo"

# Previsão de 7 dias
curl "http://localhost:3001/forecast?city=Londres&days=7"

# Localização pelo IP atual
curl "http://localhost:3002/location"

# Localização por IP específico
curl "http://localhost:3002/location?ip=8.8.8.8"

# Calcular idade
curl -X POST http://localhost:3003/person \
  -H "Content-Type: application/json" \
  -d '{"name": "João Silva", "birthdate": "1990-05-15"}'

# Health check de todos
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

---

## 15. Solução de problemas

### Minikube não inicia no Windows

```powershell
# Tentar com driver hyper-v
minikube start --driver=hyperv --memory=4096

# Ou deletar e recriar
minikube delete
minikube start --memory=4096 --cpus=4 --driver=docker
```

### Imagem não encontrada (ErrImageNeverPull)

O contexto Docker não está apontando para o Minikube. Reexecute:

```powershell
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
docker build -t api-weather:local ./api-weather
kubectl rollout restart deployment/api-weather -n temperaturaapp
```

### Pod em CrashLoopBackOff

```bash
# Ver logs do pod que está crashando
kubectl logs -l app=api-weather -n temperaturaapp --previous

# Ver eventos
kubectl describe pod -l app=api-weather -n temperaturaapp
```

Causas comuns:
- `OPENWEATHER_API_KEY` não configurada → verifique o secret
- RabbitMQ ainda não subiu → aguarde o readiness probe (até 30s)
- MongoDB ainda inicializando → aguarde até 15s

### RabbitMQ connection refused nas APIs

As APIs tentam reconectar automaticamente a cada 5 segundos. Se o RabbitMQ demorar para subir, as APIs ficam em retry loop. Aguarde o pod do RabbitMQ estar `Running (1/1)` antes de reiniciar as APIs:

```bash
kubectl wait --for=condition=ready pod -l app=rabbitmq -n temperaturaapp --timeout=60s
kubectl rollout restart deployment/api-weather -n temperaturaapp
```

### MongoDB não conecta

```bash
# Verificar se o pod subiu
kubectl get pod -l app=mongodb -n temperaturaapp

# Testar conectividade de dentro de uma API
kubectl exec -it deployment/api-weather -n temperaturaapp -- sh
# Dentro: wget -qO- http://mongodb:27017
```

### Redis "Connection refused"

O Redis usa `lazyConnect: true` — conexão é estabelecida na primeira chamada. Se o Redis não estiver pronto, o cache simplesmente não funciona (as APIs continuam funcionando sem cache).

### Frontend não consegue chamar as APIs (CORS ou proxy)

Para Docker Compose: o nginx proxy está configurado para rotear `/api/weather`, `/api/location`, `/api/person` para os serviços corretos na rede Docker.

Para desenvolvimento local com `npm run dev` (Vite): o `vite.config.js` já configura proxy para `localhost:3001`, `3002`, `3003`. Certifique-se de que as APIs estão rodando antes de iniciar o frontend.

### Grafana sem dados

1. Verifique se o Prometheus está coletando: acesse Prometheus → Status → Targets — todos devem estar `UP`
2. Se os targets estiverem `DOWN`, as APIs ainda não subiram ou os healthchecks falharam
3. Faça algumas requisições nas APIs para gerar métricas antes de consultar o Grafana

### Porta já em uso (docker-compose)

```bash
# Descobrir qual processo usa a porta 3001
netstat -ano | findstr :3001

# Matar o processo pelo PID
taskkill /PID <pid> /F
```

### Limpar tudo e começar do zero

```bash
# Docker Compose
docker-compose -f docker-compose.dev.yaml down -v --remove-orphans
docker system prune -f

# Minikube
kubectl delete namespace temperaturaapp
# ou deletar o cluster inteiro:
minikube delete
```

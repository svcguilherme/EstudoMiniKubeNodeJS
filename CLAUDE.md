# TemperaturaVS2 — Plataforma de Clima e Dados Pessoais

## Visão Geral do Projeto

Plataforma distribuída com múltiplos microsserviços rodando em Kubernetes (Minikube), cobrindo:
- Consulta de temperatura/clima via APIs externas
- Dados de localização do usuário
- Calculadora de idade por nome/data de nascimento
- Mensageria event-driven com RabbitMQ
- Observabilidade com Prometheus + Grafana + OpenTelemetry
- Cache com Redis
- Persistência com MongoDB (consultas JSON) e SQLite (log de transações)
- Frontend React consumindo todas as APIs
- CI/CD com GitHub Actions

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        MINIKUBE CLUSTER                         │
│                                                                 │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │  frontend  │──▶│ api-weather  │──▶│  RabbitMQ (AMQP)    │  │
│  │  React     │   │  Node.js     │   │  (Service Bus local) │  │
│  │  :3000     │   │  :3001       │   │  :5672 / :15672      │  │
│  └────────────┘   └──────┬───────┘   └──────────────────────┘  │
│         │                │                                      │
│         │         ┌──────▼───────┐                             │
│         │         │  api-location│                             │
│         │         │  Node.js     │                             │
│         │         │  :3002       │                             │
│         │         └──────────────┘                             │
│         │                                                       │
│         │         ┌──────────────┐                             │
│         └────────▶│  api-person  │                             │
│                   │  Node.js     │                             │
│                   │  :3003       │                             │
│                   └──────────────┘                             │
│                                                                 │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │  MongoDB   │   │    Redis     │   │  SQLite (PVC)        │  │
│  │  :27017    │   │  :6379       │   │  transactions.db     │  │
│  └────────────┘   └──────────────┘   └──────────────────────┘  │
│                                                                 │
│  ┌────────────┐   ┌──────────────┐                             │
│  │ Prometheus │   │   Grafana    │                             │
│  │  :9090     │   │  :3000       │                             │
│  └────────────┘   └──────────────┘                             │
│                                                                 │
│  ┌─────────────────────────────────┐                           │
│  │  OpenTelemetry Collector        │                           │
│  │  :4317 (gRPC) / :4318 (HTTP)   │                           │
│  └─────────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Serviços

### `api-weather` (porta 3001)
**Responsabilidade**: Ponto central de consulta climática.

- `GET /weather?city=<cidade>` — temperatura atual
- `GET /forecast?city=<cidade>&days=<n>` — previsão de N dias
- `GET /health` — healthcheck

**Fluxo interno**:
1. Recebe requisição HTTP
2. Verifica cache Redis (key: `weather:<city>`)
3. Se miss: chama OpenWeatherMap API ou WeatherAPI
4. Publica evento `weather.queried` no RabbitMQ (exchange `climate-events`)
5. Persiste no MongoDB (coleção `weather_queries`)
6. Persiste transação no SQLite
7. Retorna dados + salva CSV no Redis como cache

**Variáveis de ambiente**:
```
OPENWEATHER_API_KEY=
WEATHER_API_KEY=
RABBITMQ_URL=amqp://rabbitmq:5672
MONGODB_URI=mongodb://mongodb:27017/temperaturadb
REDIS_URL=redis://redis:6379
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
SQLITE_PATH=/data/transactions.db
```

---

### `api-location` (porta 3002)
**Responsabilidade**: Retorna dados de localização geográfica.

- `GET /location` — localização via IP do cliente (ipapi.co ou ip-api.com)
- `GET /location?ip=<ip>` — localização de IP específico
- `GET /health` — healthcheck

**Fluxo interno**:
1. Extrai IP do header `X-Forwarded-For` ou `req.ip`
2. Verifica cache Redis (key: `location:<ip>`)
3. Se miss: chama ip-api.com (gratuito, sem chave)
4. Publica evento `location.queried` no RabbitMQ
5. Persiste no MongoDB (coleção `location_queries`)
6. Persiste transação no SQLite
7. Retorna: cidade, região, país, latitude, longitude, timezone

**Variáveis de ambiente**:
```
RABBITMQ_URL=amqp://rabbitmq:5672
MONGODB_URI=mongodb://mongodb:27017/temperaturadb
REDIS_URL=redis://redis:6379
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
SQLITE_PATH=/data/transactions.db
```

---

### `api-person` (porta 3003)
**Responsabilidade**: Calcula idade a partir de nome e data de nascimento.

- `POST /person` — body: `{ "name": "João", "birthdate": "1990-05-15" }`
  - Retorna: nome, data de nascimento, idade em anos/meses/dias, signo zodiacal
- `GET /health` — healthcheck

**Fluxo interno**:
1. Valida payload
2. Calcula idade precisa (anos, meses, dias)
3. Calcula signo do zodíaco
4. Publica evento `person.queried` no RabbitMQ
5. Persiste no MongoDB (coleção `person_queries`)
6. Persiste transação no SQLite
7. Retorna dados calculados

**Variáveis de ambiente**:
```
RABBITMQ_URL=amqp://rabbitmq:5672
MONGODB_URI=mongodb://mongodb:27017/temperaturadb
REDIS_URL=redis://redis:6379
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
SQLITE_PATH=/data/transactions.db
```

---

### `frontend` (porta 80 no cluster, 3000 local)
**Responsabilidade**: Interface do usuário — React com Vite.

**Páginas**:
- `/` — Home com resumo
- `/weather` — Consulta de clima (campo: cidade)
- `/location` — Localização atual
- `/person` — Calculadora de idade (campos: nome, data)
- `/telemetry` — Dashboard de telemetria (chama Prometheus API)
- `/history` — Histórico de consultas (chama MongoDB via API gateway)

**Tecnologias**: React 18, Vite, Axios, Chart.js, TailwindCSS

---

## Mensageria — RabbitMQ (Event-Driven)

RabbitMQ substitui Azure Service Bus e Azure Event Hub localmente.

**Exchanges**:
- `climate-events` (topic) — eventos de clima
- `location-events` (topic) — eventos de localização
- `person-events` (topic) — eventos de pessoa

**Routing Keys**:
- `weather.queried` — consulta de clima realizada
- `weather.forecast.queried` — consulta de previsão
- `location.queried` — consulta de localização
- `person.queried` — consulta de pessoa

**Filas**:
- `audit-queue` — consome todos os eventos para auditoria
- `notification-queue` — consome eventos para notificações futuras
- `analytics-queue` — consome para analytics/BI

**Analogia com Azure**:
| Azure | Local (RabbitMQ) |
|-------|-----------------|
| Service Bus Queue | Queue no RabbitMQ |
| Service Bus Topic | Exchange type=topic |
| Event Hub | Exchange type=fanout com múltiplos consumers |
| Event Hub Consumer Group | Fila separada por consumer |

---

## Cache — Redis

Redis é **gratuito e open source**. Neste projeto roda como container local — **não precisa criar conta**.

**Estratégia de cache**:
- `weather:<city>` — TTL 10 minutos (dados de clima mudam pouco)
- `forecast:<city>:<days>` — TTL 30 minutos
- `location:<ip>` — TTL 24 horas (localização por IP é estável)
- `csv:weather:<city>:<date>` — CSV da consulta, TTL 1 hora

**Formato CSV em cache**:
```
city,temperature,feels_like,humidity,wind_speed,timestamp
São Paulo,22.5,20.1,78,15.3,2024-01-15T10:30:00Z
```

**Comandos úteis**:
```bash
# Acessar Redis no cluster
kubectl exec -it deployment/redis -- redis-cli

# Ver todas as chaves
keys *

# Ver valor de uma chave
get weather:SaoPaulo

# TTL restante
ttl weather:SaoPaulo
```

---

## Persistência

### MongoDB — Consultas JSON
Banco principal para armazenar o payload completo de cada consulta.

**Coleções**:
- `weather_queries` — `{ city, temperature, humidity, wind, timestamp, source }`
- `forecast_queries` — `{ city, days, forecast[], timestamp }`
- `location_queries` — `{ ip, city, country, lat, lon, timezone, timestamp }`
- `person_queries` — `{ name, birthdate, age_years, age_months, age_days, sign, timestamp }`

### SQLite — Log de Transações
Log auditável de todas as operações, persistido em PersistentVolume.

**Tabela `transactions`**:
```sql
CREATE TABLE transactions (
  id         TEXT PRIMARY KEY,
  service    TEXT NOT NULL,      -- 'api-weather', 'api-location', 'api-person'
  endpoint   TEXT NOT NULL,      -- '/weather', '/location', etc.
  method     TEXT NOT NULL,      -- GET, POST
  status     INTEGER NOT NULL,   -- HTTP status code
  duration_ms INTEGER,           -- tempo de resposta
  input_hash TEXT,               -- hash dos parâmetros de entrada
  created_at TEXT NOT NULL       -- ISO 8601
);
```

---

## Observabilidade

### Prometheus
Coleta métricas de cada serviço via `/metrics` (prom-client).

**Métricas expostas por serviço**:
- `http_requests_total{service, method, route, status}` — total de requisições
- `http_request_duration_seconds{service, route}` — histograma de latência
- `cache_hits_total{service}` / `cache_misses_total{service}` — eficiência do cache
- `rabbitmq_messages_published_total{service, routing_key}` — mensagens publicadas

### Grafana
Dashboards pré-configurados via ConfigMap (JSON provisioning).

**Dashboards**:
- `Overview` — visão geral de todos os serviços
- `Weather API` — métricas específicas de clima
- `Cache Performance` — hit rate, TTL expirations
- `RabbitMQ` — throughput de mensagens
- `Infrastructure` — CPU/Memória dos pods

**Acesso**: `http://localhost:3000` após `minikube service grafana`
- User: `admin` / Password: `admin123`

### OpenTelemetry
Collector centraliza traces distribuídos.

**Pipeline**:
```
API → OTLP → OTel Collector → Prometheus (métricas)
                            → Jaeger (traces, opcional)
```

---

## Estrutura de Diretórios

```
TemperaturaVS2/
├── CLAUDE.md
├── .claude/
│   └── commands/               # Skills do Claude Code
│       ├── start.md
│       ├── deploy.md
│       ├── status.md
│       └── logs.md
├── api-weather/
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/
│   │   │   ├── weather.js
│   │   │   └── forecast.js
│   │   ├── services/
│   │   │   ├── weatherService.js
│   │   │   ├── cacheService.js
│   │   │   ├── messagingService.js
│   │   │   └── persistenceService.js
│   │   └── middleware/
│   │       ├── telemetry.js
│   │       └── metrics.js
│   ├── Dockerfile
│   └── package.json
├── api-location/
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/location.js
│   │   └── services/
│   ├── Dockerfile
│   └── package.json
├── api-person/
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/person.js
│   │   └── services/
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Weather.jsx
│   │   │   ├── Location.jsx
│   │   │   ├── Person.jsx
│   │   │   ├── Telemetry.jsx
│   │   │   └── History.jsx
│   │   └── components/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── k8s/
│   ├── namespace.yaml
│   ├── configmaps/
│   │   ├── grafana-dashboards.yaml
│   │   └── otel-config.yaml
│   ├── deployments/
│   │   ├── api-weather.yaml
│   │   ├── api-location.yaml
│   │   ├── api-person.yaml
│   │   ├── frontend.yaml
│   │   ├── rabbitmq.yaml
│   │   ├── mongodb.yaml
│   │   ├── redis.yaml
│   │   ├── prometheus.yaml
│   │   ├── grafana.yaml
│   │   └── otel-collector.yaml
│   ├── services/
│   │   └── (um .yaml por serviço acima)
│   ├── ingress/
│   │   └── ingress.yaml
│   └── volumes/
│       └── sqlite-pvc.yaml
├── .github/
│   └── workflows/
│       ├── ci-backend.yaml
│       └── ci-frontend.yaml
└── docker-compose.dev.yaml     # desenvolvimento local sem Minikube
```

---

## Pré-requisitos

### Ferramentas necessárias
```
- Docker Desktop (Windows) — versão 24+
- Minikube — versão 1.32+
- kubectl — versão 1.28+
- Node.js — versão 20+
- Git
```

### Instalação das ferramentas (Windows)

```powershell
# Chocolatey (se não tiver)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Ferramentas
choco install minikube kubernetes-cli docker-desktop -y
```

### APIs externas (gratuitas)
| API | Uso | Link para chave | Tier gratuito |
|-----|-----|-----------------|---------------|
| OpenWeatherMap | Temperatura atual | openweathermap.org | 1.000 req/dia |
| WeatherAPI | Previsão | weatherapi.com | 1.000.000 req/mês |
| ip-api.com | Geolocalização por IP | ip-api.com | 45 req/min (sem chave) |

Redis: **sem conta necessária** — roda como container local.

---

## Setup Inicial

### 1. Clonar e configurar

```bash
git clone <repo>
cd TemperaturaVS2
cp .env.example .env
# Editar .env com suas chaves de API
```

### 2. Iniciar Minikube

```bash
minikube start --memory=4096 --cpus=4 --driver=docker
minikube addons enable ingress
minikube addons enable metrics-server
eval $(minikube docker-env)   # Linux/Mac
# Windows PowerShell:
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
```

### 3. Build das imagens

```bash
# Com contexto Docker do Minikube ativo:
docker build -t api-weather:local ./api-weather
docker build -t api-location:local ./api-location
docker build -t api-person:local ./api-person
docker build -t frontend:local ./frontend
```

### 4. Deploy no Kubernetes

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/volumes/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress/
```

### 5. Verificar pods

```bash
kubectl get pods -n temperaturaapp
kubectl get services -n temperaturaapp
```

### 6. Acessar serviços

```bash
minikube service frontend -n temperaturaapp
minikube service grafana -n temperaturaapp
minikube service rabbitmq -n temperaturaapp  # UI de gerenciamento
```

---

## Desenvolvimento Local (sem Minikube)

Para desenvolvimento rápido use o docker-compose:

```bash
docker-compose -f docker-compose.dev.yaml up
```

Serviços acessíveis em:
- Frontend: http://localhost:3000
- api-weather: http://localhost:3001
- api-location: http://localhost:3002
- api-person: http://localhost:3003
- RabbitMQ UI: http://localhost:15672 (guest/guest)
- MongoDB: localhost:27017
- Redis: localhost:6379
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin123)

---

## CI/CD — GitHub Actions

### Backend (`ci-backend.yaml`)
Trigger: push em `api-weather/**`, `api-location/**`, `api-person/**`

1. Lint (ESLint)
2. Testes unitários (Jest)
3. Build Docker image
4. Push para registry (GitHub Container Registry ou Docker Hub)
5. Update Kubernetes deployment (kubectl set image)

### Frontend (`ci-frontend.yaml`)
Trigger: push em `frontend/**`

1. Lint + Type check
2. Testes (Vitest)
3. Build produção (Vite)
4. Build Docker image (nginx)
5. Push para registry
6. Update Kubernetes deployment

---

## Comandos Úteis

```bash
# Reiniciar um deployment
kubectl rollout restart deployment/api-weather -n temperaturaapp

# Ver logs de um pod
kubectl logs -f deployment/api-weather -n temperaturaapp

# Entrar em um pod
kubectl exec -it deployment/api-weather -n temperaturaapp -- sh

# Port-forward manual
kubectl port-forward svc/grafana 3000:3000 -n temperaturaapp

# Deletar tudo e recomeçar
kubectl delete namespace temperaturaapp
kubectl apply -f k8s/

# Status do Minikube
minikube status
minikube dashboard
```

---

## Conceitos Aplicados

| Conceito | Tecnologia | Onde |
|----------|-----------|------|
| Microsserviços | Node.js | 3 APIs independentes |
| Containerização | Docker | Dockerfile por serviço |
| Orquestração | Kubernetes/Minikube | k8s/ |
| Event-Driven | RabbitMQ | Publicação de eventos por API |
| Message Queue | RabbitMQ AMQP | audit-queue, analytics-queue |
| Cache | Redis | weather, location, CSV export |
| Banco de dados NoSQL | MongoDB | JSON das consultas |
| Banco de dados relacional | SQLite | Log de transações |
| Observabilidade | Prometheus + Grafana | Métricas, dashboards |
| Tracing distribuído | OpenTelemetry | Traces entre serviços |
| CI/CD | GitHub Actions | .github/workflows/ |
| Ingress Controller | nginx | Roteamento de URLs |

---

## Variáveis de Ambiente (.env.example)

```bash
# APIs externas
OPENWEATHER_API_KEY=your_key_here
WEATHER_API_KEY=your_key_here

# Infraestrutura (para desenvolvimento local)
RABBITMQ_URL=amqp://guest:guest@localhost:5672
MONGODB_URI=mongodb://localhost:27017/temperaturadb
REDIS_URL=redis://localhost:6379
SQLITE_PATH=./data/transactions.db

# OpenTelemetry
OTEL_SERVICE_NAME=api-weather
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Kubernetes namespace
K8S_NAMESPACE=temperaturaapp
```

---

## Troubleshooting

**Minikube não inicia no Windows**:
```powershell
minikube delete
minikube start --driver=hyperv  # ou --driver=docker
```

**Imagem não encontrada no cluster**:
```powershell
# Certificar que o contexto Docker está apontando para Minikube
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
# Rebuildar com imagePullPolicy: Never nos manifests
```

**RabbitMQ connection refused**:
```bash
kubectl get pods -n temperaturaapp | grep rabbitmq
kubectl describe pod rabbitmq-xxx -n temperaturaapp
# Aguardar readiness probe passar (~30s)
```

**Redis sem espaço**:
```bash
kubectl exec -it deployment/redis -n temperaturaapp -- redis-cli
FLUSHDB  # limpa banco atual
```

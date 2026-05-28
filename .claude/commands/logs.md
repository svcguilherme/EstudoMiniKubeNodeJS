# logs — Ver logs de um serviço

Exibe os logs de um serviço específico rodando no Minikube, com opção de follow.

## Uso

`/logs <serviço> [--follow] [--lines=N]`

Serviços válidos: `api-weather`, `api-location`, `api-person`, `frontend`, `rabbitmq`, `mongodb`, `redis`, `prometheus`, `grafana`, `otel-collector`

## Passos

1. Identificar o pod do serviço: `kubectl get pods -n temperaturaapp | grep <serviço>`
2. Se `--follow` ou `-f` foi passado: `kubectl logs -f deployment/<serviço> -n temperaturaapp`
3. Se `--lines=N` foi passado: `kubectl logs --tail=N deployment/<serviço> -n temperaturaapp`
4. Default (sem flags): últimas 50 linhas: `kubectl logs --tail=50 deployment/<serviço> -n temperaturaapp`
5. Se o pod tiver múltiplos containers, listar com `kubectl get pod <pod-name> -n temperaturaapp -o jsonpath='{.spec.containers[*].name}'` e perguntar qual container

## Dicas de diagnóstico

- Para ver logs de pods que crasharam: `kubectl logs --previous deployment/<serviço> -n temperaturaapp`
- Para filtrar erros: pipe com `| Select-String "ERROR"` (PowerShell) ou `| grep -i error` (bash)
- Para RabbitMQ, mostrar também `kubectl exec -it deployment/rabbitmq -n temperaturaapp -- rabbitmqctl list_queues`

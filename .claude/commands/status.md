# status — Estado completo do cluster

Exibe um resumo do estado de todos os componentes do projeto no Minikube.

## O que verificar

1. Status geral do Minikube: `minikube status`
2. Todos os pods do namespace: `kubectl get pods -n temperaturaapp -o wide`
3. Todos os services: `kubectl get services -n temperaturaapp`
4. Ingress: `kubectl get ingress -n temperaturaapp`
5. PersistentVolumeClaims: `kubectl get pvc -n temperaturaapp`
6. Uso de recursos: `kubectl top pods -n temperaturaapp` (requer metrics-server)
7. Eventos recentes de erro: `kubectl get events -n temperaturaapp --sort-by=.lastTimestamp | tail -20`
8. URLs de acesso: `minikube service list -n temperaturaapp`

## Formato de saída esperado

Apresentar em seções claras:
- **Pods**: tabela com nome, status (Running/Pending/Error), restarts, age
- **Services**: tabela com nome, tipo, porta, IP externo
- **Problemas detectados**: pods com status != Running, alta contagem de restarts (>5), PVCs não bound
- **URLs de acesso**: lista clicável de todos os serviços expostos

Destacar qualquer pod em estado de erro ou CrashLoopBackOff e sugerir comando de diagnóstico.

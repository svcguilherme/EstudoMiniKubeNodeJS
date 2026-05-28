# start — Inicializar ambiente Minikube completo

Inicializa o Minikube, configura o contexto Docker, faz build de todas as imagens e faz deploy de todos os serviços no cluster.

## Passos

1. Verificar se Minikube está rodando: `minikube status`
2. Se não estiver: `minikube start --memory=4096 --cpus=4 --driver=docker`
3. Habilitar addons necessários: `minikube addons enable ingress` e `minikube addons enable metrics-server`
4. Configurar contexto Docker para o Minikube (Windows PowerShell): `& minikube -p minikube docker-env --shell powershell | Invoke-Expression`
5. Build de todas as imagens Docker:
   - `docker build -t api-weather:local ./api-weather`
   - `docker build -t api-location:local ./api-location`
   - `docker build -t api-person:local ./api-person`
   - `docker build -t frontend:local ./frontend`
6. Aplicar todos os manifests Kubernetes em ordem:
   - `kubectl apply -f k8s/namespace.yaml`
   - `kubectl apply -f k8s/configmaps/`
   - `kubectl apply -f k8s/volumes/`
   - `kubectl apply -f k8s/deployments/`
   - `kubectl apply -f k8s/services/`
   - `kubectl apply -f k8s/ingress/`
7. Aguardar todos os pods ficarem Ready: `kubectl wait --for=condition=ready pod --all -n temperaturaapp --timeout=120s`
8. Exibir URLs de acesso: `minikube service list -n temperaturaapp`

Se algum passo falhar, reportar o erro com o nome do serviço afetado e sugerir o comando de diagnóstico adequado (`kubectl describe pod`, `kubectl logs`).

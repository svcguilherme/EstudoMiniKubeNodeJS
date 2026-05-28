# deploy — Rebuild e redeploy de um serviço específico

Reconstrói a imagem Docker de um serviço e atualiza o deployment no Minikube sem derrubar o cluster inteiro.

## Uso

`/deploy <serviço>`

Onde `<serviço>` pode ser: `api-weather`, `api-location`, `api-person`, `frontend`, `all`

## Passos

1. Validar que o argumento passado é um serviço válido
2. Garantir que o contexto Docker está no Minikube: `& minikube -p minikube docker-env --shell powershell | Invoke-Expression`
3. Build da imagem com tag `:local`:
   - `docker build -t <serviço>:local ./<serviço>`
4. Forçar rollout do deployment:
   - `kubectl rollout restart deployment/<serviço> -n temperaturaapp`
5. Aguardar rollout completar:
   - `kubectl rollout status deployment/<serviço> -n temperaturaapp`
6. Se `all`, repetir para todos os serviços: api-weather, api-location, api-person, frontend

Se o serviço não existir como deployment, listar os deployments disponíveis com `kubectl get deployments -n temperaturaapp`.

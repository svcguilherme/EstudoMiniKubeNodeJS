# teardown — Destruir ambiente do cluster

Remove todos os recursos do namespace `temperaturaapp` do cluster Minikube. Use quando quiser recomeçar do zero ou liberar recursos.

## Níveis de destruição

`/teardown` — Remove apenas o namespace e seus recursos (mantém Minikube rodando)
`/teardown --all` — Remove o namespace + para o Minikube
`/teardown --hard` — Deleta o cluster Minikube completamente (`minikube delete`)

## Passos para `/teardown` (padrão)

1. Confirmar com o usuário antes de prosseguir (ação destrutiva e irreversível para dados persistidos)
2. `kubectl delete namespace temperaturaapp`
3. Aguardar deleção: `kubectl get namespace temperaturaapp` (repetir até 404)
4. Confirmar: "Namespace deletado. Minikube ainda está rodando. Use /start para recriar o ambiente."

## Passos para `/teardown --all`

1. Confirmar com o usuário
2. Deletar namespace: `kubectl delete namespace temperaturaapp`
3. Parar Minikube: `minikube stop`
4. Confirmar: "Ambiente parado. Use /start para reiniciar."

## Passos para `/teardown --hard`

1. Confirmar com o usuário duas vezes (ação mais destrutiva — apaga o cluster inteiro)
2. `minikube delete`
3. Confirmar: "Cluster deletado. Use /start para recriar do zero."

## Aviso

Dados no SQLite (PersistentVolume) e MongoDB serão perdidos ao deletar o namespace, a menos que tenham sido exportados previamente.

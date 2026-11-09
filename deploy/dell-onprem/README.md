# TREK on dell-onprem (microk8s)

Namespace `trek`, separate from `greenhouse-local`. No LoadBalancer (MetalLB pool
10.0.0.240-245 is fully used); reached over the tailnet at https://trek.tail3f6a05.ts.net.
Run kubectl on the host as `microk8s kubectl` so it can never hit the GKE contexts.

## 1. Image (from the Mac)
    docker save trek-app:latest | ssh dislev@dell-onprem 'microk8s ctr image import -'
    # then tag it to match values-dell.yaml (ctr keeps the original name; adjust `tag` to what `microk8s ctr images ls | grep trek` shows)

## 2. Namespace, secret, quota
    ssh dislev@dell-onprem
    microk8s kubectl create namespace trek
    # on the Mac: scp /Users/dislev/repos/TREK/data/.encryption_key dislev@dell-onprem:/tmp/enc
    microk8s kubectl -n trek create secret generic trek-secrets --from-file=ENCRYPTION_KEY=/tmp/enc && shred -u /tmp/enc
    microk8s kubectl -n trek create quota trek-quota --hard=requests.cpu=1,requests.memory=1Gi,limits.cpu=1,limits.memory=1Gi,persistentvolumeclaims=3

## 3. Install, then stop it so the data can be copied in
    helm template/upgrade --install trek ./charts/trek -n trek -f deploy/dell-onprem/values-dell.yaml
    microk8s kubectl -n trek scale deploy/trek --replicas=0

## 4. Data (stop the Mac container first: `docker compose stop` in ~/repos/TREK)
    # fresh consistent copy of the DB, then rsync data/ and uploads/ into the two PVC host paths
    # (see `microk8s kubectl get pv`, hostpath under /var/snap/microk8s/common/default-storage/)
    # chown the copied files to 1000:1000; the pod's fsGroup also handles this on start.

## 5. Start and publish
    microk8s kubectl -n trek scale deploy/trek --replicas=1
    microk8s kubectl apply -f deploy/dell-onprem/ingress-tailnet.yaml

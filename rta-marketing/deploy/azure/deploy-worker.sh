#!/usr/bin/env bash
set -Eeuo pipefail

IMAGE_REF="${1:?Usage: deploy-worker.sh <image-ref>}"
WORKER_DIR="${RTA_WORKER_DIR:-$HOME/rta-worker}"
ENV_FILE="$WORKER_DIR/.env"
CONTAINER_NAME="rta-worker"
PREVIOUS_CONTAINER="rta-worker-previous"
PREVIOUS_IMAGE_FILE="$WORKER_DIR/previous-image"
IMAGE_REPOSITORY="${IMAGE_REF%:*}"
STARTUP_TIMEOUT_SECONDS="${RTA_WORKER_STARTUP_TIMEOUT_SECONDS:-90}"

log() { printf '[rta-worker] %s\n' "$*"; }

if [[ ! -f "$ENV_FILE" ]]; then
  log "missing production environment file: $ENV_FILE"
  exit 1
fi

previous_image=""
rollback_image=""
if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  previous_image="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER_NAME")"
  previous_image_id="$(docker inspect --format '{{.Image}}' "$CONTAINER_NAME")"
  if [[ -f "$PREVIOUS_IMAGE_FILE" ]] && [[ "$(cat "$PREVIOUS_IMAGE_FILE")" != "$previous_image" ]]; then
    docker image rm "$(cat "$PREVIOUS_IMAGE_FILE")" >/dev/null 2>&1 || true
  fi
  rollback_image="rta-worker:rollback-$(date +%s)"
  docker image tag "$previous_image_id" "$rollback_image"
  printf '%s\n' "$rollback_image" > "$PREVIOUS_IMAGE_FILE"
fi

docker pull "$IMAGE_REF"

docker rm -f "$PREVIOUS_CONTAINER" >/dev/null 2>&1 || true
if [[ -n "$previous_image" ]]; then
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rename "$CONTAINER_NAME" "$PREVIOUS_CONTAINER"
fi

rollback() {
  trap - ERR
  log "candidate failed validation; restoring previous worker"
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  if docker inspect "$PREVIOUS_CONTAINER" >/dev/null 2>&1; then
    docker rename "$PREVIOUS_CONTAINER" "$CONTAINER_NAME"
    docker start "$CONTAINER_NAME" >/dev/null
    log "previous worker restored: $(docker inspect --format '{{.Config.Image}}' "$CONTAINER_NAME")"
  else
    log "no previous worker was available"
  fi
  exit 1
}

trap rollback ERR

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --init \
  --env-file "$ENV_FILE" \
  --health-cmd='test -f /tmp/rta-worker-ready' \
  --health-interval=10s \
  --health-timeout=5s \
  --health-retries=6 \
  "$IMAGE_REF" >/dev/null

for ((second = 1; second <= STARTUP_TIMEOUT_SECONDS; second += 1)); do
  running="$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)"
  if [[ "$running" != "true" ]]; then
    docker logs --tail=100 "$CONTAINER_NAME" || true
    exit 1
  fi

  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' "$CONTAINER_NAME")"
  logs="$(docker logs "$CONTAINER_NAME" 2>&1 || true)"
  if [[ "$health" == "healthy" ]] && grep -q "scraping worker started" <<<"$logs" && grep -q 'database.*connected' <<<"$logs" && grep -q 'redis.*connected' <<<"$logs"; then
    restart_count="$(docker inspect --format '{{.RestartCount}}' "$CONTAINER_NAME")"
    if [[ "$restart_count" != "0" ]]; then
      log "candidate restarted $restart_count times during startup"
      exit 1
    fi
    break
  fi
  sleep 1
  if (( second == STARTUP_TIMEOUT_SECONDS )); then
    docker logs --tail=150 "$CONTAINER_NAME" || true
    exit 1
  fi
done

trap - ERR
docker rm -f "$PREVIOUS_CONTAINER" >/dev/null 2>&1 || true
docker image prune -f >/dev/null
while read -r image_ref _image_id; do
  [[ "$image_ref" == "$IMAGE_REF" || "$image_ref" == "$rollback_image" ]] && continue
  docker image rm "$image_ref" >/dev/null 2>&1 || true
done < <(docker image ls "$IMAGE_REPOSITORY" --format '{{.Repository}}:{{.Tag}} {{.ID}}')
log "worker deployed successfully: $IMAGE_REF"
docker inspect --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}} image={{.Config.Image}}' "$CONTAINER_NAME"

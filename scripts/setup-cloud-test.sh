#!/usr/bin/env bash
set -Eeuo pipefail

# Prepare a cloud/ephemeral Linux workspace for testing Legacy Spec Agent.
# The script is intentionally idempotent: it can be re-run after a container
# restart to refresh dependencies, rebuild the connector, and run smoke tests.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONNECTOR_DIR="${ROOT_DIR}/connector"
NODE_MAJOR_MIN=20
RUN_TESTS="${RUN_TESTS:-1}"
REGISTER_CODEX_MARKETPLACE="${REGISTER_CODEX_MARKETPLACE:-0}"

log() {
  printf '\033[1;34m[cloud-setup]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[cloud-setup:warn]\033[0m %s\n' "$*" >&2
}

fail() {
  printf '\033[1;31m[cloud-setup:error]\033[0m %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' is not installed. Install it in the cloud image first."
}

node_major() {
  node -p "Number(process.versions.node.split('.')[0])"
}

log "Repository root: ${ROOT_DIR}"
need_cmd git
need_cmd node
need_cmd npm

actual_node_major="$(node_major)"
if (( actual_node_major < NODE_MAJOR_MIN )); then
  fail "Node.js ${NODE_MAJOR_MIN}+ is required, but found $(node --version). Use the cloud image's Node version manager to select Node ${NODE_MAJOR_MIN} or newer."
fi
log "Using Node $(node --version) and npm $(npm --version)"

if [[ ! -f "${CONNECTOR_DIR}/package-lock.json" ]]; then
  fail "Cannot find connector/package-lock.json. Run this script from a complete repository checkout."
fi

log "Installing connector dependencies with npm ci"
(
  cd "${CONNECTOR_DIR}"
  npm ci
)

log "Building connector"
(
  cd "${CONNECTOR_DIR}"
  npm run build
)

if [[ "${RUN_TESTS}" != "0" ]]; then
  log "Running connector tests"
  (
    cd "${CONNECTOR_DIR}"
    npm test
  )
else
  warn "Skipping tests because RUN_TESTS=0"
fi

if [[ "${REGISTER_CODEX_MARKETPLACE}" == "1" ]]; then
  if command -v codex >/dev/null 2>&1; then
    log "Registering this checkout as a local Codex plugin marketplace"
    codex plugin marketplace add "${ROOT_DIR}"
  else
    warn "REGISTER_CODEX_MARKETPLACE=1 was set, but the codex CLI is not installed."
  fi
fi

cat <<SUMMARY

Cloud test environment is ready.

Useful commands:
  cd ${CONNECTOR_DIR}
  npm test

Optional toggles:
  RUN_TESTS=0 scripts/setup-cloud-test.sh                 # install/build only
  REGISTER_CODEX_MARKETPLACE=1 scripts/setup-cloud-test.sh # also register local Codex marketplace when codex CLI exists
SUMMARY

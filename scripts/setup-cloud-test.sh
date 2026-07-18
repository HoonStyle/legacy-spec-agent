#!/usr/bin/env bash
set -Eeuo pipefail

# Prepare a cloud/ephemeral Linux workspace for testing Legacy Spec Agent.
# The script is intentionally idempotent: it can be re-run after a container
# restart to refresh dependencies, rebuild the connector, and run smoke tests.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONNECTOR_DIR="${ROOT_DIR}/connector"
CODEX_MARKETPLACE_FILE="${ROOT_DIR}/.agents/plugins/marketplace.json"
NODE_MAJOR_MIN=20
RUN_TESTS="${RUN_TESTS:-1}"
REGISTER_CODEX_MARKETPLACE="${REGISTER_CODEX_MARKETPLACE:-0}"
CODEX_NPM_PACKAGE="${CODEX_NPM_PACKAGE:-@openai/codex}"

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
  if [[ ! -f "${CODEX_MARKETPLACE_FILE}" ]]; then
    fail "Cannot find .agents/plugins/marketplace.json. Run this script from a complete plugin checkout."
  fi

  CODEX_MARKETPLACE_NAME="$(node -e "const fs = require('node:fs'); const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(m.name);" "${CODEX_MARKETPLACE_FILE}")"
  CODEX_PLUGIN_NAME="$(node -e "const fs = require('node:fs'); const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(m.plugins[0].name);" "${CODEX_MARKETPLACE_FILE}")"
  CODEX_PLUGIN_SELECTOR="${CODEX_PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}"

  if command -v codex >/dev/null 2>&1; then
    CODEX_CMD=(codex)
  else
    log "codex CLI is not installed; using npx ${CODEX_NPM_PACKAGE} for one-shot plugin setup"
    CODEX_CMD=(npx -y "${CODEX_NPM_PACKAGE}")
  fi

  log "Registering this checkout as a local Codex plugin marketplace"
  "${CODEX_CMD[@]}" plugin marketplace add "${ROOT_DIR}"

  log "Installing ${CODEX_PLUGIN_SELECTOR} from the local Codex marketplace"
  "${CODEX_CMD[@]}" plugin add "${CODEX_PLUGIN_SELECTOR}"
fi

cat <<SUMMARY

Cloud test environment is ready.

Useful commands:
  cd ${CONNECTOR_DIR}
  npm test

Optional toggles:
  RUN_TESTS=0 scripts/setup-cloud-test.sh                  # install/build only
  REGISTER_CODEX_MARKETPLACE=1 scripts/setup-cloud-test.sh  # also register and install the local Codex plugin
  CODEX_NPM_PACKAGE=@openai/codex@0.144.5 REGISTER_CODEX_MARKETPLACE=1 scripts/setup-cloud-test.sh
SUMMARY

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
APP_NAME="$(basename "${PROJECT_DIR}")"
PID_FILE="${SCRIPT_DIR}/.webapplab-http-server.pid"
URL_FILE="${SCRIPT_DIR}/.webapplab-http-server.urls"
LOG_FILE="${SCRIPT_DIR}/webapplab-http-server.log"
GRACE_SECONDS="${GRACE_SECONDS:-10}"

is_running() {
  local pid="$1"
  [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null
}

# Signal the whole process group first (the dev server spawns helper children,
# e.g. esbuild), then fall back to the single PID if it isn't a group leader.
term_pid() {
  local pid="$1"
  kill -TERM -- "-${pid}" 2>/dev/null || kill -TERM "${pid}" 2>/dev/null || true
}

force_pid() {
  local pid="$1"
  kill -KILL -- "-${pid}" 2>/dev/null || kill -KILL "${pid}" 2>/dev/null || true
}

if [[ ! -f "${PID_FILE}" ]]; then
  echo "Aplicação ${APP_NAME} não está em execução (PID file ausente)."
  exit 0
fi

pid="$(tr -d '[:space:]' < "${PID_FILE}")"
if [[ -z "${pid}" ]]; then
  rm -f "${PID_FILE}"
  echo "PID file inválido. Estado local foi limpo."
  exit 0
fi

if ! is_running "${pid}"; then
  rm -f "${PID_FILE}" "${URL_FILE}"
  echo "Aplicação ${APP_NAME} já estava parada."
  exit 0
fi

echo "Encerrando ${APP_NAME} (PID ${pid})..."
term_pid "${pid}"

for _ in $(seq 1 "${GRACE_SECONDS}"); do
  if ! is_running "${pid}"; then
    rm -f "${PID_FILE}" "${URL_FILE}"
    echo "Aplicação encerrada com sucesso."
    echo "Log: ${LOG_FILE}"
    exit 0
  fi
  sleep 1
done

echo "Processo ainda ativo após ${GRACE_SECONDS}s. Forçando encerramento..."
force_pid "${pid}"
sleep 1

if is_running "${pid}"; then
  echo "Erro: não foi possível encerrar o processo ${pid}."
  exit 1
fi

rm -f "${PID_FILE}" "${URL_FILE}"
echo "Aplicação encerrada com sucesso após kill -9."
echo "Log: ${LOG_FILE}"

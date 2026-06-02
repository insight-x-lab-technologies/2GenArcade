#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
APP_NAME="$(basename "${PROJECT_DIR}")"
PORT="${PORT:-${WEBAPPLAB_PORT:-8080}}"
SERVE_DIR="${SERVE_DIR:-${PROJECT_DIR}/src}"
PID_FILE="${SCRIPT_DIR}/.webapplab-http-server.pid"
URL_FILE="${SCRIPT_DIR}/.webapplab-http-server.urls"
LOG_FILE="${SCRIPT_DIR}/webapplab-http-server.log"
PYTHON_BIN="${PYTHON_BIN:-/usr/bin/python3}"

is_running() {
  local pid="$1"
  [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null
}

start_server() {
  if command -v setsid >/dev/null 2>&1; then
    nohup setsid "${PYTHON_BIN}" -m http.server "${PORT}" --directory "${SERVE_DIR}" --bind 0.0.0.0 \
      < /dev/null >> "${LOG_FILE}" 2>&1 &
  else
    nohup "${PYTHON_BIN}" -m http.server "${PORT}" --directory "${SERVE_DIR}" --bind 0.0.0.0 \
      < /dev/null >> "${LOG_FILE}" 2>&1 &
  fi

  echo "$!"
}

collect_urls() {
  local port="$1"
  local -a urls
  local ipaddr
  local primary_ip

  urls=("http://127.0.0.1:${port}" "http://localhost:${port}")

  if command -v ip >/dev/null 2>&1; then
    primary_ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}')"
    if [[ -n "${primary_ip}" ]] && [[ "${primary_ip}" != 127.* ]] && [[ "${primary_ip}" != *:* ]]; then
      urls+=("http://${primary_ip}:${port}")
    fi

    while read -r ipaddr; do
      [[ -z "${ipaddr}" ]] && continue
      [[ "${ipaddr}" == 127.* ]] && continue
      [[ "${ipaddr}" == *:* ]] && continue
      urls+=("http://${ipaddr}:${port}")
    done < <(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1)
  elif command -v hostname >/dev/null 2>&1; then
    while read -r ipaddr; do
      [[ -z "${ipaddr}" ]] && continue
      [[ "${ipaddr}" == 127.* ]] && continue
      [[ "${ipaddr}" == *:* ]] && continue
      urls+=("http://${ipaddr}:${port}")
    done < <(hostname -I 2>/dev/null | tr ' ' '\n')
  fi

  printf '%s\n' "${urls[@]}" | awk '!seen[$0]++'
}

print_runtime_summary() {
  local pid="$1"

  echo "Aplicação: ${APP_NAME}"
  echo "PID: ${pid}"
  echo "Porta: ${PORT}"
  echo "Diretório servido: ${SERVE_DIR}"
  echo "Log: ${LOG_FILE}"
  echo "URLs:"
  cat "${URL_FILE}"
}

if [[ ! -d "${SERVE_DIR}" ]]; then
  echo "Erro: diretório a ser servido não encontrado: ${SERVE_DIR}"
  exit 1
fi

if [[ -f "${PID_FILE}" ]]; then
  existing_pid="$(tr -d '[:space:]' < "${PID_FILE}")"
  if is_running "${existing_pid}"; then
    if [[ ! -f "${URL_FILE}" ]]; then
      collect_urls "${PORT}" > "${URL_FILE}"
    fi
    echo "Aplicação já está em execução."
    print_runtime_summary "${existing_pid}"
    exit 0
  fi
  rm -f "${PID_FILE}"
fi

mkdir -p "${SCRIPT_DIR}"
collect_urls "${PORT}" > "${URL_FILE}"

{
  echo
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando ${APP_NAME} na porta ${PORT}"
  echo "Diretório servido: ${SERVE_DIR}"
} >> "${LOG_FILE}"

cd "${PROJECT_DIR}"
server_pid="$(start_server)"
echo "${server_pid}" > "${PID_FILE}"

sleep 1
if ! is_running "${server_pid}"; then
  echo "Erro: falha ao iniciar a aplicação."
  echo "Consulte o log: ${LOG_FILE}"
  tail -n 20 "${LOG_FILE}" 2>/dev/null || true
  rm -f "${PID_FILE}"
  exit 1
fi

echo "Aplicação iniciada com sucesso."
print_runtime_summary "${server_pid}"

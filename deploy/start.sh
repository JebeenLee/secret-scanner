#!/bin/sh
set -e

# Render 등은 PORT 환경변수를 주입한다. 기본값 보정.
export PORT="${PORT:-10000}"
export BACKEND_PORT="${BACKEND_PORT:-4000}"

# nginx 설정 생성 (${PORT}, ${BACKEND_PORT} 만 치환 — nginx 내장 변수 $host 등은 보존)
envsubst '${PORT} ${BACKEND_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# 백엔드(Express)를 내부 포트로 기동
PORT="$BACKEND_PORT" node /app/backend/src/index.js &

# 백엔드가 응답할 때까지 대기 (nginx가 부팅 중 502 내지 않도록, 최대 ~20초)
i=0
while [ "$i" -lt 20 ]; do
  if wget -q -O /dev/null "http://127.0.0.1:${BACKEND_PORT}/api/health" 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

# nginx 포그라운드 실행 (컨테이너 메인 프로세스)
nginx -g 'daemon off;'

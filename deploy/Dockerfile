# 배포용 단일 컨테이너 — nginx(정적 서빙 + /api 프록시) + Express 를 함께 실행
# (로컬 개발은 루트 docker-compose.yml 의 멀티 컨테이너 구성을 사용)

# ---- 1) 프론트엔드 빌드 ----
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2) 백엔드 의존성 ----
FROM node:22-alpine AS backend
WORKDIR /be
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./

# ---- 3) 런타임: nginx + node ----
FROM node:22-alpine
RUN apk add --no-cache nginx gettext
WORKDIR /app

# 백엔드 + 의존성
COPY --from=backend /be /app/backend
# 프론트엔드 정적 빌드
COPY --from=frontend /fe/dist /usr/share/nginx/html
# nginx 템플릿 + 시작 스크립트
COPY deploy/nginx.conf.template /etc/nginx/nginx.conf.template
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

ENV PORT=10000 BACKEND_PORT=4000
EXPOSE 10000
CMD ["/app/start.sh"]

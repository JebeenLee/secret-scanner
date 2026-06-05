# Secret Scanner

> 프론트엔드 코드에 하드코딩된 민감정보(시크릿)를 **배포 전에** 찾아내는 셀프 점검 도구

**배포(Live):** https://secret-scanner-vu9r.onrender.com

인천대학교 Web Programming 프로젝트 과제 (2026)

---

## 개요

프론트엔드 코드(JS 번들, 설정 파일)는 브라우저로 전송되는 순간 누구나 열어볼 수 있는 공개 자산이 됩니다. 그럼에도 API 키·시크릿 키·토큰을 코드에 하드코딩한 채 배포하는 사고가 끊이지 않고, 한 번 유출된 키는 클라우드 비용 폭탄·개인정보 유출·계정 탈취로 이어집니다.

**Secret Scanner**는 배포 전에 자신의 코드/설정 파일을 넣으면 그 안의 하드코딩된 시크릿을 찾아 경고하고, "이게 무엇이고 왜 위험하며 어떻게 고치는지"까지 알려주는 보안 경각심 도구입니다.

## 주요 기능

- **시크릿 탐지** — 코드에서 AWS·Google·GitHub·Slack·Stripe·OpenAI·JWT·Private Key 등 10종을 패턴 매칭 + 엔트로피 분석으로 검출
- **파일·폴더 입력** — 드래그앤드롭 또는 클릭으로 여러 파일/폴더 스캔 (node_modules·바이너리 자동 제외, 최대 5MB)
- **결과 표시** — 발견 위치를 라인 단위로 보여주되 값은 마스킹, 위험도와 함께 정체·영향·수정법 해설 제공
- **AI 보조 분석** — 마스킹된 코드 맥락(변수명·주석)을 바탕으로 Gemini가 진위(실제 시크릿 vs 예시)를 판정하고 수정법을 제안 (원문은 전송하지 않음)
- **익명 통계 대시보드** — 누적 발견된 시크릿 종류 분포 (원문 저장 없이 종류·개수만 집계, 전체 비우기 가능)
- **예제 체험** — 자기 코드가 없어도 샘플로 바로 스캔 체험

## 프라이버시 원칙

탐지는 **전부 사용자 브라우저 안에서** 수행합니다. 점검 대상 파일을 서버로 업로드하지 않습니다. *시크릿 노출을 막는 도구가, 정작 당신의 시크릿을 가져가지 않습니다.*

> 본 도구는 **사용자가 직접 넣은 파일/텍스트**만 분석하는 셀프 점검 도구입니다. 외부 URL 수집이나 타 사이트 점검 같은 능동적 기능은 제공하지 않습니다. AI 분석에도 원문이 아닌 **마스킹된 값·코드 맥락**만 전송합니다.

## 기술 스택

| 구분 | 사용 기술 |
|---|---|
| Frontend | React (Vite) |
| Backend | Node.js, Express |
| AI / API | Google Gemini (`@ai-sdk/google`, AI SDK), Zod |
| Storage | Web Storage(localStorage) + PostgreSQL |
| Infra | Nginx (Reverse Proxy), Docker (docker-compose) |
| 배포 / CI/CD | Render + Render PostgreSQL, GitHub Actions |

## 프로젝트 구조

```
secret-scanner/
├── frontend/           # React (Vite) — 탐지 엔진 + UI (브라우저에서 분석)
│   ├── src/lib/detector.js   # 패턴 매칭 + 엔트로피 탐지
│   ├── nginx.conf            # 정적 서빙 + /api 리버스 프록시
│   └── Dockerfile            # build → nginx 멀티스테이지
├── backend/            # Express API — 백과사전 / 통계 / AI
│   ├── src/index.js          # 라우트 (탐지 백과사전·통계·AI 검증)
│   ├── src/secretTypes.js    # 시크릿 종류 백과사전
│   └── src/db.js             # PostgreSQL 연결
├── docker-compose.yml  # 로컬 스택: nginx(web) + backend + PostgreSQL(db)
├── deploy/             # 배포용 단일 컨테이너 (nginx + Express)
├── render.yaml         # Render Blueprint (웹 서비스 + PostgreSQL 자동 생성)
└── .github/workflows/  # GitHub Actions CI/CD
```

## 실행 방법

### 로컬 개발

```bash
# 백엔드 (터미널 1)
cd backend && npm install && npm run dev    # http://localhost:4000

# 프론트엔드 (터미널 2)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

> AI 보조 분석을 쓰려면 `backend/.env`에 `GOOGLE_GENERATIVE_AI_API_KEY` 를 설정하세요 (https://aistudio.google.com 에서 발급). 미설정 시 AI 버튼만 비활성이며 나머지 기능은 정상 동작합니다.

### Docker (전체 스택)

```bash
cp .env.example .env          # 필요 시 GOOGLE_GENERATIVE_AI_API_KEY 입력
docker compose up --build     # http://localhost:8080
```

## 배포

- **Render Blueprint**(`render.yaml`)로 웹 서비스 + 관리형 PostgreSQL 자동 생성, `DATABASE_URL` 자동 연결
- **GitHub Actions**로 push 시 빌드 검사 + 배포 트리거
- AI 키는 Render 환경변수 `GOOGLE_GENERATIVE_AI_API_KEY` 로 주입

## License

MIT

// 시크릿 종류 백과사전 (스켈레톤 데이터 — 추후 PostgreSQL로 이전)
// 각 항목: 정체(what) / 노출 영향(impact) / 수정법(fix)
export const SECRET_TYPES = [
  {
    id: 'aws_access_key',
    name: 'AWS Access Key',
    risk: 'critical',
    what: 'AWS 계정의 액세스 키 ID. IAM 권한에 따라 클라우드 리소스를 제어한다.',
    impact: '유출 시 EC2 무단 생성(암호화폐 채굴), 데이터 유출, 막대한 요금 청구로 이어질 수 있다.',
    fix: '즉시 키를 폐기(rotate)하고 서버 환경변수/시크릿 매니저로 옮긴다. 프론트엔드에는 절대 두지 않는다.',
  },
  {
    id: 'google_api_key',
    name: 'Google API Key',
    risk: 'high',
    what: 'Google Cloud / Maps 등 API 호출에 사용되는 키.',
    impact: '무단 호출로 인한 과금, 할당량 소진, 서비스 남용이 발생할 수 있다.',
    fix: '키에 도메인/IP 제한과 API 범위 제한을 걸고, 노출된 키는 재발급한다.',
  },
  {
    id: 'github_token',
    name: 'GitHub Personal Access Token',
    risk: 'high',
    what: 'GitHub 리포지토리·계정에 접근하는 개인 액세스 토큰.',
    impact: '비공개 코드 유출, 코드 변조, 공급망 공격의 발판이 될 수 있다.',
    fix: '토큰을 즉시 revoke 하고 최소 권한으로 재발급한다.',
  },
  {
    id: 'jwt',
    name: 'JSON Web Token',
    risk: 'medium',
    what: '인증/세션 정보를 담은 서명된 토큰.',
    impact: '유효한 토큰이 노출되면 세션 탈취·권한 도용이 가능하다.',
    fix: '토큰을 코드에 하드코딩하지 말고, 만료 시간을 짧게 두며 노출 시 키를 회전한다.',
  },
  {
    id: 'private_key',
    name: 'Private Key',
    risk: 'critical',
    what: 'RSA/EC 등 비대칭 암호의 개인키.',
    impact: '서명 위조, 암호화 트래픽 복호화, 서버 신원 도용이 가능하다.',
    fix: '개인키는 절대 클라이언트에 포함하지 않으며, 노출 시 즉시 폐기·재발급한다.',
  },
  {
    id: 'generic_secret',
    name: 'Generic Secret',
    risk: 'medium',
    what: 'api_key / secret / token / password 형태로 하드코딩된 일반 비밀값.',
    impact: '연결된 서비스에 따라 데이터 접근·계정 탈취로 이어질 수 있다.',
    fix: '환경변수로 분리하고 .gitignore 처리하며, 노출된 값은 폐기한다.',
  },
];

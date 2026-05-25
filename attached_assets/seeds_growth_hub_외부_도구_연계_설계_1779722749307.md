# Seeds GrowthHub - 외부 도구 연계 설계

## 1. 문서 목적

이 문서는 Seeds GrowthHub가 GitHub, Discord, Google Drive/Notion, Calendar, Email/SMS, Jira/Linear, Object Storage 등 외부 도구와 어떤 방식으로 연결될지 정의한다.

이 문서의 핵심은 GrowthHub가 외부 도구를 무리하게 대체하지 않고, Seeds 관점에서 필요한 운영·성장 메타데이터와 연결 맥락을 관리하도록 범위를 제한하는 것이다.

## 2. 기본 원칙

1. GrowthHub는 외부 도구를 대체하지 않는다.
2. 외부 도구가 더 잘하는 일은 외부 도구에 남긴다.
3. GrowthHub는 Seeds 관점의 메타데이터, 결정사항, 산출물 링크, 상태 신호, 권한 맥락을 관리한다.
4. 초기에는 링크 기반 연동을 우선한다.
5. API 연동은 실제 필요성과 운영 신뢰가 확인된 뒤 확장한다.
6. 자동 수집은 감시처럼 보일 수 있으므로 신중히 한다.
7. 연동 데이터는 평가가 아니라 운영, 피드백, 회고, 맥락 파악을 위한 보조 신호로 사용한다.
8. 연동 실패 시 GrowthHub 핵심 기능이 멈추지 않아야 한다.

## 3. Source of Truth 정책

| 영역 | Source of Truth | GrowthHub 역할 |
|---|---|---|
| 코드/PR/Issue | GitHub | 프로젝트와 산출물에 연결되는 링크와 메타데이터 관리 |
| 실시간 대화 | Discord | 주요 채널, 공지, 결정 링크 관리 |
| 기존 문서/외부 공유 | Google Drive / Notion | 문서 링크, 소유자, 최신 여부, 연결 객체 관리 |
| 내부 운영 문서 | GrowthHub Markdown DB | 문서 본문, 버전, 권한, 연결 객체 관리 |
| 공식 제출 문서 | Google Drive 또는 파일 첨부 | 링크/첨부와 맥락 관리 |
| 운영 일정 | 초기에는 GrowthHub | 필요 시 Calendar export/sync |
| 이메일 발송 이력 | GrowthHub | 발송 대상, 템플릿, 성공/실패 이력 관리 |
| 첨부파일/영수증 | Object Storage | 파일 URL, 권한, 연결 객체 관리 |

## 4. GitHub 연계

### 4.1 목적

GitHub는 개발 프로젝트의 코드, PR, Issue, Release, README가 존재하는 원본 도구다. GrowthHub는 GitHub를 평가 도구가 아니라 산출물·협업 흔적·기술 활동 증거의 연결점으로 사용한다.

### 4.2 MVP 범위

- Repository URL 수동 등록
- 주요 PR 링크 등록
- 주요 Issue 링크 등록
- README 링크 등록
- Release 링크 등록
- Demo URL 등록
- 프로젝트/산출물과 연결

### 4.3 확장 범위

- GitHub API로 최근 activity 조회
- contributors 조회
- PR/Issue 수집
- release 정보 수집
- 코드리뷰 코멘트 수집

### 4.4 하지 않을 것

- 커밋 수로 성장 평가
- 기여도 자동 판정
- 학생별 랭킹
- GitHub 활동량 기반 성실도 판단

### 4.5 원칙

GitHub 지표는 평가 점수가 아니라, 멘토링과 회고를 위한 대화 신호로만 사용한다.

## 5. Discord 연계

### 5.1 목적

Discord는 실시간 커뮤니케이션과 커뮤니티 분위기의 원본 도구다. GrowthHub는 Discord를 대체하지 않는다.

### 5.2 MVP 범위

- 서버 링크 등록
- 주요 채널 링크 등록
- 팀별 채널 링크 등록
- 주요 공지 링크 등록
- 운영진이 기록한 주요 결정사항 연결

### 5.3 확장 범위

- 특정 공지 채널의 공지 자동 기록
- 이벤트 리마인드
- 메시지 링크 저장

### 5.4 하지 않을 것

- 사적 대화 수집
- 학생별 메시지 수 추적
- 활동량 감시
- 메시지 기반 학생 평가

### 5.5 원칙

Discord 연동은 커뮤니케이션을 감시하기 위한 것이 아니라, 운영상 필요한 공지·결정·링크를 잃지 않기 위한 보조 수단이다.

## 6. Google Drive / Notion 연계

### 6.1 목적

Google Drive와 Notion은 기존 자료, 외부 공유 문서, 대용량 파일, 공식 제출 문서의 저장소로 활용할 수 있다.

### 6.2 MVP 범위

- 외부 문서 링크 등록
- 문서 유형 등록
- 연결 객체 설정: 기수, 행사, 회의, 프로젝트, 모집, 회계 등
- 소유자 등록
- 공개 범위 등록
- 최신 여부 수동 표시

### 6.3 확장 범위

- Drive API로 파일 메타데이터 조회
- 수정일 표시
- 권한 확인
- 링크 만료 또는 접근 불가 감지

### 6.4 하지 않을 것

- 모든 Drive 문서 복제
- Drive 권한 체계를 GrowthHub가 완전히 대체
- Notion 전체 워크스페이스 복제

### 6.5 원칙

내부 운영 문서는 GrowthHub Markdown을 source of truth로 두고, Drive/Notion은 외부 공유·기존 자료·공식 문서용으로 활용한다.

## 7. Calendar 연계

### 7.1 목적

Calendar 연계는 운영 일정, 회의, 행사, 면접, 정산 마감, 프로젝트 마일스톤을 놓치지 않기 위한 보조 기능이다.

### 7.2 MVP 범위

- GrowthHub 내부 일정 관리
- 일정 export
- 주요 일정 알림

### 7.3 확장 범위

- Google Calendar 단방향 sync
- 필요 시 양방향 sync 검토
- 면접 일정 자동 등록
- 행사 리마인드

### 7.4 하지 않을 것

- 개인 캘린더 전체 조회
- 사적 일정 수집
- 개인 일정 기반 자동 판단

### 7.5 원칙

초기에는 GrowthHub가 운영 일정의 source of truth가 되고, 외부 캘린더는 export 또는 단방향 sync 대상으로 둔다.

## 8. Email / SMS 연계

### 8.1 목적

Email/SMS는 모집, 평가, 행사, 중요공지의 발송과 이력 관리를 위한 도구다.

### 8.2 MVP 범위

- 이메일 템플릿
- 이메일 발송
- 발송 대상 관리
- 발송 성공/실패 이력
- 관련 객체 연결: 지원자, 행사, 회의, 과제 등

### 8.3 확장 범위

- SMS 발송
- 리마인드
- 실패 재시도
- 수신 확인
- 발송 예약

### 8.4 하지 않을 것

- 마케팅 자동화 플랫폼 수준의 복잡한 캠페인
- 불필요한 대량 발송
- 동의 없는 홍보성 발송

### 8.5 communication_logs 후보 필드

- id
- recipient_type
- recipient_id
- channel
- template_id
- related_object_type
- related_object_id
- sent_at
- status
- failure_reason
- created_by

## 9. Jira / Linear / Issue Tracker 연계

### 9.1 목적

학생 팀이 사용하는 Jira, Linear, GitHub Issues, Notion 보드는 세부 개발 이슈의 원본 도구로 둔다.

### 9.2 MVP 범위

- 외부 보드 링크 등록
- 프로젝트와 연결
- 운영진/멘토가 확인할 주요 마일스톤과 블로커만 GrowthHub에 기록

### 9.3 확장 범위

- issue count 조회
- milestone status 조회
- 매우 제한적인 상태 요약

### 9.4 하지 않을 것

- Jira 대체
- 스프린트 관리
- 학생 팀의 세부 개발 태스크 추적
- 이슈 처리량 기반 학생 평가

### 9.5 원칙

GrowthHub는 프로젝트 관리툴이 아니라 Seeds 관점의 프로젝트 성장·운영 메타 레이어다.

## 10. Object Storage

### 10.1 목적

영수증, 이미지, 첨부파일, 아바타, PDF/DOCX 첨부 등 파일을 저장한다.

### 10.2 MVP 범위

- 파일 업로드
- 파일 URL 저장
- 연결 객체 관리
- 권한 기반 접근

### 10.3 확장 범위

- 만료 URL
- 파일 접근 로그
- 용량 제한
- 바이러스 검사
- 파일 보관 정책

### 10.4 하지 않을 것

- Google Drive 전체 대체
- 외부 문서 저장소 전체 복제

## 11. 개인정보·감시 우려 원칙

| 영역 | 주의사항 |
|---|---|
| Discord | 사적 대화 수집 금지, 활동량 감시 금지 |
| GitHub | 커밋 수 기반 평가 금지 |
| Calendar | 개인 일정 수집 금지 |
| Email/SMS | 동의·목적·발송 이력 관리 필요 |
| Drive/Notion | 권한 불일치와 민감문서 노출 주의 |
| Object Storage | 영수증·개인정보 접근 제한 필요 |

## 12. 연동 실패 정책

- 외부 연동 실패 시 GrowthHub 핵심 기능이 중단되지 않아야 한다.
- 링크 기반 정보는 수동으로 수정 가능해야 한다.
- API 연동 데이터는 최신성 표시가 필요하다.
- 동기화 실패 시 마지막 성공 시각과 실패 사유를 기록한다.
- 연동 데이터는 원본 데이터의 복사본이 아니라 참조 또는 캐시로 취급한다.

## 13. 관련 데이터 객체 후보

| 객체 | 목적 |
|---|---|
| external_links | 외부 URL과 연결 객체 관리 |
| attachments | 업로드 파일 메타데이터 |
| integration_accounts | 외부 계정 연동 정보 |
| communication_logs | Email/SMS 발송 이력 |
| sync_logs | API sync 성공/실패 이력 |
| calendar_events | GrowthHub 내부 일정 |

## 14. 현재 판단

외부 연계의 초기 전략은 링크 기반 + 메타데이터 관리다. API 연동은 필요성이 검증된 뒤 확장한다.

가장 중요한 원칙은 다음이다.

1. GrowthHub는 외부 도구를 대체하지 않는다.
2. GrowthHub는 Seeds 관점의 맥락, 권한, 연결관계를 관리한다.
3. 자동 수집은 감시처럼 보이지 않도록 제한한다.
4. GitHub/Discord/Calendar 데이터는 평가가 아니라 대화와 운영 보조 신호로만 사용한다.


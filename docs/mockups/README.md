# 법조데스크 1차 목업

변호사·변리사 대상 법령·판례 원문 리서치 MVP UI 목업입니다.

## 화면

| 파일 | 내용 |
|------|------|
| `index.html` | 허브 |
| `research.html` | 질의 → 조문/판례 카드 (법제처 원문 링크 필수) |
| `citations.html` | 서면 인용검증 5상태 |
| `errors.html` | OC / MCP / 503≠NOT_FOUND / 부분결과 |

## 인용 상태

`exists` · `not_found` · `content_mismatch` · `repealed` · `unverified`

내용불일치·폐지·미검증은 ✓로 표시하지 않습니다.

## OC 카피

장애 화면: **법제처 Open API 인증키(OC)** (OpenAI 아님)

## 로컬 확인

브라우저에서 HTML을 직접 엽니다. API·서버 불필요.
# ERP

사내 업무 시스템 — 일일업무일지 · 주간업무보고 · 휴가 · 결재.

Claude Design으로 만든 반응형 ERP 시안을 **FastAPI + Jinja2 + 순수 CSS/JS**
구조로 옮긴 구현체다. 원본 시안은 React 단일 파일에 모든 스타일이 인라인으로 들어가 있었고,
이 저장소는 같은 화면을 레이아웃 분할 · 외부 CSS · 서버 렌더링으로 재구성했다.

---

## 실행

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

→ http://127.0.0.1:8000

로그인 화면에서 아이디/비밀번호는 검증하지 않는다(시안 데모). 아무 값으로 **로그인**을 누르면
대시보드로 들어간다.

---

## 구조

```
app/
  main.py              FastAPI 진입점 · 정적 파일 마운트
  templating.py        Jinja2 환경
  data.py              데모 시드 데이터 + 휴가일수/캘린더 계산
  store.py             메모리 상태 저장소 (권한 · 결재선처럼 화면에서 바뀌는 값)
  view.py              템플릿에 넘길 뷰 모델 조립
  routers/
    pages.py           HTML 화면 라우터
    api.py             JSON API 라우터
  templates/
    base.html          <head> · CSS 로드 순서
    login.html         로그인 (앱 셸 미사용)
    layouts/app.html   앱 셸 = 사이드바 + 헤더 + 메인
    partials/          sidebar · header · icons · 모달 4종
    pages/             화면별 본문
static/
  css/
    pretendard.css     Pretendard 웹폰트 @font-face (self-host)
    base.css           디자인 토큰 · 리셋 · 타이포그래피
    layout.css         셸 · 사이드바 · 헤더 · 메인
    components.css     카드 · 배지 · 탭 · 칩 · 버튼 · 테이블 · 폼 · 모달
    responsive.css     브레이크포인트 (1180 / 1024 / 700 / 560)
    pages/*.css        화면 고유 스타일
  js/
    app.js             사이드바 · 사용자 메뉴 · 인원 선택 모달 · 토스트
    doc-form.js        업무일지 행 추가/삭제
    leave.js           휴가 종류·구분 선택, 사용일수 계산
    admin.js           부서 · 직급 · 휴가 종류 · 권한 · 사원 · 결재선
  fonts/pretendard/    woff2 서브셋 92개 + OFL 라이선스
tests/e2e/             Playwright 시나리오 테스트
```

### CSS 로드 순서

`base → layout → components → (페이지 CSS) → responsive`

페이지 CSS가 공통 컴포넌트보다 뒤에 오므로 화면별 덮어쓰기가 가능하고,
`responsive.css`가 마지막이라 브레이크포인트 규칙이 항상 이긴다.

> **주의** — 두 화면 이상에서 쓰는 클래스는 반드시 `components.css`에 둔다.
> 페이지 CSS에 두면 그 파일을 불러오지 않는 화면에서 스타일이 조용히 빠진다.
> (`tests/e2e` 외에 `python3 tools/audit_css.py`로도 확인 가능)

---

## 화면

| 경로 | 화면 |
|------|------|
| `/` | 로그인 |
| `/dashboard?tab=a\|b` | 대시보드 (A 요약 카드형 / B 오늘의 업무 중심) |
| `/daily` · `/daily/new` | 일일업무일지 목록 / 작성 |
| `/weekly?tab=view\|write` | 주간업무보고 조회 / 작성 |
| `/leave?tab=new\|my\|cal` | 휴가 신청 / 내역 / 팀 캘린더 |
| `/approve` | 결재함 |
| `/admin?tab=org\|role\|leave\|approval\|perm` | 관리자 |

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/directory?q=` | 부서별 조직도 (인원 선택 모달) |
| GET/POST | `/api/depts` | 조직도 부서 조회 / 추가 |
| POST | `/api/leave/days` | 휴가 사용일수 계산 (주말 제외 영업일) |
| GET/POST | `/api/roles` | 권한 조회 / 생성·수정 |
| DELETE | `/api/roles/{key}` | 권한 삭제 (기본 권한은 거부) |
| GET | `/api/members` | 사원 목록 |
| POST | `/api/members/perm` | 사원 권한 부여 |
| GET | `/api/approval-lines` | 결재선 조회 |
| POST | `/api/approval-lines/mode` | 결재 단계 수 변경 (none/one/two) |
| POST | `/api/approval-lines/step` | 단계별 결재자·수신자·참조자 지정 |
| GET/POST | `/api/ranks` | 직급표 조회 / 전체 저장 |
| GET | `/api/ranks/{name}/days` | 직급별 기본 연차 |
| GET/POST | `/api/leave-types` | 휴가 종류표 조회 / 전체 저장 |

대화형 문서: `/docs`

---

## 폰트

원본 시안은 `Plus Jakarta Sans`(라틴) + `Noto Sans KR`(한글)을 썼다.
요청에 따라 **Pretendard로 전체 교체**했고, 외부 CDN 없이 저장소에 self-host 한다.

- `static/fonts/pretendard/woff2-dynamic-subset/` — `unicode-range`로 나뉜 서브셋 92개
- 브라우저는 실제 사용된 글자에 해당하는 서브셋만 내려받는다 (대시보드 기준 9개)
- 라이선스: SIL Open Font License 1.1 (`static/fonts/pretendard/LICENSE.txt`)

이미지는 원본에 한 장도 없었다. 아이콘은 전부 인라인 SVG(`partials/icons.html`),
아바타는 이름 첫 글자, 배경은 CSS 그라디언트다. 즉 **외부 요청이 0건**이다.

---

## 테스트

서버를 띄운 뒤:

```bash
npm install          # playwright
npx playwright install chromium
npm run test:e2e
```

| 스크립트 | 검증 내용 |
|----------|-----------|
| `test:interact` | 로그인 플로우, 사이드바 접기(쿠키 유지), 사용자 메뉴, 인원 선택 모달(검색·선택·칩 삭제·hidden 동기화), 업무일지 행 추가/삭제, 휴가 일수 계산 |
| `test:admin` | 권한 생성·수정·삭제(기본 권한 보호), 사원 권한 변경, 직급별 기본 연차 자동 반영, 결재선 단계 전환, 결재자 서버 저장 |
| `test:responsive` | 1440/1100/820/390px에서 로그인 1↔2단 전환, 모바일 하단 탭바, 가로 오버플로 없음 |
| `test:mobile` | 모바일(≤700px) 전용 — 로그인 스크롤 없음, 레이어 팝업이 하단 탭바를 침범하지 않음, 자동 포커스 억제(데스크톱에서는 유지되는지까지 확인) |
| `test:orgsetup` | 부서 추가(중복·빈 이름 거부), 직급/휴가 종류 행 추가·삭제·저장과 새로고침 후 유지, 다른 화면(사원 모달·휴가 신청)에 반영되는지 |

`npm run shots`는 전 화면 스크린샷을 `tests/e2e/__shots__/`에 저장한다.

환경변수: `BASE_URL`(기본 `http://127.0.0.1:8000`), `CHROMIUM_PATH`, `SHOT_DIR`.

---

## 관리자 조직 설정

관리자 화면의 "추가" 버튼은 모두 서버에 반영된다(저장소는 메모리).

| 버튼 | 동작 |
|------|------|
| `+ 부서 추가` | 모달에서 부서명·구분(본부/팀/부서)을 받아 조직도에 추가한다. 팀은 본부 묶음 안쪽에 들어간다. 추가 즉시 사원 등록 모달의 부서 선택지에도 나온다. |
| `+ 직급 추가` | 표에 빈 행을 붙인다. **저장**을 눌러야 서버에 반영된다. 반영되면 사원 모달의 직급 목록과 직급별 기본 연차 자동 입력에 쓰인다. |
| `+ 휴가 종류 추가` | 표에 빈 행을 붙인다. **저장**하면 휴가 신청 화면의 종류 목록이 함께 바뀐다. |
| 행의 `×` | 해당 행을 지운다. 마지막 한 줄은 지우지 않고 값만 비운다. |

직급·휴가 종류의 저장은 부분 갱신이 아니라 **화면에 보이는 표 전체를 한 번에 보낸다.**
행 추가·삭제·이름 변경이 한 번의 요청으로 처리되고, 서버는 받은 표로 통째로 교체한다.
중복 이름, 빈 이름, 숫자가 아닌 연차는 422로 거절하고 화면에는 토스트로 알린다.

> 부서는 삭제 UI 가 없다. 원본 시안의 조직도에 삭제 버튼이 없어 그대로 두었다.

## 모바일 대응

브레이크포인트 700px 이하를 모바일로 본다(태블릿은 제외). 이 구간에서는:

- 사이드바가 하단 탭바로 바뀐다. 높이는 `--tabbar-h` 토큰으로 관리한다.
- **레이어 팝업은 탭바를 침범하지 않는다.** 모달·토스트의 위치와 최대 높이를
  `--tabbar-safe`(탭바 높이 + `env(safe-area-inset-bottom)`) 기준으로 계산한다.
- **자동 포커스를 하지 않는다.** 인원 선택·행 추가·사원 등록에서 입력칸에 포커스를 주면
  키보드가 올라오며 화면이 확대되어 오히려 방해가 된다. `window.erpFocus()`가
  이 판단을 한 곳에서 담당하고, 데스크톱에서는 기존대로 포커스를 준다.
- 화면 높이는 `100vh` 대신 `100dvh`를 쓴다. iOS Safari 는 주소창이 보이는 동안에도
  `100vh`를 큰 뷰포트 기준으로 계산해서, `100vh`만 쓰면 실제 기기에서만 스크롤이 생긴다.

---

## 데모 데이터에 관하여

`app/data.py`의 시드와 `app/store.py`의 메모리 저장소는 시안 재현을 위한 것이다.
서버를 재시작하면 부서·직급·휴가 종류·권한·결재선 변경이 모두 초기화된다. 실제 서비스에서는 이 두 모듈이
DB 레이어로 교체될 자리다. 로그인 역시 자격 증명을 검증하지 않는 데모 수준이다.

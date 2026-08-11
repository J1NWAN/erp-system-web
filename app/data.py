"""ERP 데모 데이터.

원본 디자인 시안의 시드 데이터를 그대로 옮긴 모듈이다.
실제 서비스에서는 이 자리에 DB 레이어가 들어간다.
"""

from __future__ import annotations

from datetime import date, timedelta

# --- 조직도 --------------------------------------------------------------

DIRECTORY = [
    {"dept": "개발1팀", "name": "최민서", "rank": "부장", "email": "choi.ms@example.co.kr"},
    {"dept": "개발1팀", "name": "박서준", "rank": "책임", "email": "park.sj@example.co.kr"},
    {"dept": "개발1팀", "name": "김지현", "rank": "선임", "email": "kim.jh@example.co.kr"},
    {"dept": "개발1팀", "name": "이도윤", "rank": "주임", "email": "lee.dy@example.co.kr"},
    {"dept": "개발1팀", "name": "한도현", "rank": "주임", "email": "han.dh@example.co.kr"},
    {"dept": "개발1팀", "name": "정하윤", "rank": "인턴", "email": "jung.hy@example.co.kr"},
    {"dept": "개발2팀", "name": "서지우", "rank": "선임", "email": "seo.jw@example.co.kr"},
    {"dept": "개발2팀", "name": "오수빈", "rank": "주임", "email": "oh.sb@example.co.kr"},
    {"dept": "경영지원팀", "name": "윤채원", "rank": "책임", "email": "yoon.cw@example.co.kr"},
    {"dept": "경영지원팀", "name": "강태오", "rank": "이사", "email": "kang.to@example.co.kr"},
]

STAFF = [
    {"id": "N-2019-004", "name": "최민서", "rank": "부장", "dept": "개발본부", "joined": "2019-03-04", "leave": "18.0일"},
    {"id": "N-2020-011", "name": "박서준", "rank": "책임", "dept": "개발1팀", "joined": "2020-07-01", "leave": "16.0일"},
    {"id": "N-2022-007", "name": "김지현", "rank": "선임", "dept": "개발1팀", "joined": "2022-01-10", "leave": "15.0일"},
    {"id": "N-2023-015", "name": "이도윤", "rank": "주임", "dept": "개발1팀", "joined": "2023-05-22", "leave": "15.0일"},
    {"id": "N-2024-021", "name": "한도현", "rank": "주임", "dept": "개발1팀", "joined": "2024-02-19", "leave": "15.0일"},
    {"id": "N-2026-003", "name": "정하윤", "rank": "인턴", "dept": "개발1팀", "joined": "2026-01-02", "leave": "11.0일"},
]

# 관리자 > 조직 탭의 조직도 트리.
#   kind — div: 본부, team: 본부 하위 팀, dept: 본부에 속하지 않는 부서
#   count — 트리에 함께 찍는 인원수. 본부(div)는 표시하지 않으므로 None.
ORG_ROOT = "전사"

DEPARTMENTS = [
    {"name": "개발본부", "kind": "div", "count": None},
    {"name": "개발1팀", "kind": "team", "count": 6},
    {"name": "개발2팀", "kind": "team", "count": 4},
    {"name": "경영지원팀", "kind": "dept", "count": 5},
    {"name": "영업팀", "kind": "dept", "count": 5},
]

DEPT_KINDS = ("div", "team", "dept")

RANKS = [
    {"no": 1, "name": "인턴", "days": "11", "perm": "일반"},
    {"no": 2, "name": "주임", "days": "15", "perm": "일반"},
    {"no": 3, "name": "선임", "days": "15", "perm": "일반"},
    {"no": 4, "name": "책임", "days": "16", "perm": "팀 승인"},
    {"no": 5, "name": "부장", "days": "18", "perm": "전체 관리"},
    {"no": 6, "name": "이사", "days": "20", "perm": "전체 관리"},
    {"no": 7, "name": "상무", "days": "20", "perm": "전체 관리"},
]

RANK_PERMS = ("일반", "팀 승인", "전체 관리")

MENU_DEFS = [
    {"key": "dash", "label": "대시보드"},
    {"key": "daily", "label": "일일업무일지"},
    {"key": "weekly", "label": "주간업무보고"},
    {"key": "leave", "label": "휴가 관리"},
    {"key": "approve", "label": "결재함"},
    {"key": "admin", "label": "관리자"},
]

DEFAULT_ROLES = [
    {
        "key": "admin",
        "name": "관리자",
        "menus": {"dash": True, "daily": True, "weekly": True, "leave": True, "approve": True, "admin": True},
    },
    {
        "key": "user",
        "name": "사용자",
        "menus": {"dash": True, "daily": True, "weekly": True, "leave": True, "approve": True, "admin": False},
    },
]

DEFAULT_PERMS = {
    "N-2019-004": "admin",
    "N-2020-011": "admin",
    "N-2022-007": "user",
    "N-2023-015": "user",
    "N-2024-021": "user",
    "N-2026-003": "user",
}

DEFAULT_APPROVAL_LINES = [
    {
        "doc": "휴가 신청",
        "mode": "two",
        "steps": [
            {"ap": ["최민서"], "to": ["박서준"], "cc": []},
            {"ap": ["정하윤"], "to": [], "cc": ["김지현"]},
        ],
    },
    {
        "doc": "일일업무일지",
        "mode": "none",
        "steps": [{"ap": [], "to": [], "cc": []}, {"ap": [], "to": [], "cc": []}],
    },
    {
        "doc": "주간업무보고",
        "mode": "one",
        "steps": [{"ap": ["박서준"], "to": ["최민서"], "cc": []}, {"ap": [], "to": [], "cc": []}],
    },
]

# --- 콘텐츠 --------------------------------------------------------------

NOTICES = [
    {"tag": "필수", "tone": "danger", "title": "8월 정기 보안교육 이수 안내 (~8/20)", "date": "08-03"},
    {"tag": "인사", "tone": "primary", "title": "하계 휴가 사용 촉진 안내", "date": "08-01"},
    {"tag": "공지", "tone": "muted", "title": "ERP 주간보고 양식 변경 안내", "date": "07-29"},
    {"tag": "공지", "tone": "muted", "title": "사내 네트워크 점검 (8/9 02:00–04:00)", "date": "07-28"},
]

RECENT_DOCS = [
    {"date": "08-04", "kind": "일지", "kind_tone": "muted", "title": "휴가 모듈 API 연동 3일차", "state": "제출완료"},
    {"date": "08-03", "kind": "일지", "kind_tone": "muted", "title": "조직도 트리 렌더링 성능 개선", "state": "제출완료"},
    {"date": "07-31", "kind": "주보", "kind_tone": "primary", "title": "[개발1팀] 31주차 주간업무보고", "state": "승인"},
    {"date": "07-30", "kind": "휴가", "kind_tone": "primary", "title": "오전반차 신청 (7/31)", "state": "승인"},
]

DAILY_ROWS = [
    {"date": "08-04", "title": "ERP 휴가모듈 API 연동 3일차", "writer": "김지현", "to": "박서준 책임", "done": "4 / 5", "state": "제출완료"},
    {"date": "08-03", "title": "조직도 트리 렌더링 성능 개선", "writer": "김지현", "to": "박서준 책임", "done": "3 / 3", "state": "제출완료"},
    {"date": "08-03", "title": "결재선 다단계 처리 설계 검토", "writer": "이도윤", "to": "박서준 책임", "done": "2 / 4", "state": "제출완료"},
    {"date": "07-31", "title": "QA 이슈 대응 및 릴리즈 노트 정리", "writer": "정하윤", "to": "김지현 선임", "done": "5 / 5", "state": "승인"},
    {"date": "07-30", "title": "사원 등록 화면 유효성 검사 보완", "writer": "김지현", "to": "박서준 책임", "done": "2 / 2", "state": "승인"},
    {"date": "07-29", "title": "주간보고 자동 집계 배치 작성", "writer": "한도현", "to": "박서준 책임", "done": "1 / 3", "state": "반려"},
    {"date": "07-28", "title": "로그인 SSO 연동 사전 조사", "writer": "이도윤", "to": "김지현 선임", "done": "2 / 2", "state": "승인"},
]

TASK_SEED = [
    {"system": "ERP · 휴가", "content": "휴가 신청 API 연동 및 반차 계산 로직 구현", "received": "2026-08-01", "started": "2026-08-03", "done": "완료"},
    {"system": "ERP · 조직", "content": "조직도 트리 캐싱 적용", "received": "2026-07-30", "started": "2026-08-04", "done": "진행중"},
    {"system": "공통", "content": "8월 정기 배포 QA 대응", "received": "2026-08-04", "started": "2026-08-05", "done": "진행중"},
]

PLAN_SEED = [
    {"system": "ERP · 결재", "content": "휴가 결재선 다단계 처리 로직 개발", "received": "2026-08-05", "plan_start": "2026-08-10", "plan_end": "2026-08-14"},
    {"system": "ERP · 조직", "content": "조직도 API 성능 개선 (300ms 이하)", "received": "2026-08-04", "plan_start": "2026-08-11", "plan_end": "2026-08-18"},
]

WEEKLY_ROWS = [
    {"writer": "김지현", "title": "[개발1팀] 32주차 주간업무보고", "at": "08-04 18:02", "state": "제출완료"},
    {"writer": "박서준", "title": "[개발1팀] 32주차 주간업무보고", "at": "08-04 17:45", "state": "승인"},
    {"writer": "이도윤", "title": "[개발1팀] 32주차 주간업무보고", "at": "08-04 16:30", "state": "제출완료"},
    {"writer": "정하윤", "title": "[개발1팀] 32주차 주간업무보고", "at": "08-04 18:20", "state": "제출완료"},
    {"writer": "한도현", "title": "—", "at": "—", "state": "미제출"},
    {"writer": "서지우", "title": "—", "at": "—", "state": "미제출"},
]

WEEKLY_TASKS = [
    {"no": 1, "system": "ERP · 휴가", "content": "휴가 신청/승인 API 연동 완료", "received": "2026-08-01", "started": "2026-08-03", "done": "완료"},
    {"no": 2, "system": "ERP · 조직", "content": "조직도 트리 캐싱 적용", "received": "2026-07-30", "started": "2026-08-04", "done": "진행중"},
    {"no": 3, "system": "ERP · 일지", "content": "일일업무일지 임시저장 기능", "received": "2026-07-28", "started": "2026-07-29", "done": "완료"},
    {"no": 4, "system": "공통", "content": "8월 정기 배포 QA 대응", "received": "2026-08-04", "started": "2026-08-05", "done": "진행중"},
]

DURATIONS = ["전일", "오전반차", "오후반차"]

MY_LEAVES = [
    {"period": "08-17 ~ 08-18", "type": "휴가(연차)", "reason": "가족 여행", "days": "2.0", "approver": "최민서 부장", "state": "대기"},
    {"period": "07-31", "type": "휴가(연차)", "reason": "개인 사유 (오전반차)", "days": "0.5", "approver": "최민서 부장", "state": "승인"},
    {"period": "06-24 ~ 06-25", "type": "휴가(연차)", "reason": "개인 일정", "days": "2.0", "approver": "최민서 부장", "state": "승인"},
    {"period": "05-19", "type": "병가", "reason": "병원 진료", "days": "1.0", "approver": "최민서 부장", "state": "승인"},
    {"period": "04-08", "type": "포상휴가", "reason": "상반기 우수사원 포상", "days": "1.0", "approver": "최민서 부장", "state": "승인"},
    {"period": "03-12", "type": "기타(연차미반영)", "reason": "예비군 훈련", "days": "1.0", "approver": "최민서 부장", "state": "승인"},
]

LEAVE_CONFIG = [
    {"name": "휴가(연차)", "deduct": "차감", "half": True, "proof": False},
    {"name": "병가", "deduct": "차감", "half": True, "proof": True},
    {"name": "경조휴가", "deduct": "미차감", "half": False, "proof": True},
    {"name": "출산휴가", "deduct": "미차감", "half": False, "proof": True},
    {"name": "포상휴가", "deduct": "미차감", "half": True, "proof": False},
    {"name": "기타(연차미반영)", "deduct": "미차감", "half": True, "proof": False},
]

LEAVE_DEDUCTS = ("차감", "미차감")

# 휴가 신청 화면의 종류 목록은 관리자 > 휴가 종류 설정에서 나온다.
# 여기서는 시드 값만 만들고, 실행 중에는 store.leave_type_names() 를 쓴다.
LEAVE_TYPES = [c["name"] for c in LEAVE_CONFIG]

APPROVAL_ITEMS = [
    {"kind": "휴가", "title": "연차 휴가 신청 (8/17–8/18)", "who": "김지현 선임", "at": "2026-08-05 09:12",
     "period": "2026-08-17 ~ 08-18", "d": "2.0일", "reason": "가족 여행으로 인한 연차 사용입니다."},
    {"kind": "휴가", "title": "오후반차 신청 (8/6)", "who": "이도윤 주임", "at": "2026-08-04 17:40",
     "period": "2026-08-06", "d": "0.5일", "reason": "병원 정기 검진."},
    {"kind": "보고", "title": "[개발1팀] 32주차 주간업무보고", "who": "정하윤 인턴", "at": "2026-08-04 18:02",
     "period": "2026-08-03 ~ 08-07", "d": "—", "reason": "주간 업무 실적 보고 건입니다."},
    {"kind": "휴가", "title": "경조휴가 신청 (8/24–8/26)", "who": "최민서 부장", "at": "2026-08-03 11:20",
     "period": "2026-08-24 ~ 08-26", "d": "3.0일", "reason": "가족 경조사."},
]

TEAM_WEEK_RAW = [
    ("김지현 (나)", [None, None, None, "연차", "연차"]),
    ("박서준", ["연차", "연차", "연차", None, None]),
    ("이도윤", [None, None, "오후반차", None, None]),
    ("최민서", [None, None, None, None, None]),
    ("정하윤", [None, "오전반차", None, None, None]),
]

# 팀 휴가 캘린더 이벤트 — 키는 8월 일자
CALENDAR_EVENTS = {
    6: [("박서준 연차", "full")],
    7: [("박서준 연차", "full"), ("이도윤 반차", "half")],
    12: [("정하윤 병가", "etc")],
    17: [("김지현 연차", "full")],
    18: [("김지현 연차", "full"), ("한도현 반차", "half")],
    24: [("최민서 경조", "etc")],
    27: [("이도윤 연차", "full")],
}

PAGE_TITLES = {
    "dash": ("대시보드", "2026년 8월 5일 수요일 기준"),
    "daily": ("일일업무일지", "작성한 일지를 조회하고 관리합니다"),
    "daily-new": ("일일업무일지 작성", "제출 후에도 당일 18시까지 수정 가능"),
    "weekly": ("주간업무보고", "매주 금요일 18시 마감"),
    "leave": ("휴가", "신청 · 조회 · 팀 캘린더"),
    "approve": ("결재함", "승인 대기 4건"),
    "admin": ("관리자", "조직 · 직급 · 휴가 정책 설정"),
}


# --- 헬퍼 ----------------------------------------------------------------

def person(name: str) -> dict | None:
    return next((p for p in DIRECTORY if p["name"] == name), None)


def label(name: str) -> str:
    p = person(name)
    return f"{p['name']} {p['rank']}" if p else name


def state_tone(state: str) -> str:
    """상태 배지의 색 토큰을 고른다."""
    if state in ("승인", "제출완료"):
        return "primary"
    if state in ("대기", "미제출"):
        return "muted"
    if state == "반려":
        return "danger"
    return "muted"


def business_days(start: str, end: str, duration: str) -> float:
    """휴가 일수 계산 — 전일은 주말 제외 영업일, 반차는 0.5일."""
    if duration != "전일":
        return 0.5
    try:
        a = date.fromisoformat(start)
        b = date.fromisoformat(end)
    except (ValueError, TypeError):
        return 0.0
    if b < a:
        return 0.0
    n = 0
    d = a
    while d <= b:
        if d.weekday() < 5:
            n += 1
        d += timedelta(days=1)
    return float(n)


def calendar_cells() -> list[dict]:
    """5주 x 7일 그리드. 원본과 동일하게 6번째 칸이 1일이 되도록 5칸 오프셋."""
    cells = []
    for i in range(35):
        num = i - 5
        in_month = 1 <= num <= 31
        dow = i % 7
        cells.append({
            "num": str(num) if in_month else "",
            "in_month": in_month,
            "today": num == 5,
            "dow": dow,
            "events": [{"label": lb, "tone": tone} for lb, tone in CALENDAR_EVENTS.get(num, [])] if in_month else [],
        })
    return cells


def team_week() -> list[dict]:
    rows = []
    for name, days in TEAM_WEEK_RAW:
        rows.append({
            "name": name,
            "cells": [{"label": v or "", "tone": ("full" if v == "연차" else "half") if v else "none"} for v in days],
        })
    return rows


def leave_type_hint(leave_type: str) -> str:
    if leave_type == "기타(연차미반영)":
        return "잔여 연차에서 차감되지 않습니다."
    if leave_type == "병가":
        return "3일 이상 신청 시 진단서 첨부가 필요합니다."
    return "잔여 연차에서 차감됩니다."

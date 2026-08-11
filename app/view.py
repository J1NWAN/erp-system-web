"""템플릿에 넘길 뷰 모델을 조립한다.

원본 시안의 renderVals()에 해당하는 계층. 화면이 필요로 하는 값만
가공해서 넘기고, 스타일 분기는 CSS 클래스 이름으로만 전달한다.
"""

from __future__ import annotations

from . import data
from .store import store

# 사이드바 메뉴 정의 — key, 라벨, 라우트, 활성 판정에 쓰는 화면 그룹
NAV_ITEMS = [
    {"key": "dash", "label": "대시보드", "url": "/dashboard", "icon": "grid"},
    {"key": "daily", "label": "일일업무일지", "url": "/daily", "icon": "doc"},
    {"key": "weekly", "label": "주간업무보고", "url": "/weekly", "icon": "chart"},
    {"key": "leave", "label": "휴가", "url": "/leave", "icon": "calendar"},
    {"key": "approve", "label": "결재함", "url": "/approve", "icon": "inbox"},
    {"key": "admin", "label": "관리자", "url": "/admin", "icon": "user"},
]

CURRENT_USER = {
    "name": "김지현",
    "rank": "선임",
    "dept": "개발1팀",
    "email": "kim.jh@example.co.kr",
    "initial": "김",
}


def base_context(screen: str, collapsed: bool = False) -> dict:
    """모든 앱 화면이 공유하는 셸 컨텍스트."""
    title, sub = data.PAGE_TITLES.get(screen, ("", ""))
    # daily-new 는 사이드바에서 daily 로 묶어 강조한다.
    nav_key = "daily" if screen == "daily-new" else screen
    return {
        "screen": screen,
        "nav_items": NAV_ITEMS,
        "nav_key": nav_key,
        "page_title": title,
        "page_sub": sub,
        "user": CURRENT_USER,
        "collapsed": collapsed,
        "pending_count": len(data.APPROVAL_ITEMS),
        "today_label": data.date_label(data.TODAY),
    }


def directory_groups(query: str = "") -> list[dict]:
    """부서별로 묶은 조직도. 인원 선택 모달에서 쓴다."""
    q = (query or "").strip()
    hit = [
        p for p in data.DIRECTORY
        if not q or q in p["name"] or q in p["dept"] or q in p["rank"]
    ]
    groups = []
    for dept in dict.fromkeys(p["dept"] for p in hit):
        groups.append({
            "dept": dept,
            "people": [
                {**p, "initial": p["name"][0]}
                for p in hit if p["dept"] == dept
            ],
        })
    return groups


def org_tree() -> dict:
    """관리자 > 조직 탭의 조직도 트리.

    본부(div)는 이름만, 팀·부서는 인원수까지 붙여 한 줄로 만든다.
    """
    return {
        "root": data.ORG_ROOT,
        "nodes": [
            {
                "name": d["name"],
                "kind": d["kind"],
                "label": d["name"] if d["count"] is None else f"{d['name']} · {d['count']}",
            }
            for d in store.depts
        ],
    }


def dept_options() -> list[str]:
    """사원 모달의 부서 선택지 — 조직도에 등록된 순서 그대로 넘긴다."""
    return store.dept_names()


def members() -> list[dict]:
    """관리자 > 조직 탭의 사원 목록 (권한 이름 결합)."""
    out = []
    for m in data.STAFF:
        role_key = store.perms.get(m["id"], "user")
        role = store.role(role_key) or {"name": "사용자"}
        out.append({
            **m,
            "role_key": role_key,
            "role": role["name"],
            "role_tone": "primary" if role_key == "admin" else "muted",
            "email": (data.person(m["name"]) or {}).get("email", ""),
            "login_id": m["id"].lower().replace("-", ""),
        })
    return out


def perm_roles() -> list[dict]:
    """관리자 > 권한 탭의 권한 카드 목록."""
    out = []
    for r in store.roles:
        allowed = [m for m in data.MENU_DEFS if r["menus"].get(m["key"])]
        out.append({
            "key": r["key"],
            "name": r["name"],
            "can_delete": r["key"] not in ("admin", "user"),
            "member_count": sum(
                1 for m in data.STAFF if store.perms.get(m["id"], "user") == r["key"]
            ),
            "allowed_count": len(allowed),
            "menu_list": " · ".join(m["label"] for m in allowed) or "없음",
            "menus": r["menus"],
        })
    return out


def role_scope(role_key: str) -> str:
    r = store.role(role_key)
    if not r:
        return ""
    return " · ".join(m["label"] for m in data.MENU_DEFS if r["menus"].get(m["key"]))


def role_options() -> list[dict]:
    """사원 모달의 권한 라디오 카드 — 접근 메뉴 요약을 함께 넘긴다."""
    return [
        {
            "key": r["key"],
            "name": r["name"],
            "scope": " · ".join(
                m["label"] for m in data.MENU_DEFS if r["menus"].get(m["key"])
            ),
        }
        for r in store.roles
    ]


def approval_lines() -> list[dict]:
    """관리자 > 결재선 탭. 단계 카드까지 펼쳐서 넘긴다."""
    out = []
    for idx, line in enumerate(store.lines):
        count = {"one": 1, "two": 2}.get(line["mode"], 0)
        steps = []
        for si in range(count):
            ap = line["steps"][si].get("ap", [])
            if len(ap) > 1:
                rule = f"결재자 {len(ap)}명 중 1명 승인 시 다음 단계로 진행"
            elif len(ap) == 1:
                rule = "지정 결재자 1명 승인"
            else:
                rule = "결재자를 선택하세요"
            steps.append({
                "no": si + 1,
                "title": f"{si + 1}단계 결재",
                "rule": rule,
                "ap_chips": [{"name": n, "label": data.label(n)} for n in ap],
                "to_chips": [{"name": n, "label": data.label(n)} for n in line["steps"][si].get("to", [])],
                "cc_chips": [{"name": n, "label": data.label(n)} for n in line["steps"][si].get("cc", [])],
            })
        flow_mid = " → ".join(f"{k + 1}단계 결재" for k in range(count))
        out.append({
            "index": idx,
            "doc": line["doc"],
            "mode": line["mode"],
            "is_none": line["mode"] == "none",
            "has_steps": count > 0,
            "flow": f"신청자 → {flow_mid} → 완료" if count else "신청자 →  → 완료",
            "step_cards": steps,
        })
    return out


def approvals(picked: int = 0) -> dict:
    """결재함 목록 + 선택된 문서 상세."""
    items = data.APPROVAL_ITEMS
    picked = picked if 0 <= picked < len(items) else 0
    rows = [
        {
            **a,
            "index": i,
            "kind_tone": "primary" if a["kind"] == "휴가" else "muted",
            "meta": f"{a['who']} · {a['at']}",
            "is_picked": i == picked,
        }
        for i, a in enumerate(items)
    ]
    p = items[picked]
    return {
        "rows": rows,
        "picked_index": picked,
        "picked_kind": "휴가 신청서" if p["kind"] == "휴가" else "주간업무보고",
        "picked": p,
    }


def task_rows(count: int) -> list[dict]:
    out = []
    for i in range(count):
        seed = data.TASK_SEED[i] if i < len(data.TASK_SEED) else {
            "system": "", "content": "", "received": "", "started": "", "done": "진행중",
        }
        out.append({"no": i + 1, **seed})
    return out


def plan_rows(count: int) -> list[dict]:
    out = []
    for i in range(count):
        seed = data.PLAN_SEED[i] if i < len(data.PLAN_SEED) else {
            "system": "", "content": "", "received": "", "plan_start": "", "plan_end": "",
        }
        out.append({"no": i + 1, **seed})
    return out


def chips(names: list[str]) -> list[dict]:
    return [{"name": n, "label": data.label(n)} for n in names]

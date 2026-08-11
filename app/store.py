"""프로세스 메모리에 올려두는 데모용 상태 저장소.

권한·결재선처럼 화면에서 수정 가능한 값만 여기서 관리한다.
실제 서비스라면 DB 세션으로 대체될 자리다.
"""

from __future__ import annotations

import copy
import threading

from . import data


class Store:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self.roles = copy.deepcopy(data.DEFAULT_ROLES)
            self.perms = dict(data.DEFAULT_PERMS)
            self.lines = copy.deepcopy(data.DEFAULT_APPROVAL_LINES)
            self.depts = copy.deepcopy(data.DEPARTMENTS)
            self.ranks = copy.deepcopy(data.RANKS)
            self.leave_config = copy.deepcopy(data.LEAVE_CONFIG)

    # --- 권한(롤) -------------------------------------------------------

    def role(self, key: str) -> dict | None:
        return next((r for r in self.roles if r["key"] == key), None)

    def save_role(self, key: str, name: str, menus: dict) -> dict:
        with self._lock:
            name = (name or "").strip() or "새 권한"
            existing = next((r for r in self.roles if r["key"] == key), None)
            if existing:
                existing["name"] = name
                existing["menus"] = menus
                return existing
            created = {"key": key, "name": name, "menus": menus}
            self.roles.append(created)
            return created

    def next_role_key(self) -> str:
        return f"role{len(self.roles) + 1}"

    def remove_role(self, key: str) -> bool:
        """기본 권한(admin/user)은 삭제할 수 없다."""
        if key in ("admin", "user"):
            return False
        with self._lock:
            before = len(self.roles)
            self.roles = [r for r in self.roles if r["key"] != key]
            if len(self.roles) == before:
                return False
            # 삭제된 권한을 쓰던 사원은 기본 사용자 권한으로 되돌린다.
            for emp_id, role_key in list(self.perms.items()):
                if role_key == key:
                    self.perms[emp_id] = "user"
            return True

    # --- 사원 권한 매핑 --------------------------------------------------

    def set_perm(self, emp_id: str, role_key: str) -> None:
        with self._lock:
            self.perms[emp_id] = role_key

    # --- 부서 -----------------------------------------------------------

    def add_dept(self, name: str, kind: str) -> dict:
        """조직도에 부서를 추가한다. 인원수는 아직 0명이다."""
        name = (name or "").strip()
        if not name:
            raise ValueError("부서명을 입력하세요.")
        if kind not in data.DEPT_KINDS:
            raise ValueError("알 수 없는 부서 구분입니다.")
        with self._lock:
            if any(d["name"] == name for d in self.depts):
                raise ValueError(f"이미 있는 부서입니다: {name}")
            created = {"name": name, "kind": kind, "count": 0}
            # 팀은 소속 본부 바로 아래에 오도록, 마지막 팀 뒤에 끼워 넣는다.
            if kind == "team":
                last = max(
                    (i for i, d in enumerate(self.depts) if d["kind"] in ("div", "team")),
                    default=len(self.depts) - 1,
                )
                self.depts.insert(last + 1, created)
            else:
                self.depts.append(created)
            return created

    def dept_names(self) -> list[str]:
        return [d["name"] for d in self.depts]

    # --- 직급 -----------------------------------------------------------

    def save_ranks(self, rows: list[dict]) -> list[dict]:
        """직급 표를 화면에 보이는 그대로 통째로 갈아끼운다.

        행 추가·삭제·이름 변경이 한 번의 저장으로 반영되므로 부분 갱신보다 단순하다.
        """
        cleaned = []
        seen = set()
        for row in rows:
            name = (row.get("name") or "").strip()
            if not name:
                raise ValueError("직급명을 입력하세요.")
            if name in seen:
                raise ValueError(f"직급명이 중복됩니다: {name}")
            seen.add(name)
            days = (str(row.get("days") or "")).strip()
            try:
                float(days)
            except ValueError:
                raise ValueError(f"'{name}' 의 기본 연차는 숫자여야 합니다.") from None
            perm = row.get("perm") or data.RANK_PERMS[0]
            if perm not in data.RANK_PERMS:
                raise ValueError(f"알 수 없는 권한입니다: {perm}")
            cleaned.append({"no": len(cleaned) + 1, "name": name, "days": days, "perm": perm})
        if not cleaned:
            raise ValueError("직급은 최소 하나가 필요합니다.")
        with self._lock:
            self.ranks = cleaned
            return self.ranks

    def rank_names(self) -> list[str]:
        return [r["name"] for r in self.ranks]

    def rank_days(self, rank_name: str) -> str:
        r = next((x for x in self.ranks if x["name"] == rank_name), None)
        return f"{float(r['days']):.1f}" if r else "15.0"

    # --- 휴가 종류 -------------------------------------------------------

    def save_leave_config(self, rows: list[dict]) -> list[dict]:
        """휴가 종류 표를 통째로 갈아끼운다. 직급과 같은 이유로 전체 저장이다."""
        cleaned = []
        seen = set()
        for row in rows:
            name = (row.get("name") or "").strip()
            if not name:
                raise ValueError("휴가 종류명을 입력하세요.")
            if name in seen:
                raise ValueError(f"휴가 종류명이 중복됩니다: {name}")
            seen.add(name)
            deduct = row.get("deduct") or data.LEAVE_DEDUCTS[0]
            if deduct not in data.LEAVE_DEDUCTS:
                raise ValueError(f"알 수 없는 차감 방식입니다: {deduct}")
            cleaned.append({
                "name": name,
                "deduct": deduct,
                "half": bool(row.get("half")),
                "proof": bool(row.get("proof")),
            })
        if not cleaned:
            raise ValueError("휴가 종류는 최소 하나가 필요합니다.")
        with self._lock:
            self.leave_config = cleaned
            return self.leave_config

    def leave_type_names(self) -> list[str]:
        return [c["name"] for c in self.leave_config]

    # --- 결재선 ---------------------------------------------------------

    def set_line_mode(self, index: int, mode: str) -> dict | None:
        with self._lock:
            if not 0 <= index < len(self.lines):
                return None
            self.lines[index]["mode"] = mode
            return self.lines[index]

    def set_step_field(self, index: int, step: int, key: str, names: list[str]) -> dict | None:
        with self._lock:
            if not 0 <= index < len(self.lines):
                return None
            steps = self.lines[index]["steps"]
            if not 0 <= step < len(steps):
                return None
            steps[step][key] = names
            return self.lines[index]


store = Store()

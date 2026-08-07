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

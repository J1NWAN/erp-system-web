"""JSON API 라우터 — 프런트엔드 JS가 호출한다."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from .. import data, view
from ..store import store

router = APIRouter(prefix="/api", tags=["api"])


# --- 스키마 --------------------------------------------------------------


class LeaveDaysIn(BaseModel):
    start: str
    end: str
    duration: str = "전일"
    leave_type: str = Field("휴가(연차)", alias="type")

    model_config = {"populate_by_name": True}


class RoleIn(BaseModel):
    key: str
    name: str
    menus: dict[str, bool]


class PermIn(BaseModel):
    employee_id: str
    role_key: str


class LineModeIn(BaseModel):
    index: int
    mode: str


class StepFieldIn(BaseModel):
    index: int
    step: int
    field: str
    names: list[str]


# --- 조직도 --------------------------------------------------------------


@router.get("/directory")
async def get_directory(q: str = Query("")):
    """인원 선택 모달용 부서별 조직도."""
    return {"groups": view.directory_groups(q)}


# --- 휴가 ----------------------------------------------------------------


@router.post("/leave/days")
async def calc_leave_days(payload: LeaveDaysIn):
    """휴가 일수 계산 — 주말을 제외한 영업일 기준."""
    if payload.duration not in data.DURATIONS:
        raise HTTPException(status_code=422, detail="알 수 없는 휴가 구분입니다.")
    end = payload.end if payload.duration == "전일" else payload.start
    days = data.business_days(payload.start, end, payload.duration)
    return {
        "days": days,
        "label": f"{days:.1f}일",
        "hint": data.leave_type_hint(payload.leave_type),
        "end": end,
    }


# --- 권한 ----------------------------------------------------------------


@router.get("/roles")
async def get_roles():
    return {"roles": view.perm_roles(), "menus": data.MENU_DEFS}


@router.post("/roles")
async def save_role(payload: RoleIn):
    menus = {m["key"]: bool(payload.menus.get(m["key"])) for m in data.MENU_DEFS}
    store.save_role(payload.key, payload.name, menus)
    return {"roles": view.perm_roles()}


@router.delete("/roles/{key}")
async def delete_role(key: str):
    if not store.remove_role(key):
        raise HTTPException(status_code=400, detail="기본 권한은 삭제할 수 없습니다.")
    return {"roles": view.perm_roles()}


# --- 사원 권한 ------------------------------------------------------------


@router.get("/members")
async def get_members():
    return {"members": view.members()}


@router.post("/members/perm")
async def set_perm(payload: PermIn):
    if not store.role(payload.role_key):
        raise HTTPException(status_code=404, detail="없는 권한입니다.")
    if not any(m["id"] == payload.employee_id for m in data.STAFF):
        raise HTTPException(status_code=404, detail="없는 사원입니다.")
    store.set_perm(payload.employee_id, payload.role_key)
    return {"members": view.members()}


# --- 결재선 --------------------------------------------------------------


@router.get("/approval-lines")
async def get_lines():
    return {"lines": view.approval_lines()}


@router.post("/approval-lines/mode")
async def set_line_mode(payload: LineModeIn):
    if payload.mode not in ("none", "one", "two"):
        raise HTTPException(status_code=422, detail="알 수 없는 결재 단계입니다.")
    if store.set_line_mode(payload.index, payload.mode) is None:
        raise HTTPException(status_code=404, detail="없는 결재선입니다.")
    return {"lines": view.approval_lines()}


@router.post("/approval-lines/step")
async def set_step_field(payload: StepFieldIn):
    if payload.field not in ("ap", "to", "cc"):
        raise HTTPException(status_code=422, detail="알 수 없는 필드입니다.")
    known = {p["name"] for p in data.DIRECTORY}
    unknown = [n for n in payload.names if n not in known]
    if unknown:
        raise HTTPException(status_code=422, detail=f"조직도에 없는 사원: {', '.join(unknown)}")
    if store.set_step_field(payload.index, payload.step, payload.field, payload.names) is None:
        raise HTTPException(status_code=404, detail="없는 결재선 단계입니다.")
    return {"lines": view.approval_lines()}


# --- 직급 기본 연차 --------------------------------------------------------


@router.get("/ranks/{name}/days")
async def get_rank_days(name: str):
    if not any(r["name"] == name for r in data.RANKS):
        raise HTTPException(status_code=404, detail="없는 직급입니다.")
    return {"rank": name, "days": data.rank_days(name)}

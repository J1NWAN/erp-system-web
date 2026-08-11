"""HTML 화면 라우터."""

from __future__ import annotations

import os

from fastapi import APIRouter, Cookie, Form, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from .. import data, view
from ..store import store
from ..templating import templates

router = APIRouter()

SESSION_COOKIE = "erp_session"
SIDEBAR_COOKIE = "erp_sidebar"

# HTTPS로 서비스할 때만 Secure 쿠키를 쓴다. 로컬 http 개발에서는 꺼둬야
# 브라우저가 쿠키를 저장하지 않는 문제가 생기지 않는다.
SECURE_COOKIES = os.getenv("SECURE_COOKIES", "").lower() in ("1", "true", "yes")


def _logged_in(session: str | None) -> bool:
    return session == "1"


def _collapsed(sidebar: str | None) -> bool:
    return sidebar == "1"


def _login_redirect() -> RedirectResponse:
    return RedirectResponse("/", status_code=303)


# --- 로그인 --------------------------------------------------------------


@router.get("/", response_class=HTMLResponse)
async def login_page(request: Request, erp_session: str | None = Cookie(None)):
    if _logged_in(erp_session):
        return RedirectResponse("/dashboard", status_code=303)
    return templates.TemplateResponse(request, "login.html", {})


@router.post("/login")
async def do_login(username: str = Form(""), password: str = Form("")):
    # 데모 시안이라 자격 증명은 검증하지 않고 바로 대시보드로 보낸다.
    response = RedirectResponse("/dashboard", status_code=303)
    response.set_cookie(
        SESSION_COOKIE, "1", httponly=True, samesite="lax", path="/", secure=SECURE_COOKIES
    )
    return response


@router.post("/logout")
async def do_logout():
    response = RedirectResponse("/", status_code=303)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


# --- 대시보드 ------------------------------------------------------------


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    tab: str = Query("a"),
    erp_session: str | None = Cookie(None),
    erp_sidebar: str | None = Cookie(None),
):
    if not _logged_in(erp_session):
        return _login_redirect()
    tab = tab if tab in ("a", "b") else "a"
    ctx = view.base_context("dash", _collapsed(erp_sidebar))
    ctx.update({
        "tab": tab,
        "team_week": data.team_week(),
        "notices": data.NOTICES,
        "recent_docs": [
            {**d, "state_tone": data.state_tone(d["state"])} for d in data.RECENT_DOCS
        ],
    })
    return templates.TemplateResponse(request, "pages/dashboard.html", ctx)


# --- 일일업무일지 ---------------------------------------------------------


@router.get("/daily", response_class=HTMLResponse)
async def daily_list(
    request: Request,
    erp_session: str | None = Cookie(None),
    erp_sidebar: str | None = Cookie(None),
):
    if not _logged_in(erp_session):
        return _login_redirect()
    ctx = view.base_context("daily", _collapsed(erp_sidebar))
    ctx["rows"] = [
        {**r, "state_tone": data.state_tone(r["state"])} for r in data.DAILY_ROWS
    ]
    return templates.TemplateResponse(request, "pages/daily_list.html", ctx)


@router.get("/daily/new", response_class=HTMLResponse)
async def daily_new(
    request: Request,
    tasks: int = Query(3, ge=1, le=30),
    plans: int = Query(2, ge=1, le=30),
    erp_session: str | None = Cookie(None),
    erp_sidebar: str | None = Cookie(None),
):
    if not _logged_in(erp_session):
        return _login_redirect()
    ctx = view.base_context("daily-new", _collapsed(erp_sidebar))
    ctx.update({
        "task_rows": view.task_rows(tasks),
        "plan_rows": view.plan_rows(plans),
        "to_chips": view.chips(["박서준"]),
        "cc_chips": view.chips(["최민서", "정하윤"]),
    })
    return templates.TemplateResponse(request, "pages/daily_new.html", ctx)


# --- 주간업무보고 ---------------------------------------------------------


@router.get("/weekly", response_class=HTMLResponse)
async def weekly(
    request: Request,
    tab: str = Query("view"),
    erp_session: str | None = Cookie(None),
    erp_sidebar: str | None = Cookie(None),
):
    if not _logged_in(erp_session):
        return _login_redirect()
    tab = tab if tab in ("view", "write") else "view"
    ctx = view.base_context("weekly", _collapsed(erp_sidebar))
    ctx.update({
        "tab": tab,
        "rows": [{**r, "state_tone": data.state_tone(r["state"])} for r in data.WEEKLY_ROWS],
        "tasks": [
            {**t, "done_tone": "primary" if t["done"] == "완료" else "muted"}
            for t in data.WEEKLY_TASKS
        ],
    })
    return templates.TemplateResponse(request, "pages/weekly.html", ctx)


# --- 휴가 ----------------------------------------------------------------


@router.get("/leave", response_class=HTMLResponse)
async def leave(
    request: Request,
    tab: str = Query("new"),
    type: str = Query("휴가(연차)"),
    duration: str = Query("전일"),
    start: str = Query("2026-08-17"),
    end: str = Query("2026-08-18"),
    erp_session: str | None = Cookie(None),
    erp_sidebar: str | None = Cookie(None),
):
    if not _logged_in(erp_session):
        return _login_redirect()
    tab = tab if tab in ("new", "my", "cal") else "new"
    leave_type = type if type in data.LEAVE_TYPES else data.LEAVE_TYPES[0]
    dur = duration if duration in data.DURATIONS else data.DURATIONS[0]
    end_value = end if dur == "전일" else start

    ctx = view.base_context("leave", _collapsed(erp_sidebar))
    ctx.update({
        "tab": tab,
        "leave_types": data.LEAVE_TYPES,
        "durations": data.DURATIONS,
        "leave_type": leave_type,
        "duration": dur,
        "start": start,
        "end": end_value,
        "end_disabled": dur != "전일",
        "type_hint": data.leave_type_hint(leave_type),
        "days_label": f"{data.business_days(start, end_value, dur):.1f}일",
        "my_leaves": [
            {**l, "state_tone": data.state_tone(l["state"])} for l in data.MY_LEAVES
        ],
        "cal_cells": data.calendar_cells(),
    })
    return templates.TemplateResponse(request, "pages/leave.html", ctx)


# --- 결재함 --------------------------------------------------------------


@router.get("/approve", response_class=HTMLResponse)
async def approve(
    request: Request,
    picked: int = Query(0, ge=0),
    erp_session: str | None = Cookie(None),
    erp_sidebar: str | None = Cookie(None),
):
    if not _logged_in(erp_session):
        return _login_redirect()
    ctx = view.base_context("approve", _collapsed(erp_sidebar))
    ctx.update(view.approvals(picked))
    return templates.TemplateResponse(request, "pages/approve.html", ctx)


# --- 관리자 --------------------------------------------------------------


@router.get("/admin", response_class=HTMLResponse)
async def admin(
    request: Request,
    tab: str = Query("org"),
    erp_session: str | None = Cookie(None),
    erp_sidebar: str | None = Cookie(None),
):
    if not _logged_in(erp_session):
        return _login_redirect()
    tab = tab if tab in ("org", "perm", "role", "leave", "approval") else "org"
    ctx = view.base_context("admin", _collapsed(erp_sidebar))
    ctx.update({
        "tab": tab,
        "members": view.members(),
        "perm_roles": view.perm_roles(),
        "ranks": data.RANKS,
        "leave_config": data.LEAVE_CONFIG,
        "approval_lines": view.approval_lines(),
        "menu_defs": data.MENU_DEFS,
        "roles": view.role_options(),
        "depts": sorted({m["dept"] for m in data.STAFF}),
        "rank_names": [r["name"] for r in data.RANKS],
        "next_role_key": store.next_role_key(),
    })
    return templates.TemplateResponse(request, "pages/admin.html", ctx)

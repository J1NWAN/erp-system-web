"""Nexo ERP — FastAPI 진입점."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .routers import api, pages

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="Nexo ERP",
    description="사내 업무 시스템 — 업무일지 · 주간보고 · 휴가 · 결재",
    version="1.0.0",
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(api.router)
app.include_router(pages.router)


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}

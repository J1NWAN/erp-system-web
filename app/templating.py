"""Jinja2 템플릿 환경."""

from __future__ import annotations

from pathlib import Path

from fastapi.templating import Jinja2Templates

TEMPLATE_DIR = Path(__file__).parent / "templates"

templates = Jinja2Templates(directory=str(TEMPLATE_DIR))
templates.env.trim_blocks = True
templates.env.lstrip_blocks = True


def active(current: str, target: str) -> str:
    """탭·네비 활성 클래스를 붙이는 헬퍼."""
    return "is-active" if current == target else ""


templates.env.globals["active"] = active

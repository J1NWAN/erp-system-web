"""페이지별로 실제 로드되는 CSS에 클래스가 정의돼 있는지 검사한다.

공통 컴포넌트를 페이지 전용 CSS에 두면, 그 파일을 불러오지 않는 화면에서
스타일이 조용히 빠진다. 이 스크립트는 그런 누락을 잡아낸다.

    python3 tools/audit_css.py

Jinja로 보간되는 클래스(`pill--{{ tone }}`)와 스타일이 필요 없는 구조용
래퍼는 IGNORE에 등록해 오탐을 걸러낸다.
"""

import re, os, glob
from pathlib import Path

TPL = Path("app/templates")
CSS = Path("static/css")

# 1) CSS 파일별 정의된 클래스 수집
defined = {}
for f in glob.glob("static/css/**/*.css", recursive=True):
    if f.endswith("pretendard.css"): continue
    txt = open(f, encoding="utf-8").read()
    txt = re.sub(r'/\*.*?\*/', '', txt, flags=re.S)
    defined[f] = set(re.findall(r'\.([A-Za-z_][\w-]*)', txt))

# 상태 클래스 · Jinja 보간 접두사 · 스타일 불필요한 구조용 래퍼
IGNORE = {
    "is-active", "is-collapsed", "is-on", "is-picked", "is-clickable", "is-locked",
    "picker", "user__pop", "login__stat", "leaveform__field",
}

ALWAYS = ["static/css/base.css","static/css/layout.css","static/css/components.css","static/css/responsive.css"]

# 2) 템플릿별 로드되는 css 파일 추정
def css_for(tpl_path):
    files = set(ALWAYS)
    seen = set()
    stack = [tpl_path]
    while stack:
        p = stack.pop()
        if p in seen or not p.exists(): continue
        seen.add(p)
        t = p.read_text(encoding="utf-8")
        for href in re.findall(r'href="/static/(css/[\w/\-.]+)"', t):
            files.add("static/" + href)
        m = re.search(r'{%\s*extends\s*"([^"]+)"', t)
        if m: stack.append(TPL / m.group(1))
        for inc in re.findall(r'{%\s*include\s*"([^"]+)"', t):
            stack.append(TPL / inc)
    return files, seen

# 3) 각 페이지 템플릿의 class= 수집 (자신 + include + 상속 체인의 partial)
page_tpls = sorted(glob.glob("app/templates/pages/*.html")) + ["app/templates/login.html"]
problems = []
for pt in page_tpls:
    p = Path(pt)
    files, chain = css_for(p)
    avail = set()
    for f in files:
        avail |= defined.get(f, set())
    used = set()
    for c in chain:
        t = c.read_text(encoding="utf-8")
        for m in re.findall(r'class="([^"]*)"', t):
            m = re.sub(r'{{.*?}}|{%.*?%}', ' ', m)
            for cls in m.split():
                if cls and not cls.startswith("{"):
                    used.add(cls)
    missing = sorted(c for c in used - avail if c not in IGNORE and not c.endswith("--"))
    if missing:
        problems.append((pt, missing))

for pt, miss in problems:
    print(f"\n{pt}")
    for m in miss: print("   MISSING:", m)
if not problems:
    print("클래스 정의 누락 없음")

import sys
sys.exit(1 if problems else 0)

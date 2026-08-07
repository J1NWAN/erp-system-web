/* ==========================================================================
   Nexo ERP — 프런트엔드 동작
   사이드바 접기 · 사용자 메뉴 · 인원 선택 모달 · 토스트
   ========================================================================== */

(function () {
  "use strict";

  /* --- 공통 유틸 --------------------------------------------------------- */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function setCookie(name, value, days) {
    const maxAge = (days || 365) * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};samesite=lax`;
  }

  async function api(url, options) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      let detail = `요청에 실패했습니다 (${res.status})`;
      try {
        const body = await res.json();
        if (body && body.detail) detail = body.detail;
      } catch (_) {
        /* 본문이 JSON이 아니면 기본 메시지를 쓴다 */
      }
      throw new Error(detail);
    }
    return res.json();
  }

  /* --- 토스트 ------------------------------------------------------------ */

  let toastTimer = null;

  function toast(message) {
    const el = $("[data-toast]");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2200);
  }

  window.nexoToast = toast;
  window.nexoApi = api;

  /* --- 사이드바 접기 ------------------------------------------------------ */

  function initSidebar() {
    const shell = $("[data-shell]");
    const btn = $('[data-action="toggle-sidebar"]');
    if (!shell || !btn) return;

    btn.addEventListener("click", () => {
      const collapsed = shell.classList.toggle("is-collapsed");
      btn.setAttribute("aria-pressed", collapsed ? "true" : "false");
      setCookie("nexo_sidebar", collapsed ? "1" : "0");
    });
  }

  /* --- 사용자 메뉴 -------------------------------------------------------- */

  function initUserMenu() {
    const wrap = $("[data-user-menu]");
    if (!wrap) return;
    const trigger = $('[data-action="toggle-user-menu"]', wrap);
    const pop = $(".user__pop", wrap);
    if (!trigger || !pop) return;

    const close = () => {
      pop.hidden = true;
      wrap.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    };

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const opening = pop.hidden;
      pop.hidden = !opening;
      wrap.classList.toggle("is-open", opening);
      trigger.setAttribute("aria-expanded", opening ? "true" : "false");
    });

    $$('[data-action="close-user-menu"]', wrap).forEach((el) =>
      el.addEventListener("click", close)
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  /* --- 인원 선택 모달 ------------------------------------------------------
     data-picker-open 속성이 붙은 버튼이 모달을 연다.
       data-picker-open : 대상 컨테이너의 CSS 선택자
       data-picker-mode : to | cc | ap  (제목/안내문에만 영향)
     선택 결과는 컨테이너 안의 태그 칩으로 렌더링되고,
     hidden input(name=<field>)에 콤마로 이어붙여 담긴다. */

  const pickerTitles = {
    to: ["수신자 선택", "여러 명을 선택할 수 있습니다"],
    lto: ["수신자 선택", "여러 명을 선택할 수 있습니다"],
    cc: ["참조자 선택", "여러 명을 선택할 수 있습니다"],
    lcc: ["참조자 선택", "여러 명을 선택할 수 있습니다"],
    ap: ["결재자 선택", "선택한 결재자 중 한 명만 승인하면 다음 단계로 진행됩니다"],
  };

  const picker = {
    el: null,
    target: null, // 칩을 그릴 컨테이너
    selected: [],
    groups: [],
    onConfirm: null,
  };

  function chipMarkup(name, label) {
    return `<span class="tagchip" data-name="${escapeAttr(name)}">${escapeHtml(label)}<button class="tagchip__x" type="button" data-action="remove-chip" aria-label="${escapeAttr(label)} 제거">×</button></span>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  const escapeAttr = escapeHtml;

  function currentNames(container) {
    return $$(".tagchip", container).map((c) => c.dataset.name);
  }

  function syncHidden(container) {
    const input = $("input[type=hidden]", container);
    if (input) input.value = currentNames(container).join(",");
  }

  function renderPickerList() {
    const list = $("[data-picker-list]", picker.el);
    if (!picker.groups.length) {
      list.innerHTML = '<div class="picker__empty">검색 결과가 없습니다.</div>';
      return;
    }
    list.innerHTML = picker.groups
      .map(
        (g) => `
        <div class="picker__group">
          <p class="picker__dept">${escapeHtml(g.dept)}</p>
          ${g.people
            .map((p) => {
              const on = picker.selected.includes(p.name);
              return `
              <button class="picker__row ${on ? "is-on" : ""}" type="button" data-pick="${escapeAttr(p.name)}" aria-pressed="${on}">
                <span class="picker__avatar">${escapeHtml(p.initial)}</span>
                <span class="picker__info">
                  <span class="picker__name">${escapeHtml(p.name)} <span class="picker__rank">${escapeHtml(p.rank)}</span></span>
                  <span class="picker__mail">${escapeHtml(p.email)}</span>
                </span>
                <span class="picker__check">✓</span>
              </button>`;
            })
            .join("")}
        </div>`
      )
      .join("");

    $("[data-picker-count]", picker.el).textContent = picker.selected.length;
  }

  async function loadPicker(query) {
    try {
      const body = await api(`/api/directory?q=${encodeURIComponent(query || "")}`);
      picker.groups = body.groups;
      renderPickerList();
    } catch (err) {
      toast(err.message);
    }
  }

  function openPicker(target, mode, onConfirm) {
    picker.target = target;
    picker.onConfirm = onConfirm || null;
    picker.selected = target ? currentNames(target) : [];

    const [title, hint] = pickerTitles[mode] || pickerTitles.to;
    $("[data-picker-title]", picker.el).textContent = title;
    $("[data-picker-hint]", picker.el).textContent = hint;

    const search = $("[data-picker-search]", picker.el);
    search.value = "";
    picker.el.hidden = false;
    loadPicker("");
    search.focus();
  }

  function closePicker() {
    picker.el.hidden = true;
    picker.target = null;
    picker.onConfirm = null;
  }

  function confirmPicker() {
    if (picker.onConfirm) {
      picker.onConfirm(picker.selected.slice());
    } else if (picker.target) {
      const chips = $("[data-chips]", picker.target) || picker.target;
      const labels = {};
      picker.groups.forEach((g) =>
        g.people.forEach((p) => (labels[p.name] = `${p.name} ${p.rank}`))
      );
      // 검색으로 목록에서 빠진 이름도 라벨을 잃지 않도록 기존 칩에서 보완한다.
      $$(".tagchip", chips).forEach((c) => {
        if (!labels[c.dataset.name]) labels[c.dataset.name] = c.textContent.replace("×", "").trim();
      });
      const addBtn = $(".pickbox__add", chips);
      $$(".tagchip", chips).forEach((c) => c.remove());
      const html = picker.selected.map((n) => chipMarkup(n, labels[n] || n)).join("");
      if (addBtn) addBtn.insertAdjacentHTML("beforebegin", html);
      else chips.insertAdjacentHTML("beforeend", html);
      syncHidden(picker.target);
    }
    closePicker();
  }

  function initPicker() {
    picker.el = $("[data-picker]");
    if (!picker.el) return;

    $$('[data-action="close-picker"]', picker.el).forEach((el) =>
      el.addEventListener("click", closePicker)
    );
    $('[data-action="confirm-picker"]', picker.el).addEventListener("click", confirmPicker);

    // 목록 항목 토글
    $("[data-picker-list]", picker.el).addEventListener("click", (e) => {
      const row = e.target.closest("[data-pick]");
      if (!row) return;
      const name = row.dataset.pick;
      const at = picker.selected.indexOf(name);
      if (at >= 0) picker.selected.splice(at, 1);
      else picker.selected.push(name);
      renderPickerList();
    });

    // 검색 (입력이 멈추면 조회)
    let searchTimer = null;
    $("[data-picker-search]", picker.el).addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      const q = e.target.value;
      searchTimer = setTimeout(() => loadPicker(q), 160);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !picker.el.hidden) closePicker();
    });

    // 모달 여는 버튼
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-picker-open]");
      if (!btn) return;
      e.preventDefault();
      const target = $(btn.dataset.pickerOpen);
      if (target) openPicker(target, btn.dataset.pickerMode || "to");
    });

    // 칩 제거
    document.addEventListener("click", (e) => {
      const x = e.target.closest('[data-action="remove-chip"]');
      if (!x) return;
      const container = x.closest("[data-pickbox]");
      x.closest(".tagchip").remove();
      if (container) syncHidden(container);
    });
  }

  window.nexoOpenPicker = openPicker;

  /* --- 초기화 ------------------------------------------------------------ */

  document.addEventListener("DOMContentLoaded", () => {
    initSidebar();
    initUserMenu();
    initPicker();
  });
})();

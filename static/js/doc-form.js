/* ==========================================================================
   Nexo ERP — 문서 작성 폼
   업무 내용 / 예정사항 행 추가·삭제, 임시저장 토스트
   ========================================================================== */

(function () {
  "use strict";

  const form = document.querySelector("[data-doc-form]");
  if (!form) return;

  /** 행 번호를 1부터 다시 매긴다. */
  function renumber(container) {
    container.querySelectorAll("[data-row]").forEach((row, i) => {
      const no = row.querySelector(".gridtable__no");
      if (no) no.textContent = i + 1;
    });
  }

  /** 마지막 행을 복제해 값만 비운 새 행을 만든다. */
  function addRow(kind) {
    const container = form.querySelector(`[data-rows="${kind}"]`);
    if (!container) return;
    const rows = container.querySelectorAll("[data-row]");
    if (!rows.length) return;

    const clone = rows[rows.length - 1].cloneNode(true);
    clone.querySelectorAll("input").forEach((input) => {
      input.value = "";
    });
    clone.querySelectorAll("select").forEach((select) => {
      select.selectedIndex = select.querySelector('option[value="진행중"], option') ? 1 : 0;
      // 완료여부 기본값은 '진행중'
      const idx = Array.from(select.options).findIndex((o) => o.text === "진행중");
      if (idx >= 0) select.selectedIndex = idx;
    });
    container.appendChild(clone);
    renumber(container);

    const first = clone.querySelector("input");
    if (first) first.focus();
  }

  form.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-row]");
    if (add) {
      e.preventDefault();
      addRow(add.dataset.addRow);
      return;
    }

    const del = e.target.closest("[data-del-row]");
    if (del) {
      e.preventDefault();
      const row = del.closest("[data-row]");
      const container = row.parentElement;
      // 최소 한 줄은 남긴다.
      if (container.querySelectorAll("[data-row]").length <= 1) {
        row.querySelectorAll("input").forEach((i) => (i.value = ""));
        return;
      }
      row.remove();
      renumber(container);
      return;
    }

    const toastBtn = e.target.closest("[data-toast-msg]");
    if (toastBtn && window.nexoToast) {
      e.preventDefault();
      window.nexoToast(toastBtn.dataset.toastMsg);
    }
  });
})();

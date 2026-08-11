/* ==========================================================================
   ERP — 휴가 신청 폼
   휴가 종류 / 사용 구분 칩 선택, 사용 일수 계산 (서버 계산 API 사용)
   ========================================================================== */

(function () {
  "use strict";

  const form = document.querySelector("[data-leave-form]");
  if (!form) return;

  const typeInput = form.querySelector("[data-leave-type-input]");
  const durInput = form.querySelector("[data-duration-input]");
  const startInput = form.querySelector("[data-start]");
  const endInput = form.querySelector("[data-end]");
  const daysEl = form.querySelector("[data-days]");
  const hintEl = form.querySelector("[data-type-hint]");

  /** 같은 그룹의 칩 중 하나만 활성 상태로 만든다. */
  function selectChip(group, value, attr) {
    form.querySelectorAll(`[${attr}]`).forEach((btn) => {
      const on = btn.getAttribute(attr) === value;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  /** 반차를 고르면 종료일은 시작일로 고정하고 입력을 잠근다. */
  function syncEndState() {
    const isFull = durInput.value === "전일";
    endInput.disabled = !isFull;
    if (!isFull) endInput.value = startInput.value;
  }

  let pending = null;

  async function recalc() {
    const payload = {
      start: startInput.value,
      end: endInput.value,
      duration: durInput.value,
      type: typeInput.value,
    };
    // 연속 입력 시 마지막 요청만 반영되도록 토큰으로 구분한다.
    const token = {};
    pending = token;
    try {
      const body = await window.erpApi("/api/leave/days", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (pending !== token) return;
      daysEl.textContent = body.label;
      hintEl.textContent = body.hint;
      if (body.end && endInput.value !== body.end) endInput.value = body.end;
    } catch (err) {
      if (pending !== token) return;
      window.erpToast(err.message);
    }
  }

  form.addEventListener("click", (e) => {
    const typeBtn = e.target.closest("[data-leave-type]");
    if (typeBtn) {
      e.preventDefault();
      typeInput.value = typeBtn.dataset.leaveType;
      selectChip("type", typeInput.value, "data-leave-type");
      recalc();
      return;
    }

    const durBtn = e.target.closest("[data-duration]");
    if (durBtn) {
      e.preventDefault();
      durInput.value = durBtn.dataset.duration;
      selectChip("duration", durInput.value, "data-duration");
      syncEndState();
      recalc();
      return;
    }

    const toastBtn = e.target.closest("[data-toast-msg]");
    if (toastBtn) {
      e.preventDefault();
      window.erpToast(toastBtn.dataset.toastMsg);
    }
  });

  startInput.addEventListener("change", () => {
    if (durInput.value !== "전일") endInput.value = startInput.value;
    recalc();
  });

  endInput.addEventListener("change", recalc);
})();

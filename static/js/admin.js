/* ==========================================================================
   Nexo ERP — 관리자 화면
   권한 모달 · 사원 모달 · 결재선 단계 전환
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const toast = window.nexoToast;
  const api = window.nexoApi;

  /* --- 권한 모달 ---------------------------------------------------------- */

  const roleModal = $("[data-role-modal]");
  let roleKey = null;

  function openRole(key, name, menus) {
    if (!roleModal) return;
    roleKey = key;
    $("[data-role-title]", roleModal).textContent = key ? "권한 수정" : "권한 추가";
    $("[data-role-name]", roleModal).value = name || "";
    $$("[data-role-menu]", roleModal).forEach((btn) => {
      const on = !!(menus && menus[btn.dataset.roleMenu]);
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    roleModal.hidden = false;
    $("[data-role-name]", roleModal).focus();
  }

  function closeRole() {
    if (roleModal) roleModal.hidden = true;
    roleKey = null;
  }

  async function saveRole() {
    const name = $("[data-role-name]", roleModal).value;
    const menus = {};
    $$("[data-role-menu]", roleModal).forEach((btn) => {
      menus[btn.dataset.roleMenu] = btn.classList.contains("is-on");
    });
    const key = roleKey || $("[data-role-new]").dataset.nextKey;
    try {
      await api("/api/roles", {
        method: "POST",
        body: JSON.stringify({ key, name, menus }),
      });
      closeRole();
      // 목록을 서버 렌더링 결과로 다시 그린다.
      window.location.reload();
    } catch (err) {
      toast(err.message);
    }
  }

  async function deleteRole(key) {
    try {
      await api(`/api/roles/${encodeURIComponent(key)}`, { method: "DELETE" });
      window.location.reload();
    } catch (err) {
      toast(err.message);
    }
  }

  if (roleModal) {
    $$('[data-action="close-role"]', roleModal).forEach((el) =>
      el.addEventListener("click", closeRole)
    );
    $("[data-role-save]", roleModal).addEventListener("click", saveRole);

    roleModal.addEventListener("click", (e) => {
      const cell = e.target.closest("[data-role-menu]");
      if (!cell) return;
      const on = cell.classList.toggle("is-on");
      cell.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  document.addEventListener("click", (e) => {
    const newBtn = e.target.closest("[data-role-new]");
    if (newBtn) {
      openRole(null, "", {});
      return;
    }

    const delBtn = e.target.closest("[data-role-delete]");
    if (delBtn) {
      e.stopPropagation();
      deleteRole(delBtn.dataset.roleDelete);
      return;
    }

    const row = e.target.closest("[data-role-row]");
    if (row) {
      let menus = {};
      try {
        menus = JSON.parse(row.dataset.menus);
      } catch (_) {
        menus = {};
      }
      openRole(row.dataset.key, row.dataset.name, menus);
    }
  });

  /* --- 사원 모달 ---------------------------------------------------------- */

  const empModal = $("[data-emp-modal]");
  let empId = null;
  let empMode = "new";

  const field = (name) => $(`[data-emp-field="${name}"]`, empModal);

  function selectEmpRole(key) {
    $$("[data-emp-role]", empModal).forEach((btn) => {
      const on = btn.dataset.empRole === key;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function currentEmpRole() {
    const on = $("[data-emp-role].is-on", empModal);
    return on ? on.dataset.empRole : "user";
  }

  function openEmp(mode, dataset) {
    if (!empModal) return;
    empMode = mode;
    const d = dataset || {};
    empId = mode === "edit" ? d.id : null;

    $("[data-emp-title]", empModal).textContent =
      mode === "edit" ? "사원 정보 수정" : "사원 등록";
    $("[data-emp-hint]", empModal).textContent =
      mode === "edit"
        ? "사원의 기본 정보와 권한을 수정합니다"
        : "새 사원의 기본 정보와 권한을 입력하세요";

    field("id").value = d.id || "";
    field("name").value = d.name || "";
    field("dept").value = d.dept || "개발1팀";
    field("rank").value = d.rank || "주임";
    field("joined").value = d.joined || "";
    field("email").value = d.email || "";
    field("leave").value = d.leave || "";
    field("login").value = d.login || "";

    // 아이디는 수정 시 변경할 수 없다.
    const isEdit = mode === "edit";
    field("login").readOnly = isEdit;
    field("login").classList.toggle("is-locked", isEdit);
    $("[data-emp-login-note]", empModal).textContent = isEdit
      ? "아이디는 변경할 수 없습니다"
      : "로그인에 사용할 아이디입니다";
    $("[data-emp-leave-note]", empModal).textContent = isEdit
      ? ""
      : "직급 변경 시 기본 연차가 자동 적용됩니다";
    $("[data-emp-retire]", empModal).hidden = !isEdit;

    selectEmpRole(d.role || "user");

    if (!isEdit) applyRankDays(field("rank").value);

    empModal.hidden = false;
    field("id").focus();
  }

  function closeEmp() {
    if (empModal) empModal.hidden = true;
    empId = null;
  }

  /** 등록 화면에서만 직급에 맞는 기본 연차를 자동 반영한다. */
  async function applyRankDays(rank) {
    if (empMode !== "new") return;
    try {
      const body = await api(`/api/ranks/${encodeURIComponent(rank)}/days`);
      field("leave").value = body.days;
    } catch (_) {
      /* 직급 조회 실패 시 기존 값을 그대로 둔다 */
    }
  }

  async function saveEmp() {
    const id = field("id").value.trim();
    if (!id) {
      toast("사번을 입력하세요.");
      return;
    }
    // 데모 범위에서는 기존 사원의 권한 변경만 서버에 반영한다.
    if (empMode === "edit" && empId) {
      try {
        await api("/api/members/perm", {
          method: "POST",
          body: JSON.stringify({ employee_id: empId, role_key: currentEmpRole() }),
        });
        closeEmp();
        window.location.reload();
        return;
      } catch (err) {
        toast(err.message);
        return;
      }
    }
    closeEmp();
    toast("사원 정보를 저장했습니다.");
  }

  if (empModal) {
    $$('[data-action="close-emp"]', empModal).forEach((el) =>
      el.addEventListener("click", closeEmp)
    );
    $("[data-emp-save]", empModal).addEventListener("click", saveEmp);
    $("[data-emp-retire]", empModal).addEventListener("click", () => {
      closeEmp();
      toast("퇴사 처리했습니다.");
    });

    empModal.addEventListener("click", (e) => {
      const roleBtn = e.target.closest("[data-emp-role]");
      if (roleBtn) selectEmpRole(roleBtn.dataset.empRole);
    });

    field("rank").addEventListener("change", (e) => applyRankDays(e.target.value));
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-emp-new]")) {
      openEmp("new", {});
      return;
    }
    const editBtn = e.target.closest("[data-emp-edit]");
    if (editBtn) openEmp("edit", editBtn.dataset);
  });

  /* --- 결재선 단계 전환 ----------------------------------------------------- */

  const lines = $("[data-lines]");
  if (lines) {
    lines.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-line-mode]");
      if (!btn) return;
      const line = btn.closest("[data-line]");
      try {
        await api("/api/approval-lines/mode", {
          method: "POST",
          body: JSON.stringify({
            index: Number(line.dataset.line),
            mode: btn.dataset.lineMode,
          }),
        });
        window.location.reload();
      } catch (err) {
        toast(err.message);
      }
    });
  }

  /* --- 결재선 단계별 인원 저장 ------------------------------------------------
     인원 선택 모달이 확정되면 해당 단계 필드를 서버에 반영한다. */

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-picker-open]");
    if (!btn) return;
    const box = $(btn.dataset.pickerOpen);
    if (!box || !box.dataset.lineIndex) return;

    // 결재선 박스는 서버 저장이 필요하므로 확정 콜백을 직접 넘긴다.
    e.stopImmediatePropagation();
    e.preventDefault();
    window.nexoOpenPicker(box, btn.dataset.pickerMode, async (names) => {
      try {
        await api("/api/approval-lines/step", {
          method: "POST",
          body: JSON.stringify({
            index: Number(box.dataset.lineIndex),
            step: Number(box.dataset.step),
            field: box.dataset.field,
            names: names,
          }),
        });
        window.location.reload();
      } catch (err) {
        toast(err.message);
      }
    });
  }, true);

  /* --- 저장 버튼 토스트 ----------------------------------------------------- */

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toast-msg]");
    if (btn) {
      e.preventDefault();
      toast(btn.dataset.toastMsg);
    }
  });

  /* --- 닫기 단축키 --------------------------------------------------------- */

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeRole();
    closeEmp();
  });
})();

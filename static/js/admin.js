/* ==========================================================================
   ERP — 관리자 화면
   권한 모달 · 사원 모달 · 결재선 단계 전환
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const toast = window.erpToast;
  const api = window.erpApi;
  // 모바일에서는 자동 포커스를 건너뛴다 (키보드가 올라오며 화면이 확대됨).
  const focusField = window.erpFocus || ((el) => el && el.focus());

  /* --- 부서 추가 모달 -------------------------------------------------------
     조직도는 서버가 그리므로, 추가에 성공하면 화면을 다시 불러온다. */

  const deptModal = $("[data-dept-modal]");

  function openDept() {
    if (!deptModal) return;
    $("[data-dept-name]", deptModal).value = "";
    $("[data-dept-kind]", deptModal).value = "dept";
    deptModal.hidden = false;
    focusField($("[data-dept-name]", deptModal));
  }

  function closeDept() {
    if (deptModal) deptModal.hidden = true;
  }

  async function saveDept() {
    const name = $("[data-dept-name]", deptModal).value.trim();
    if (!name) {
      toast("부서명을 입력하세요.");
      return;
    }
    try {
      await api("/api/depts", {
        method: "POST",
        body: JSON.stringify({ name, kind: $("[data-dept-kind]", deptModal).value }),
      });
      closeDept();
      window.location.reload();
    } catch (err) {
      toast(err.message);
    }
  }

  if (deptModal) {
    $$('[data-action="close-dept"]', deptModal).forEach((el) =>
      el.addEventListener("click", closeDept)
    );
    $("[data-dept-save]", deptModal).addEventListener("click", saveDept);
    // 부서명만 채우면 되는 모달이라 Enter 로 바로 추가할 수 있게 한다.
    $("[data-dept-name]", deptModal).addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveDept();
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-dept-new]")) openDept();
  });

  /* --- 표 편집 (직급 · 휴가 종류) ---------------------------------------------
     두 표 모두 "행을 추가·삭제하고 마지막에 저장" 방식이라 동작을 공유한다.
     저장은 화면에 보이는 행 전체를 한 번에 보낸다. */

  /** 마지막 행을 복제해 값만 비운 새 행을 붙인다. */
  function addTableRow(container, rowSel, fieldAttr) {
    const rows = $$(rowSel, container);
    if (!rows.length) return null;

    const clone = rows[rows.length - 1].cloneNode(true);
    $$(`[${fieldAttr}]`, clone).forEach((el) => {
      if (el.type === "checkbox") {
        el.checked = false;
        el.removeAttribute("checked");
      } else if (el.tagName === "SELECT") {
        el.selectedIndex = 0;
      } else {
        el.value = "";
        el.removeAttribute("value");
      }
    });
    container.appendChild(clone);
    return clone;
  }

  /** 행을 지운다. 마지막 한 줄은 남기고 값만 비운다. */
  function removeTableRow(row, rowSel, fieldAttr) {
    const container = row.parentElement;
    if ($$(rowSel, container).length <= 1) {
      $$(`[${fieldAttr}]`, row).forEach((el) => {
        if (el.type === "checkbox") el.checked = false;
        else if (el.tagName !== "SELECT") el.value = "";
      });
      return;
    }
    row.remove();
  }

  /** 행에서 필드 값을 읽어 객체로 만든다. */
  function readRow(row, fieldAttr) {
    const out = {};
    $$(`[${fieldAttr}]`, row).forEach((el) => {
      out[el.getAttribute(fieldAttr)] = el.type === "checkbox" ? el.checked : el.value;
    });
    return out;
  }

  /** 순서 열(gridtable__no)을 1부터 다시 매긴다. */
  function renumber(container, rowSel) {
    $$(rowSel, container).forEach((row, i) => {
      const no = $(".gridtable__no", row);
      if (no) no.textContent = i + 1;
    });
  }

  /* 직급 */

  const rankTable = $("[data-rank-rows]");
  if (rankTable) {
    document.addEventListener("click", async (e) => {
      if (e.target.closest("[data-rank-add]")) {
        const row = addTableRow(rankTable, "[data-rank-row]", "data-rank-field");
        renumber(rankTable, "[data-rank-row]");
        if (row) focusField($('[data-rank-field="name"]', row));
        return;
      }

      const del = e.target.closest("[data-rank-del]");
      if (del) {
        removeTableRow(del.closest("[data-rank-row]"), "[data-rank-row]", "data-rank-field");
        renumber(rankTable, "[data-rank-row]");
        return;
      }

      if (!e.target.closest("[data-rank-save]")) return;
      const ranks = $$("[data-rank-row]", rankTable).map((r) =>
        readRow(r, "data-rank-field")
      );
      try {
        await api("/api/ranks", { method: "POST", body: JSON.stringify({ ranks }) });
        // 화면은 이미 저장한 그대로다. 다시 그릴 필요가 없어 토스트만 띄운다.
        toast("직급 설정을 저장했습니다.");
      } catch (err) {
        toast(err.message);
      }
    });
  }

  /* 휴가 종류 */

  const leaveTable = $("[data-leave-rows]");
  if (leaveTable) {
    document.addEventListener("click", async (e) => {
      if (e.target.closest("[data-leave-add]")) {
        const row = addTableRow(leaveTable, "[data-leave-row]", "data-leave-field");
        if (row) {
          // 복제한 체크박스의 aria-label 에는 원본 종류명이 남아 있다.
          $('[data-leave-field="half"]', row).setAttribute("aria-label", "반차 허용");
          $('[data-leave-field="proof"]', row).setAttribute("aria-label", "증빙 필요");
          focusField($('[data-leave-field="name"]', row));
        }
        return;
      }

      const del = e.target.closest("[data-leave-del]");
      if (del) {
        removeTableRow(del.closest("[data-leave-row]"), "[data-leave-row]", "data-leave-field");
        return;
      }

      if (!e.target.closest("[data-leave-save]")) return;
      const types = $$("[data-leave-row]", leaveTable).map((r) =>
        readRow(r, "data-leave-field")
      );
      try {
        await api("/api/leave-types", {
          method: "POST",
          body: JSON.stringify({ types }),
        });
        toast("휴가 종류를 저장했습니다.");
      } catch (err) {
        toast(err.message);
      }
    });
  }

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
    focusField($("[data-role-name]", roleModal));
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
    focusField(field("id"));
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
    window.erpOpenPicker(box, btn.dataset.pickerMode, async (names) => {
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
    closeDept();
    closeRole();
    closeEmp();
  });
})();

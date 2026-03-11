const DATA_FILE_PATH = "./data.json";
const FAV_STORAGE_KEY = "familyGuide_favorites";
const CHILDREN_STORAGE_KEY = "familyGuide_children";
const CUSTOM_CALENDAR_KEY = "familyGuide_customCalendar";

// カレンダー期間と月齢の対応表
const CALENDAR_PERIOD_MAP = [
  { id: "cal-birth", label: "出生直後",      minMonth: 0,  maxMonth: 0 },
  { id: "cal-1m",    label: "1ヶ月",         minMonth: 1,  maxMonth: 1 },
  { id: "cal-2m",   label: "2ヶ月",         minMonth: 2,  maxMonth: 2 },
  { id: "cal-3m",   label: "3ヶ月",         minMonth: 3,  maxMonth: 3 },
  { id: "cal-3-4m", label: "3〜4ヶ月",      minMonth: 3,  maxMonth: 4 },
  { id: "cal-5m",   label: "5ヶ月",         minMonth: 5,  maxMonth: 5 },
  { id: "cal-6m",   label: "6〜7ヶ月",      minMonth: 6,  maxMonth: 7 },
  { id: "cal-9m",   label: "9〜11ヶ月",     minMonth: 9,  maxMonth: 11 },
  { id: "cal-1y",   label: "1歳",           minMonth: 12, maxMonth: 17 },
  { id: "cal-1y6m", label: "1歳半",         minMonth: 18, maxMonth: 35 },
  { id: "cal-3y",   label: "3歳",           minMonth: 36, maxMonth: 47 },
  { id: "cal-4y",   label: "4歳",           minMonth: 48, maxMonth: 59 },
  { id: "cal-5y",   label: "5〜6歳",        minMonth: 60, maxMonth: 72 },
];

const SUGGESTION_TAG_STYLES = {
  event:   { bg: "#fecdd3", color: "#be123c", label: "お祝い" },
  vaccine: { bg: "#bfdbfe", color: "#1e40af", label: "予防接種" },
  checkup: { bg: "#bbf7d0", color: "#166534", label: "健診" },
  todo:    { bg: "#fde68a", color: "#92400e", label: "手続き" },
};

const CHILD_ICONS = ["👶", "🧒", "🐱", "🐶", "🐰", "🦖", "🐻", "🦁", "🚗", "🌟"];
const EXPECTED_CHILD_ICONS = ["🤰", "🍼", "👶", "🎀", "🧸", "💕", "🌸", "⭐", "🦋", "🐣"];

const BIRTH_TASKS = [
  // 出産前 — showFrom: 予定日までの残り日数がこの値以下になったら表示（null=常に表示）
  { id: "pre_maternity_book",  phase: "pre",    label: "母子手帳の受け取り", nav: "govlinks", showFrom: null },
  { id: "pre_hospital_bag",    phase: "pre",    label: "出産バッグの準備", nav: null, showFrom: 120 },
  { id: "pre_labor_taxi",      phase: "pre",    label: "陣痛タクシーの登録", nav: "taxi", showFrom: 120 },
  { id: "pre_hospital_prep",   phase: "pre",    label: "入院準備", nav: null, showFrom: 120 },
  { id: "pre_baby_supplies",   phase: "pre",    label: "ベビー用品の準備", nav: null, showFrom: 120 },
  { id: "pre_postpartum_care", phase: "pre",    label: "産後ケア施設の確認", nav: "caresupport", showFrom: 120 },
  // 出生後すぐ（〜14日）
  { id: "post_birth_reg",       phase: "post0",  label: "出生届の提出", deadline: 14, nav: "govlinks" },
  { id: "post_health_insurance",phase: "post0",  label: "健康保険の加入手続き", deadline: 14, nav: null },
  { id: "post_medical_cert",    phase: "post0",  label: "乳幼児医療証の申請", deadline: 14, nav: "govlinks" },
  { id: "post_child_allowance", phase: "post0",  label: "児童手当の申請", deadline: 15, nav: "govlinks" },
  { id: "post_birth_lumpsum",   phase: "post0",  label: "出産育児一時金の申請", nav: null },
  { id: "post_maternity_allow", phase: "post0",  label: "出産手当金の申請（産休中の場合）", nav: null },
];

// ===== こども管理 =====
function getChildren() {
  if (_childrenCache !== null) return _childrenCache;
  try {
    return JSON.parse(localStorage.getItem(CHILDREN_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveChildren(children) {
  _childrenCache = children;
  localStorage.setItem(CHILDREN_STORAGE_KEY, JSON.stringify(children));
  renderChildrenList();
  firebaseSet("shared/children",
    arrayToFirebaseObj(children, c => c.id));
}

function addChild(name, birthdate, icon, status, dueDate) {
  const children = getChildren();
  const child = {
    id: "child_" + Date.now(),
    name: name.trim(),
    icon: icon || "👶",
    createdAt: new Date().toISOString(),
    status: status || "born",
    birthTasks: {},
  };
  if (status === "expected") {
    child.dueDate = dueDate;
    child.birthdate = "";
  } else {
    child.birthdate = birthdate;
  }
  children.push(child);
  saveChildren(children);
}

function updateChild(id, name, birthdate, icon, status, dueDate) {
  const children = getChildren();
  const child = children.find((c) => c.id === id);
  if (child) {
    child.name = name.trim();
    child.icon = icon || "👶";
    child.status = status || "born";
    if (status === "expected") {
      child.dueDate = dueDate;
    } else {
      child.birthdate = birthdate;
    }
  }
  saveChildren(children);
}

function calculateDueDateDisplay(dueDate) {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return { text: `あと${diffDays}日`, overdue: false };
  if (diffDays === 0) return { text: "予定日当日", overdue: false };
  return { text: `予定日超過${Math.abs(diffDays)}日`, overdue: true };
}

function getVisibleBirthTasks(child) {
  const dueDate = child.dueDate;
  if (!dueDate) return BIRTH_TASKS;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return BIRTH_TASKS.filter((t) => t.showFrom == null || daysUntilDue <= t.showFrom);
}

function toggleBirthTask(childId, taskId) {
  const children = getChildren();
  const child = children.find((c) => c.id === childId);
  if (!child) return;
  if (!child.birthTasks) child.birthTasks = {};
  child.birthTasks[taskId] = child.birthTasks[taskId] ? null : new Date().toISOString();
  saveChildren(children);
}

function convertToBorn(childId, birthdate, name) {
  const children = getChildren();
  const child = children.find((c) => c.id === childId);
  if (!child) return;
  child.status = "born";
  child.birthdate = birthdate;
  if (name) child.name = name;
  saveChildren(children);
}

function deleteChild(id) {
  const children = getChildren().filter((c) => c.id !== id);
  saveChildren(children);
}

function calculateAge(birthdate) {
  const birth = new Date(birthdate + "T00:00:00");
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (today.getDate() < birth.getDate()) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years === 0) {
    return `${months}ヶ月`;
  }
  return `${years}歳 ${months}ヶ月`;
}

function calculateAgeInMonths(birthdate) {
  const birth = new Date(birthdate + "T00:00:00");
  const today = new Date();
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) {
    months--;
  }
  return Math.max(0, months);
}

function getItemTypeFromClasses(classList) {
  for (const cls of classList) {
    if (cls.startsWith("calendar-item--")) {
      return cls.replace("calendar-item--", "");
    }
  }
  return null;
}

function getCalendarItemsFromPeriod(periodId) {
  const period = document.getElementById(periodId);
  if (!period) return [];
  const items = [];
  period.querySelectorAll(".calendar-item").forEach((el) => {
    const type = getItemTypeFromClasses(el.classList);
    const strong = el.querySelector("strong");
    if (strong && type) {
      items.push({ title: strong.textContent, type, periodId });
    }
  });
  return items;
}

function getCalendarSuggestionsForChild(birthdate) {
  const ageMonths = calculateAgeInMonths(birthdate);
  const now = [];
  const soon = [];

  for (let i = 0; i < CALENDAR_PERIOD_MAP.length; i++) {
    const period = CALENDAR_PERIOD_MAP[i];
    if (ageMonths >= period.minMonth && ageMonths <= period.maxMonth) {
      now.push(...getCalendarItemsFromPeriod(period.id));
    }
    // 「もうすぐ」: 次の期間の開始が現在月齢+1以内
    if (period.minMonth > ageMonths && period.minMonth <= ageMonths + 1) {
      soon.push(...getCalendarItemsFromPeriod(period.id));
    }
  }

  return { now, soon };
}

function renderSuggestionGroup(items, labelText, labelClass, groupClass) {
  if (items.length === 0) return "";
  const itemsHtml = items
    .map((item) => {
      const style = SUGGESTION_TAG_STYLES[item.type] || SUGGESTION_TAG_STYLES.todo;
      return `<button class="child-suggestion-item" data-jump-period="${item.periodId}" type="button">
        <span class="child-suggestion-tag" style="background:${style.bg};color:${style.color}">${style.label}</span>
        <span class="child-suggestion-title">${escapeHtml(item.title)}</span>
      </button>`;
    })
    .join("");
  return `<div class="child-suggestion-group ${groupClass}">
    <span class="child-suggestion-label ${labelClass}">${labelText}</span>
    <div class="child-suggestion-items">${itemsHtml}</div>
  </div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderChildrenList() {
  const list = document.getElementById("childrenList");
  const empty = document.getElementById("childrenEmpty");
  if (!list) return;

  const children = getChildren();

  if (children.length === 0) {
    list.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  list.innerHTML = children
    .map((child) => {
      const isExpected = child.status === "expected";

      if (isExpected) {
        const dueDateInfo = calculateDueDateDisplay(child.dueDate);
        const visible = getVisibleBirthTasks(child);
        const tasks = child.birthTasks || {};

        function renderTaskColumn(items, labelText, labelClass, groupClass) {
          if (items.length === 0) return "";
          const itemsHtml = items.map((t) => {
            const checked = tasks[t.id] ? "checked" : "";
            const deadlineHtml = t.deadline ? `<span class="birth-task-deadline">（${t.deadline}日以内）</span>` : "";
            const navHtml = t.nav ? `<button class="birth-task-nav-btn birth-task-nav-btn--sm" data-nav="${t.nav}" type="button" title="関連セクションへ">→</button>` : "";
            return `<label class="child-suggestion-item birth-task-item-inline ${checked ? "birth-task-item--done" : ""}">
              <input type="checkbox" ${checked} data-child-id="${child.id}" data-task-id="${t.id}" class="birth-task-checkbox birth-task-checkbox--sm" />
              <span class="child-suggestion-title">${t.label}${deadlineHtml}</span>${navHtml}
            </label>`;
          }).join("");
          return `<div class="child-suggestion-group ${groupClass}">
            <span class="child-suggestion-label ${labelClass}">${labelText}</span>
            <div class="child-suggestion-items">${itemsHtml}</div>
          </div>`;
        }

        const preTasks = visible.filter((t) => t.phase === "pre");
        const postTasks = visible.filter((t) => t.phase === "post0");
        const preHtml = renderTaskColumn(preTasks, "📌 出産前", "child-suggestion-label--now", "child-suggestion-group--now");
        const postHtml = renderTaskColumn(postTasks, "🔜 出生後すぐ", "child-suggestion-label--soon", "child-suggestion-group--soon");
        const todoHtml = (preHtml || postHtml)
          ? `<div class="child-suggestions child-suggestions--expected">${preHtml}${postHtml}</div>`
          : "";

        return `
    <div class="child-card child-card--expected" data-child-id="${child.id}">
      <div class="child-card-header">
        <span class="child-card-icon">${child.icon || "🤰"}</span>
        <div class="child-card-info">
          <span class="child-card-name">${escapeHtml(child.name || "ベビー")}</span>
          <span class="child-card-age child-card-due${dueDateInfo.overdue ? " child-card-due--overdue" : ""}">${dueDateInfo.text}</span>
          <button class="child-born-btn" data-child-id="${child.id}" type="button">⇨🎉出産しました！</button>
        </div>
        <div class="child-card-actions">
          <button class="child-edit-btn" data-child-id="${child.id}" type="button" title="編集">✏️</button>
        </div>
      </div>
      ${todoHtml}
    </div>`;
      }

      // 通常の出生済みこども
      const suggestions = getCalendarSuggestionsForChild(child.birthdate);
      const nowHtml = renderSuggestionGroup(
        suggestions.now, "📌 いま", "child-suggestion-label--now", "child-suggestion-group--now"
      );
      const soonHtml = renderSuggestionGroup(
        suggestions.soon, "🔜 もうすぐ", "child-suggestion-label--soon", "child-suggestion-group--soon"
      );
      const suggestionsHtml = (nowHtml || soonHtml)
        ? `<div class="child-suggestions">${nowHtml}${soonHtml}</div>`
        : "";

      return `
    <div class="child-card" data-child-id="${child.id}">
      <div class="child-card-header">
        <span class="child-card-icon">${child.icon || "👶"}</span>
        <div class="child-card-info">
          <span class="child-card-name">${escapeHtml(child.name)}</span>
          <span class="child-card-age">${calculateAge(child.birthdate)}</span>
        </div>
        <div class="child-card-actions">
          <button class="child-edit-btn" data-child-id="${child.id}" type="button" title="編集">✏️</button>
        </div>
      </div>
      ${suggestionsHtml}
    </div>`;
    })
    .join("");
}

let editingChildId = null;
let selectedChildIcon = "👶";

function renderIconGrid(selectedIcon, icons) {
  const grid = document.getElementById("childIconGrid");
  if (!grid) return;
  const iconSet = icons || CHILD_ICONS;
  grid.innerHTML = iconSet.map((icon) =>
    `<button type="button" class="child-icon-option${icon === selectedIcon ? " child-icon-option--selected" : ""}" data-icon="${icon}">${icon}</button>`
  ).join("");
}

function setChildModalStatus(status) {
  const isExpected = status === "expected";
  document.querySelectorAll(".child-status-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.status === status);
  });
  document.getElementById("childBirthdateGroup").hidden = isExpected;
  document.getElementById("childDueDateGroup").hidden = !isExpected;
  document.getElementById("childNameHint").hidden = !isExpected;
  const icons = isExpected ? EXPECTED_CHILD_ICONS : CHILD_ICONS;
  if (!icons.includes(selectedChildIcon)) {
    selectedChildIcon = icons[0];
  }
  renderIconGrid(selectedChildIcon, icons);
}

function getChildModalStatus() {
  const activeBtn = document.querySelector(".child-status-btn.active");
  return activeBtn ? activeBtn.dataset.status : "born";
}

function openChildModal(childId) {
  const modal = document.getElementById("childModal");
  const title = document.getElementById("childModalTitle");
  const nameInput = document.getElementById("childNameInput");
  const birthdateInput = document.getElementById("childBirthdateInput");
  const dueDateInput = document.getElementById("childDueDateInput");
  const saveBtn = document.getElementById("childSaveBtn");

  if (childId) {
    editingChildId = childId;
    const child = getChildren().find((c) => c.id === childId);
    if (!child) return;
    title.textContent = "こどもの情報を編集";
    nameInput.value = child.name;
    birthdateInput.value = child.birthdate || "";
    dueDateInput.value = child.dueDate || "";
    selectedChildIcon = child.icon || "👶";
    saveBtn.textContent = "保存する";
    setChildModalStatus(child.status || "born");
  } else {
    editingChildId = null;
    title.textContent = "こどもを登録";
    nameInput.value = "";
    birthdateInput.value = "";
    dueDateInput.value = "";
    selectedChildIcon = "👶";
    saveBtn.textContent = "登録する";
    setChildModalStatus("born");
  }
  modal.hidden = false;
  nameInput.focus();
}

function closeChildModal() {
  document.getElementById("childModal").hidden = true;
  editingChildId = null;
}

let convertingChildId = null;

function openBirthConvertModal(childId) {
  convertingChildId = childId;
  const child = getChildren().find((c) => c.id === childId);
  if (!child) return;
  document.getElementById("birthConvertName").value = child.name === "ベビー" ? "" : child.name;
  document.getElementById("birthConvertDate").value = "";
  document.getElementById("birthConvertModal").hidden = false;
}

function closeBirthConvertModal() {
  document.getElementById("birthConvertModal").hidden = true;
  convertingChildId = null;
}

let deletingChildId = null;

function openChildListModal() {
  const modal = document.getElementById("childListModal");
  const body = document.getElementById("childListModalBody");
  if (!modal || !body) return;
  const children = getChildren();
  if (children.length === 0) {
    body.innerHTML = `<p class="child-list-modal-empty">登録されているこどもがいません。</p>`;
  } else {
    body.innerHTML = children.map((c) =>
      `<div class="child-list-modal-item">
        <span class="child-list-modal-icon">${c.icon || "👶"}</span>
        <span class="child-list-modal-name">${escapeHtml(c.name)}</span>
        <button class="child-list-modal-edit" data-child-id="${c.id}" type="button" title="編集">✏️</button>
        <button class="child-list-modal-delete" data-child-id="${c.id}" type="button" title="削除">🗑️</button>
      </div>`
    ).join("");
  }
  modal.hidden = false;
}

function closeChildListModal() {
  document.getElementById("childListModal").hidden = true;
}

function openDeleteConfirm(childId) {
  deletingChildId = childId;
  const child = getChildren().find((c) => c.id === childId);
  const msg = document.getElementById("childDeleteMessage");
  if (msg && child) {
    msg.textContent = `「${child.name}」の情報を削除しますか？`;
  }
  document.getElementById("childDeleteModal").hidden = false;
}

function closeDeleteConfirm() {
  document.getElementById("childDeleteModal").hidden = true;
  deletingChildId = null;
}

function setupChildManagement() {
  const addBtn = document.getElementById("addChildBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => openChildModal(null));
  }

  // ステータストグル
  document.getElementById("childStatusToggle")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".child-status-btn");
    if (!btn) return;
    setChildModalStatus(btn.dataset.status);
  });

  document.getElementById("childSaveBtn")?.addEventListener("click", () => {
    const name = document.getElementById("childNameInput").value.trim();
    const birthdate = document.getElementById("childBirthdateInput").value;
    const dueDate = document.getElementById("childDueDateInput").value;
    const status = getChildModalStatus();

    if (status === "born") {
      if (!name) { showToast("なまえを入力してください"); return; }
      if (!birthdate) { showToast("生年月日を入力してください"); return; }
    } else {
      if (!dueDate) { showToast("出産予定日を入力してください"); return; }
    }

    if (editingChildId) {
      updateChild(editingChildId, name || "ベビー", birthdate, selectedChildIcon, status, dueDate);
      showToast("情報を更新しました");
    } else {
      addChild(name || "ベビー", birthdate, selectedChildIcon, status, dueDate);
      showToast(status === "expected" ? "出産予定を登録しました" : "こどもを登録しました");
    }
    closeChildModal();
  });

  document.getElementById("childCancelBtn")?.addEventListener("click", closeChildModal);

  document.getElementById("childIconGrid")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".child-icon-option");
    if (!btn) return;
    selectedChildIcon = btn.dataset.icon;
    const currentStatus = getChildModalStatus();
    const icons = currentStatus === "expected" ? EXPECTED_CHILD_ICONS : CHILD_ICONS;
    renderIconGrid(selectedChildIcon, icons);
  });

  document.getElementById("childModal")?.addEventListener("click", (e) => {
    if (e.target.id === "childModal") closeChildModal();
  });

  document.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".child-edit-btn");
    if (editBtn) {
      openChildModal(editBtn.dataset.childId);
      return;
    }

    const deleteBtn = e.target.closest(".child-delete-btn");
    if (deleteBtn) {
      openDeleteConfirm(deleteBtn.dataset.childId);
      return;
    }

    const suggestionBtn = e.target.closest(".child-suggestion-item");
    if (suggestionBtn) {
      const periodId = suggestionBtn.dataset.jumpPeriod;
      if (periodId) {
        navigateTo("calendar");
        setTimeout(() => {
          const target = document.getElementById(periodId);
          if (target) {
            const headerHeight = document.querySelector(".sticky-top")?.offsetHeight || 0;
            const y = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
            window.scrollTo({ top: y, behavior: "smooth" });
          }
        }, 100);
      }
      return;
    }

    // 出産しましたボタン
    const bornBtn = e.target.closest(".child-born-btn");
    if (bornBtn) {
      openBirthConvertModal(bornBtn.dataset.childId);
      return;
    }

    // タスクのナビゲーションボタン
    const navBtn = e.target.closest(".birth-task-nav-btn");
    if (navBtn) {
      navigateTo(navBtn.dataset.nav);
      return;
    }
  });

  // タスクチェックボックス
  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("birth-task-checkbox")) {
      toggleBirthTask(e.target.dataset.childId, e.target.dataset.taskId);
    }
  });

  document.getElementById("childDeleteConfirmBtn")?.addEventListener("click", () => {
    if (deletingChildId) {
      deleteChild(deletingChildId);
      showToast("削除しました");
    }
    closeDeleteConfirm();
  });

  document.getElementById("childDeleteCancelBtn")?.addEventListener("click", closeDeleteConfirm);

  document.getElementById("childDeleteModal")?.addEventListener("click", (e) => {
    if (e.target.id === "childDeleteModal") closeDeleteConfirm();
  });

  // 出産変換モーダル
  document.getElementById("birthConvertSaveBtn")?.addEventListener("click", () => {
    const birthdate = document.getElementById("birthConvertDate").value;
    if (!birthdate) { showToast("生年月日を入力してください"); return; }
    const name = document.getElementById("birthConvertName").value.trim();
    convertToBorn(convertingChildId, birthdate, name || null);
    closeBirthConvertModal();
    showToast("おめでとうございます！登録を更新しました");
  });

  document.getElementById("birthConvertCancelBtn")?.addEventListener("click", closeBirthConvertModal);

  document.getElementById("birthConvertModal")?.addEventListener("click", (e) => {
    if (e.target.id === "birthConvertModal") closeBirthConvertModal();
  });

  // こども一覧モーダル
  document.getElementById("childListModal")?.addEventListener("click", (e) => {
    if (e.target.id === "childListModal") closeChildListModal();
    const editBtn = e.target.closest(".child-list-modal-edit");
    if (editBtn) {
      closeChildListModal();
      openChildModal(editBtn.dataset.childId);
      return;
    }
    const deleteBtn = e.target.closest(".child-list-modal-delete");
    if (deleteBtn) {
      closeChildListModal();
      openDeleteConfirm(deleteBtn.dataset.childId);
    }
  });

  document.getElementById("childListCloseBtn")?.addEventListener("click", closeChildListModal);

  document.getElementById("childListAddBtn")?.addEventListener("click", () => {
    closeChildListModal();
    openChildModal(null);
  });

  renderChildrenList();
}

function setupHeaderMenu() {
  const menuBtn = document.getElementById("headerMenuBtn");
  const dropdown = document.getElementById("headerMenuDropdown");
  if (!menuBtn || !dropdown) return;

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });

  document.addEventListener("click", () => {
    dropdown.hidden = true;
  });

  document.getElementById("menuAddChild")?.addEventListener("click", () => {
    dropdown.hidden = true;
    openChildModal(null);
  });

  document.getElementById("menuViewChildren")?.addEventListener("click", () => {
    dropdown.hidden = true;
    openChildListModal();
  });

  // お気に入りポップアップ
  document.getElementById("menuFavorites")?.addEventListener("click", () => {
    dropdown.hidden = true;
    openFavPopup();
  });

  document.getElementById("favPopupClose")?.addEventListener("click", closeFavPopup);
  document.getElementById("favOverlay")?.addEventListener("click", closeFavPopup);
}

function openFavPopup() {
  const popup = document.getElementById("favPopup");
  const overlay = document.getElementById("favOverlay");
  if (!popup || !overlay) return;
  renderFavoritesList();
  overlay.hidden = false;
  popup.hidden = false;
  requestAnimationFrame(() => popup.classList.add("open"));
}

function closeFavPopup() {
  const popup = document.getElementById("favPopup");
  const overlay = document.getElementById("favOverlay");
  if (!popup || !overlay) return;
  popup.classList.remove("open");
  popup.addEventListener("transitionend", () => {
    popup.hidden = true;
    overlay.hidden = true;
  }, { once: true });
}

// ===== お気に入り管理 =====
function getFavorites() {
  if (_favoritesCache !== null) return _favoritesCache;
  try {
    return JSON.parse(localStorage.getItem(FAV_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveFavorites(favs) {
  _favoritesCache = favs;
  localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favs));
  updateFavCountBadge();
  firebaseSet("shared/favorites",
    arrayToFirebaseObj(favs, f => f.id));
}

function makeFavId(category, item) {
  return `${category}::${item.name}`;
}

function isFavorite(favId) {
  return getFavorites().some((f) => f.id === favId);
}

function toggleFavorite(favId, category, item) {
  let favs = getFavorites();
  const idx = favs.findIndex((f) => f.id === favId);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push({ id: favId, category, item });
  }
  saveFavorites(favs);
  return idx < 0; // true = added
}

function updateFavCountBadge() {
  const badge = document.getElementById("menuFavBadge");
  if (!badge) return;
  const count = getFavorites().length;
  badge.textContent = count > 0 ? count : "";
  badge.hidden = count === 0;
}

// ===== レンダリング =====
let allData = {};

function createFavButton(category, item) {
  const favId = makeFavId(category, item);
  const active = isFavorite(favId);
  return `<button class="fav-btn ${active ? "fav-btn--active" : ""}" data-fav-id="${favId}" data-category="${category}" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}' title="${active ? "お気に入りから外す" : "お気に入りに追加"}" type="button">${active ? "★" : "☆"}</button>`;
}

function createReviewBadge(item) {
  if (!item.rating) return "";
  const count = item.reviewCount ? ` ${item.reviewCount}件` : "";
  const source = item.reviewSource ? ` ${item.reviewSource}` : "";
  return `<span class="review-badge"><span class="review-badge-star">★</span>${item.rating}${count}${source}</span>`;
}

function sortWithFavoritesFirst(items, category) {
  const favIds = new Set(getFavorites().map((f) => f.id));
  return [...items].sort((a, b) => {
    const aFav = favIds.has(makeFavId(category, a)) ? 0 : 1;
    const bFav = favIds.has(makeFavId(category, b)) ? 0 : 1;
    return aFav - bFav;
  });
}

function renderList(targetId, items, category) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const sorted = sortWithFavoritesFirst(items, category);

  target.innerHTML = sorted
    .map(
      (item) => `
      <li data-search="${[item.name, item.area, item.phone, item.note].join(" ").toLowerCase()}">
        <div class="name">
          ${createFavButton(category, item)}
          ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name}</a>` : item.name}
          ${createReviewBadge(item)}
        </div>
        <div class="meta">地域: ${item.area}</div>
        <div class="meta">電話: ${item.phone}</div>
        <div class="meta">${item.note}</div>
        ${item.phone ? `<div><a href="tel:${item.phone}" class="list-call-btn">📞 電話をかける</a></div>` : ""}
      </li>
    `
    )
    .join("");
}

function renderTaxiList(targetId, items, category) {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.innerHTML = items
    .map((item) => {
      const methodLabel = item.method === "app" ? "アプリ" : "電話";
      const methodClass = item.method === "app" ? "taxi-method-app" : "taxi-method-tel";

      let callBtn = "";
      if (item.phone) {
        callBtn = `<a href="tel:${item.phone}" class="taxi-call-btn taxi-call-btn-tel">📞 電話する</a>`;
      }

      return `
      <li data-search="${[item.name, item.area, item.phone, item.note, item.method === "app" ? "アプリ" : "電話"].join(" ").toLowerCase()}">
        <div class="name">
          ${createFavButton(category, item)}
          ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name}</a>` : item.name}
          <span class="taxi-method ${methodClass}">${methodLabel}</span>
        </div>
        <div class="meta">対応エリア: ${item.area}</div>
        ${item.phone ? `<div class="meta">電話: ${item.phone}</div>` : ""}
        <div class="meta">${item.note}</div>
        <div>${callBtn}</div>
      </li>
    `;
    })
    .join("");
}

function renderCareSupport(targetId, items) {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.innerHTML = items
    .map((item) => {
      const favBtn = createFavButton("caresupport", item);

      // Registration badge
      let regClass = "care-registration--required";
      if (item.registration === "登録不要") regClass = "care-registration--none";
      else if (item.registration === "要申請") regClass = "care-registration--apply";

      const phoneBtn = item.phone
        ? `<a href="tel:${item.phone}" class="care-call-btn">📞 電話する</a>`
        : "";

      const openBtn = item.url
        ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="care-open-btn">サイトを開く ↗</a>`
        : "";

      return `
      <li data-category="${item.category}" data-search="${[item.name, item.category, item.area, item.phone, item.note, item.cost, item.registration].join(" ").toLowerCase()}">
        <div class="name">
          ${favBtn}
          ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name}</a>` : item.name}
          <span class="care-category">${item.category}</span>
        </div>
        ${item.area ? `<div class="meta">📍 ${item.area}</div>` : ""}
        ${item.phone ? `<div class="meta">📞 ${item.phone}</div>` : ""}
        <div class="meta">${item.note}</div>
        <div>
          <span class="care-registration ${regClass}">${item.registration}</span>
          <span class="care-cost">💰 ${item.cost}</span>
        </div>
        <div>${openBtn}${phoneBtn}</div>
      </li>
    `;
    })
    .join("");
}

function renderGovLinks(targetId, items) {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.innerHTML = items
    .map((item) => {
      const favBtn = createFavButton("govlinks", item);
      return `
      <li data-search="${[item.name, item.category, item.note].join(" ").toLowerCase()}">
        <div class="name">
          ${favBtn}
          <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name}</a>
          <span class="govlink-category">${item.category}</span>
        </div>
        <div class="meta">${item.note}</div>
        <div><a href="${item.url}" target="_blank" rel="noopener noreferrer" class="govlink-open-btn">サイトを開く ↗</a></div>
      </li>
    `;
    })
    .join("");
}

// ===== 応急手当レンダリング =====
function renderFirstAid(emergencyData) {
  // --- バナー描画 ---
  const bannerContainer = document.getElementById("emergencyBanners");
  if (bannerContainer) {
    const bannerItems = (emergencyData || []).filter((item) =>
      item.phone === "#7119" || item.phone === "#8000"
    );
    bannerContainer.innerHTML = bannerItems.map((item) => {
      const cls = item.phone === "#7119" ? "emergency-banner--7119" : "emergency-banner--8000";
      return `
        <a href="tel:${item.phone}" class="emergency-banner ${cls}">
          <div class="emergency-banner-info">
            <div class="emergency-banner-title">📞 ${item.name}</div>
            <div class="emergency-banner-note">${item.note}</div>
          </div>
          <span class="emergency-banner-call">電話する</span>
        </a>
      `;
    }).join("");
  }

  // --- カテゴリナビ描画 ---
  const navContainer = document.getElementById("firstAidNav");
  if (navContainer) {
    navContainer.innerHTML = FIRST_AID_DATA.map((item) =>
      `<button class="firstaid-nav-btn" data-firstaid-target="${item.id}" type="button">${item.icon} ${item.title.replace(/（.+）/, "")}</button>`
    ).join("");
  }

  // --- アコーディオンリスト描画 ---
  const listContainer = document.getElementById("firstAidList");
  if (listContainer) {
    listContainer.innerHTML = FIRST_AID_DATA.map((item) => {
      const searchText = [item.title, item.searchKeywords, item.firstAction,
        ...item.checkpoints.map((c) => c.text),
        ...item.dontDo
      ].join(" ").toLowerCase();

      // 本文の構築
      let bodyHtml = "";
      bodyHtml += `<div class="firstaid-first-action"><span class="firstaid-first-action-label">まずやること</span>${item.firstAction}</div>`;

      bodyHtml += `<div class="firstaid-checkpoints">`;
      item.checkpoints.forEach((cp) => {
        bodyHtml += `<div class="firstaid-checkpoint"><span class="firstaid-checkpoint-label">${cp.label}</span> ${cp.text}</div>`;
      });
      bodyHtml += `</div>`;

      bodyHtml += `<div class="firstaid-dont-section"><div class="firstaid-dont-title">✗ やってはいけないこと</div>`;
      item.dontDo.forEach((d) => {
        bodyHtml += `<div class="firstaid-dont-item">・${d}</div>`;
      });
      bodyHtml += `</div>`;

      // 「休日・夜間」は病院タブへのリンクボタン追加
      if (item.linkToTab) {
        bodyHtml += `<button class="firstaid-link-btn" data-goto-tab="${item.linkToTab}" type="button">🏥 休日・夜間の診療先を見る →</button>`;
      }

      // 参考リンク
      if (item.refUrl) {
        bodyHtml += `<a href="${item.refUrl}" target="_blank" rel="noopener noreferrer" class="firstaid-ref-link">🔗 参考サイトを見る</a>`;
      }

      return `
        <li class="firstaid-item" id="firstaid-${item.id}" data-search="${searchText}">
          <button class="firstaid-header" type="button">
            <span class="firstaid-header-icon">${item.icon}</span>
            <span class="firstaid-header-title">${item.title}</span>
            <span class="firstaid-chevron">▸</span>
          </button>
          <div class="firstaid-body" hidden>${bodyHtml}</div>
        </li>
      `;
    }).join("");
  }
}

function setupFirstAidAccordion() {
  const list = document.getElementById("firstAidList");
  if (!list) return;

  // アコーディオンの排他制御
  list.addEventListener("click", (e) => {
    const header = e.target.closest(".firstaid-header");
    if (!header) return;

    const item = header.closest(".firstaid-item");
    const body = item.querySelector(".firstaid-body");
    const isOpen = !body.hidden;

    // 他のアコーディオンを全て閉じる
    list.querySelectorAll(".firstaid-item").forEach((otherItem) => {
      if (otherItem !== item) {
        otherItem.classList.remove("open");
        const otherBody = otherItem.querySelector(".firstaid-body");
        if (otherBody) otherBody.hidden = true;
      }
    });

    // 自身をトグル
    if (isOpen) {
      item.classList.remove("open");
      body.hidden = true;
    } else {
      item.classList.add("open");
      body.hidden = false;
    }
  });

  // タブ遷移ボタン（休日・夜間 → 病院タブ）
  list.addEventListener("click", (e) => {
    const linkBtn = e.target.closest(".firstaid-link-btn");
    if (!linkBtn) return;
    const tabId = linkBtn.dataset.gotoTab;
    if (tabId && typeof navigateTo === "function") {
      navigateTo(tabId);
      // 病院タブの夜間ペインを表示
      const nightBtn = document.querySelector('[data-hospital-mode="night"]');
      if (nightBtn) nightBtn.click();
    }
  });
}

function setupFirstAidNav() {
  const nav = document.getElementById("firstAidNav");
  if (!nav) return;

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".firstaid-nav-btn");
    if (!btn) return;

    const targetId = btn.dataset.firstaidTarget;
    const targetItem = document.getElementById(`firstaid-${targetId}`);
    if (!targetItem) return;

    const list = document.getElementById("firstAidList");

    // 他のアコーディオンを全て閉じる
    if (list) {
      list.querySelectorAll(".firstaid-item").forEach((item) => {
        item.classList.remove("open");
        const body = item.querySelector(".firstaid-body");
        if (body) body.hidden = true;
      });
    }

    // 対象を開く
    targetItem.classList.add("open");
    const targetBody = targetItem.querySelector(".firstaid-body");
    if (targetBody) targetBody.hidden = false;

    // スクロール
    targetItem.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderAll(data) {
  allData = data;
  renderList("pediatricsList", data.pediatrics || [], "pediatrics");
  renderList("entList", data.ent || [], "ent");
  renderList("dermaList", data.dermatology || [], "dermatology");
  renderFirstAid(data.emergency || []);
  renderList("nightEmergencyList", data.nightEmergency || [], "nightEmergency");
  renderTaxiList("taxiLaborList", data.taxiLabor || [], "taxiLabor");
  renderTaxiList("taxiGeneralList", data.taxiGeneral || [], "taxiGeneral");
  renderCareSupport("careSupportList", data.careSupport || []);
  renderGovLinks("govlinksList", data.governmentLinks || []);
  renderNurseryList(data.nurseries || []);
  renderFavoritesList();
}

// ===== お気に入りリスト =====
const CATEGORY_LABELS = {
  pediatrics: "小児科",
  ent: "耳鼻科",
  dermatology: "皮膚科",
  emergency: "困ったとき",
  nightEmergency: "休日/夜間",
  taxiLabor: "陣痛タクシー",
  taxiGeneral: "通常タクシー",
  taxi: "タクシー",
  govlinks: "行政リンク",
  caresupport: "預け先",
  nursery: "保育園",
};

function renderFavoritesList() {
  const target = document.getElementById("favoritesList");
  const emptyMsg = document.getElementById("favoritesEmpty");
  if (!target) return;

  const favs = getFavorites();

  if (favs.length === 0) {
    target.innerHTML = "";
    if (emptyMsg) emptyMsg.hidden = false;
    return;
  }
  if (emptyMsg) emptyMsg.hidden = true;

  target.innerHTML = favs
    .map((fav) => {
      const item = fav.item;
      const catLabel = CATEGORY_LABELS[fav.category] || fav.category;
      const isTaxi = fav.category === "taxiLabor" || fav.category === "taxiGeneral";

      let callBtn = "";
      if (isTaxi && item.phone) {
        callBtn = `<a href="tel:${item.phone}" class="taxi-call-btn taxi-call-btn-tel">📞 電話する</a>`;
      }

      return `
      <li data-search="${[item.name, item.area, item.phone, item.note].join(" ").toLowerCase()}" data-fav-category="${fav.category}">
        <div class="name">
          <button class="fav-btn fav-btn--active" data-fav-id="${fav.id}" data-category="${fav.category}" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}' title="お気に入りから外す" type="button">★</button>
          ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name}</a>` : item.name}
          <span class="fav-category-badge">${catLabel}</span>
        </div>
        <div class="meta">地域: ${item.area}</div>
        ${item.phone ? `<div class="meta">電話: ${item.phone}</div>` : ""}
        <div class="meta">${item.note}</div>
        ${callBtn ? `<div>${callBtn}</div>` : ""}
      </li>
    `;
    })
    .join("");

  updateFavCountBadge();
}

// ===== お気に入りボタンのクリックハンドラ =====
function setupFavoriteClicks() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".fav-btn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const favId = btn.dataset.favId;
    const category = btn.dataset.category;
    const item = JSON.parse(btn.dataset.item);

    const added = toggleFavorite(favId, category, item);

    // Update all buttons with same favId
    document.querySelectorAll(`.fav-btn[data-fav-id="${CSS.escape(favId)}"]`).forEach((b) => {
      b.classList.toggle("fav-btn--active", added);
      b.textContent = added ? "★" : "☆";
      b.title = added ? "お気に入りから外す" : "お気に入りに追加";
    });

    renderFavoritesList();
    showToast(added ? "お気に入りに追加しました" : "お気に入りから外しました");
  });
}

// ===== タブ・ナビゲーション =====
const TAB_IDS = ["hospital", "emergency", "taxi", "nursery", "caresupport", "govlinks", "calendar", "shopping", "supplies", "kondate"];

function navigateTo(target) {
  const homeView = document.getElementById("homeView");
  const listView = document.getElementById("listView");
  const searchInput = document.getElementById("searchInput");

  // Clear search when navigating
  if (searchInput) {
    searchInput.value = "";
    document.querySelectorAll("[data-search]").forEach((card) => {
      card.style.display = "";
    });
    document.querySelectorAll(".calendar-period").forEach((period) => {
      period.style.display = "";
    });
    clearHighlights();
    updateSearchResultInfo(0, "");
  }

  currentTab = target;
  localStorage.setItem("currentTab", target);

  if (target === "home") {
    if (listView) listView.hidden = true;
    if (homeView) homeView.hidden = false;
  } else {
    if (homeView) homeView.hidden = true;
    if (listView) listView.hidden = false;
    showTab(target);
  }
  updateHeaderNav(target);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showTab(tabId) {
  TAB_IDS.forEach((id) => {
    const panel = document.getElementById(id);
    if (panel) panel.hidden = id !== tabId;
  });

  // Restore hospital sub-pane visibility after search
  if (tabId === "hospital") {
    const savedMode = localStorage.getItem("hospitalMode") || "pediatrics";
    const hospitalPanes = { pediatrics: "pediatricsPane", ent: "entPane", derma: "dermaPane", night: "nightPane" };
    Object.entries(hospitalPanes).forEach(([key, paneId]) => {
      const pane = document.getElementById(paneId);
      if (pane) pane.hidden = key !== savedMode;
    });
  }
}

function updateHeaderNav(activeNav) {
  document.querySelectorAll(".header-nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === activeNav);
  });
  // Scroll active nav item into view
  const activeBtn = document.querySelector(".header-nav-item.active");
  if (activeBtn) {
    activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

function setupNavigation() {
  // ホームカード
  document.querySelectorAll(".home-card[data-tab]").forEach((card) => {
    card.addEventListener("click", () => {
      navigateTo(card.dataset.tab);
    });
  });

  // ヘッダーナビ
  document.querySelectorAll(".header-nav-item[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigateTo(btn.dataset.nav);
    });
  });
}

// ===== スワイプナビゲーション =====
function setupSwipeNavigation() {
  const ALL_TABS = ["home", ...TAB_IDS];
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let isSwiping = false; // 横スワイプ確定フラグ

  function isExcluded(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el.closest(".leaflet-container, .header-nav, input, textarea");
  }

  function handleSwipeEnd(endX) {
    const dx = endX - startX;
    const currentIndex = ALL_TABS.indexOf(currentTab);
    if (currentIndex === -1) return;
    if (dx < 0 && currentIndex < ALL_TABS.length - 1) {
      navigateTo(ALL_TABS[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      navigateTo(ALL_TABS[currentIndex - 1]);
    }
  }

  // --- タッチイベント（スマホ） ---
  document.addEventListener("touchstart", (e) => {
    isSwiping = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (isExcluded(startX, startY)) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    // 横方向の移動が縦より大きければ横スワイプと判定し、ブラウザのジェスチャーを抑制
    if (!isSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping = true;
    }
    if (isSwiping) {
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("touchend", (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    const dt = Date.now() - startTime;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) || dt > 500) return;
    handleSwipeEnd(e.changedTouches[0].clientX);
  }, { passive: true });

  // --- マウスイベント（PC） ---
  let mouseDown = false;
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    mouseDown = true;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
  });

  document.addEventListener("mouseup", (e) => {
    if (!mouseDown) return;
    mouseDown = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dt = Date.now() - startTime;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) || dt > 500) return;
    if (isExcluded(startX, startY)) return;
    handleSwipeEnd(e.clientX);
  });
}

// ===== 病院 小児科/耳鼻科 切替 =====
function setupHospitalToggle() {
  const toggleBtns = document.querySelectorAll(".hospital-toggle-btn");
  const panes = {
    pediatrics: document.getElementById("pediatricsPane"),
    ent: document.getElementById("entPane"),
    derma: document.getElementById("dermaPane"),
    night: document.getElementById("nightPane"),
  };

  // 保存された選択状態を復元
  const savedMode = localStorage.getItem("hospitalMode");
  if (savedMode && panes[savedMode]) {
    toggleBtns.forEach((b) => {
      b.classList.toggle("active", b.dataset.hospitalMode === savedMode);
    });
    Object.entries(panes).forEach(([key, pane]) => {
      if (pane) pane.hidden = key !== savedMode;
    });
  }

  toggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const mode = btn.dataset.hospitalMode;
      localStorage.setItem("hospitalMode", mode);
      Object.entries(panes).forEach(([key, pane]) => {
        if (pane) pane.hidden = key !== mode;
      });
    });
  });
}

// ===== タクシー通常/陣痛 切替 =====
function setupTaxiToggle() {
  const toggleBtns = document.querySelectorAll(".taxi-toggle-btn");
  const generalPane = document.getElementById("taxiGeneralPane");
  const laborPane = document.getElementById("taxiLaborPane");

  // 保存された選択状態を復元
  const savedMode = localStorage.getItem("taxiMode");
  if (savedMode) {
    toggleBtns.forEach((b) => {
      b.classList.toggle("active", b.dataset.taxiMode === savedMode);
    });
    if (generalPane) generalPane.hidden = savedMode !== "general";
    if (laborPane) laborPane.hidden = savedMode !== "labor";
  }

  toggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const mode = btn.dataset.taxiMode;
      localStorage.setItem("taxiMode", mode);
      if (generalPane) generalPane.hidden = mode !== "general";
      if (laborPane) laborPane.hidden = mode !== "labor";
    });
  });
}

// ===== 預け先カテゴリフィルター =====
function setupCareFilter() {
  const filterBtns = document.querySelectorAll(".care-filter-btn");
  if (!filterBtns.length) return;

  // 保存された選択状態を復元
  const savedFilter = localStorage.getItem("careFilter");
  if (savedFilter) {
    filterBtns.forEach((b) => {
      b.classList.toggle("active", b.dataset.careFilter === savedFilter);
    });
    applyCareFilter();
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      localStorage.setItem("careFilter", btn.dataset.careFilter);
      applyCareFilter();
    });
  });
}

function applyCareFilter() {
  const active = document.querySelector(".care-filter-btn.active");
  const filter = active ? active.dataset.careFilter : "all";
  document.querySelectorAll("#careSupportList li").forEach((li) => {
    li.style.display = filter === "all" || li.dataset.category === filter ? "" : "none";
  });
}

// ===== トップに戻るボタン =====
function setupScrollTop() {
  const btn = document.getElementById("scrollTopBtn");
  if (!btn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 200) {
      btn.hidden = false;
      requestAnimationFrame(() => btn.classList.add("visible"));
    } else {
      btn.classList.remove("visible");
    }
  }, { passive: true });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ===== 応急手当データ =====
const FIRST_AID_DATA = [
  {
    id: "fever",
    icon: "🌡️",
    title: "発熱（38℃以上）",
    firstAction: "脇の下・首・太ももの付け根を冷やす。水分をこまめに少量ずつ与える",
    checkpoints: [
      { label: "🚑 救急車", text: "3か月未満で38℃以上 / 意識がもうろう / けいれんが5分以上続く" },
      { label: "🏥 受診", text: "生後3〜6か月で38℃以上 / 水分が取れない / ぐったりしている / 高熱が3日以上続く" },
      { label: "🏠 様子見", text: "機嫌がよく遊べる / 水分が取れる / 38.5℃未満で元気" }
    ],
    dontDo: ["厚着にさせない（熱がこもる）", "自己判断で解熱剤を使わない（医師の指示に従う）", "氷水や冷水で体全体を冷やさない"],
    searchKeywords: "熱 発熱 高熱 38度 39度 40度 体温",
    refUrl: "https://kodomo-qq.jp/index.php?pname=fever"
  },
  {
    id: "vomiting",
    icon: "🤮",
    title: "嘔吐",
    firstAction: "横向き（回復体位）に寝かせて、吐いたもので窒息しないようにする",
    checkpoints: [
      { label: "🚑 救急車", text: "頭を打った後に嘔吐 / 意識がぼんやり / 緑色の嘔吐物" },
      { label: "🏥 受診", text: "半日以上吐き続ける / おしっこが半日出ない / ぐったり / 血が混じる" },
      { label: "🏠 様子見", text: "1〜2回吐いた後に元気 / 水分が少しずつ取れる" }
    ],
    dontDo: ["吐いた直後に水分を大量に飲ませない（少量ずつ）", "仰向けに寝かせない（窒息の危険）", "無理に食べさせない"],
    searchKeywords: "嘔吐 吐く はく おうと 吐き気 もどす",
    refUrl: "https://kodomo-qq.jp/index.php?pname=vomiting"
  },
  {
    id: "diarrhea",
    icon: "💧",
    title: "下痢",
    firstAction: "経口補水液やお茶で水分をこまめに補給する。おしりかぶれに注意",
    checkpoints: [
      { label: "🚑 救急車", text: "血便が大量に出る / 意識がもうろう / ぐったりして反応が弱い" },
      { label: "🏥 受診", text: "水様便が1日6回以上 / 血や粘液が混じる / おしっこが半日出ない / 高熱を伴う" },
      { label: "🏠 様子見", text: "機嫌がよい / 水分が取れる / 食欲がある" }
    ],
    dontDo: ["市販の下痢止めを自己判断で使わない", "脂っこい食事やジュースを与えない", "おしりを強くこすらない（ぬるま湯で洗い流す）"],
    searchKeywords: "下痢 げり おなか 腹痛 水便 軟便",
    refUrl: "https://kodomo-qq.jp/index.php?pname=diarrhea"
  },
  {
    id: "seizure",
    icon: "⚡",
    title: "けいれん・ひきつけ",
    firstAction: "平らな場所に寝かせ、横向きにする。時間を計る。体を押さえつけない",
    checkpoints: [
      { label: "🚑 救急車", text: "5分以上続く / 初めてのけいれん / 意識が戻らない / 左右非対称の動き" },
      { label: "🏥 受診", text: "短時間で止まっても初回は必ず受診 / 24時間以内に繰り返す / 38℃未満でけいれん" },
      { label: "🏠 様子見", text: "熱性けいれんの既往あり・医師の指示済みで、5分未満で意識が戻った場合" }
    ],
    dontDo: ["口に物を入れない（舌を噛むのを防ぐためは誤り）", "体を強く揺すらない・押さえつけない", "大声で名前を呼び続けない（静かに見守る）"],
    searchKeywords: "けいれん ひきつけ 痙攣 てんかん 熱性けいれん ガクガク",
    refUrl: "https://kodomo-qq.jp/index.php?pname=convulsion"
  },
  {
    id: "ingestion",
    icon: "⚠️",
    title: "誤飲・誤食",
    firstAction: "口の中に残っていれば取り除く。何を・いつ・どのくらい飲んだか確認する",
    checkpoints: [
      { label: "🚑 救急車", text: "ボタン電池・磁石・灯油・漂白剤・除光液を飲んだ / 意識がない / 呼吸困難" },
      { label: "🏥 受診", text: "タバコを食べた（2cm以上） / 医薬品を飲んだ / 尖ったものを飲み込んだ" },
      { label: "📞 相談", text: "判断に迷ったら → 中毒110番（072-727-2499 / 24h: 029-852-9999）" }
    ],
    dontDo: ["むやみに吐かせない（灯油・漂白剤等は吐かせると危険）", "水や牛乳を慌てて飲ませない（物質による）", "様子見で済ませない（ボタン電池は特に緊急）"],
    searchKeywords: "誤飲 誤食 飲み込んだ のみこんだ 異物 ボタン電池 タバコ 中毒",
    refUrl: "https://www.j-poison-ic.jp/ippan/"
  },
  {
    id: "burn",
    icon: "🔥",
    title: "やけど",
    firstAction: "すぐに流水で20分以上冷やす。服の上からでもOK。無理に脱がさない",
    checkpoints: [
      { label: "🚑 救急車", text: "広範囲（手のひら以上）のやけど / 顔・関節・陰部 / 水ぶくれが多い" },
      { label: "🏥 受診", text: "水ぶくれができた / 皮膚が白い・茶色い / 範囲が広い / 乳児のやけど" },
      { label: "🏠 様子見", text: "赤みだけで水ぶくれなし / 小さい範囲で痛みが軽い" }
    ],
    dontDo: ["氷で直接冷やさない（凍傷の危険）", "水ぶくれを潰さない", "民間療法（味噌・アロエ等）を塗らない"],
    searchKeywords: "やけど 火傷 熱湯 アイロン ストーブ 湯たんぽ 低温やけど",
    refUrl: "https://kodomo-qq.jp/index.php?pname=burn"
  },
  {
    id: "injury",
    icon: "🩹",
    title: "けが・出血",
    firstAction: "清潔なガーゼやタオルで傷口を直接押さえて止血する（圧迫止血）",
    checkpoints: [
      { label: "🚑 救急車", text: "出血が止まらない（15分以上） / 深い切り傷 / 頭を強打して意識がぼんやり" },
      { label: "🏥 受診", text: "傷口がパックリ開いている / 汚れた物での傷 / 動物に噛まれた / 頭を打った" },
      { label: "🏠 様子見", text: "小さなすり傷 / 出血がすぐ止まった / 元気に動いている" }
    ],
    dontDo: ["傷口を消毒液で繰り返し消毒しない（水道水で洗い流す）", "頭を打った直後に寝かせっぱなしにしない（48時間は注意して観察）", "止血帯を素人が巻かない"],
    searchKeywords: "けが 怪我 出血 切り傷 すり傷 打撲 頭 打った 転んだ",
    refUrl: "https://kodomo-qq.jp/index.php?pname=injury"
  },
  {
    id: "crying",
    icon: "😢",
    title: "泣き止まない",
    firstAction: "おむつ・空腹・暑さ寒さ・体調をチェック。抱っこして優しく揺らす",
    checkpoints: [
      { label: "🚑 救急車", text: "顔色が悪い（青白い・紫） / ぐったりして泣き方が弱い / 嘔吐やけいれんを伴う" },
      { label: "🏥 受診", text: "いつもと明らかに違う泣き方 / 3時間以上泣き止まない / 発熱を伴う / お腹が張っている" },
      { label: "🏠 様子見", text: "抱っこやおくるみで落ち着く / 授乳で落ち着く / 機嫌にムラがあるだけ" }
    ],
    dontDo: ["絶対に揺さぶらない（揺さぶられっ子症候群の危険）", "イライラしたら赤ちゃんを安全な場所に置いて一度離れる", "泣くことを異常と決めつけない（泣くのは正常な表現）"],
    searchKeywords: "泣き止まない 泣く 夜泣き ぐずる ギャン泣き 泣き続ける コリック",
    refUrl: "https://kodomo-qq.jp/"
  },
  {
    id: "rash",
    icon: "🔴",
    title: "発疹・じんましん",
    firstAction: "全身の状態を観察。かゆみがあれば冷たいタオルで冷やす。爪を短く切る",
    checkpoints: [
      { label: "🚑 救急車", text: "呼吸が苦しい・顔が腫れる（アナフィラキシー） / 唇や舌が腫れる / ぐったり" },
      { label: "🏥 受診", text: "全身に広がる発疹 / 高熱を伴う / 水ぶくれができる / 食事の後に出た" },
      { label: "🏠 様子見", text: "一部分だけで全身状態がよい / 数時間で消える / かゆみが軽い" }
    ],
    dontDo: ["強く掻かせない（とびひになる）", "自己判断でステロイド軟膏を塗らない", "原因食物が疑われる場合は自己判断で除去しない（医師に相談）"],
    searchKeywords: "発疹 じんましん 蕁麻疹 ぶつぶつ 湿疹 アレルギー かゆい アトピー 水疱瘡 手足口病",
    refUrl: "https://kodomo-qq.jp/index.php?pname=rash"
  },
  {
    id: "breathing",
    icon: "💨",
    title: "咳・呼吸が苦しい",
    firstAction: "上体を起こした姿勢にする。室内を適度に加湿する。落ち着かせる",
    checkpoints: [
      { label: "🚑 救急車", text: "呼吸が速い・肩で息 / 唇や顔色が紫（チアノーゼ） / ゼーゼーして苦しそう / 異物で喉が詰まった" },
      { label: "🏥 受診", text: "犬が吠えるような咳（クループ） / 夜中に咳で眠れない / 喘息の発作 / 水分が取れない" },
      { label: "🏠 様子見", text: "たまにコンコンする程度 / 元気で食欲あり / 鼻水程度" }
    ],
    dontDo: ["仰向けに寝かせない（咳がひどくなる）", "煙や強い匂いのある場所に置かない", "喉に詰まった異物を指で探らない（背部叩打法を）"],
    searchKeywords: "咳 せき ゼーゼー 呼吸 息苦しい クループ 喘息 ぜんそく 窒息 喉 のど",
    refUrl: "https://kodomo-qq.jp/index.php?pname=cough"
  },
  {
    id: "feeding",
    icon: "🍼",
    title: "授乳・ミルクの悩み",
    firstAction: "飲まないときは無理せず時間を空ける。体重の増え方を記録して確認する",
    checkpoints: [
      { label: "🏥 受診", text: "体重が減り続ける / おしっこが1日4回未満 / ぐったりして起きない / 嘔吐が続く" },
      { label: "📞 相談", text: "母乳の出が心配 / ミルクの量がわからない → かかりつけ医・助産師に相談" },
      { label: "🏠 様子見", text: "体重が順調に増えている / 機嫌がよい / おしっこ・うんちが出ている" }
    ],
    dontDo: ["1回の量や間隔を厳密に決めすぎない（個人差が大きい）", "ミルクを足すか迷ったら自己判断せず相談", "母乳が出ないと思い込まない（専門家に相談を）"],
    searchKeywords: "授乳 ミルク 母乳 飲まない 乳腺炎 哺乳瓶 体重 おっぱい",
    refUrl: "https://www.mhlw.go.jp/shingi/2007/03/dl/s0314-17.pdf"
  },
  {
    id: "nosebleed",
    icon: "👃",
    title: "鼻血",
    firstAction: "やや下を向かせて、小鼻（骨より下の柔らかい部分）を親指と人差し指で10分しっかりつまむ",
    checkpoints: [
      { label: "🚑 救急車", text: "30分以上止まらない / 大量出血 / 頭を打った後の鼻血 / 意識がぼんやり" },
      { label: "🏥 受診", text: "15分押さえても止まらない / 週に何度も繰り返す / あざができやすい" },
      { label: "🏠 様子見", text: "10分以内に止まった / 元気で他に症状がない" }
    ],
    dontDo: ["上を向かせない（血を飲み込んで吐き気の原因に）", "ティッシュを詰め込まない（抜くとき再出血する）", "首の後ろを叩かない（効果なし）"],
    searchKeywords: "鼻血 はなぢ 鼻出血",
    refUrl: "https://kodomo-qq.jp/"
  },
  {
    id: "night",
    icon: "🌙",
    title: "休日・夜間の受診",
    firstAction: "まず #7119 または #8000 に電話して相談。受診が必要か判断してもらう",
    checkpoints: [
      { label: "🚑 救急車", text: "意識がない / 呼吸していない / けいれん / 大量出血" },
      { label: "🌙 夜間診療", text: "高熱＋ぐったり / 嘔吐が止まらない / 呼吸が苦しそう" },
      { label: "⏰ 翌朝受診", text: "熱はあるが元気 / 軽い咳や鼻水 / 食欲がある" }
    ],
    dontDo: ["迷ったときに我慢して朝まで待たない（#7119/#8000に電話）", "夜間診療に行く前に電話確認を忘れない", "保険証・医療証・お薬手帳を忘れない"],
    searchKeywords: "休日 夜間 救急 急患 夜中 深夜 日曜 祝日 年末年始",
    linkToTab: "hospital",
    refUrl: ""
  },
  {
    id: "disaster",
    icon: "🆘",
    title: "災害時",
    firstAction: "まず子どもの安全を確保。落下物から頭を守る。慌てず避難経路を確認",
    checkpoints: [
      { label: "📞 安否確認", text: "171（災害用伝言ダイヤル）→ 録音は「1」、再生は「2」→ 相手の電話番号を入力" },
      { label: "📱 Web171", text: "https://www.web171.jp/ でテキストによる安否登録・確認も可能" },
      { label: "🏠 備え", text: "おむつ・ミルク・離乳食・常備薬・母子手帳コピーを非常袋に入れておく" }
    ],
    dontDo: ["エレベーターを使って避難しない", "子どもを一人にしない", "デマ情報に惑わされない（公式情報を確認）"],
    searchKeywords: "災害 地震 避難 171 伝言ダイヤル 防災 台風 津波",
    refUrl: "https://www.bousai.go.jp/"
  }
];

// ===== 検索 =====
let currentTab = "home";
const SEARCH_HISTORY_KEY = "familyGuide_searchHistory";
const SEARCH_HISTORY_MAX = 7;

function getSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveSearchHistory(history) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function addToSearchHistory(keyword) {
  if (!keyword || keyword.length < 2) return;
  let history = getSearchHistory();
  // Remove duplicate, add to front
  history = history.filter((h) => h !== keyword);
  history.unshift(keyword);
  if (history.length > SEARCH_HISTORY_MAX) history = history.slice(0, SEARCH_HISTORY_MAX);
  saveSearchHistory(history);
}

function removeFromSearchHistory(keyword) {
  const history = getSearchHistory().filter((h) => h !== keyword);
  saveSearchHistory(history);
  renderSearchHistory();
}

function clearSearchHistory() {
  saveSearchHistory([]);
  renderSearchHistory();
}

function renderSearchHistory() {
  const container = document.getElementById("searchHistory");
  const list = document.getElementById("searchHistoryList");
  if (!container || !list) return;

  const history = getSearchHistory();
  if (history.length === 0) {
    container.hidden = true;
    return;
  }

  list.innerHTML = history
    .map(
      (kw) => `
      <li>
        <span class="search-history-keyword" data-keyword="${kw.replace(/"/g, "&quot;")}">${kw.replace(/</g, "&lt;")}</span>
        <button class="search-history-delete" data-delete-keyword="${kw.replace(/"/g, "&quot;")}" type="button" aria-label="削除">&times;</button>
      </li>
    `
    )
    .join("");
}

function showSearchHistory() {
  const container = document.getElementById("searchHistory");
  if (!container) return;
  const history = getSearchHistory();
  if (history.length === 0) {
    container.hidden = true;
    return;
  }
  renderSearchHistory();
  container.hidden = false;
}

function hideSearchHistory() {
  const container = document.getElementById("searchHistory");
  if (container) container.hidden = true;
}

// 同義語マッピング: ユーザーが入力しそうなワード → 検索対象に含まれるワード
const SEARCH_SYNONYMS = {
  "熱": ["急患", "救急", "夜間", "体調"],
  "発熱": ["急患", "救急", "夜間", "体調"],
  "注射": ["予防接種", "ワクチン"],
  "肌": ["皮膚科", "アレルギー"],
  "肌荒れ": ["皮膚科", "アレルギー"],
  "湿疹": ["皮膚科", "アレルギー"],
  "耳": ["耳鼻科", "耳鼻咽喉科"],
  "鼻": ["耳鼻科", "耳鼻咽喉科"],
  "預ける": ["一時預かり", "シッター", "病児保育", "ファミサポ", "託児"],
  "預け": ["一時預かり", "シッター", "病児保育", "ファミサポ", "託児"],
  "お金": ["児童手当", "助成", "手当", "助成金"],
  "手当": ["児童手当", "助成"],
  "母乳": ["母乳外来", "助産"],
  "おっぱい": ["母乳外来", "助産"],
  "タクシー": ["配車", "タクシー"],
  "陣痛": ["陣痛タクシー", "マタニティ"],
  "小児科": ["小児科", "こども", "クリニック"],
  "救急": ["急患", "救急", "夜間", "#7119", "#8000"],
  "夜間": ["夜間急病", "救急"],
  "保育": ["保育所", "保育園", "一時預かり", "病児保育", "認可", "認可外", "小規模"],
  "保活": ["保育園", "認可", "見学", "申込"],
  "園": ["保育園", "こども園", "認定"],
  "風邪": ["小児科", "急患", "救急"],
  "アレルギー": ["アレルギー", "皮膚科", "耳鼻科"],
  "嘔吐": ["吐く", "はく", "おうと", "嘔吐", "もどす"],
  "吐く": ["嘔吐", "おうと"],
  "下痢": ["おなか", "げり", "水便"],
  "けいれん": ["ひきつけ", "痙攣", "熱性けいれん"],
  "ひきつけ": ["けいれん", "痙攣"],
  "誤飲": ["飲み込んだ", "誤食", "のみこんだ", "ボタン電池"],
  "やけど": ["火傷", "熱湯", "アイロン"],
  "けが": ["出血", "怪我", "切り傷", "打撲"],
  "泣き止まない": ["泣く", "夜泣き", "ぐずる", "ギャン泣き"],
  "夜泣き": ["泣き止まない", "泣く", "ぐずる"],
  "発疹": ["じんましん", "蕁麻疹", "ぶつぶつ", "湿疹"],
  "じんましん": ["発疹", "蕁麻疹", "ぶつぶつ"],
  "咳": ["せき", "ゼーゼー", "呼吸", "クループ", "喘息"],
  "息苦しい": ["呼吸", "ゼーゼー", "喘息"],
  "鼻血": ["はなぢ", "鼻出血"],
  "災害": ["地震", "避難", "171", "伝言ダイヤル", "防災"],
  "地震": ["災害", "避難", "171"],
  "ミルク": ["授乳", "母乳", "哺乳瓶"],
  "休日": ["夜間", "急患", "救急", "休日・夜間"],
};

function expandSearchKeywords(keyword) {
  const keywords = [keyword];
  for (const [trigger, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
    if (keyword.includes(trigger)) {
      keywords.push(...synonyms);
    }
  }
  return [...new Set(keywords)];
}

function highlightText(element, keyword) {
  // Remove existing highlights
  element.querySelectorAll("mark.search-highlight").forEach((mark) => {
    mark.replaceWith(mark.textContent);
  });
  if (!keyword) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  const lowerKeyword = keyword.toLowerCase();
  textNodes.forEach((node) => {
    const text = node.textContent;
    const lowerText = text.toLowerCase();
    const idx = lowerText.indexOf(lowerKeyword);
    if (idx === -1) return;
    // Skip text nodes inside buttons, inputs, etc.
    if (node.parentElement.closest("button, input, textarea, .fav-btn")) return;

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + keyword.length);
    const after = text.slice(idx + keyword.length);

    const mark = document.createElement("mark");
    mark.className = "search-highlight";
    mark.textContent = match;

    const fragment = document.createDocumentFragment();
    if (before) fragment.appendChild(document.createTextNode(before));
    fragment.appendChild(mark);
    if (after) fragment.appendChild(document.createTextNode(after));
    node.replaceWith(fragment);
  });
}

function clearHighlights() {
  document.querySelectorAll("mark.search-highlight").forEach((mark) => {
    mark.replaceWith(mark.textContent);
  });
}

function updateSearchResultInfo(count, keyword) {
  const info = document.getElementById("searchResultInfo");
  if (!info) return;
  if (!keyword) {
    info.hidden = true;
    info.textContent = "";
    return;
  }
  info.hidden = false;
  if (count === 0) {
    info.textContent = `「${keyword}」に該当する情報が見つかりませんでした`;
    info.className = "search-result-info search-result-info--empty";
  } else {
    info.textContent = `「${keyword}」の検索結果: ${count}件`;
    info.className = "search-result-info";
  }
}

function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  let historyDebounceTimer = null;

  searchInput.addEventListener("input", (event) => {
    const rawKeyword = String(event.target.value || "").trim();
    const keyword = rawKeyword.toLowerCase();

    // Hide history dropdown while typing
    hideSearchHistory();

    if (!keyword) {
      // Clear: show all items, go back to current view
      document.querySelectorAll("[data-search]").forEach((card) => {
        card.style.display = "";
      });
      // Restore calendar period visibility
      document.querySelectorAll(".calendar-period").forEach((period) => {
        period.style.display = "";
      });
      clearHighlights();
      updateSearchResultInfo(0, "");
      // Restore the view to the current tab
      navigateTo(currentTab);
      clearTimeout(historyDebounceTimer);
      return;
    }

    // Expand keyword with synonyms
    const keywords = expandSearchKeywords(keyword);

    // Always switch to showing all panels for site-wide search
    const homeView = document.getElementById("homeView");
    const listView = document.getElementById("listView");
    if (homeView) homeView.hidden = true;
    if (listView) listView.hidden = false;
    TAB_IDS.forEach((id) => {
      const panel = document.getElementById(id);
      if (panel) panel.hidden = false;
    });

    let totalMatches = 0;

    // Filter items across ALL panels (site-wide search)
    const panels = TAB_IDS;
    panels.forEach((tabId) => {
      const panel = document.getElementById(tabId);
      if (!panel) return;

      // Handle list items (li[data-search])
      const items = panel.querySelectorAll("li[data-search]");
      let hasMatch = false;
      items.forEach((card) => {
        const text = card.getAttribute("data-search") || "";
        const match = keywords.some((kw) => text.includes(kw));
        card.style.display = match ? "" : "none";
        if (match) {
          hasMatch = true;
          totalMatches++;
          highlightText(card, rawKeyword);
          // 応急手当アコーディオンを自動展開
          if (card.classList.contains("firstaid-item")) {
            card.classList.add("open");
            const body = card.querySelector(".firstaid-body");
            if (body) body.hidden = false;
          }
        } else {
          highlightText(card, "");
          // 非マッチの応急手当アコーディオンを閉じる
          if (card.classList.contains("firstaid-item")) {
            card.classList.remove("open");
            const body = card.querySelector(".firstaid-body");
            if (body) body.hidden = true;
          }
        }
      });

      // Handle calendar items (div[data-search])
      if (tabId === "calendar") {
        const calendarItems = panel.querySelectorAll(".calendar-item[data-search]");
        calendarItems.forEach((item) => {
          const text = item.getAttribute("data-search") || "";
          const match = keywords.some((kw) => text.includes(kw));
          item.style.display = match ? "" : "none";
          if (match) {
            hasMatch = true;
            totalMatches++;
            highlightText(item, rawKeyword);
          } else {
            highlightText(item, "");
          }
        });
        // Hide calendar periods with no visible items
        panel.querySelectorAll(".calendar-period").forEach((period) => {
          const visibleItems = period.querySelectorAll(".calendar-item[data-search]");
          const anyVisible = Array.from(visibleItems).some((item) => item.style.display !== "none");
          period.style.display = anyVisible ? "" : "none";
        });
      }

      // Show all hospital sub-panes during search so matched items are visible
      if (tabId === "hospital" && hasMatch) {
        panel.querySelectorAll("#pediatricsPane, #entPane, #dermaPane, #nightPane").forEach((pane) => {
          pane.hidden = false;
        });
      }

      // Hide panels with no matches
      panel.hidden = !hasMatch;
    });

    updateSearchResultInfo(totalMatches, rawKeyword);

    // Save to search history (debounced, only if results found)
    clearTimeout(historyDebounceTimer);
    if (totalMatches > 0) {
      historyDebounceTimer = setTimeout(() => {
        addToSearchHistory(rawKeyword);
      }, 800);
    }
  });

  // Show history on focus (if input is empty)
  searchInput.addEventListener("focus", () => {
    if (!searchInput.value.trim()) {
      showSearchHistory();
    }
  });

  // Hide history on blur (with delay for click)
  searchInput.addEventListener("blur", () => {
    setTimeout(hideSearchHistory, 150);
  });

  // Handle clicks on history items and delete buttons
  const historyContainer = document.getElementById("searchHistory");
  if (historyContainer) {
    historyContainer.addEventListener("mousedown", (e) => {
      // Prevent blur from hiding the dropdown before click registers
      e.preventDefault();
    });
    historyContainer.addEventListener("click", (e) => {
      const deleteBtn = e.target.closest(".search-history-delete");
      if (deleteBtn) {
        const kw = deleteBtn.dataset.deleteKeyword;
        removeFromSearchHistory(kw);
        // Keep focus on input, re-show history
        searchInput.focus();
        showSearchHistory();
        return;
      }
      const kwSpan = e.target.closest(".search-history-keyword");
      if (kwSpan) {
        const kw = kwSpan.dataset.keyword;
        searchInput.value = kw;
        searchInput.dispatchEvent(new Event("input"));
        hideSearchHistory();
        searchInput.focus();
      }
    });
  }

  // Clear all history button
  const clearBtn = document.getElementById("clearSearchHistory");
  if (clearBtn) {
    clearBtn.addEventListener("mousedown", (e) => e.preventDefault());
    clearBtn.addEventListener("click", () => {
      clearSearchHistory();
      searchInput.focus();
    });
  }
}

function setStatusMessage(message) {
  const status = document.getElementById("statusMessage");
  if (!status) return;
  status.textContent = message;
}

// ===== 共有機能 =====
function setupShare() {
  const shareBtn = document.getElementById("shareFavBtn");
  const shareModal = document.getElementById("shareModal");
  const shareUrlEl = document.getElementById("shareUrl");
  const copyBtn = document.getElementById("copyShareBtn");
  const closeBtn = document.getElementById("closeShareBtn");

  if (!shareBtn) return;

  shareBtn.addEventListener("click", () => {
    const favs = getFavorites();
    if (favs.length === 0) {
      showToast("お気に入りがありません");
      return;
    }

    // Encode favorites as compact data
    const shareData = favs.map((f) => ({
      id: f.id,
      c: f.category,
      i: f.item,
    }));
    const encoded = btoa(new TextEncoder().encode(JSON.stringify(shareData)).reduce((s, b) => s + String.fromCharCode(b), ""));
    const url = `${location.origin}${location.pathname}?favs=${encoded}`;

    shareUrlEl.value = url;
    shareModal.hidden = false;
  });

  copyBtn.addEventListener("click", () => {
    const url = shareUrlEl.value;
    navigator.clipboard.writeText(url).then(() => {
      showToast("コピーしました！家族に送りましょう");
      shareModal.hidden = true;
    }).catch(() => {
      shareUrlEl.select();
      showToast("上のリンクを長押しでコピーしてください");
    });
  });

  closeBtn.addEventListener("click", () => {
    shareModal.hidden = true;
  });

  shareModal.addEventListener("click", (e) => {
    if (e.target === shareModal) shareModal.hidden = true;
  });
}

function checkImport() {
  const params = new URLSearchParams(location.search);
  const favsParam = params.get("favs");
  if (!favsParam) return;

  // URLパラメータを即座にクリア（重複表示防止）
  clearUrlParams();

  try {
    const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(favsParam), (c) => c.charCodeAt(0))));
    const incoming = decoded.map((d) => ({
      id: d.id,
      category: d.c,
      item: d.i,
    }));

    if (!incoming.length) return;

    const importModal = document.getElementById("importModal");
    const importMsg = document.getElementById("importMessage");
    const mergeBtn = document.getElementById("importMergeBtn");
    const replaceBtn = document.getElementById("importReplaceBtn");
    const cancelBtn = document.getElementById("importCancelBtn");

    importMsg.textContent = `${incoming.length}件のお気に入りが共有されました。`;
    importModal.hidden = false;

    function closeImport() {
      importModal.hidden = true;
    }

    mergeBtn.onclick = () => {
      const current = getFavorites();
      const existingIds = new Set(current.map((f) => f.id));
      const newItems = incoming.filter((f) => !existingIds.has(f.id));
      saveFavorites([...current, ...newItems]);
      closeImport();
      renderAll(allData);
      showToast(`${newItems.length}件を追加しました`);
    };

    replaceBtn.onclick = () => {
      saveFavorites(incoming);
      closeImport();
      renderAll(allData);
      showToast(`${incoming.length}件に置き換えました`);
    };

    cancelBtn.onclick = closeImport;

    importModal.addEventListener("click", (e) => {
      if (e.target === importModal) closeImport();
    });
  } catch (err) {
    console.error("Import error:", err);
    showToast("共有リンクの読み込みに失敗しました");
  }
}

function clearUrlParams() {
  history.replaceState(null, "", location.pathname);
}

// ===== トースト =====
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.remove("toast--hide");
  toast.classList.add("toast--show");

  setTimeout(() => {
    toast.classList.remove("toast--show");
    toast.classList.add("toast--hide");
    setTimeout(() => {
      toast.hidden = true;
    }, 300);
  }, 2000);
}

// ===== 位置情報による区判定 =====
const YOKOHAMA_WARDS = {
  "鶴見区":    { latMin: 35.480, latMax: 35.530, lngMin: 139.660, lngMax: 139.720 },
  "神奈川区":  { latMin: 35.470, latMax: 35.500, lngMin: 139.620, lngMax: 139.660 },
  "西区":      { latMin: 35.445, latMax: 35.475, lngMin: 139.610, lngMax: 139.640 },
  "中区":      { latMin: 35.420, latMax: 35.455, lngMin: 139.630, lngMax: 139.680 },
  "南区":      { latMin: 35.415, latMax: 35.445, lngMin: 139.590, lngMax: 139.630 },
  "港南区":    { latMin: 35.385, latMax: 35.420, lngMin: 139.575, lngMax: 139.620 },
  "保土ケ谷区":{ latMin: 35.440, latMax: 35.475, lngMin: 139.575, lngMax: 139.610 },
  "旭区":      { latMin: 35.455, latMax: 35.500, lngMin: 139.530, lngMax: 139.580 },
  "磯子区":    { latMin: 35.390, latMax: 35.425, lngMin: 139.610, lngMax: 139.650 },
  "金沢区":    { latMin: 35.330, latMax: 35.390, lngMin: 139.600, lngMax: 139.660 },
  "港北区":    { latMin: 35.500, latMax: 35.545, lngMin: 139.590, lngMax: 139.650 },
  "緑区":      { latMin: 35.500, latMax: 35.540, lngMin: 139.530, lngMax: 139.590 },
  "青葉区":    { latMin: 35.530, latMax: 35.580, lngMin: 139.510, lngMax: 139.570 },
  "都筑区":    { latMin: 35.530, latMax: 35.560, lngMin: 139.560, lngMax: 139.610 },
  "戸塚区":    { latMin: 35.370, latMax: 35.420, lngMin: 139.510, lngMax: 139.570 },
  "栄区":      { latMin: 35.345, latMax: 35.380, lngMin: 139.540, lngMax: 139.580 },
  "泉区":      { latMin: 35.390, latMax: 35.430, lngMin: 139.480, lngMax: 139.530 },
  "瀬谷区":    { latMin: 35.440, latMax: 35.480, lngMin: 139.480, lngMax: 139.530 },
};

function detectWard(lat, lng) {
  let bestWard = null;
  let bestDist = Infinity;

  for (const [ward, bounds] of Object.entries(YOKOHAMA_WARDS)) {
    const centerLat = (bounds.latMin + bounds.latMax) / 2;
    const centerLng = (bounds.lngMin + bounds.lngMax) / 2;

    if (lat >= bounds.latMin && lat <= bounds.latMax && lng >= bounds.lngMin && lng <= bounds.lngMax) {
      const dist = Math.sqrt((lat - centerLat) ** 2 + (lng - centerLng) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestWard = ward;
      }
    }
  }

  if (!bestWard) {
    for (const [ward, bounds] of Object.entries(YOKOHAMA_WARDS)) {
      const centerLat = (bounds.latMin + bounds.latMax) / 2;
      const centerLng = (bounds.lngMin + bounds.lngMax) / 2;
      const dist = Math.sqrt((lat - centerLat) ** 2 + (lng - centerLng) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestWard = ward;
      }
    }
  }

  return bestWard;
}

// ===== タクシー検索機能 =====
let taxiLaborData = [];

function setupTaxiFinder() {
  const btn = document.getElementById("findTaxiBtn");
  const resultDiv = document.getElementById("taxiFinderResult");
  if (!btn || !resultDiv) return;

  btn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      resultDiv.innerHTML = '<div class="no-match">この端末では位置情報を取得できません</div>';
      return;
    }

    btn.disabled = true;
    btn.textContent = "位置情報を取得中...";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const ward = detectWard(latitude, longitude);

        if (!ward) {
          resultDiv.innerHTML = '<div class="no-match">横浜市外のため対応エリア判定ができません。全社のリストをご確認ください。</div>';
          btn.disabled = false;
          btn.textContent = "現在地からタクシーを探す";
          return;
        }

        const matched = taxiLaborData.filter(
          (t) => t.wards && t.wards.includes(ward)
        );

        if (matched.length === 0) {
          resultDiv.innerHTML = `
            <div class="ward-detected">現在地: ${ward}付近</div>
            <div class="no-match">この地域に対応する陣痛タクシーが見つかりませんでした。下のリストから直接お電話ください。</div>
          `;
        } else {
          const listHtml = matched
            .map((t) => {
              const callAction = t.phone
                ? `<a href="tel:${t.phone}" class="taxi-call-btn taxi-call-btn-tel">📞 ${t.phone}</a>`
                : "";
              return `<li>
                <div class="name">${t.name}</div>
                <div class="meta">${t.note}</div>
                <div>${callAction}</div>
              </li>`;
            })
            .join("");

          resultDiv.innerHTML = `
            <div class="ward-detected">現在地: ${ward}付近 — ${matched.length}社対応</div>
            <ul class="recommended-list">${listHtml}</ul>
          `;
        }

        btn.disabled = false;
        btn.textContent = "現在地からタクシーを探す";
      },
      (error) => {
        let msg = "位置情報の取得に失敗しました。";
        if (error.code === 1) msg = "位置情報の使用が許可されていません。設定をご確認ください。";
        if (error.code === 2) msg = "位置情報が取得できませんでした。";
        if (error.code === 3) msg = "位置情報の取得がタイムアウトしました。";
        resultDiv.innerHTML = `<div class="no-match">${msg}</div>`;
        btn.disabled = false;
        btn.textContent = "現在地からタクシーを探す";
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// ===== カレンダーフィルター =====
function setupCalendarFilter() {
  const filterBtns = document.querySelectorAll(".calendar-filter-btn");
  if (!filterBtns.length) return;

  // Jump buttons
  document.querySelectorAll(".calendar-jump-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.jump);
      if (!target) return;
      const headerHeight = document.querySelector(".sticky-top")?.offsetHeight || 0;
      const y = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  });

  // 保存された選択状態を復元
  const savedCalFilters = localStorage.getItem("calendarFilters");
  if (savedCalFilters) {
    try {
      const saved = JSON.parse(savedCalFilters);
      filterBtns.forEach((b) => {
        b.classList.toggle("active", saved.includes(b.dataset.filter));
      });
      applyCalendarFilter();
    } catch {}
  }

  function saveCalendarFilters() {
    const active = Array.from(document.querySelectorAll(".calendar-filter-btn.active")).map((b) => b.dataset.filter);
    localStorage.setItem("calendarFilters", JSON.stringify(active));
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const allBtns = document.querySelectorAll(".calendar-filter-btn");
      const activeBtns = document.querySelectorAll(".calendar-filter-btn.active");
      const allActive = activeBtns.length === allBtns.length;

      if (allActive) {
        // All ON → switch to only this one
        allBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      } else if (btn.classList.contains("active")) {
        // Turning OFF an active filter
        if (activeBtns.length === 1) {
          // Last one → reset to all ON
          allBtns.forEach((b) => b.classList.add("active"));
        } else {
          btn.classList.remove("active");
        }
      } else {
        // Turning ON an inactive filter
        btn.classList.add("active");
      }

      saveCalendarFilters();
      applyCalendarFilter();
    });
  });
}

function applyCalendarFilter() {
  const activeFilters = new Set(
    Array.from(document.querySelectorAll(".calendar-filter-btn.active")).map((b) => b.dataset.filter)
  );

  document.querySelectorAll(".calendar-item").forEach((item) => {
    const type = Array.from(item.classList)
      .find((c) => c.startsWith("calendar-item--"))
      ?.replace("calendar-item--", "");
    item.style.display = type && activeFilters.has(type) ? "" : "none";
  });

  // Hide periods with no visible items
  document.querySelectorAll(".calendar-period").forEach((period) => {
    const visible = period.querySelectorAll(".calendar-item:not([style*='display: none'])");
    period.style.display = visible.length ? "" : "none";
  });
}

// ===== カスタムカレンダー項目 =====
const CALENDAR_CATEGORY_LABELS = { event: "お祝い", vaccine: "予防接種", checkup: "健診", todo: "手続き" };

function getCustomCalendarItems() {
  if (_customCalendarCache !== null) return _customCalendarCache;
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_CALENDAR_KEY)) || [];
  } catch { return []; }
}

function saveCustomCalendarItems(items) {
  _customCalendarCache = items;
  localStorage.setItem(CUSTOM_CALENDAR_KEY, JSON.stringify(items));
  firebaseSet("shared/customCalendar",
    arrayToFirebaseObj(items, i => i.id || ("cal_" + Date.now())));
}

function renderCustomCalendarItems() {
  // Remove existing custom items
  document.querySelectorAll(".calendar-item[data-custom-id]").forEach((el) => el.remove());

  const items = getCustomCalendarItems();
  items.forEach((item) => {
    const period = document.getElementById(item.periodId);
    if (!period) return;
    const container = period.querySelector(".calendar-items");
    if (!container) return;

    const label = CALENDAR_CATEGORY_LABELS[item.category] || item.category;
    const searchText = `${label} ${item.title} ${item.desc || ""} ${item.periodLabel || ""}`;

    const div = document.createElement("div");
    div.className = `calendar-item calendar-item--${item.category}`;
    div.dataset.customId = item.id;
    div.dataset.search = searchText;
    div.innerHTML =
      `<span class="calendar-tag calendar-tag--${item.category}">${label}</span>` +
      `<div class="calendar-item-body">` +
        `<strong>${escapeHtml(item.title)}</strong>` +
        (item.desc ? `<p>${escapeHtml(item.desc)}</p>` : "") +
      `</div>` +
      `<button class="calendar-item-delete" title="削除">&times;</button>`;

    div.querySelector(".calendar-item-delete").addEventListener("click", () => {
      if (confirm(`「${item.title}」を削除しますか？`)) {
        const all = getCustomCalendarItems().filter((i) => i.id !== item.id);
        saveCustomCalendarItems(all);
        renderCustomCalendarItems();
        applyCalendarFilter();
      }
    });

    container.appendChild(div);
  });
}

function setupCustomCalendar() {
  const addBtn = document.getElementById("calendarAddBtn");
  const modal = document.getElementById("calendarModal");
  const closeBtn = document.getElementById("calendarModalClose");
  const form = document.getElementById("calendarAddForm");
  const periodSelect = document.getElementById("calAddPeriod");
  if (!addBtn || !modal || !form || !periodSelect) return;

  // Populate period select
  CALENDAR_PERIOD_MAP.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    periodSelect.appendChild(opt);
  });

  // モーダルを開く共通関数（periodId指定で時期を自動選択）
  function openAddModal(preselectedPeriodId) {
    if (preselectedPeriodId) {
      periodSelect.value = preselectedPeriodId;
    }
    modal.hidden = false;
  }

  addBtn.addEventListener("click", () => {
    openAddModal(null);
  });

  // 各月齢セクションヘッダーに＋ボタンを挿入
  document.querySelectorAll(".calendar-period").forEach((period) => {
    const header = period.querySelector(".calendar-period-header");
    if (!header) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "calendar-period-add-btn";
    btn.title = "この時期に項目を追加";
    btn.textContent = "＋";
    btn.addEventListener("click", () => {
      openAddModal(period.id);
    });
    header.appendChild(btn);
  });

  closeBtn.addEventListener("click", () => {
    modal.hidden = true;
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const category = form.querySelector('input[name="cal-cat"]:checked').value;
    const periodId = periodSelect.value;
    const title = document.getElementById("calAddTitle").value.trim();
    const desc = document.getElementById("calAddDesc").value.trim();
    if (!title) return;

    const periodInfo = CALENDAR_PERIOD_MAP.find((p) => p.id === periodId);
    const items = getCustomCalendarItems();
    items.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      category,
      periodId,
      periodLabel: periodInfo?.label || "",
      title,
      desc,
    });
    saveCustomCalendarItems(items);
    renderCustomCalendarItems();
    applyCalendarFilter();

    // Reset form and close
    form.reset();
    form.querySelector('input[name="cal-cat"][value="event"]').checked = true;
    modal.hidden = true;
  });

  // Initial render
  renderCustomCalendarItems();
}

// ===== データ読み込み・初期化 =====
async function loadData() {
  const response = await fetch(DATA_FILE_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`data.json の読み込みに失敗しました (${response.status})`);
  }
  return response.json();
}

// ===== Firebase & Shopping List =====
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDmrT37_DwQUbYoY9d3jZmVCDahWlsjkU0",
  authDomain: "family-local-guide.firebaseapp.com",
  databaseURL: "https://family-local-guide-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "family-local-guide",
  storageBucket: "family-local-guide.firebasestorage.app",
  messagingSenderId: "903018887987",
  appId: "1:903018887987:web:c6102e017c154753535c46"
};

const DEFAULT_CATEGORIES = [
  { id: "super", name: "スーパー", icon: "🛒" },
  { id: "hac", name: "HAC", icon: "💊" },
  { id: "nitori", name: "ニトリ", icon: "🏠" },
  { id: "100yen", name: "100均", icon: "💯" },
  { id: "amazon", name: "Amazon", icon: "📦" },
  { id: "rakuten", name: "楽天", icon: "🛍️" },
];

let shoppingDb = null; // Firebase database reference (used for all shared data)

// Firebase共有データのインメモリキャッシュ
let _favoritesCache = null;
let _childrenCache = null;
let _nurseryInterestsCache = null;
let _nurseryVisitsCache = null;
let _nurseryMemosCache = null;
let _customCalendarCache = null;

function firebaseSet(path, data) {
  if (!shoppingDb) return;
  shoppingDb.ref(path).set(data).catch((err) => {
    console.error("Firebase write error:", path, err.message || err);
  });
}

function arrayToFirebaseObj(arr, keyFn) {
  const obj = {};
  arr.forEach(item => {
    const key = keyFn(item).replace(/[.#$/\[\]]/g, "_");
    obj[key] = item;
  });
  return obj;
}

function initFirebase() {
  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK not loaded");
    return null;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  return firebase.database();
}

function setupShoppingList() {
  shoppingDb = initFirebase();
  if (!shoppingDb) {
    const status = document.getElementById("shoppingSyncStatus");
    if (status) status.textContent = "オフラインモード（Firebase未接続）";
    return;
  }

  const categoriesRef = shoppingDb.ref("shopping/categories");
  const itemsRef = shoppingDb.ref("shopping/items");

  // Initialize default categories if empty
  categoriesRef.once("value", (snap) => {
    if (!snap.exists()) {
      const updates = {};
      DEFAULT_CATEGORIES.forEach((cat) => {
        updates[cat.id] = { name: cat.name, icon: cat.icon, order: DEFAULT_CATEGORIES.indexOf(cat) };
      });
      categoriesRef.set(updates);
    }
  });

  // Listen for real-time changes
  categoriesRef.on("value", (snap) => {
    const categories = snap.val() || {};
    renderShoppingCategories(categories);
  });

  // Connection status
  const connRef = shoppingDb.ref(".info/connected");
  const statusEl = document.getElementById("shoppingSyncStatus");
  connRef.on("value", (snap) => {
    if (statusEl) {
      statusEl.textContent = snap.val() ? "" : "接続中...";
      statusEl.className = "shopping-sync-status" + (snap.val() ? "" : " shopping-sync-offline");
    }
  });

  // Add category button
  const addBtn = document.getElementById("addCategoryBtn");
  const input = document.getElementById("newCategoryInput");
  if (addBtn && input) {
    addBtn.addEventListener("click", () => addCategory(input));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addCategory(input);
    });
  }
}

// ===== Firebase リアルタイム同期（全共有データ） =====
function setupFirebaseSync() {
  if (!shoppingDb) return;

  // 前回の書き込み失敗時のためマイグレーションフラグをリセット
  localStorage.removeItem("familyGuide_firebaseMigrated");
  migrateLocalStorageToFirebase();

  // Favorites リスナー
  shoppingDb.ref("shared/favorites").on("value", (snap) => {
    const obj = snap.val() || {};
    _favoritesCache = Object.values(obj);
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(_favoritesCache));
    updateFavCountBadge();
    renderFavoritesList();
    refreshFavStars();
  });

  // Children リスナー
  shoppingDb.ref("shared/children").on("value", (snap) => {
    const obj = snap.val() || {};
    _childrenCache = Object.values(obj);
    localStorage.setItem(CHILDREN_STORAGE_KEY, JSON.stringify(_childrenCache));
    renderChildrenList();
  });

  // Nursery interests リスナー
  shoppingDb.ref("shared/nursery/interests").on("value", (snap) => {
    _nurseryInterestsCache = snap.val() || [];
    localStorage.setItem(NURSERY_INTEREST_KEY, JSON.stringify(_nurseryInterestsCache));
    refreshNurseryUI();
  });

  // Nursery visits リスナー
  shoppingDb.ref("shared/nursery/visits").on("value", (snap) => {
    _nurseryVisitsCache = snap.val() || [];
    localStorage.setItem(NURSERY_VISIT_KEY, JSON.stringify(_nurseryVisitsCache));
    refreshNurseryUI();
  });

  // Nursery memos リスナー
  shoppingDb.ref("shared/nursery/memos").on("value", (snap) => {
    _nurseryMemosCache = snap.val() || {};
    localStorage.setItem(NURSERY_MEMO_KEY, JSON.stringify(_nurseryMemosCache));
    refreshNurseryUI();
  });

  // Supplies リスナー
  shoppingDb.ref("shared/supplies").on("value", (snap) => {
    const list = snap.val() || [];
    _suppliesCache = Array.isArray(list) ? list : Object.values(list);
    localStorage.setItem(SUPPLIES_KEY, JSON.stringify(_suppliesCache));
    renderSupplies();
  });

  // Custom Calendar リスナー
  shoppingDb.ref("shared/customCalendar").on("value", (snap) => {
    const obj = snap.val() || {};
    _customCalendarCache = Object.values(obj);
    localStorage.setItem(CUSTOM_CALENDAR_KEY, JSON.stringify(_customCalendarCache));
    renderCustomCalendarItems();
  });
}

function refreshFavStars() {
  const favs = getFavorites();
  const favIds = new Set(favs.map(f => f.id));
  document.querySelectorAll(".fav-btn").forEach(btn => {
    const id = btn.dataset.favId;
    if (id) {
      const active = favIds.has(id);
      btn.classList.toggle("fav-btn--active", active);
      btn.textContent = active ? "★" : "☆";
      btn.title = active ? "お気に入りから外す" : "お気に入りに追加";
    }
  });
}

function refreshNurseryUI() {
  if (typeof nurseryData !== "undefined" && nurseryData.length > 0) {
    applyNurseryFilters();
  }
}

function migrateLocalStorageToFirebase() {
  if (!shoppingDb) return;
  if (localStorage.getItem("familyGuide_firebaseMigrated")) return;

  const migrations = [
    { key: FAV_STORAGE_KEY, path: "shared/favorites",
      convert: arr => arrayToFirebaseObj(arr, f => f.id) },
    { key: CHILDREN_STORAGE_KEY, path: "shared/children",
      convert: arr => arrayToFirebaseObj(arr, c => c.id) },
    { key: NURSERY_INTEREST_KEY, path: "shared/nursery/interests", convert: null },
    { key: NURSERY_VISIT_KEY, path: "shared/nursery/visits", convert: null },
    { key: NURSERY_MEMO_KEY, path: "shared/nursery/memos", convert: null },
    { key: CUSTOM_CALENDAR_KEY, path: "shared/customCalendar",
      convert: arr => arrayToFirebaseObj(arr, i => i.id || ("cal_" + Math.random().toString(36).slice(2))) },
    { key: SUPPLIES_KEY, path: "shared/supplies", convert: null },
  ];

  const promises = [];

  migrations.forEach(({ key, path, convert }) => {
    try {
      const raw = JSON.parse(localStorage.getItem(key));
      if (raw && (Array.isArray(raw) ? raw.length > 0 : Object.keys(raw).length > 0)) {
        const p = shoppingDb.ref(path).once("value").then((snap) => {
          if (!snap.exists()) {
            return shoppingDb.ref(path).set(convert ? convert(raw) : raw);
          }
        });
        promises.push(p);
      }
    } catch (e) { /* skip */ }
  });

  if (promises.length > 0) {
    Promise.all(promises).then(() => {
      localStorage.setItem("familyGuide_firebaseMigrated", "1");
    }).catch((err) => {
      console.error("Firebase migration failed:", err.message || err);
    });
  } else {
    localStorage.setItem("familyGuide_firebaseMigrated", "1");
  }
}

function addCategory(input) {
  const name = input.value.trim();
  if (!name || !shoppingDb) return;
  const id = "cat_" + Date.now();
  shoppingDb.ref("shopping/categories/" + id).set({
    name: name,
    icon: "",
    order: Date.now()
  });
  input.value = "";
}

function renderShoppingFilter(sortedCategories) {
  const filterContainer = document.getElementById("shoppingFilter");
  if (!filterContainer) return;

  filterContainer.innerHTML = sortedCategories.map(([catId, cat]) =>
    `<button class="shopping-filter-btn" data-jump-cat="${catId}" type="button">${cat.icon ? cat.icon + " " : ""}${escapeHtml(cat.name)}</button>`
  ).join("");

  filterContainer.querySelectorAll(".shopping-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById("shopping-cat-" + btn.dataset.jumpCat);
      if (!target) return;
      const headerHeight = document.querySelector(".sticky-top")?.offsetHeight || 0;
      const y = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
      window.scrollTo({ top: y, behavior: "smooth" });
      // Highlight briefly
      target.classList.add("shopping-category--highlight");
      setTimeout(() => target.classList.remove("shopping-category--highlight"), 1500);
    });
  });
}

function renderShoppingCategories(categories) {
  const container = document.getElementById("shoppingCategories");
  if (!container) return;

  // Sort by order
  const sorted = Object.entries(categories).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

  // Render filter/jump buttons
  renderShoppingFilter(sorted);

  container.innerHTML = "";
  sorted.forEach(([catId, cat]) => {
    const section = document.createElement("div");
    section.className = "shopping-category";
    section.id = "shopping-cat-" + catId;
    section.innerHTML = `
      <div class="shopping-category-header">
        <h3 class="shopping-category-title">${cat.icon ? cat.icon + " " : ""}${escapeHtml(cat.name)}</h3>
        <div class="shopping-cat-actions">
          <button class="shopping-edit-cat-btn" data-cat-id="${catId}" data-cat-name="${escapeHtml(cat.name)}" type="button" title="カテゴリ名を編集">✎</button>
          <button class="shopping-delete-cat-btn" data-cat-id="${catId}" type="button" title="カテゴリ削除">✕</button>
        </div>
      </div>
      <ul class="shopping-items" id="shopping-items-${catId}"></ul>
      <div class="shopping-add-item">
        <input type="text" class="shopping-input shopping-item-input" placeholder="買うものを追加" maxlength="50" data-cat-id="${catId}" />
        <button class="shopping-add-item-btn" data-cat-id="${catId}" type="button">＋</button>
      </div>
    `;
    container.appendChild(section);

    // Listen for items in this category
    const itemsRef = shoppingDb.ref("shopping/items/" + catId);
    itemsRef.on("value", (snap) => {
      renderShoppingItems(catId, snap.val() || {});
    });

    // Add item events
    const itemInput = section.querySelector(".shopping-item-input");
    const addItemBtn = section.querySelector(".shopping-add-item-btn");
    addItemBtn.addEventListener("click", () => addShoppingItem(catId, itemInput));
    itemInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addShoppingItem(catId, itemInput);
    });

    // Edit category name
    const editCatBtn = section.querySelector(".shopping-edit-cat-btn");
    editCatBtn.addEventListener("click", () => {
      const newName = prompt("カテゴリ名を入力", cat.name);
      if (newName !== null && newName.trim() && newName.trim() !== cat.name) {
        shoppingDb.ref("shopping/categories/" + catId + "/name").set(newName.trim());
      }
    });

    // Delete category
    const deleteCatBtn = section.querySelector(".shopping-delete-cat-btn");
    deleteCatBtn.addEventListener("click", () => {
      if (confirm(`「${cat.name}」カテゴリを削除しますか？中のアイテムもすべて削除されます。`)) {
        shoppingDb.ref("shopping/categories/" + catId).remove();
        shoppingDb.ref("shopping/items/" + catId).remove();
      }
    });
  });
}

function addShoppingItem(catId, input) {
  const name = input.value.trim();
  if (!name || !shoppingDb) return;
  const itemId = "item_" + Date.now();
  shoppingDb.ref("shopping/items/" + catId + "/" + itemId).set({
    name: name,
    done: false,
    addedAt: Date.now()
  });
  input.value = "";
}

// ===== 在庫→買い物リスト連携 =====
function promptAddToShoppingList(itemName) {
  if (!confirm(`「${itemName}」を買い物リストに追加しますか？`)) return;

  if (!shoppingDb) {
    showToast("買い物リスト接続エラー");
    return;
  }

  shoppingDb.ref("shopping/categories").once("value").then((snap) => {
    const categories = snap.val() || {};
    showShoppingCategoryModal(itemName, categories);
  }).catch(() => {
    showToast("カテゴリ取得エラー");
  });
}

function showShoppingCategoryModal(itemName, categories) {
  const modal = document.getElementById("shoppingAddModal");
  const nameEl = document.getElementById("shoppingAddItemName");
  const catContainer = document.getElementById("shoppingAddCategories");

  nameEl.textContent = `「${itemName}」`;

  const sorted = Object.entries(categories).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

  if (sorted.length === 0) {
    catContainer.innerHTML = '<p class="shopping-add-loading">買い物リストにカテゴリがありません</p>';
  } else {
    catContainer.innerHTML = sorted.map(([catId, cat]) =>
      `<button class="shopping-add-cat-btn" data-cat-id="${catId}" type="button">${cat.icon ? cat.icon + " " : ""}${escapeHtml(cat.name)}</button>`
    ).join("");

    catContainer.querySelectorAll(".shopping-add-cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const catId = btn.dataset.catId;
        const itemId = "item_" + Date.now();
        shoppingDb.ref("shopping/items/" + catId + "/" + itemId).set({
          name: itemName,
          done: false,
          addedAt: Date.now()
        }).then(() => {
          showToast("買い物リストに追加しました");
        }).catch(() => {
          showToast("追加エラー");
        });
        modal.hidden = true;
      });
    });
  }

  modal.hidden = false;

  document.getElementById("shoppingAddCancelBtn").onclick = () => { modal.hidden = true; };
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  }, { once: true });
}

function renderShoppingItems(catId, items) {
  const ul = document.getElementById("shopping-items-" + catId);
  if (!ul) return;

  const sorted = Object.entries(items).sort((a, b) => {
    // Unchecked first, then by addedAt
    if (a[1].done !== b[1].done) return a[1].done ? 1 : -1;
    return (a[1].addedAt || 0) - (b[1].addedAt || 0);
  });

  ul.innerHTML = "";
  sorted.forEach(([itemId, item]) => {
    const li = document.createElement("li");
    li.className = "shopping-item" + (item.done ? " shopping-item--done" : "");
    li.innerHTML = `
      <label class="shopping-item-label">
        <input type="checkbox" class="shopping-checkbox" ${item.done ? "checked" : ""} />
        <span class="shopping-item-name">${escapeHtml(item.name)}</span>
      </label>
      <button class="shopping-delete-btn" type="button" title="削除">🗑️</button>
    `;

    const checkbox = li.querySelector(".shopping-checkbox");
    checkbox.addEventListener("change", () => {
      shoppingDb.ref("shopping/items/" + catId + "/" + itemId + "/done").set(checkbox.checked);
    });

    const deleteBtn = li.querySelector(".shopping-delete-btn");
    deleteBtn.addEventListener("click", () => {
      shoppingDb.ref("shopping/items/" + catId + "/" + itemId).remove();
    });

    ul.appendChild(li);
  });
}

// ===== 保育園セクション =====
const NURSERY_INTEREST_KEY = "familyGuide_nurseryInterests";
const NURSERY_VISIT_KEY = "familyGuide_nurseryVisits";
const NURSERY_MEMO_KEY = "familyGuide_nurseryMemos";

function getNurseryInterests() {
  if (_nurseryInterestsCache !== null) return _nurseryInterestsCache;
  try { return JSON.parse(localStorage.getItem(NURSERY_INTEREST_KEY)) || []; } catch { return []; }
}
function saveNurseryInterests(list) {
  _nurseryInterestsCache = list;
  localStorage.setItem(NURSERY_INTEREST_KEY, JSON.stringify(list));
  firebaseSet("shared/nursery/interests", list);
}

function getNurseryVisits() {
  if (_nurseryVisitsCache !== null) return _nurseryVisitsCache;
  try { return JSON.parse(localStorage.getItem(NURSERY_VISIT_KEY)) || []; } catch { return []; }
}
function saveNurseryVisits(list) {
  _nurseryVisitsCache = list;
  localStorage.setItem(NURSERY_VISIT_KEY, JSON.stringify(list));
  firebaseSet("shared/nursery/visits", list);
}

function getNurseryMemos() {
  if (_nurseryMemosCache !== null) return _nurseryMemosCache;
  try { return JSON.parse(localStorage.getItem(NURSERY_MEMO_KEY)) || {}; } catch { return {}; }
}
function saveNurseryMemos(memos) {
  _nurseryMemosCache = memos;
  localStorage.setItem(NURSERY_MEMO_KEY, JSON.stringify(memos));
  firebaseSet("shared/nursery/memos", memos);
}

const NURSERY_TYPE_HELP = {
  "認可": {
    title: "認可保育園とは？",
    body: `<dl>
      <dt>概要</dt><dd>国の基準（施設の広さ・職員数・給食設備など）を満たし、都道府県知事の認可を受けた保育園。</dd>
      <dt>保育料</dt><dd>世帯の住民税額に応じて決まる（所得に応じた負担）。3〜5歳は無償化。</dd>
      <dt>申込</dt><dd>区役所に申込 → 利用調整（ポイント制）で入園が決まる。</dd>
      <dt>ポイント制とは？</dt><dd>保護者の就労状況・世帯状況（ひとり親・兄弟在園等）を点数化し、点数が高い順に入園が決まる仕組み。</dd>
    </dl>`,
    link: "https://www.city.yokohama.lg.jp/kosodate-kyoiku/hoiku-yoji/shisetsu/riyou/hoikuriyou/"
  },
  "認可外": {
    title: "認可外保育施設とは？",
    body: `<dl>
      <dt>概要</dt><dd>認可基準を満たしていないが、都道府県に届出をして運営している保育施設。独自の保育方針を持つ園も多い。</dd>
      <dt>保育料</dt><dd>施設ごとに自由に設定。認可より高い場合が多いが、3〜5歳は月37,000円まで無償化の対象。</dd>
      <dt>申込</dt><dd>園に直接申込。利用調整（ポイント制）は不要。空きがあれば入園可能。</dd>
      <dt>メリット</dt><dd>独自カリキュラム・延長保育の柔軟さ・入りやすさなど。</dd>
    </dl>`,
    link: "https://www.city.yokohama.lg.jp/kosodate-kyoiku/hoiku-yoji/shisetsu/hoikuseido/ninkagai/"
  },
  "小規模": {
    title: "小規模保育事業とは？",
    body: `<dl>
      <dt>概要</dt><dd>定員6〜19名の小さな保育施設。0〜2歳児が対象。認可事業。</dd>
      <dt>保育料</dt><dd>認可保育園と同じ基準（住民税額に応じた負担）。</dd>
      <dt>特徴</dt><dd>少人数で家庭的な保育。3歳からは連携施設（幼稚園・保育園）に転園が必要。</dd>
      <dt>申込</dt><dd>区役所に申込。認可保育園と同じ利用調整（ポイント制）。</dd>
    </dl>`,
    link: "https://www.city.yokohama.lg.jp/kosodate-kyoiku/hoiku-yoji/shisetsu/hoikuseido/20140418091506.html"
  },
  "認定こども園": {
    title: "認定こども園とは？",
    body: `<dl>
      <dt>概要</dt><dd>幼稚園と保育園の機能を併せ持つ施設。教育と保育を一体的に提供。</dd>
      <dt>保育料</dt><dd>保育認定（2号・3号）は認可保育園と同じ基準。教育認定（1号）は施設が設定。3〜5歳は無償化。</dd>
      <dt>特徴</dt><dd>保護者の就労状況が変わっても通い続けられる。</dd>
      <dt>申込</dt><dd>保育認定は区役所経由（利用調整あり）。教育認定は園に直接。</dd>
    </dl>`,
    link: "https://www.city.yokohama.lg.jp/kosodate-kyoiku/hoiku-yoji/yochien/yochi-list/"
  },
  "企業主導型": {
    title: "企業主導型保育事業とは？",
    body: `<dl>
      <dt>概要</dt><dd>企業が主に従業員向けに設置・運営する保育施設。地域枠として一般の子どもも利用可能な場合あり。</dd>
      <dt>保育料</dt><dd>施設ごとに設定。認可保育園の水準を超えない設定が多い。</dd>
      <dt>特徴</dt><dd>企業のニーズに合わせた柔軟な保育（夜間・休日など）。</dd>
      <dt>申込</dt><dd>園に直接申込。利用調整なし。</dd>
    </dl>`,
    link: "https://www.kigyounaihoiku.jp/"
  },
};

let nurseryData = [];
let nurseryMap = null;
let nurseryMapMarkers = [];
const HOME_LAT = 35.4200;
const HOME_LNG = 139.6095;

const NURSERY_TYPE_COLORS = {
  "認可": "#22c55e",
  "認可外": "#eab308",
  "小規模": "#3b82f6",
  "認定こども園": "#8b5cf6",
  "企業主導型": "#f97316",
};

function createNurseryMapIcon(type) {
  const color = NURSERY_TYPE_COLORS[type] || "#6b7280";
  return L.divIcon({
    className: "nursery-map-marker",
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function initNurseryMap() {
  if (nurseryMap) return;
  const mapEl = document.getElementById("nurseryMap");
  if (!mapEl || typeof L === "undefined") return;

  nurseryMap = L.map("nurseryMap", { scrollWheelZoom: false }).setView([HOME_LAT, HOME_LNG], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(nurseryMap);

  // Home marker
  const homeIcon = L.divIcon({
    className: "nursery-map-home",
    html: `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));">🏠</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
  L.marker([HOME_LAT, HOME_LNG], { icon: homeIcon })
    .addTo(nurseryMap)
    .bindPopup("<strong>自宅</strong>");

  updateNurseryMapMarkers();
}

function updateNurseryMapMarkers() {
  if (!nurseryMap) return;

  // Remove old markers
  nurseryMapMarkers.forEach((m) => nurseryMap.removeLayer(m));
  nurseryMapMarkers = [];

  const interests = getNurseryInterests();
  const visits = getNurseryVisits();

  nurseryData.forEach((item) => {
    if (!item.lat || !item.lng) return;
    const icon = createNurseryMapIcon(item.type);
    const isInterested = interests.includes(item.name);
    const isVisited = visits.includes(item.name);
    let badges = "";
    if (isInterested) badges += " 💗";
    if (isVisited) badges += " ✅";

    const marker = L.marker([item.lat, item.lng], { icon })
      .addTo(nurseryMap)
      .bindPopup(
        `<strong>${item.name}</strong>${badges}<br>` +
        `<span style="font-size:0.8em;color:#666;">${item.type} / 徒歩${item.walkMinutes}分</span><br>` +
        `<span style="font-size:0.8em;">${item.ageRange} / 定員${item.capacity}</span>` +
        (item.url ? `<br><a href="${item.url}" target="_blank" style="font-size:0.8em;">サイトを見る ↗</a>` : "")
      )
      .bindTooltip(item.name, {
        direction: "top",
        className: "nursery-map-label",
        offset: [0, -10],
      });
    nurseryMapMarkers.push(marker);
  });
}

function renderNurseryList(nurseries) {
  nurseryData = nurseries || [];
  applyNurseryFilters();
}

function applyNurseryFilters() {
  const target = document.getElementById("nurseryList");
  if (!target) return;

  const typeFilter = document.querySelector(".nursery-filter-btn.active");
  const distFilter = document.querySelector(".nursery-distance-btn.active");
  const sortSelect = document.getElementById("nurserySortSelect");

  const filterType = typeFilter ? typeFilter.dataset.nurseryFilter : "all";
  const maxWalk = distFilter ? parseInt(distFilter.dataset.walkMax) : 99;
  const sortBy = sortSelect ? sortSelect.value : "walk";

  const interests = getNurseryInterests();
  const visits = getNurseryVisits();
  const memos = getNurseryMemos();

  let filtered = nurseryData.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (item.walkMinutes > maxWalk) return false;
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    if (sortBy === "walk") return a.walkMinutes - b.walkMinutes;
    if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
    if (sortBy === "interest") {
      const ai = interests.includes(a.name) ? 0 : 1;
      const bi = interests.includes(b.name) ? 0 : 1;
      return ai - bi || a.walkMinutes - b.walkMinutes;
    }
    return 0;
  });

  target.innerHTML = filtered
    .map((item) => {
      const isInterested = interests.includes(item.name);
      const isVisited = visits.includes(item.name);
      const memo = memos[item.name];
      const hasMemo = memo && (memo.text || memo.date);
      const favBtn = createFavButton("nursery", item);

      let memoPreview = "";
      if (hasMemo) {
        memoPreview = `<div class="nursery-memo-preview">`;
        if (memo.date) memoPreview += `<div class="nursery-memo-preview-date">見学日: ${memo.date}</div>`;
        if (memo.text) memoPreview += `<div>${escapeHtml(memo.text)}</div>`;
        memoPreview += `</div>`;
      }

      return `
      <li data-nursery-type="${item.type}" data-walk="${item.walkMinutes}"
          data-search="${[item.name, item.type, item.area, item.phone, item.note, item.ageRange, item.capacity, item.hours].join(" ").toLowerCase()}">
        <div class="name">
          ${favBtn}
          ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name}</a>` : item.name}
          <span class="nursery-type-badge nursery-type--${item.type}">${item.type}</span>
          <span class="nursery-walk-badge">徒歩${item.walkMinutes}分</span>
        </div>
        <div class="meta">📍 ${item.area}</div>
        ${item.phone ? `<div class="meta">📞 ${item.phone}</div>` : ""}
        <div class="nursery-details">
          <span>👶 ${item.ageRange}</span>
          <span>👥 定員${item.capacity}</span>
          <span>🕐 ${item.hours}</span>
        </div>
        <div class="meta">${item.note}</div>
        <div class="nursery-actions">
          <button class="nursery-interest-btn ${isInterested ? "active" : ""}" data-nursery-name="${item.name.replace(/"/g, "&quot;")}" type="button">
            ${isInterested ? "💗 気になる！" : "🤍 気になる"}
          </button>
          <button class="nursery-visited-btn ${isVisited ? "active" : ""}" data-nursery-name="${item.name.replace(/"/g, "&quot;")}" type="button">
            ${isVisited ? "✅ 見学済み" : "👀 見学に行った"}
          </button>
          <button class="nursery-memo-btn ${hasMemo ? "has-memo" : ""}" data-nursery-name="${item.name.replace(/"/g, "&quot;")}" type="button">
            ${hasMemo ? "📝 メモあり" : "📝 メモ"}
          </button>
        </div>
        ${item.phone ? `<div><a href="tel:${item.phone}" class="list-call-btn">📞 電話をかける</a></div>` : ""}
        ${memoPreview}
      </li>
    `;
    })
    .join("");
}

function setupNursery() {
  // Map toggle
  const mapToggleBtn = document.getElementById("nurseryMapToggle");
  const mapContainer = document.getElementById("nurseryMapContainer");
  if (mapToggleBtn && mapContainer) {
    mapToggleBtn.addEventListener("click", () => {
      const isHidden = mapContainer.hidden;
      mapContainer.hidden = !isHidden;
      mapToggleBtn.classList.toggle("active", isHidden);
      mapToggleBtn.textContent = isHidden ? "🗺️ 地図を閉じる" : "🗺️ 地図で見る";
      if (isHidden) {
        initNurseryMap();
        // Fix Leaflet map rendering in hidden container
        setTimeout(() => { if (nurseryMap) nurseryMap.invalidateSize(); }, 200);
      }
    });
  }

  // Type filter
  const savedNurseryType = localStorage.getItem("nurseryTypeFilter");
  if (savedNurseryType) {
    document.querySelectorAll(".nursery-filter-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.nurseryFilter === savedNurseryType);
    });
  }
  document.querySelectorAll(".nursery-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nursery-filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      localStorage.setItem("nurseryTypeFilter", btn.dataset.nurseryFilter);
      applyNurseryFilters();
    });
  });

  // Distance filter
  const savedNurseryDist = localStorage.getItem("nurseryDistFilter");
  if (savedNurseryDist) {
    document.querySelectorAll(".nursery-distance-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.walkMax === savedNurseryDist);
    });
  }
  document.querySelectorAll(".nursery-distance-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nursery-distance-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      localStorage.setItem("nurseryDistFilter", btn.dataset.walkMax);
      applyNurseryFilters();
    });
  });

  // Sort
  const sortSelect = document.getElementById("nurserySortSelect");
  if (sortSelect) {
    const savedSort = localStorage.getItem("nurserySort");
    if (savedSort) sortSelect.value = savedSort;
    sortSelect.addEventListener("change", () => {
      localStorage.setItem("nurserySort", sortSelect.value);
      applyNurseryFilters();
    });
  }

  // Help link — show all types in one modal
  const helpAllBtn = document.getElementById("nurseryHelpAllBtn");
  if (helpAllBtn) {
    helpAllBtn.addEventListener("click", () => {
      const modal = document.getElementById("nurseryHelpModal");
      document.getElementById("nurseryHelpTitle").textContent = "保育園の種別について";
      let html = "";
      for (const [type, info] of Object.entries(NURSERY_TYPE_HELP)) {
        const color = NURSERY_TYPE_COLORS[type] || "#6b7280";
        html += `<div class="nursery-help-card" style="background:${color}10;border-left:4px solid ${color};">`;
        html += `<h4 style="color:${color};">${info.title}</h4>`;
        html += info.body;
        html += `<a href="${info.link}" target="_blank" class="nursery-help-card-link">横浜市の公式ページ ↗</a>`;
        html += `</div>`;
      }
      document.getElementById("nurseryHelpBody").innerHTML = html;
      modal.hidden = false;
    });
  }

  // Help modal close
  const helpCloseBtn = document.getElementById("nurseryHelpCloseBtn");
  const helpCloseX = document.getElementById("nurseryHelpCloseX");
  if (helpCloseBtn) {
    helpCloseBtn.addEventListener("click", () => {
      document.getElementById("nurseryHelpModal").hidden = true;
    });
  }
  if (helpCloseX) {
    helpCloseX.addEventListener("click", () => {
      document.getElementById("nurseryHelpModal").hidden = true;
    });
  }
  const helpModal = document.getElementById("nurseryHelpModal");
  if (helpModal) {
    helpModal.addEventListener("click", (e) => {
      if (e.target === helpModal) helpModal.hidden = true;
    });
  }

  // Interest button
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".nursery-interest-btn");
    if (!btn) return;
    const name = btn.dataset.nurseryName;
    let interests = getNurseryInterests();
    if (interests.includes(name)) {
      interests = interests.filter((n) => n !== name);
      showToast("「気になる」を解除しました");
    } else {
      interests.push(name);
      showToast("「気になる」に追加しました");
    }
    saveNurseryInterests(interests);
    applyNurseryFilters();
    updateNurseryMapMarkers();
  });

  // Visited button
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".nursery-visited-btn");
    if (!btn) return;
    const name = btn.dataset.nurseryName;
    let visits = getNurseryVisits();
    if (visits.includes(name)) {
      visits = visits.filter((n) => n !== name);
      showToast("「見学済み」を解除しました");
    } else {
      visits.push(name);
      showToast("「見学済み」にしました");
    }
    saveNurseryVisits(visits);
    applyNurseryFilters();
    updateNurseryMapMarkers();
  });

  // Memo button - open modal
  let currentMemoNursery = "";
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".nursery-memo-btn");
    if (!btn) return;
    currentMemoNursery = btn.dataset.nurseryName;
    const memos = getNurseryMemos();
    const memo = memos[currentMemoNursery] || {};

    document.getElementById("nurseryMemoTitle").textContent = currentMemoNursery + " のメモ";
    document.getElementById("nurseryVisitDate").value = memo.date || "";
    document.getElementById("nurseryMemoText").value = memo.text || "";
    document.getElementById("nurseryMemoModal").hidden = false;
  });

  // Memo save
  const memoSaveBtn = document.getElementById("nurseryMemoSaveBtn");
  if (memoSaveBtn) {
    memoSaveBtn.addEventListener("click", () => {
      const date = document.getElementById("nurseryVisitDate").value;
      const text = document.getElementById("nurseryMemoText").value.trim();
      const memos = getNurseryMemos();
      if (date || text) {
        memos[currentMemoNursery] = { date, text };
      } else {
        delete memos[currentMemoNursery];
      }
      saveNurseryMemos(memos);
      document.getElementById("nurseryMemoModal").hidden = true;
      applyNurseryFilters();
      showToast("メモを保存しました");
    });
  }

  // Memo cancel
  const memoCancelBtn = document.getElementById("nurseryMemoCancelBtn");
  if (memoCancelBtn) {
    memoCancelBtn.addEventListener("click", () => {
      document.getElementById("nurseryMemoModal").hidden = true;
    });
  }
  const memoModal = document.getElementById("nurseryMemoModal");
  if (memoModal) {
    memoModal.addEventListener("click", (e) => {
      if (e.target === memoModal) memoModal.hidden = true;
    });
  }
}

// ===== 日用品在庫管理 =====
const SUPPLIES_KEY = "familyGuide_supplies";
const SUPPLIES_CATEGORIES = {
  kitchen: "🍳 キッチン",
  bath: "🛁 お風呂・整容",
  toilet: "🚽 トイレ",
  paper: "🧻 ペーパー類",
  other: "📦 その他",
};
const SUPPLIES_CAT_ORDER = ["kitchen", "bath", "toilet", "paper", "other"];
let suppliesCategory = "kitchen";
let suppliesSearchQuery = "";
let editingSupplyId = null;
let _suppliesCache = null;

function getSupplies() {
  if (_suppliesCache !== null) return _suppliesCache;
  try {
    return JSON.parse(localStorage.getItem(SUPPLIES_KEY)) || [];
  } catch { return []; }
}

function saveSupplies(list) {
  _suppliesCache = list;
  localStorage.setItem(SUPPLIES_KEY, JSON.stringify(list));
  if (shoppingDb) {
    shoppingDb.ref("shared/supplies").set(list);
  }
}

function addSupply(name, category, qty, spareQty, memo) {
  const list = getSupplies();
  list.push({
    id: "sup_" + Date.now(),
    name: name.trim(),
    category: category,
    qty: qty != null ? qty : 1,
    spareQty: spareQty || 0,
    memo: memo ? memo.trim() : "",
  });
  saveSupplies(list);
}

function updateSupply(id, name, category, qty, spareQty, memo) {
  const list = getSupplies();
  const item = list.find((s) => s.id === id);
  if (item) {
    item.name = name.trim();
    item.category = category;
    item.qty = qty != null ? qty : 1;
    item.spareQty = spareQty || 0;
    item.memo = memo ? memo.trim() : "";
    saveSupplies(list);
  }
}

function deleteSupply(id) {
  const list = getSupplies().filter((s) => s.id !== id);
  saveSupplies(list);
}

function changeSupplyQty(id, field, delta) {
  const list = getSupplies();
  const item = list.find((s) => s.id === id);
  if (!item) return;
  const current = item[field] != null ? item[field] : (field === "qty" ? 1 : 0);
  const newVal = Math.max(0, Math.min(999, current + delta));
  item[field] = newVal;
  saveSupplies(list);
  renderSupplies();

  // 予備が0になったら買い物リストへの追加を提案
  if (field === "spareQty" && current > 0 && newVal === 0) {
    promptAddToShoppingList(item.name);
  }
}

function renderSupplyItem(s) {
  const qty = s.qty != null ? s.qty : 1;
  const spareQty = s.spareQty || 0;
  const isOutOfStock = qty === 0;
  let itemClass = "supply-item";
  if (isOutOfStock) itemClass += " supply-item--out-of-stock";
  const memoHtml = s.memo ? `<div class="supply-item-memo">${escapeHtml(s.memo)}</div>` : "";

  return `
  <div class="${itemClass}" data-id="${s.id}">
    <div class="supply-item-row">
      <div class="supply-item-name">${escapeHtml(s.name)}</div>
      <div class="supply-inline-qty">
        <div class="supply-inline-label">個数</div>
        <div class="quantity-control quantity-control--inline">
          <button class="sup-qty-btn" data-id="${s.id}" data-field="qty" data-delta="-1" type="button">−</button>
          <span class="qty-display">${qty}</span>
          <button class="sup-qty-btn" data-id="${s.id}" data-field="qty" data-delta="1" type="button">＋</button>
        </div>
      </div>
      <div class="supply-inline-qty">
        <div class="supply-inline-label">予備</div>
        <div class="quantity-control quantity-control--inline">
          <button class="sup-qty-btn" data-id="${s.id}" data-field="spareQty" data-delta="-1" type="button">−</button>
          <span class="qty-display">${spareQty}</span>
          <button class="sup-qty-btn" data-id="${s.id}" data-field="spareQty" data-delta="1" type="button">＋</button>
        </div>
      </div>
    </div>
    ${memoHtml}
  </div>`;
}

function renderSupplies() {
  const suppliesItems = document.getElementById("suppliesItems");
  const suppliesEmpty = document.getElementById("suppliesEmpty");
  if (!suppliesItems) return;

  let list = getSupplies().filter((s) => s.category === suppliesCategory);

  if (suppliesSearchQuery) {
    const q = suppliesSearchQuery.toLowerCase();
    list = list.filter((s) => s.name.toLowerCase().includes(q));
  }

  list.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  if (list.length === 0) {
    suppliesItems.innerHTML = "";
    suppliesEmpty.hidden = false;
    return;
  }

  suppliesEmpty.hidden = true;
  suppliesItems.innerHTML = list.map(renderSupplyItem).join("");

  // qty buttons
  suppliesItems.querySelectorAll(".sup-qty-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      changeSupplyQty(btn.dataset.id, btn.dataset.field, Number(btn.dataset.delta));
    });
  });

  // item click → edit
  suppliesItems.querySelectorAll(".supply-item").forEach((el) => {
    el.addEventListener("click", () => openSuppliesEditModal(el.dataset.id));
  });
}

function switchSuppliesCategory(cat) {
  suppliesCategory = cat;
  document.querySelectorAll(".supplies-cat-btn").forEach((btn) => {
    btn.classList.toggle("supplies-cat-btn--active", btn.dataset.cat === cat);
  });
  renderSupplies();
}

function openSuppliesEditModal(id) {
  editingSupplyId = id || null;
  const item = id ? getSupplies().find((s) => s.id === id) : null;

  document.getElementById("suppliesEditTitle").textContent = item ? "在庫編集" : "在庫追加";
  document.getElementById("suppliesEditName").value = item ? item.name : "";
  document.getElementById("suppliesEditCategory").value = item ? item.category : suppliesCategory;
  document.getElementById("suppliesEditQty").value = item ? (item.qty != null ? item.qty : 1) : 1;
  document.getElementById("suppliesEditSpareQty").value = item ? (item.spareQty || 0) : 0;
  document.getElementById("suppliesEditMemo").value = item ? (item.memo || "") : "";
  document.getElementById("suppliesEditDeleteBtn").hidden = !item;

  document.getElementById("suppliesEditModal").hidden = false;
  setTimeout(() => document.getElementById("suppliesEditName").focus(), 100);
}

function closeSuppliesEditModal() {
  document.getElementById("suppliesEditModal").hidden = true;
  editingSupplyId = null;
}

function saveSuppliesEditItem() {
  const name = document.getElementById("suppliesEditName").value.trim();
  if (!name) { showToast("品名を入力してください"); return; }

  const category = document.getElementById("suppliesEditCategory").value;
  const memo = document.getElementById("suppliesEditMemo").value;
  const qtyParsed = parseInt(document.getElementById("suppliesEditQty").value);
  const qty = Math.max(0, Math.min(999, isNaN(qtyParsed) ? 1 : qtyParsed));
  const spareQty = Math.max(0, Math.min(999, parseInt(document.getElementById("suppliesEditSpareQty").value) || 0));

  if (editingSupplyId) {
    updateSupply(editingSupplyId, name, category, qty, spareQty, memo);
    showToast("更新しました");
  } else {
    addSupply(name, category, qty, spareQty, memo);
    showToast("追加しました");
  }

  document.getElementById("suppliesSearch").value = "";
  suppliesSearchQuery = "";
  closeSuppliesEditModal();
  renderSupplies();
}

function deleteSuppliesEditItem() {
  if (!editingSupplyId) return;
  const item = getSupplies().find((s) => s.id === editingSupplyId);
  if (item && confirm(`「${item.name}」を削除しますか？`)) {
    deleteSupply(editingSupplyId);
    document.getElementById("suppliesSearch").value = "";
    suppliesSearchQuery = "";
    closeSuppliesEditModal();
    renderSupplies();
    showToast("削除しました");
  }
}

function setupSuppliesSwipe() {
  const area = document.getElementById("suppliesSwipeArea");
  if (!area) return;
  let startX = 0, startY = 0, tracking = false;

  area.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY; tracking = true;
  }, { passive: true });

  area.addEventListener("touchmove", () => {}, { passive: true });

  area.addEventListener("touchend", (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    const idx = SUPPLIES_CAT_ORDER.indexOf(suppliesCategory);
    if (dx < 0 && idx < SUPPLIES_CAT_ORDER.length - 1) {
      switchSuppliesCategory(SUPPLIES_CAT_ORDER[idx + 1]);
    } else if (dx > 0 && idx > 0) {
      switchSuppliesCategory(SUPPLIES_CAT_ORDER[idx - 1]);
    }
  }, { passive: true });
}

function setupSupplies() {
  const addBtn = document.getElementById("addSupplyBtn");
  const searchInput = document.getElementById("suppliesSearch");
  const searchBtn = document.getElementById("suppliesSearchBtn");
  const saveBtn = document.getElementById("suppliesEditSaveBtn");
  const deleteBtn = document.getElementById("suppliesEditDeleteBtn");
  const cancelBtn = document.getElementById("suppliesEditCancelBtn");
  const modal = document.getElementById("suppliesEditModal");

  if (addBtn) addBtn.addEventListener("click", () => openSuppliesEditModal());
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      suppliesSearchQuery = searchInput.value;
      renderSupplies();
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        suppliesSearchQuery = searchInput.value;
        renderSupplies();
        searchInput.blur();
      }
    });
  }
  if (searchBtn) searchBtn.addEventListener("click", () => {
    suppliesSearchQuery = searchInput.value;
    renderSupplies();
    searchInput.blur();
  });

  document.querySelectorAll(".supplies-cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchSuppliesCategory(btn.dataset.cat));
  });

  if (saveBtn) saveBtn.addEventListener("click", saveSuppliesEditItem);
  if (deleteBtn) deleteBtn.addEventListener("click", deleteSuppliesEditItem);
  if (cancelBtn) cancelBtn.addEventListener("click", closeSuppliesEditModal);
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal) closeSuppliesEditModal(); });
  }

  // Modal qty +/- buttons
  const qtyMinus = document.getElementById("suppliesQtyMinus");
  const qtyPlus = document.getElementById("suppliesQtyPlus");
  const spareQtyMinus = document.getElementById("suppliesSpareQtyMinus");
  const spareQtyPlus = document.getElementById("suppliesSpareQtyPlus");
  const qtyInput = document.getElementById("suppliesEditQty");
  const spareQtyInput = document.getElementById("suppliesEditSpareQty");

  if (qtyMinus) qtyMinus.addEventListener("click", () => { qtyInput.value = Math.max(0, (parseInt(qtyInput.value) || 0) - 1); });
  if (qtyPlus) qtyPlus.addEventListener("click", () => { qtyInput.value = Math.min(999, (parseInt(qtyInput.value) || 0) + 1); });
  if (spareQtyMinus) spareQtyMinus.addEventListener("click", () => { spareQtyInput.value = Math.max(0, (parseInt(spareQtyInput.value) || 0) - 1); });
  if (spareQtyPlus) spareQtyPlus.addEventListener("click", () => { spareQtyInput.value = Math.min(999, (parseInt(spareQtyInput.value) || 0) + 1); });

  setupSuppliesSwipe();
  renderSupplies();
}

async function init() {
  setupNavigation();
  setupSwipeNavigation();
  setupSearch();
  setupHospitalToggle();
  setupTaxiToggle();
  setupCareFilter();
  setupTaxiFinder();
  setupFavoriteClicks();
  setupShare();
  setupScrollTop();
  setupCalendarFilter();
  setupCustomCalendar();
  setupHeaderMenu();
  setupChildManagement();
  setupShoppingList();
  setupSupplies();
  setupFirebaseSync();
  setupNursery();
  setupKondateView();
  setupFirstAidAccordion();
  setupFirstAidNav();
  try {
    const data = await loadData();
    taxiLaborData = data.taxiLabor || [];
    renderAll(data);
    setStatusMessage("");
    updateFavCountBadge();
    checkImport();
    const savedTab = localStorage.getItem("currentTab");
    if (savedTab && savedTab !== "home" && savedTab !== "favorites") {
      navigateTo(savedTab);
    }
  } catch (error) {
    renderAll({ pediatrics: [], ent: [], dermatology: [], emergency: [], nightEmergency: [], taxiLabor: [], taxiGeneral: [], careSupport: [], governmentLinks: [], nurseries: [] });
    setStatusMessage("データの読み込みに失敗しました。data.json を確認してください。");
    console.error(error);
  }
}

// ===== 献立連携（kyou-nani Firebase） =====
const KONDATE_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBsGx15Iqefe-OksgqXCeB8pLQQSFTAjQw",
  authDomain: "kyou-nani.firebaseapp.com",
  databaseURL: "https://kyou-nani-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kyou-nani",
  storageBucket: "kyou-nani.firebasestorage.app",
  messagingSenderId: "500768937988",
  appId: "1:500768937988:web:c9eaed25e254baac6afd51"
};

let kondateDb = null;
let kondateMenus = {};
let kondateYear, kondateMonth;

function setupKondateView() {
  const now = new Date();
  kondateYear = now.getFullYear();
  kondateMonth = now.getMonth();

  if (typeof firebase === "undefined") {
    const status = document.getElementById("kondateSyncStatus");
    if (status) status.textContent = "オフラインモード";
    return;
  }

  // Initialize as second named app
  let kondateApp;
  try {
    kondateApp = firebase.app("kyou-nani");
  } catch {
    kondateApp = firebase.initializeApp(KONDATE_FIREBASE_CONFIG, "kyou-nani");
  }
  kondateDb = kondateApp.database();

  // Connection status
  const statusEl = document.getElementById("kondateSyncStatus");
  kondateDb.ref(".info/connected").on("value", (snap) => {
    if (statusEl) {
      statusEl.textContent = snap.val() ? "" : "接続中...";
    }
  });

  // Listen for menus
  kondateDb.ref("menus").on("value", (snap) => {
    kondateMenus = snap.val() || {};
    renderKondateCalendar();
  });

  // Month navigation
  const prevBtn = document.getElementById("kondatePrevMonth");
  const nextBtn = document.getElementById("kondateNextMonth");
  const todayBtn = document.getElementById("kondateTodayBtn");
  if (prevBtn) prevBtn.addEventListener("click", () => {
    kondateMonth--;
    if (kondateMonth < 0) { kondateMonth = 11; kondateYear--; }
    renderKondateCalendar();
  });
  if (nextBtn) nextBtn.addEventListener("click", () => {
    kondateMonth++;
    if (kondateMonth > 11) { kondateMonth = 0; kondateYear++; }
    renderKondateCalendar();
  });
  if (todayBtn) todayBtn.addEventListener("click", () => {
    const now = new Date();
    kondateYear = now.getFullYear();
    kondateMonth = now.getMonth();
    renderKondateCalendar();
  });

  renderKondateCalendar();
}

function renderKondateCalendar() {
  const grid = document.getElementById("kondateGrid");
  const label = document.getElementById("kondateMonthLabel");
  if (!grid) return;

  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  if (label) label.textContent = `${kondateYear}年 ${monthNames[kondateMonth]}`;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const firstDay = new Date(kondateYear, kondateMonth, 1).getDay();
  const daysInMonth = new Date(kondateYear, kondateMonth + 1, 0).getDate();

  let html = "";

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="kondate-cell kondate-cell--empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(kondateMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${kondateYear}-${m}-${dd}`;
    const dow = (firstDay + d - 1) % 7;

    const raw = kondateMenus[dateStr];
    let menuArr = [];
    if (raw) {
      if (typeof raw === "string") menuArr = raw.trim() ? [raw.trim()] : [];
      else if (Array.isArray(raw)) menuArr = raw.filter((s) => s && s.trim());
    }

    let classes = "kondate-cell";
    if (dow === 0) classes += " kondate-cell--sun";
    if (dow === 6) classes += " kondate-cell--sat";
    if (dateStr === todayStr) classes += " kondate-cell--today";
    if (menuArr.length > 0) classes += " kondate-cell--filled";

    html += `<div class="${classes}">`;
    html += `<span class="kondate-cell-num">${d}</span>`;
    if (menuArr.length > 0) {
      html += menuArr.map((m) => `<span class="kondate-cell-menu">${escapeHtml(m)}</span>`).join("");
    }
    html += "</div>";
  }

  const totalCells = firstDay + daysInMonth;
  const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < trailing; i++) {
    html += '<div class="kondate-cell kondate-cell--empty"></div>';
  }

  grid.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", init);

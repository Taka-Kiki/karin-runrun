const STORAGE_KEY = "kondate_menus";
const MENU_LIST_KEY = "kondate_menu_list";
const STOCK_KEY = "kondate_stock";
const MEMO_KEY = "kondate_calendar_memo";
const PRESET_TAGS = ["和食", "洋食", "中華", "丼もの", "魚", "肉", "野菜", "麺類", "鍋"];
const STOCK_CATEGORIES = { fridge: "冷蔵庫", freezer: "冷凍庫", pantry: "常温・調味料" };
const STOCK_SUBCATEGORIES = {
  fridge: { staple: "常備品", vegetable: "野菜" },
  pantry: { room_temp: "常温", seasoning: "調味料" },
};
const SUBCAT_ORDER = { fridge: ["staple", "vegetable", ""], pantry: ["room_temp", "seasoning", ""] };

// ===== Firebase =====
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBsGx15Iqefe-OksgqXCeB8pLQQSFTAjQw",
  authDomain: "kyou-nani.firebaseapp.com",
  databaseURL: "https://kyou-nani-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kyou-nani",
  storageBucket: "kyou-nani.firebasestorage.app",
  messagingSenderId: "500768937988",
  appId: "1:500768937988:web:c9eaed25e254baac6afd51"
};

const FIREBASE_PATHS = {
  menus: "menus",
  menuList: "menuList",
  stock: "stock",
  memo: "memo",
};

let kondateDb = null;
let _menusCache = null;
let _menuListCache = null;
let _stockCache = null;
let _memoCache = null;

// ===== State =====
let currentYear;
let currentMonth; // 0-indexed
let editingDate = null; // "YYYY-MM-DD"
let activeTab = "calendar";

// Menu list state
let editingMenuId = null; // null = add, string = edit
let menuListFilterTag = null;
let menuListSearchQuery = "";
let modalFilterTag = null;

// Multi-entry modal state
let menuEntries = []; // [{value: "", mode: "manual"}]

// Stock state
let stockCategory = "fridge";
let stockSearchQuery = "";
let editingStockId = null;

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const monthLabel = $("monthLabel");
const calendarGrid = $("calendarGrid");
const prevMonthBtn = $("prevMonth");
const nextMonthBtn = $("nextMonth");
const todayBtn = $("todayBtn");

// Calendar Modal
const menuModal = $("menuModal");
const menuModalTitle = $("menuModalTitle");
const menuEntriesEl = $("menuEntries");
const addEntryBtn = $("addEntryBtn");
const menuSaveBtn = $("menuSaveBtn");
const menuCopyNextBtn = $("menuCopyNextBtn");
const menuDeleteBtn = $("menuDeleteBtn");
const menuCancelBtn = $("menuCancelBtn");
const menuSuggestions = $("menuSuggestions");
const menuSuggestionsList = $("menuSuggestionsList");

// Menu List Tab
const menulistSearch = $("menulistSearch");
const menulistTags = $("menulistTags");
const menulistItems = $("menulistItems");
const menulistEmpty = $("menulistEmpty");
const addMenuBtn = $("addMenuBtn");

// Menu Edit Modal
const menuEditModal = $("menuEditModal");
const menuEditTitle = $("menuEditTitle");
const menuEditName = $("menuEditName");
const menuEditTagsList = $("menuEditTagsList");
const menuEditSaveBtn = $("menuEditSaveBtn");
const menuEditCancelBtn = $("menuEditCancelBtn");

// Stock Tab
const stockSearch = $("stockSearch");
const stockItems = $("stockItems");
const stockEmpty = $("stockEmpty");
const stockAlerts = $("stockAlerts");
const addStockBtn = $("addStockBtn");

// Stock Edit Modal
const stockEditModal = $("stockEditModal");
const stockEditTitle = $("stockEditTitle");
const stockEditName = $("stockEditName");
const stockEditCategory = $("stockEditCategory");
const stockEditExpiry = $("stockEditExpiry");
const stockEditMemo = $("stockEditMemo");
const stockEditQty = $("stockEditQty");
const stockEditSpareQty = $("stockEditSpareQty");
const stockEditSaveBtn = $("stockEditSaveBtn");
const stockEditDeleteBtn = $("stockEditDeleteBtn");
const stockEditCancelBtn = $("stockEditCancelBtn");

// Calendar Memo & Pinned Stock
const calendarMemo = $("calendarMemo");
const calendarMemoToggle = $("calendarMemoToggle");
const memoToggleArrow = $("memoToggleArrow");
const pinnedStockEl = $("pinnedStock");
const pinnedStockChips = $("pinnedStockChips");

// Toast
const toastEl = $("toast");

// ===== Storage: Calendar Menus =====
function getMenus() {
  if (_menusCache !== null) return _menusCache;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMenus(menus) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));
  kondateFirebaseSet(FIREBASE_PATHS.menus, menus);
}

function getMenuArray(dateStr) {
  const raw = getMenus()[dateStr];
  if (!raw) return [];
  // Backward compat: string → array
  if (typeof raw === "string") return raw.trim() ? [raw.trim()] : [];
  if (Array.isArray(raw)) return raw.filter((s) => s.trim());
  return [];
}

function getMenu(dateStr) {
  return getMenuArray(dateStr).join("、") || "";
}

function setMenuArray(dateStr, arr) {
  const menus = getMenus();
  const filtered = arr.map((s) => s.trim()).filter(Boolean);
  if (filtered.length > 0) {
    menus[dateStr] = filtered;
  } else {
    delete menus[dateStr];
  }
  saveMenus(menus);
}

function setMenu(dateStr, menu) {
  const menus = getMenus();
  if (menu.trim()) {
    menus[dateStr] = [menu.trim()];
  } else {
    delete menus[dateStr];
  }
  saveMenus(menus);
}

// ===== Storage: Menu List =====
function getMenuList() {
  if (_menuListCache !== null) return _menuListCache;
  try {
    return JSON.parse(localStorage.getItem(MENU_LIST_KEY)) || [];
  } catch {
    return [];
  }
}

function saveMenuList(list) {
  localStorage.setItem(MENU_LIST_KEY, JSON.stringify(list));
  kondateFirebaseSet(FIREBASE_PATHS.menuList, list);
}

function addMenuItem(name, tags) {
  const list = getMenuList();
  list.push({
    id: "m_" + Date.now(),
    name: name.trim(),
    tags: tags || [],
    usageCount: 0,
  });
  saveMenuList(list);
}

function updateMenuItem(id, name, tags) {
  const list = getMenuList();
  const item = list.find((m) => m.id === id);
  if (item) {
    item.name = name.trim();
    item.tags = tags || [];
    saveMenuList(list);
  }
}

function deleteMenuItem(id) {
  const list = getMenuList().filter((m) => m.id !== id);
  saveMenuList(list);
}

// ===== Storage: Stock =====
function getStock() {
  if (_stockCache !== null) return _stockCache;
  try {
    return JSON.parse(localStorage.getItem(STOCK_KEY)) || [];
  } catch {
    return [];
  }
}

function saveStock(list) {
  localStorage.setItem(STOCK_KEY, JSON.stringify(list));
  kondateFirebaseSet(FIREBASE_PATHS.stock, list);
}

function addStockItem(name, category, expiry, memo, qty, spareQty, subCategory, frozenDate) {
  const list = getStock();
  list.push({
    id: "s_" + Date.now(),
    name: name.trim(),
    category: category,
    subCategory: subCategory || "",
    expiry: expiry || "",
    frozenDate: frozenDate || "",
    memo: memo ? memo.trim() : "",
    qty: qty || 1,
    spareQty: spareQty || 0,
  });
  saveStock(list);
}

function updateStockItem(id, name, category, expiry, memo, qty, spareQty, subCategory, frozenDate) {
  const list = getStock();
  const item = list.find((s) => s.id === id);
  if (item) {
    item.name = name.trim();
    item.category = category;
    item.subCategory = subCategory || "";
    item.expiry = expiry || "";
    item.frozenDate = frozenDate || "";
    item.memo = memo ? memo.trim() : "";
    item.qty = qty || 1;
    item.spareQty = spareQty || 0;
    saveStock(list);
  }
}

function deleteStockItem(id) {
  const list = getStock().filter((s) => s.id !== id);
  saveStock(list);
}

// ===== Calendar Memo =====
function loadCalendarMemo() {
  const saved = (_memoCache !== null) ? _memoCache : (localStorage.getItem(MEMO_KEY) || "");
  calendarMemo.value = saved;
  // Open if has content, closed if empty
  const hasContent = saved.trim().length > 0;
  calendarMemo.classList.toggle("calendar-memo-text--open", hasContent);
  memoToggleArrow.classList.toggle("toggle-arrow--open", hasContent);
}

let memoSaveTimer;
function saveCalendarMemo() {
  clearTimeout(memoSaveTimer);
  memoSaveTimer = setTimeout(() => {
    localStorage.setItem(MEMO_KEY, calendarMemo.value);
    kondateFirebaseSet(FIREBASE_PATHS.memo, calendarMemo.value);
  }, 500);
}

function toggleCalendarMemo() {
  const isOpen = calendarMemo.classList.toggle("calendar-memo-text--open");
  memoToggleArrow.classList.toggle("toggle-arrow--open", isOpen);
  if (isOpen) calendarMemo.focus();
}

// ===== Stock Pin =====
function toggleStockPin(id) {
  const list = getStock();
  const item = list.find((s) => s.id === id);
  if (!item) return;
  item.pinned = !item.pinned;
  saveStock(list);
  renderStock();
  renderPinnedStock();
}

function unpinStock(id) {
  const list = getStock();
  const item = list.find((s) => s.id === id);
  if (!item) return;
  item.pinned = false;
  saveStock(list);
  renderPinnedStock();
  // If stock tab is visible, re-render it too
  if (activeTab === "stock") renderStock();
}

function renderPinnedStock() {
  const pinned = getStock().filter((s) => s.pinned);
  if (pinned.length === 0) {
    pinnedStockEl.hidden = true;
    return;
  }

  pinnedStockEl.hidden = false;
  pinnedStockChips.innerHTML = pinned
    .map((s) => {
      const qty = s.qty || 1;
      const catLabel = s.category === "freezer" ? "冷凍" : "";
      const label = `${escapeHtml(s.name)}×${qty}${catLabel ? "(" + catLabel + ")" : ""}`;
      return `<span class="pinned-chip pinned-chip--${s.category}">
        ${label}
        <button class="pinned-chip-remove" data-id="${s.id}" type="button" title="非表示">×</button>
      </span>`;
    })
    .join("");

  pinnedStockChips.querySelectorAll(".pinned-chip-remove").forEach((btn) => {
    btn.addEventListener("click", () => unpinStock(btn.dataset.id));
  });
}

// ===== Suggestions =====
function getFrequentMenus(limit) {
  const menus = getMenus();
  const counts = {};
  Object.values(menus).forEach((m) => {
    // Handle both string (legacy) and array format
    const items = Array.isArray(m) ? m : [m];
    items.forEach((item) => {
      const key = item.trim();
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

// ===== Tab Navigation =====
function switchTab(tabName) {
  document.querySelectorAll(".tab-content").forEach((el) => (el.hidden = true));
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("tab-btn--active"));

  const tabMap = { calendar: "tabCalendar", menulist: "tabMenuList", stock: "tabStock" };
  const tabEl = $(tabMap[tabName]);
  if (tabEl) tabEl.hidden = false;

  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  if (btn) btn.classList.add("tab-btn--active");

  activeTab = tabName;
  localStorage.setItem("kondate_active_tab", tabName);

  if (tabName === "calendar") {
    renderPinnedStock();
  } else if (tabName === "menulist") {
    renderMenuList();
  } else if (tabName === "stock") {
    renderStock();
  }
}

// ===== Calendar Rendering =====
function formatDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function renderCalendar() {
  const today = new Date();
  const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  monthLabel.textContent = `${currentYear}年 ${monthNames[currentMonth]}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const menus = getMenus();
  let filledCount = 0;
  let html = "";

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="day-cell day-cell--empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateStr(currentYear, currentMonth, d);
    const dow = (firstDay + d - 1) % 7;
    const menuArr = getMenuArray(dateStr);
    const hasMenu = menuArr.length > 0;
    if (hasMenu) filledCount++;

    let classes = "day-cell";
    if (dow === 0) classes += " day-cell--sun";
    if (dow === 6) classes += " day-cell--sat";
    if (dateStr === todayStr) classes += " day-cell--today";

    html += `<div class="${classes}" data-date="${dateStr}">`;
    html += `<span class="day-number">${d}</span>`;
    if (hasMenu) {
      html += menuArr.map((m, i) => `<span class="day-menu" draggable="true" data-date="${dateStr}" data-menu-idx="${i}">${escapeHtml(m)}</span>`).join("");
    }
    html += "</div>";
  }

  const totalCells = firstDay + daysInMonth;
  const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < trailing; i++) {
    html += '<div class="day-cell day-cell--empty"></div>';
  }

  calendarGrid.innerHTML = html;
  calendarGrid.querySelectorAll(".day-cell:not(.day-cell--empty)").forEach((cell) => {
    cell.addEventListener("click", (e) => {
      // Don't open modal if clicking on a draggable menu item (handled by drag)
      if (e.target.classList.contains("day-menu")) return;
      openMenuModal(cell.dataset.date);
    });
  });
  initDragAndDrop();
}

// ===== Calendar Modal =====
function openMenuModal(dateStr) {
  editingDate = dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = ["日", "月", "火", "水", "木", "金", "土"][new Date(y, m - 1, d).getDay()];
  menuModalTitle.textContent = `${m}月${d}日（${dow}）の夕飯`;

  const current = getMenuArray(dateStr);
  menuDeleteBtn.hidden = current.length === 0;

  // Init entries
  if (current.length > 0) {
    menuEntries = current.map((v) => ({ value: v, mode: "manual" }));
  } else {
    menuEntries = [{ value: "", mode: "manual" }];
  }
  renderMenuEntries();

  // Frequent suggestions (for manual mode)
  const suggestions = getFrequentMenus(10);
  if (suggestions.length > 0) {
    menuSuggestions.hidden = false;
    menuSuggestionsList.innerHTML = suggestions
      .map((s) => `<button type="button" class="menu-suggestion-tag">${escapeHtml(s)}</button>`)
      .join("");
    menuSuggestionsList.querySelectorAll(".menu-suggestion-tag").forEach((btn) => {
      btn.addEventListener("click", () => {
        // Find the first empty manual entry, or the last entry
        const idx = menuEntries.findIndex((e) => !e.value.trim()) !== -1
          ? menuEntries.findIndex((e) => !e.value.trim())
          : menuEntries.length - 1;
        menuEntries[idx].value = btn.textContent;
        menuEntries[idx].mode = "manual";
        renderMenuEntries();
      });
    });
  } else {
    menuSuggestions.hidden = true;
  }

  menuModal.classList.add("is-open");
  setTimeout(() => {
    const firstInput = menuEntriesEl.querySelector(".menu-entry-input");
    if (firstInput) firstInput.focus();
  }, 100);
}

function renderMenuEntries() {
  const menuList = getMenuList();
  const hasMenuList = menuList.length > 0;

  menuEntriesEl.innerHTML = menuEntries
    .map((entry, idx) => {
      const removeBtn = menuEntries.length > 1
        ? `<button type="button" class="entry-remove-btn" data-idx="${idx}" title="削除">×</button>`
        : "";

      const modeToggle = hasMenuList
        ? `<div class="entry-mode-toggle">
            <button type="button" class="entry-mode-btn${entry.mode === "manual" ? " entry-mode-btn--active" : ""}" data-idx="${idx}" data-mode="manual">手入力</button>
            <button type="button" class="entry-mode-btn${entry.mode === "list" ? " entry-mode-btn--active" : ""}" data-idx="${idx}" data-mode="list">一覧から</button>
          </div>`
        : "";

      let inputArea;
      if (entry.mode === "list" && hasMenuList) {
        inputArea = renderMenuListPicker(idx, entry.value, menuList);
      } else {
        inputArea = `<input type="text" class="menu-form-input menu-entry-input" data-idx="${idx}" placeholder="例：カレーライス" maxlength="100" value="${escapeHtml(entry.value)}" />`;
      }

      return `
        <div class="menu-entry" data-idx="${idx}">
          <div class="menu-entry-header">
            <span class="menu-entry-label">${menuEntries.length > 1 ? `メニュー${idx + 1}` : "夕飯メニュー"}</span>
            ${removeBtn}
          </div>
          ${modeToggle}
          ${inputArea}
        </div>`;
    })
    .join("");

  // Bind events
  menuEntriesEl.querySelectorAll(".menu-entry-input").forEach((input) => {
    input.addEventListener("input", () => {
      menuEntries[Number(input.dataset.idx)].value = input.value;
    });
  });

  menuEntriesEl.querySelectorAll(".entry-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      menuEntries.splice(Number(btn.dataset.idx), 1);
      renderMenuEntries();
    });
  });

  menuEntriesEl.querySelectorAll(".entry-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      menuEntries[idx].mode = btn.dataset.mode;
      renderMenuEntries();
    });
  });

  // List picker item clicks
  menuEntriesEl.querySelectorAll(".list-picker-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      menuEntries[idx].value = btn.dataset.name;
      renderMenuEntries();
    });
  });

  // List picker tag filter clicks
  menuEntriesEl.querySelectorAll(".list-picker-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const tag = btn.dataset.tag;
      const picker = btn.closest(".menu-list-picker");
      const currentTag = picker.dataset.filterTag || "";
      picker.dataset.filterTag = currentTag === tag ? "" : tag;
      renderMenuEntries();
    });
  });
}

function renderMenuListPicker(idx, selectedValue, menuList) {
  const usedTags = [...new Set(menuList.flatMap((m) => m.tags))];
  // We'll use a data attribute to track filter state; re-read from DOM if exists
  const existingPicker = menuEntriesEl.querySelector(`.menu-list-picker[data-idx="${idx}"]`);
  const filterTag = existingPicker ? existingPicker.dataset.filterTag || "" : "";

  let filtered = menuList;
  if (filterTag) {
    filtered = menuList.filter((m) => m.tags.includes(filterTag));
  }
  filtered.sort((a, b) => b.usageCount - a.usageCount);

  const tagsHtml = usedTags.length > 0
    ? `<div class="menulist-tags-mini">${usedTags
        .map((t) => `<button type="button" class="tag-filter-btn list-picker-tag${filterTag === t ? " tag-filter-btn--active" : ""}" data-idx="${idx}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
        .join("")}</div>`
    : "";

  const itemsHtml = filtered
    .map((m) => `<button type="button" class="menu-suggestion-tag list-picker-item${m.name === selectedValue ? " list-picker-item--selected" : ""}" data-idx="${idx}" data-name="${escapeHtml(m.name)}">${escapeHtml(m.name)}</button>`)
    .join("");

  return `
    <div class="menu-list-picker" data-idx="${idx}" data-filter-tag="${escapeHtml(filterTag)}">
      ${tagsHtml}
      <div class="menu-suggestions-list">${itemsHtml}</div>
    </div>`;
}

function addMenuEntry() {
  menuEntries.push({ value: "", mode: "manual" });
  renderMenuEntries();
  // Focus the new input
  setTimeout(() => {
    const inputs = menuEntriesEl.querySelectorAll(".menu-entry-input");
    if (inputs.length > 0) inputs[inputs.length - 1].focus();
  }, 50);
}

function closeMenuModal() {
  menuModal.classList.remove("is-open");
  editingDate = null;
  menuEntries = [];
}

function saveMenu() {
  if (!editingDate) return;
  const values = menuEntries.map((e) => e.value.trim()).filter(Boolean);
  setMenuArray(editingDate, values);

  // Increment usageCount or auto-add to menu list
  if (values.length > 0) {
    const list = getMenuList();
    let changed = false;
    values.forEach((v) => {
      const match = list.find((m) => m.name === v);
      if (match) {
        match.usageCount++;
        changed = true;
      } else {
        // Auto-add new menu to menu list
        list.push({
          id: "m_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
          name: v,
          tags: [],
          usageCount: 1,
        });
        changed = true;
      }
    });
    if (changed) saveMenuList(list);
  }

  closeMenuModal();
  renderCalendar();
  showToast("保存しました");
}

function copyToNextDay() {
  if (!editingDate) return;
  // First save current entries
  const values = menuEntries.map((e) => e.value.trim()).filter(Boolean);
  if (values.length === 0) {
    showToast("コピーするメニューがありません");
    return;
  }
  setMenuArray(editingDate, values);

  // Calculate next day
  const d = new Date(editingDate + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const nextDateStr = formatDateStr(d.getFullYear(), d.getMonth(), d.getDate());

  // Check if next day already has menus
  const existing = getMenuArray(nextDateStr);
  if (existing.length > 0) {
    if (!confirm(`翌日にはすでにメニューがあります。上書きしますか？`)) return;
  }

  setMenuArray(nextDateStr, values);
  closeMenuModal();
  renderCalendar();
  showToast("翌日にコピーしました");
}

function deleteMenu() {
  if (!editingDate) return;
  setMenuArray(editingDate, []);
  closeMenuModal();
  renderCalendar();
  showToast("削除しました");
}

// ===== Drag & Drop Menu Swap =====
function swapMenuItems(date1, idx1, date2, idx2) {
  const arr1 = getMenuArray(date1);
  const arr2 = getMenuArray(date2);
  const temp = arr1[idx1];
  arr1[idx1] = arr2[idx2];
  arr2[idx2] = temp;
  setMenuArray(date1, arr1);
  setMenuArray(date2, arr2);
}

function moveMenuItem(srcDate, srcIdx, dstDate) {
  const arr = getMenuArray(srcDate);
  const item = arr.splice(srcIdx, 1)[0];
  setMenuArray(srcDate, arr);
  const dstArr = getMenuArray(dstDate);
  dstArr.push(item);
  setMenuArray(dstDate, dstArr);
}

function initDragAndDrop() {
  const menuEls = calendarGrid.querySelectorAll(".day-menu");
  const dayCells = calendarGrid.querySelectorAll(".day-cell:not(.day-cell--empty)");

  function cleanupDragClasses() {
    calendarGrid.querySelectorAll(".day-menu--drag-over").forEach((o) =>
      o.classList.remove("day-menu--drag-over")
    );
    calendarGrid.querySelectorAll(".day-cell--drag-over").forEach((o) =>
      o.classList.remove("day-cell--drag-over")
    );
  }

  // --- PC: HTML5 Drag & Drop on menu items ---
  menuEls.forEach((el) => {
    el.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      el.classList.add("day-menu--dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify({
        date: el.dataset.date,
        idx: Number(el.dataset.menuIdx),
      }));
    });

    el.addEventListener("dragend", () => {
      el.classList.remove("day-menu--dragging");
      cleanupDragClasses();
    });

    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (!el.classList.contains("day-menu--dragging")) {
        el.classList.add("day-menu--drag-over");
      }
    });

    el.addEventListener("dragleave", () => {
      el.classList.remove("day-menu--drag-over");
    });

    el.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove("day-menu--drag-over");
      let src;
      try { src = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return; }
      const dstDate = el.dataset.date;
      const dstIdx = Number(el.dataset.menuIdx);
      if (src.date === dstDate && src.idx === dstIdx) return;
      swapMenuItems(src.date, src.idx, dstDate, dstIdx);
      renderCalendar();
      showToast("入れ替えました");
    });
  });

  // --- PC: HTML5 Drag & Drop on day cells (move to other day) ---
  dayCells.forEach((cell) => {
    cell.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      cell.classList.add("day-cell--drag-over");
    });

    cell.addEventListener("dragleave", (e) => {
      if (!cell.contains(e.relatedTarget)) {
        cell.classList.remove("day-cell--drag-over");
      }
    });

    cell.addEventListener("drop", (e) => {
      if (e.target.classList.contains("day-menu")) return;
      e.preventDefault();
      cell.classList.remove("day-cell--drag-over");
      let src;
      try { src = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return; }
      const dstDate = cell.dataset.date;
      if (src.date === dstDate) return;
      moveMenuItem(src.date, src.idx, dstDate);
      renderCalendar();
      showToast("移動しました");
    });
  });

  // --- Mobile: Touch long-press drag ---
  let touchState = null;

  function cleanupTouch() {
    if (!touchState) return;
    if (touchState.clone) touchState.clone.remove();
    if (touchState.src) touchState.src.classList.remove("day-menu--dragging");
    cleanupDragClasses();
    clearTimeout(touchState.timer);
    touchState = null;
  }

  function findDropTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    if (el.classList.contains("day-menu") && el !== touchState.src) {
      return { type: "menu", el };
    }
    const cell = el.closest(".day-cell:not(.day-cell--empty)");
    if (cell) {
      return { type: "cell", el: cell };
    }
    return null;
  }

  menuEls.forEach((el) => {
    el.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const timer = setTimeout(() => {
        if (!touchState) return;
        touchState.dragging = true;
        el.classList.add("day-menu--dragging");
        const clone = document.createElement("div");
        clone.className = "day-menu-clone";
        clone.textContent = el.textContent;
        clone.style.left = touch.clientX + "px";
        clone.style.top = touch.clientY + "px";
        document.body.appendChild(clone);
        touchState.clone = clone;
      }, 300);

      touchState = {
        src: el,
        srcDate: el.dataset.date,
        srcIdx: Number(el.dataset.menuIdx),
        timer,
        dragging: false,
        clone: null,
        lastOver: null,
        lastOverType: null,
      };
    }, { passive: true });

    el.addEventListener("touchmove", (e) => {
      if (!touchState || !touchState.dragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (touchState.clone) {
        touchState.clone.style.left = touch.clientX + "px";
        touchState.clone.style.top = touch.clientY + "px";
      }
      if (touchState.clone) touchState.clone.style.display = "none";
      const target = findDropTarget(touch.clientX, touch.clientY);
      if (touchState.clone) touchState.clone.style.display = "";

      if (touchState.lastOver) {
        touchState.lastOver.classList.remove("day-menu--drag-over");
        touchState.lastOver.classList.remove("day-cell--drag-over");
      }
      if (target) {
        if (target.type === "menu") {
          target.el.classList.add("day-menu--drag-over");
        } else {
          target.el.classList.add("day-cell--drag-over");
        }
        touchState.lastOver = target.el;
        touchState.lastOverType = target.type;
      } else {
        touchState.lastOver = null;
        touchState.lastOverType = null;
      }
    }, { passive: false });

    el.addEventListener("touchend", (e) => {
      if (!touchState) return;
      if (!touchState.dragging) {
        clearTimeout(touchState.timer);
        touchState = null;
        openMenuModal(el.dataset.date);
        return;
      }
      e.preventDefault();
      const target = touchState.lastOver;
      const type = touchState.lastOverType;
      if (target && type === "menu") {
        const dstDate = target.dataset.date;
        const dstIdx = Number(target.dataset.menuIdx);
        if (touchState.srcDate !== dstDate || touchState.srcIdx !== dstIdx) {
          swapMenuItems(touchState.srcDate, touchState.srcIdx, dstDate, dstIdx);
          cleanupTouch();
          renderCalendar();
          showToast("入れ替えました");
          return;
        }
      } else if (target && type === "cell") {
        const dstDate = target.dataset.date;
        if (touchState.srcDate !== dstDate) {
          moveMenuItem(touchState.srcDate, touchState.srcIdx, dstDate);
          cleanupTouch();
          renderCalendar();
          showToast("移動しました");
          return;
        }
      }
      cleanupTouch();
    });

    el.addEventListener("touchcancel", () => cleanupTouch());
  });
}

// ===== Stock Tab =====
function getExpiryStatus(expiryStr) {
  if (!expiryStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryStr + "T00:00:00");
  const diff = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "expired";
  if (diff <= 3) return "soon";
  return "ok";
}

function formatExpiry(expiryStr) {
  if (!expiryStr) return "";
  const [y, m, d] = expiryStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function switchStockCategory(cat) {
  stockCategory = cat;
  document.querySelectorAll(".stock-cat-btn").forEach((btn) => {
    btn.classList.toggle("stock-cat-btn--active", btn.dataset.cat === cat);
  });
  renderStock();
}

function renderStockAlerts() {
  const list = getStock();
  const expired = [];
  const soon = [];

  list.forEach((item) => {
    const status = getExpiryStatus(item.expiry);
    if (status === "expired") expired.push(item);
    else if (status === "soon") soon.push(item);
  });

  if (expired.length === 0 && soon.length === 0) {
    stockAlerts.hidden = true;
    return;
  }

  let html = "";
  if (expired.length > 0) {
    html += `<div class="stock-alert-title">期限切れ (${expired.length}件)</div>`;
    html += '<ul class="stock-alert-list">';
    expired.forEach((item) => {
      html += `<li>${escapeHtml(item.name)}（${formatExpiry(item.expiry)}・${STOCK_CATEGORIES[item.category]}）</li>`;
    });
    html += "</ul>";
  }
  if (soon.length > 0) {
    if (expired.length > 0) html += '<div style="margin-top:6px"></div>';
    html += `<div class="stock-alert-title">期限間近 (${soon.length}件)</div>`;
    html += '<ul class="stock-alert-list">';
    soon.forEach((item) => {
      html += `<li>${escapeHtml(item.name)}（${formatExpiry(item.expiry)}・${STOCK_CATEGORIES[item.category]}）</li>`;
    });
    html += "</ul>";
  }

  stockAlerts.innerHTML = html;
  stockAlerts.hidden = false;
}

function renderStockItem(s) {
  const status = getExpiryStatus(s.expiry);
  let itemClass = "stock-item";
  if (status === "expired") itemClass += " stock-item--expired";
  else if (status === "soon") itemClass += " stock-item--soon";

  let expiryHtml = "";
  if (s.expiry) {
    const badgeClass = status ? `stock-expiry-badge--${status}` : "";
    const labels = { expired: "期限切れ", soon: "期限間近", ok: "" };
    const label = labels[status] || "";
    expiryHtml = `<span class="stock-expiry-badge ${badgeClass}">${label ? label + " " : ""}${formatExpiry(s.expiry)}</span>`;
  }

  let frozenDateHtml = "";
  if (s.category === "freezer" && s.frozenDate) {
    frozenDateHtml = `<span class="stock-frozen-badge">冷凍 ${formatExpiry(s.frozenDate)}</span>`;
  }

  const qty = s.qty || 1;
  const spareQty = s.spareQty || 0;
  const memoHtml = s.memo ? `<div class="stock-item-memo">${escapeHtml(s.memo)}</div>` : "";
  const pinActive = s.pinned ? " pin-btn--active" : "";

  return `
  <div class="${itemClass}" data-id="${s.id}">
    <div class="stock-item-row">
      <button class="pin-btn${pinActive}" data-pin-id="${s.id}" type="button" title="カレンダーに表示">📌</button>
      <div class="stock-item-name">${escapeHtml(s.name)}</div>
      ${frozenDateHtml}
      ${expiryHtml}
      <div class="stock-inline-qty">
        <div class="stock-inline-label">個数</div>
        <div class="quantity-control quantity-control--inline">
          <button class="qty-btn" data-id="${s.id}" data-field="qty" data-delta="-1" type="button">−</button>
          <span class="qty-display">${qty}</span>
          <button class="qty-btn" data-id="${s.id}" data-field="qty" data-delta="1" type="button">＋</button>
        </div>
      </div>
      <div class="stock-inline-qty">
        <div class="stock-inline-label">予備</div>
        <div class="quantity-control quantity-control--inline">
          <button class="qty-btn" data-id="${s.id}" data-field="spareQty" data-delta="-1" type="button">−</button>
          <span class="qty-display">${spareQty}</span>
          <button class="qty-btn" data-id="${s.id}" data-field="spareQty" data-delta="1" type="button">＋</button>
        </div>
      </div>
    </div>
    ${memoHtml}
  </div>`;
}

function renderStock() {
  renderStockAlerts();

  let list = getStock().filter((s) => s.category === stockCategory);

  if (stockSearchQuery) {
    const q = stockSearchQuery.toLowerCase();
    list = list.filter((s) => s.name.toLowerCase().includes(q));
  }

  list.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  if (list.length === 0) {
    stockItems.innerHTML = "";
    stockEmpty.hidden = false;
    return;
  }

  stockEmpty.hidden = true;

  const subCats = SUBCAT_ORDER[stockCategory];
  if (subCats) {
    // Group by subcategory
    const subDefs = STOCK_SUBCATEGORIES[stockCategory];
    let html = "";
    subCats.forEach((sc) => {
      const group = list.filter((s) => (s.subCategory || "") === sc);
      if (group.length === 0) return;
      const label = sc ? subDefs[sc] : "その他";
      html += `<div class="stock-subcat-header">${escapeHtml(label)}</div>`;
      html += group.map(renderStockItem).join("");
    });
    stockItems.innerHTML = html;
  } else {
    stockItems.innerHTML = list.map(renderStockItem).join("");
  }

  // Pin buttons
  stockItems.querySelectorAll(".pin-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStockPin(btn.dataset.pinId);
    });
  });

  // Inline qty buttons
  stockItems.querySelectorAll(".qty-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      changeStockQty(btn.dataset.id, btn.dataset.field, Number(btn.dataset.delta));
    });
  });

  // Open edit modal on item click (outside qty buttons)
  stockItems.querySelectorAll(".stock-item").forEach((el) => {
    el.addEventListener("click", () => openStockEditModal(el.dataset.id));
  });
}

function changeStockQty(id, field, delta) {
  const list = getStock();
  const item = list.find((s) => s.id === id);
  if (!item) return;
  const current = item[field] || (field === "qty" ? 1 : 0);
  item[field] = Math.max(0, Math.min(999, current + delta));
  saveStock(list);
  renderStock();
}

// ===== Stock Edit Modal =====
function updateStockSubCatOptions() {
  const cat = stockEditCategory.value;
  const subCatRow = $("stockSubCatRow");
  const subCatSelect = $("stockEditSubCategory");
  const frozenDateRow = $("stockFrozenDateRow");

  // Subcategory
  const subDefs = STOCK_SUBCATEGORIES[cat];
  if (subDefs) {
    subCatRow.hidden = false;
    subCatSelect.innerHTML = '<option value="">その他</option>' +
      Object.entries(subDefs).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join("");
  } else {
    subCatRow.hidden = true;
    subCatSelect.innerHTML = '<option value="">-</option>';
  }

  // Frozen date (only for freezer)
  frozenDateRow.hidden = cat !== "freezer";
}

function openStockEditModal(id) {
  editingStockId = id || null;
  const item = id ? getStock().find((s) => s.id === id) : null;

  stockEditTitle.textContent = item ? "在庫編集" : "在庫追加";
  stockEditName.value = item ? item.name : "";
  stockEditCategory.value = item ? item.category : stockCategory;
  stockEditQty.value = item ? (item.qty || 1) : 1;
  stockEditSpareQty.value = item ? (item.spareQty || 0) : 0;
  stockEditExpiry.value = item ? item.expiry : "";
  $("stockEditFrozenDate").value = item ? (item.frozenDate || "") : "";
  stockEditMemo.value = item ? item.memo : "";
  stockEditDeleteBtn.hidden = !item;

  updateStockSubCatOptions();
  if (item && item.subCategory) {
    $("stockEditSubCategory").value = item.subCategory;
  }

  stockEditModal.classList.add("is-open");
  setTimeout(() => stockEditName.focus(), 100);
}

function closeStockEditModal() {
  stockEditModal.classList.remove("is-open");
  editingStockId = null;
}

function saveStockEditItem() {
  const name = stockEditName.value.trim();
  if (!name) {
    showToast("品名を入力してください");
    return;
  }

  const category = stockEditCategory.value;
  const expiry = stockEditExpiry.value;
  const memo = stockEditMemo.value;
  const qty = Math.max(0, Math.min(999, parseInt(stockEditQty.value) || 1));
  const spareQty = Math.max(0, Math.min(999, parseInt(stockEditSpareQty.value) || 0));
  const subCategory = $("stockEditSubCategory").value;
  const frozenDate = $("stockEditFrozenDate").value;

  if (editingStockId) {
    updateStockItem(editingStockId, name, category, expiry, memo, qty, spareQty, subCategory, frozenDate);
    showToast("更新しました");
  } else {
    addStockItem(name, category, expiry, memo, qty, spareQty, subCategory, frozenDate);
    showToast("追加しました");
  }

  // 検索をクリアしてフィルタリセット
  stockSearch.value = "";
  stockSearchQuery = "";

  closeStockEditModal();
  renderStock();
}

function deleteStockEditItem() {
  if (!editingStockId) return;
  const item = getStock().find((s) => s.id === editingStockId);
  if (item && confirm(`「${item.name}」を削除しますか？`)) {
    deleteStockItem(editingStockId);
    // 検索をクリアしてフィルタリセット
    stockSearch.value = "";
    stockSearchQuery = "";
    closeStockEditModal();
    renderStock();
    showToast("削除しました");
  }
}

// ===== Menu List Tab =====
function renderMenuListTags() {
  menulistTags.innerHTML = PRESET_TAGS.map(
    (t) =>
      `<button type="button" class="tag-filter-btn${menuListFilterTag === t ? " tag-filter-btn--active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
  ).join("");

  menulistTags.querySelectorAll(".tag-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      menuListFilterTag = menuListFilterTag === tag ? null : tag;
      renderMenuList();
    });
  });
}

function renderMenuList() {
  renderMenuListTags();

  let list = getMenuList();

  // Filter by tag
  if (menuListFilterTag) {
    list = list.filter((m) => m.tags.includes(menuListFilterTag));
  }

  // Filter by search
  if (menuListSearchQuery) {
    const q = menuListSearchQuery.toLowerCase();
    list = list.filter((m) => m.name.toLowerCase().includes(q));
  }

  // Sort alphabetically
  list.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  if (list.length === 0) {
    menulistItems.innerHTML = "";
    menulistEmpty.hidden = false;
    return;
  }

  menulistEmpty.hidden = true;
  menulistItems.innerHTML = list
    .map(
      (m) => `
    <div class="menulist-item" data-id="${m.id}">
      <div class="menulist-item-info">
        <div class="menulist-item-name">${escapeHtml(m.name)}</div>
        <div class="menulist-item-tags">
          ${m.tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>
      <div class="menulist-item-actions">
        <button class="menulist-action-btn" data-action="edit" data-id="${m.id}" title="編集">✏️</button>
        <button class="menulist-action-btn menulist-action-btn--delete" data-action="delete" data-id="${m.id}" title="削除">🗑️</button>
      </div>
    </div>`
    )
    .join("");

  // Event delegation for edit/delete
  menulistItems.querySelectorAll(".menulist-action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (btn.dataset.action === "edit") {
        openMenuEditModal(id);
      } else if (btn.dataset.action === "delete") {
        const item = getMenuList().find((m) => m.id === id);
        if (item && confirm(`「${item.name}」を削除しますか？`)) {
          deleteMenuItem(id);
          renderMenuList();
          showToast("削除しました");
        }
      }
    });
  });
}

// ===== Menu Edit Modal =====
function openMenuEditModal(id) {
  editingMenuId = id || null;
  const item = id ? getMenuList().find((m) => m.id === id) : null;

  menuEditTitle.textContent = item ? "メニュー編集" : "メニュー追加";
  menuEditName.value = item ? item.name : "";

  const selectedTags = item ? [...item.tags] : [];

  menuEditTagsList.innerHTML = PRESET_TAGS.map(
    (t) =>
      `<button type="button" class="tag-toggle-btn${selectedTags.includes(t) ? " tag-toggle-btn--active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
  ).join("");

  menuEditTagsList.querySelectorAll(".tag-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("tag-toggle-btn--active");
    });
  });

  menuEditModal.classList.add("is-open");
  setTimeout(() => menuEditName.focus(), 100);
}

function closeMenuEditModal() {
  menuEditModal.classList.remove("is-open");
  editingMenuId = null;
}

function saveMenuListItem() {
  const name = menuEditName.value.trim();
  if (!name) {
    showToast("メニュー名を入力してください");
    return;
  }

  const tags = [];
  menuEditTagsList.querySelectorAll(".tag-toggle-btn--active").forEach((btn) => {
    tags.push(btn.dataset.tag);
  });

  if (editingMenuId) {
    updateMenuItem(editingMenuId, name, tags);
    showToast("更新しました");
  } else {
    addMenuItem(name, tags);
    showToast("追加しました");
  }

  closeMenuEditModal();
  renderMenuList();
}

// ===== Toast =====
let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(() => {
      toastEl.hidden = true;
    }, 300);
  }, 1500);
}

// ===== Navigation =====
function goMonth(delta) {
  currentMonth += delta;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  } else if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
}

function goToday() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  renderCalendar();
}

// ===== Util =====
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ===== Swipe Support =====
function setupSwipe() {
  let startX = 0;
  let startY = 0;
  const grid = calendarGrid;

  grid.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    },
    { passive: true }
  );

  grid.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) goMonth(1);
        else goMonth(-1);
      }
    },
    { passive: true }
  );
}

// ===== Keyboard =====
function setupKeyboard() {
  document.addEventListener("keydown", (e) => {
    // Stock edit modal
    if (stockEditModal.classList.contains("is-open")) {
      if (e.key === "Escape") closeStockEditModal();
      if (e.key === "Enter" && !e.isComposing) saveStockEditItem();
      return;
    }

    // Menu edit modal
    if (menuEditModal.classList.contains("is-open")) {
      if (e.key === "Escape") closeMenuEditModal();
      if (e.key === "Enter" && !e.isComposing) saveMenuListItem();
      return;
    }

    // Calendar modal
    if (menuModal.classList.contains("is-open")) {
      if (e.key === "Escape") closeMenuModal();
      // Don't auto-save on Enter (multiple entries)
      return;
    }

    // Calendar tab only
    if (activeTab === "calendar") {
      if (e.key === "ArrowLeft") goMonth(-1);
      if (e.key === "ArrowRight") goMonth(1);
    }
  });
}

// ===== Firebase =====
function initKondateFirebase() {
  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK not loaded");
    return null;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  return firebase.database();
}

function kondateFirebaseSet(path, data) {
  if (!kondateDb) return;
  kondateDb.ref(path).set(data).catch((err) => {
    console.error("Firebase write error:", path, err.message || err);
  });
}

function setupKondateSync() {
  kondateDb = initKondateFirebase();
  if (!kondateDb) {
    const status = $("syncStatus");
    if (status) status.textContent = "オフラインモード";
    return;
  }

  migrateKondateToFirebase();

  // Connection status
  const connRef = kondateDb.ref(".info/connected");
  const statusEl = $("syncStatus");
  connRef.on("value", (snap) => {
    if (statusEl) {
      statusEl.textContent = snap.val() ? "" : "接続中...";
      statusEl.className = "sync-status" + (snap.val() ? "" : " sync-status--offline");
    }
  });

  // Menus listener
  kondateDb.ref(FIREBASE_PATHS.menus).on("value", (snap) => {
    _menusCache = snap.val() || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_menusCache));
    renderCalendar();
  });

  // Menu list listener
  kondateDb.ref(FIREBASE_PATHS.menuList).on("value", (snap) => {
    const val = snap.val();
    _menuListCache = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
    localStorage.setItem(MENU_LIST_KEY, JSON.stringify(_menuListCache));
    if (activeTab === "menulist") renderMenuList();
  });

  // Stock listener
  kondateDb.ref(FIREBASE_PATHS.stock).on("value", (snap) => {
    const val = snap.val();
    _stockCache = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
    localStorage.setItem(STOCK_KEY, JSON.stringify(_stockCache));
    if (activeTab === "stock") renderStock();
    if (activeTab === "calendar") renderPinnedStock();
  });

  // Memo listener
  kondateDb.ref(FIREBASE_PATHS.memo).on("value", (snap) => {
    _memoCache = snap.val() || "";
    localStorage.setItem(MEMO_KEY, _memoCache);
    // Only update if user is not currently editing
    if (document.activeElement !== calendarMemo) {
      loadCalendarMemo();
    }
  });
}

function migrateKondateToFirebase() {
  if (!kondateDb) return;
  if (localStorage.getItem("kondate_firebaseMigrated")) return;

  const migrations = [
    { key: STORAGE_KEY, path: FIREBASE_PATHS.menus },
    { key: MENU_LIST_KEY, path: FIREBASE_PATHS.menuList },
    { key: STOCK_KEY, path: FIREBASE_PATHS.stock },
    { key: MEMO_KEY, path: FIREBASE_PATHS.memo, isString: true },
  ];

  const promises = [];

  migrations.forEach(({ key, path, isString }) => {
    try {
      const raw = isString ? localStorage.getItem(key) : JSON.parse(localStorage.getItem(key));
      const hasData = isString
        ? (raw && raw.trim().length > 0)
        : (raw && (Array.isArray(raw) ? raw.length > 0 : Object.keys(raw).length > 0));

      if (hasData) {
        const p = kondateDb.ref(path).once("value").then((snap) => {
          if (!snap.exists()) {
            return kondateDb.ref(path).set(raw);
          }
        });
        promises.push(p);
      }
    } catch (e) { /* skip */ }
  });

  if (promises.length > 0) {
    Promise.all(promises).then(() => {
      localStorage.setItem("kondate_firebaseMigrated", "1");
    }).catch((err) => {
      console.error("Kondate migration failed:", err.message || err);
    });
  } else {
    localStorage.setItem("kondate_firebaseMigrated", "1");
  }
}

// ===== Init =====
function init() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  renderCalendar();
  loadCalendarMemo();
  renderPinnedStock();
  setupSwipe();
  setupKeyboard();

  // Calendar memo
  calendarMemoToggle.addEventListener("click", toggleCalendarMemo);
  calendarMemo.addEventListener("input", saveCalendarMemo);

  // Calendar navigation
  prevMonthBtn.addEventListener("click", () => goMonth(-1));
  nextMonthBtn.addEventListener("click", () => goMonth(1));
  todayBtn.addEventListener("click", goToday);
  $("printBtn").addEventListener("click", () => window.print());
  // Calendar modal
  menuSaveBtn.addEventListener("click", saveMenu);
  menuCopyNextBtn.addEventListener("click", copyToNextDay);
  menuDeleteBtn.addEventListener("click", deleteMenu);
  menuCancelBtn.addEventListener("click", closeMenuModal);
  addEntryBtn.addEventListener("click", addMenuEntry);
  menuModal.addEventListener("click", (e) => {
    if (e.target === menuModal) closeMenuModal();
  });

  // Tab navigation
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  const savedTab = localStorage.getItem("kondate_active_tab");
  if (savedTab && ["calendar", "menulist", "stock"].includes(savedTab)) {
    switchTab(savedTab);
  }

  // Menu list tab
  addMenuBtn.addEventListener("click", () => openMenuEditModal());
  menulistSearch.addEventListener("input", () => {
    menuListSearchQuery = menulistSearch.value;
    renderMenuList();
  });

  // Menu edit modal
  menuEditSaveBtn.addEventListener("click", saveMenuListItem);
  menuEditCancelBtn.addEventListener("click", closeMenuEditModal);
  menuEditModal.addEventListener("click", (e) => {
    if (e.target === menuEditModal) closeMenuEditModal();
  });

  // Stock tab
  addStockBtn.addEventListener("click", () => openStockEditModal());
  stockSearch.addEventListener("input", () => {
    stockSearchQuery = stockSearch.value;
    renderStock();
  });
  document.querySelectorAll(".stock-cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchStockCategory(btn.dataset.cat));
  });

  // Stock edit modal
  stockEditSaveBtn.addEventListener("click", saveStockEditItem);
  stockEditDeleteBtn.addEventListener("click", deleteStockEditItem);
  stockEditCancelBtn.addEventListener("click", closeStockEditModal);
  stockEditModal.addEventListener("click", (e) => {
    if (e.target === stockEditModal) closeStockEditModal();
  });
  stockEditCategory.addEventListener("change", updateStockSubCatOptions);

  // Qty +/- buttons
  $("stockQtyMinus").addEventListener("click", () => {
    stockEditQty.value = Math.max(0, (parseInt(stockEditQty.value) || 1) - 1);
  });
  $("stockQtyPlus").addEventListener("click", () => {
    stockEditQty.value = Math.min(999, (parseInt(stockEditQty.value) || 0) + 1);
  });
  $("stockSpareQtyMinus").addEventListener("click", () => {
    stockEditSpareQty.value = Math.max(0, (parseInt(stockEditSpareQty.value) || 0) - 1);
  });
  $("stockSpareQtyPlus").addEventListener("click", () => {
    stockEditSpareQty.value = Math.min(999, (parseInt(stockEditSpareQty.value) || 0) + 1);
  });

  // Firebase sync
  setupKondateSync();
}

document.addEventListener("DOMContentLoaded", init);

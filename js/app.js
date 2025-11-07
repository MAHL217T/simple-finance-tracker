import {
  changePin,
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories,
  addCategory,
  removeCategory,
  getTheme,
  setTheme,
  exportData,
  importData,
  lock
} from "./storage.js";
import {
  formatCurrency,
  renderSummary,
  renderMonthSummary,
  populateCategorySelect,
  renderCategoryList,
  renderTransactionTable,
  renderExpenseByCategory,
  renderMonthlyAverage,
  drawTrendChart,
  populateFilterOptions
} from "./ui.js";
import {
  calculateSummary,
  calculateExpenseByCategory,
  calculateMonthlyAverageExpense,
  buildMonthlyTrend,
  monthSummary
} from "./report.js";
import { initAuth, openAuthDialog } from "./auth.js";

const transactionForm = document.getElementById("transaction-form");
const transactionTypeSelect = document.getElementById("transaction-type");
const transactionCategorySelect = document.getElementById("transaction-category");
const transactionDateInput = document.getElementById("transaction-date");

const transactionTableBody = document.getElementById("transaction-table");
const filterTypeSelect = document.getElementById("filter-type");
const filterMonthSelect = document.getElementById("filter-month");
const filterYearSelect = document.getElementById("filter-year");

const categoryForm = document.getElementById("category-form");
const categoryList = document.getElementById("category-list");

const trendCanvas = document.getElementById("trend-chart");
const expenseByCategoryList = document.getElementById("expense-by-category");
const monthlyAverageElement = document.getElementById("monthly-average");

const exportButton = document.getElementById("export-data");
const importInput = document.getElementById("import-data");

const themeToggle = document.getElementById("theme-toggle");
const footerYear = document.getElementById("footer-year");
const todayDateElement = document.getElementById("today-date");

const pinForm = document.getElementById("pin-form");

const transactionDialog = document.getElementById("transaction-dialog");
const transactionEditForm = document.getElementById("transaction-edit-form");
const editTypeSelect = document.getElementById("edit-type");
const editCategorySelect = document.getElementById("edit-category");
const editDateInput = document.getElementById("edit-date");
const editAmountInput = document.getElementById("edit-amount");
const editNoteInput = document.getElementById("edit-note");
const editCancelBtn = document.getElementById("edit-cancel");
const logoutButton = document.getElementById("logout-button");

const MAX_TRANSACTION_AMOUNT = 100000000000; // Rp100.000.000.000
const MAX_AMOUNT_ERROR = "Jumlah maksimal Rp100.000.000.000.";

const toastContainer = document.createElement("div");
toastContainer.className = "toast-container";
document.body.appendChild(toastContainer);

const state = {
  transactions: [],
  categories: [],
  filters: {
    type: "all",
    month: "all",
    year: "all"
  }
};

let editingTransactionId = null;

function showToast(message, variant = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${variant}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  setTheme(theme);
  if (!themeToggle) {
    return;
  }
  const labelText = theme === "dark" ? "Mode Terang" : "Mode Gelap";
  const description =
    theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap";
  const labelEl = themeToggle.querySelector(".label");
  if (labelEl) {
    labelEl.textContent = labelText;
  }
  themeToggle.dataset.icon = theme === "dark" ? "sun" : "moon";
  themeToggle.setAttribute("aria-label", description);
  themeToggle.setAttribute("title", description);
}

function initTheme() {
  const storedTheme = getTheme();
  applyTheme(storedTheme);
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });
}

function initDate() {
  const now = new Date();
  todayDateElement.textContent = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  footerYear.textContent = now.getFullYear();
}

function initDefaultValues() {
  const today = new Date().toISOString().slice(0, 10);
  transactionDateInput.value = today;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js", { scope: "./" })
      .catch((error) => {
        console.warn("Gagal mendaftarkan service worker:", error);
      });
  });
}

async function loadData() {
  state.categories = await getCategories();
  state.transactions = await getTransactions();
}

function updateCategorySelects() {
  populateCategorySelect(
    transactionCategorySelect,
    state.categories,
    transactionTypeSelect.value
  );
  populateCategorySelect(
    editCategorySelect,
    state.categories,
    editTypeSelect.value
  );
}

function filterTransactions() {
  return state.transactions
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .filter((tx) => {
      const matchesType =
        state.filters.type === "all" || tx.type === state.filters.type;
      if (!matchesType) {
        return false;
      }

      if (state.filters.year !== "all") {
        const year = tx.date?.slice(0, 4);
        if (year !== state.filters.year) {
          return false;
        }
      }

      if (state.filters.month !== "all") {
        const month = tx.date?.slice(5, 7);
        if (month !== state.filters.month) {
          return false;
        }
      }
      return true;
    });
}

function refreshFilters() {
  populateFilterOptions(state.transactions, filterMonthSelect, filterYearSelect);
  filterTypeSelect.value = state.filters.type;
  filterMonthSelect.value = state.filters.month;
  filterYearSelect.value = state.filters.year;
}

function refreshDashboard() {
  const summary = calculateSummary(state.transactions);
  renderSummary(summary);
  renderMonthSummary(monthSummary(state.transactions));

  const trendData = buildMonthlyTrend(state.transactions);
  drawTrendChart(trendCanvas, trendData);

  const expenseStats = calculateExpenseByCategory(
    state.transactions,
    state.categories
  );
  renderExpenseByCategory(expenseByCategoryList, expenseStats);

  const average = calculateMonthlyAverageExpense(state.transactions);
  renderMonthlyAverage(monthlyAverageElement, average);
}

function refreshTransactions() {
  const filtered = filterTransactions();
  renderTransactionTable(transactionTableBody, filtered, state.categories);
}

function refreshCategories() {
  renderCategoryList(categoryList, state.categories);
  updateCategorySelects();
}

function refreshUI() {
  refreshFilters();
  refreshDashboard();
  refreshCategories();
  refreshTransactions();
}

async function handleTransactionSubmit(event) {
  event.preventDefault();
  const formData = new FormData(transactionForm);
  const date = formData.get("date");
  const type = formData.get("type");
  const categoryId = formData.get("category");
  const amount = parseInt(formData.get("amount"), 10);
  const note = (formData.get("note") || "").trim();

  if (!date || !type || !categoryId || Number.isNaN(amount) || amount <= 0) {
    showToast("Lengkapi data transaksi dengan benar.", "error");
    return;
  }

  if (!Number.isFinite(amount) || amount > MAX_TRANSACTION_AMOUNT) {
    showToast(MAX_AMOUNT_ERROR, "error");
    return;
  }

  const category = state.categories.find((cat) => cat.id === categoryId);
  const transaction = {
    date,
    type,
    categoryId,
    categoryName: category?.name || "",
    amount,
    note,
    createdAt: new Date().toISOString()
  };

  const saved = await addTransaction(transaction);
  state.transactions.push(saved);
  transactionForm.reset();
  transactionTypeSelect.value = "income";
  initDefaultValues();
  updateCategorySelects();
  refreshUI();
  showToast("Transaksi berhasil disimpan.");
}

function openEditDialog(transaction) {
  editingTransactionId = transaction.id;
  transactionEditForm.reset();
  editDateInput.value = transaction.date;
  editTypeSelect.value = transaction.type;
  populateCategorySelect(editCategorySelect, state.categories, transaction.type);
  editCategorySelect.value = transaction.categoryId || "";
  editAmountInput.value = transaction.amount;
  editNoteInput.value = transaction.note || "";
  if (typeof transactionDialog.showModal === "function") {
    transactionDialog.showModal();
  } else {
    transactionDialog.setAttribute("open", "true");
  }
}

async function handleTransactionUpdate(event) {
  event.preventDefault();
  if (!editingTransactionId) {
    return;
  }
  const formData = new FormData(transactionEditForm);
  const date = formData.get("date");
  const type = formData.get("type");
  const categoryId = formData.get("category");
  const amount = parseInt(formData.get("amount"), 10);
  const note = (formData.get("note") || "").trim();
  if (!date || !type || !categoryId || Number.isNaN(amount) || amount <= 0) {
    showToast("Periksa kembali data transaksi.", "error");
    return;
  }
  if (!Number.isFinite(amount) || amount > MAX_TRANSACTION_AMOUNT) {
    showToast(MAX_AMOUNT_ERROR, "error");
    return;
  }
  const category = state.categories.find((cat) => cat.id === categoryId);
  const updated = await updateTransaction(editingTransactionId, {
    date,
    type,
    categoryId,
    categoryName: category?.name || "",
    amount,
    note,
    updatedAt: new Date().toISOString()
  });
  const index = state.transactions.findIndex(
    (tx) => tx.id === editingTransactionId
  );
  if (index !== -1) {
    state.transactions[index] = updated;
  }
  editingTransactionId = null;
  if (transactionDialog) {
    if (typeof transactionDialog.close === "function" && transactionDialog.open) {
      transactionDialog.close();
    } else if (transactionDialog.hasAttribute("open")) {
      transactionDialog.removeAttribute("open");
    }
  }
  refreshUI();
  showToast("Transaksi berhasil diperbarui.");
}

async function handleTransactionDelete(id) {
  const confirmDelete = window.confirm("Hapus transaksi ini?");
  if (!confirmDelete) {
    return;
  }
  await deleteTransaction(id);
  state.transactions = state.transactions.filter((tx) => tx.id !== id);
  refreshUI();
  showToast("Transaksi dihapus.", "info");
}

async function handleCategorySubmit(event) {
  event.preventDefault();
  const formData = new FormData(categoryForm);
  const name = (formData.get("name") || "").trim();
  const type = formData.get("type");
  if (name.length < 2) {
    showToast("Nama kategori minimal 2 huruf.", "error");
    return;
  }
  const exists = state.categories.some(
    (cat) =>
      cat.type === type && cat.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    showToast("Kategori dengan nama tersebut sudah ada.", "error");
    return;
  }
  const category = await addCategory({ name, type });
  state.categories.push(category);
  categoryForm.reset();
  refreshUI();
  showToast("Kategori ditambahkan.");
}

async function handleCategoryRemove(id) {
  const inUse = state.transactions.some((tx) => tx.categoryId === id);
  if (inUse) {
    const confirmRemove = window.confirm(
      "Kategori dipakai oleh transaksi. Lanjut menghapus?"
    );
    if (!confirmRemove) {
      return;
    }
  }
  await removeCategory(id);
  state.categories = state.categories.filter((cat) => cat.id !== id);
  state.transactions = state.transactions.map((tx) =>
    tx.categoryId === id ? { ...tx, categoryId: null } : tx
  );
  refreshUI();
  showToast("Kategori dihapus.", "info");
}

function handleFiltersChange() {
  state.filters.type = filterTypeSelect.value;
  state.filters.month = filterMonthSelect.value;
  state.filters.year = filterYearSelect.value;
  refreshTransactions();
}

function handleTableAction(event) {
  const action = event.target.dataset.action;
  if (!action) {
    return;
  }
  const id = event.target.dataset.id;
  const transaction = state.transactions.find((tx) => tx.id === id);
  if (!transaction) {
    return;
  }
  if (action === "edit") {
    openEditDialog(transaction);
  }
  if (action === "delete") {
    handleTransactionDelete(id);
  }
}

function handleCategoryAction(event) {
  const action = event.target.dataset.action;
  if (action === "remove-category") {
    const id = event.target.dataset.id;
    handleCategoryRemove(id);
  }
}

function handleTypeChange(event) {
  populateCategorySelect(
    transactionCategorySelect,
    state.categories,
    event.target.value
  );
}

function handleEditTypeChange(event) {
  populateCategorySelect(editCategorySelect, state.categories, event.target.value);
  if (!editCategorySelect.options.length) {
    editCategorySelect.disabled = true;
  } else {
    editCategorySelect.disabled = false;
  }
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function handleExport() {
  try {
    const data = await exportData();
    downloadJSON(data, `finance-tracker-${new Date().toISOString()}.json`);
    showToast("Data berhasil diekspor.");
  } catch (error) {
    console.error(error);
    showToast("Gagal mengekspor data.", "error");
  }
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const content = await file.text();
    const payload = JSON.parse(content);
    await importData(payload);
    await loadData();
    refreshUI();
    showToast("Data berhasil diimpor.");
  } catch (error) {
    console.error(error);
    showToast("File tidak valid.", "error");
  } finally {
    importInput.value = "";
  }
}

async function handlePinChange(event) {
  event.preventDefault();
  const currentPin = document.getElementById("current-pin").value.trim();
  const newPin = document.getElementById("new-pin").value.trim();
  const confirmPin = document.getElementById("confirm-pin").value.trim();
  if (newPin.length !== 4 || confirmPin.length !== 4) {
    showToast("PIN baru harus 4 digit.", "error");
    return;
  }
  if (newPin !== confirmPin) {
    showToast("Konfirmasi PIN tidak cocok.", "error");
    return;
  }
  const changed = await changePin(currentPin, newPin);
  if (!changed) {
    showToast("PIN saat ini salah.", "error");
    return;
  }
  pinForm.reset();
  showToast("PIN berhasil diperbarui.");
}

function handleLogout() {
  lock();
  state.transactions = [];
  state.categories = [];
  editingTransactionId = null;
  if (typeof transactionDialog.close === "function") {
    transactionDialog.close();
  } else {
    transactionDialog.removeAttribute("open");
  }
  refreshUI();
  showToast("Aplikasi dikunci. Masukkan PIN untuk lanjut.", "info");
  openAuthDialog();
}

function setupEventListeners() {
  transactionForm.addEventListener("submit", handleTransactionSubmit);
  transactionTypeSelect.addEventListener("change", handleTypeChange);

  transactionTableBody.addEventListener("click", handleTableAction);
  filterTypeSelect.addEventListener("change", handleFiltersChange);
  filterMonthSelect.addEventListener("change", handleFiltersChange);
  filterYearSelect.addEventListener("change", handleFiltersChange);

  categoryForm.addEventListener("submit", handleCategorySubmit);
  categoryList.addEventListener("click", handleCategoryAction);

  exportButton.addEventListener("click", handleExport);
  importInput.addEventListener("change", handleImport);

  pinForm.addEventListener("submit", handlePinChange);

  transactionEditForm.addEventListener("submit", handleTransactionUpdate);
  editTypeSelect.addEventListener("change", handleEditTypeChange);
  transactionDialog.addEventListener("close", () => {
    editingTransactionId = null;
  });
  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }
  if (editCancelBtn) {
    editCancelBtn.addEventListener("click", () => {
      editingTransactionId = null;
      if (typeof transactionDialog.close === "function") {
        transactionDialog.close();
      } else {
        transactionDialog.removeAttribute("open");
      }
    });
  }
}

function init() {
  initTheme();
  initTopbarSettings();
  initShellNavigation();
  initDate();
  initDefaultValues();
  registerServiceWorker();
  setupEventListeners();
  initAuth({
    onUnlock: async () => {
      await loadData();
      refreshUI();
      showToast("Selamat datang kembali!", "info");
    }
  });
}

function initTopbarSettings() {
  const sheetButtons = document.querySelectorAll("[data-sheet-target]");
  sheetButtons.forEach((button) => {
    const targetId = button.dataset.sheetTarget;
    const sheet = document.getElementById(targetId);
    if (!sheet) {
      return;
    }
    button.addEventListener("click", () => {
      openUtilitySheet(sheet);
    });
  });

  const sheetCloseButtons = document.querySelectorAll("[data-sheet-close]");
  sheetCloseButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dialog = btn.closest("dialog");
      dialog?.close();
    });
  });

  document.querySelectorAll(".utility-sheet").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  });

  const closeParentSheet = (element) => {
    element.closest("dialog")?.close();
  };

  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const desiredTheme = button.dataset.themeChoice === "dark" ? "dark" : "light";
      applyTheme(desiredTheme);
      closeParentSheet(button);
    });
  });

  document
    .querySelectorAll("[data-setting-action='export']")
    .forEach((button) => {
      if (!exportButton) {
        return;
      }
      button.addEventListener("click", () => {
        exportButton.click();
        closeParentSheet(button);
      });
    });

  document
    .querySelectorAll("[data-setting-action='import']")
    .forEach((button) => {
      if (!importInput) {
        return;
      }
      button.addEventListener("click", () => {
        importInput.click();
        closeParentSheet(button);
      });
    });

  document
    .querySelectorAll("[data-setting-action='lock']")
    .forEach((button) => {
      button.addEventListener("click", () => {
        if (logoutButton) {
          logoutButton.click();
        } else {
          handleLogout();
        }
        closeParentSheet(button);
      });
    });

  const savingsRange = document.querySelector("[data-bdi-target]");
  const savingsValue = document.getElementById("bdi-target-value");
  if (savingsRange && savingsValue) {
    const syncRange = () => {
      const multiplier = Number(savingsRange.value || 0);
      const amount = multiplier * 1000000;
      savingsValue.textContent = formatCurrency(amount);
    };
    savingsRange.addEventListener("input", syncRange);
    syncRange();
  }

  document.querySelectorAll("[data-toggle-label]").forEach((input) => {
    const target = document.getElementById(input.dataset.toggleLabel);
    if (!target) {
      return;
    }
    const syncState = () => {
      target.textContent = input.checked ? "Aktif" : "Nonaktif";
      if (input.checked) {
        target.classList.remove("outline");
        target.classList.add("subtle");
      } else {
        target.classList.add("outline");
        target.classList.remove("subtle");
      }
    };
    input.addEventListener("change", syncState);
    syncState();
  });
}

function openUtilitySheet(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function initShellNavigation() {
  const navButtons = document.querySelectorAll("[data-scroll-target]");
  navButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const didScroll = scrollToTarget(button.dataset.scrollTarget);
      if (didScroll) {
        event.preventDefault();
      }
      navButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
    });
  });

  const quickActionButtons = document.querySelectorAll("[data-quick-action]");
  quickActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      handleQuickAction(button.dataset.quickAction);
    });
  });
}

function scrollToTarget(selector) {
  if (!selector) {
    return false;
  }
  const target = document.querySelector(selector);
  if (!target) {
    return false;
  }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

function handleQuickAction(action = "") {
  switch (action) {
    case "toggle-theme":
      if (themeToggle) {
        themeToggle.click();
      }
      break;
    case "open-pin":
      {
        const settingsSheet = document.getElementById("settings-sheet");
        if (settingsSheet) {
          openUtilitySheet(settingsSheet);
          setTimeout(() => {
            document.getElementById("current-pin")?.focus({ preventScroll: true });
          }, 200);
        }
      }
      break;
    case "export-data":
      if (exportButton) {
        exportButton.click();
      }
      break;
    default:
      break;
  }
}

init();

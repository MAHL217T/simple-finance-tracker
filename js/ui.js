const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0
});

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function renderSummary({ income, expense, balance }) {
  document.getElementById("income-total").textContent = formatCurrency(income);
  document.getElementById("expense-total").textContent = formatCurrency(expense);
  document.getElementById("balance-total").textContent = formatCurrency(balance);
}

function renderMonthSummary(text) {
  const summaryEl = document.getElementById("month-summary");
  summaryEl.textContent = text;
}

function populateCategorySelect(selectElement, categories, type) {
  selectElement.innerHTML = "";
  const filtered = categories.filter((cat) => cat.type === type);
  if (filtered.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Belum ada kategori";
    selectElement.append(option);
    selectElement.disabled = true;
    return;
  }
  selectElement.disabled = false;
  filtered.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    selectElement.append(option);
  });
}

function renderCategoryList(listElement, categories) {
  listElement.innerHTML = "";
  if (!categories.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Belum ada kategori.";
    listElement.append(empty);
    return;
  }
  categories
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID"))
    .forEach((category) => {
      const item = document.createElement("li");
      item.className = "category-item";
      const info = document.createElement("div");
      info.innerHTML = `<strong>${category.name}</strong>`;
      const chip = document.createElement("span");
      chip.className = `chip ${category.type}`;
      chip.textContent = category.type === "income" ? "Pemasukan" : "Pengeluaran";
      const actions = document.createElement("div");
      actions.className = "table-actions";
      const removeBtn = document.createElement("button");
      removeBtn.className = "table-action danger";
      removeBtn.dataset.action = "remove-category";
      removeBtn.dataset.id = category.id;
      removeBtn.textContent = "Hapus";
      actions.append(removeBtn);
      item.append(info, chip, actions);
      listElement.append(item);
    });
}

function humanizeType(type) {
  return type === "income" ? "Pemasukan" : "Pengeluaran";
}

function formatDate(dateStr) {
  if (!dateStr) {
    return "-";
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function renderTransactionTable(tableBody, transactions, categories) {
  tableBody.innerHTML = "";
  if (!transactions.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty-state";
    cell.textContent = "Belum ada transaksi.";
    row.append(cell);
    tableBody.append(row);
    return;
  }

  const categoryMap = new Map(categories.map((cat) => [cat.id, cat.name]));

  transactions.forEach((tx) => {
    const row = document.createElement("tr");
    row.dataset.id = tx.id;

    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(tx.date);
    dateCell.dataset.label = "Tanggal";
    const catCell = document.createElement("td");
    catCell.textContent =
      categoryMap.get(tx.categoryId) || tx.categoryName || "Tidak diketahui";
    catCell.dataset.label = "Kategori";
    const typeCell = document.createElement("td");
    typeCell.textContent = humanizeType(tx.type);
    typeCell.dataset.label = "Jenis";
    const amountCell = document.createElement("td");
    amountCell.className = "align-right";
    const sign = tx.type === "income" ? "+" : "-";
    amountCell.textContent = `${sign} ${formatCurrency(tx.amount)}`;
    amountCell.dataset.label = "Jumlah";
    const noteCell = document.createElement("td");
    noteCell.textContent = tx.note || "-";
    noteCell.dataset.label = "Catatan";
    const actionCell = document.createElement("td");
    actionCell.className = "table-actions";
    actionCell.dataset.label = "Aksi";

    const editBtn = document.createElement("button");
    editBtn.className = "table-action";
    editBtn.dataset.action = "edit";
    editBtn.dataset.id = tx.id;
    editBtn.textContent = "Edit";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "table-action danger";
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = tx.id;
    deleteBtn.textContent = "Hapus";

    actionCell.append(editBtn, deleteBtn);
    row.append(dateCell, catCell, typeCell, amountCell, noteCell, actionCell);
    tableBody.append(row);
  });
}

function renderExpenseByCategory(listElement, data) {
  listElement.innerHTML = "";
  if (!data.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Belum ada pengeluaran.";
    listElement.append(empty);
    return;
  }
  data.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${item.name}</strong> <span class="align-right">${formatCurrency(
      item.total
    )}</span>`;
    listElement.append(li);
  });
}

function renderMonthlyAverage(element, value) {
  element.textContent = formatCurrency(value);
}

function drawTrendChart(canvas, trendData) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = chartWidth / (trendData.length * 2);

  const maxValue = Math.max(
    1000000,
    ...trendData.map((item) => Math.max(item.income, item.expense))
  );

  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text-muted");
  ctx.font = "12px var(--font-sans)";
  ctx.textAlign = "center";

  trendData.forEach((item, index) => {
    const xBase = padding + index * barWidth * 2.2 + barWidth;
    const incomeHeight = (item.income / maxValue) * chartHeight;
    const expenseHeight = (item.expense / maxValue) * chartHeight;
    const bottom = height - padding;

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue(
      "--chart-income"
    );
    ctx.fillRect(
      xBase - barWidth,
      bottom - incomeHeight,
      barWidth - 6,
      incomeHeight
    );

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue(
      "--chart-expense"
    );
    ctx.fillRect(
      xBase + 6,
      bottom - expenseHeight,
      barWidth - 6,
      expenseHeight
    );

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue(
      "--text-secondary"
    );
    ctx.fillText(item.label, xBase, bottom + 14);
  });

  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue(
    "--border-subtle"
  );
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();
}

function populateFilterOptions(transactions, monthSelect, yearSelect) {
  const months = new Set();
  const years = new Set();
  transactions.forEach((tx) => {
    if (!tx.date) {
      return;
    }
    const [year, month] = tx.date.split("-");
    months.add(month);
    years.add(year);
  });

  const monthNames = [
    "01 Januari",
    "02 Februari",
    "03 Maret",
    "04 April",
    "05 Mei",
    "06 Juni",
    "07 Juli",
    "08 Agustus",
    "09 September",
    "10 Oktober",
    "11 November",
    "12 Desember"
  ];

  const sortedMonths = Array.from(months).sort();
  monthSelect.innerHTML = '<option value="all">Semua</option>';
  sortedMonths.forEach((month) => {
    const label = monthNames.find((item) => item.startsWith(month));
    const option = document.createElement("option");
    option.value = month;
    option.textContent = label ? label.slice(3) : month;
    monthSelect.append(option);
  });

  const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
  yearSelect.innerHTML = '<option value="all">Semua</option>';
  sortedYears.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.append(option);
  });
}

export {
  formatCurrency,
  renderSummary,
  renderMonthSummary,
  populateCategorySelect,
  renderCategoryList,
  renderTransactionTable,
  renderExpenseByCategory,
  renderMonthlyAverage,
  drawTrendChart,
  populateFilterOptions,
  humanizeType,
  formatDate
};

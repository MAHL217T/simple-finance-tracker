function calculateSummary(transactions) {
  return transactions.reduce(
    (acc, tx) => {
      if (tx.type === "income") {
        acc.income += tx.amount;
      } else {
        acc.expense += tx.amount;
      }
      acc.balance = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, balance: 0 }
  );
}

function calculateExpenseByCategory(transactions, categories) {
  const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
  const totals = new Map();

  transactions
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      const key = tx.categoryId || tx.categoryName || "lainnya";
      const current = totals.get(key) || 0;
      totals.set(key, current + tx.amount);
    });

  const result = [];
  totals.forEach((total, key) => {
    const category = categoryMap.get(key);
    const fallbackName = key === "lainnya" ? "Lainnya" : String(key);
    const name = category ? category.name : fallbackName;
    result.push({ id: key, name, total });
  });

  return result.sort((a, b) => b.total - a.total);
}

function groupByMonth(transactions) {
  return transactions.reduce((acc, tx) => {
    if (!tx.date) {
      return acc;
    }
    const monthKey = tx.date.slice(0, 7);
    const current = acc.get(monthKey) || { income: 0, expense: 0 };
    if (tx.type === "income") {
      current.income += tx.amount;
    } else {
      current.expense += tx.amount;
    }
    acc.set(monthKey, current);
    return acc;
  }, new Map());
}

function calculateMonthlyAverageExpense(transactions) {
  const monthly = groupByMonth(transactions);
  if (monthly.size === 0) {
    return 0;
  }
  const totalExpense = Array.from(monthly.values()).reduce(
    (sum, month) => sum + month.expense,
    0
  );
  return Math.round(totalExpense / monthly.size);
}

function buildMonthlyTrend(transactions, months = 6) {
  const monthly = groupByMonth(transactions);
  const now = new Date();
  const data = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    const label = date.toLocaleDateString("id-ID", {
      month: "short",
      year: "2-digit"
    });
    const entry = monthly.get(key) || { income: 0, expense: 0 };
    data.push({ key, label, income: entry.income, expense: entry.expense });
  }

  return data;
}

function monthSummary(transactions) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const monthly = groupByMonth(transactions);
  const current = monthly.get(currentMonthKey);
  if (!current) {
    return "Bulan ini belum ada transaksi. Mulai catat yuk!";
  }
  if (current.income >= current.expense) {
    return "Bulan ini kamu hemat. Pertahankan!";
  }
  return "Pengeluaran melebihi pemasukan, cek lagi ya.";
}

export {
  calculateSummary,
  calculateExpenseByCategory,
  calculateMonthlyAverageExpense,
  buildMonthlyTrend,
  monthSummary
};

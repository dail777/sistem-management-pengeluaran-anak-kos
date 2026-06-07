window.__dompetkuInit = function () {
  // ===== DATA =====
  let targets = [];
  let incomes = [];
  let expenses = [];
  let budgets = [];

  function saveData() {
    localStorage.setItem("dk_targets", JSON.stringify(targets));
    localStorage.setItem("dk_incomes", JSON.stringify(incomes));
    localStorage.setItem("dk_expenses", JSON.stringify(expenses));
    localStorage.setItem("dk_budgets", JSON.stringify(budgets));
  }

  function loadData() {
    targets = JSON.parse(localStorage.getItem("dk_targets") || "[]");
    incomes = JSON.parse(localStorage.getItem("dk_incomes") || "[]");
    expenses = JSON.parse(localStorage.getItem("dk_expenses") || "[]");
    budgets = JSON.parse(localStorage.getItem("dk_budgets") || "[]");
  }

  // ===== FORMAT =====
  function formatRupiah(v) {
    return "Rp " + Number(v).toLocaleString("id-ID");
  }

  function formatDate(d) {
    if (!d) return "-";
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
  }

  function currentMonthKey() {
    return new Date().toISOString().slice(0, 7);
  }

  function monthLabel(key) {
    if (!key) return "";
    const [y, m] = key.split("-");
    const names = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return `${names[parseInt(m) - 1]} ${y}`;
  }

  // ===== CATEGORY CONFIG =====
  const catCfg = {
    makanan: {
      icon: "ti-bowl",
      cls: "cat-makanan",
      label: "Makanan",
      color: "#FF7043",
    },
    transport: {
      icon: "ti-bus",
      cls: "cat-transport",
      label: "Transport",
      color: "#1E88E5",
    },
    jajan: {
      icon: "ti-coffee",
      cls: "cat-jajan",
      label: "Jajan",
      color: "#FB8C00",
    },
    hiburan: {
      icon: "ti-device-gamepad-2",
      cls: "cat-hiburan",
      label: "Hiburan",
      color: "#8B5CF6",
    },
    kesehatan: {
      icon: "ti-heart-rate-monitor",
      cls: "cat-kesehatan",
      label: "Kesehatan",
      color: "#10B981",
    },
    pendidikan: {
      icon: "ti-book",
      cls: "cat-pendidikan",
      label: "Pendidikan",
      color: "#EC4899",
    },
    kebutuhan: {
      icon: "ti-shopping-bag",
      cls: "cat-kebutuhan",
      label: "Kebutuhan",
      color: "#0891B2",
    },
    lainnya: {
      icon: "ti-dots-circle-horizontal",
      cls: "cat-lainnya",
      label: "Lainnya",
      color: "#6B7280",
    },
  };

  function catIcon(cat, size = "") {
    const c = catCfg[cat] || catCfg.lainnya;
    return `<span class="cat-icon ${c.cls}" ${size}><i class="ti ${c.icon}"></i></span>`;
  }
  function catLabel(cat) {
    return (catCfg[cat] || catCfg.lainnya).label;
  }
  function catColor(cat) {
    return (catCfg[cat] || catCfg.lainnya).color;
  }

  // ===== NAVIGATION =====
  const navItems = document.querySelectorAll(".nav-item, .sidebar-item");
  const navFab = document.querySelector(".nav-fab");
  const tabPages = document.querySelectorAll(".tab-page");

  function showTab(tabId) {
    tabPages.forEach((p) =>
      p.classList.toggle("active", p.id === `tab-${tabId}`),
    );
    navItems.forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === tabId),
    );
    if (navFab) navFab.classList.toggle("active", navFab.dataset.tab === tabId);
  }

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  if (navFab) {
    navFab.addEventListener("click", () => openTxModal("pengeluaran"));
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    if (
      btn.classList.contains("nav-item") ||
      btn.classList.contains("sidebar-item") ||
      btn.classList.contains("nav-fab")
    )
      return;
    showTab(btn.dataset.tab);
  });

  document.querySelectorAll(".inner-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.closest(".card");
      const container = btn.closest(".page-scroll");

      group
        .querySelectorAll(".inner-tab")
        .forEach((b) => b.classList.toggle("active", b === btn));
      container
        .querySelectorAll(".inner-tab-content")
        .forEach((c) =>
          c.classList.toggle("active", c.id === btn.dataset.tabDetail),
        );
    });
  });

  const btnNavBudget = document.getElementById("btn-nav-budget");
  if (btnNavBudget)
    btnNavBudget.addEventListener("click", () => showTab("riwayat"));

  // ===== RENDER: DASHBOARD =====
  function renderDashboard() {
    const month = currentMonthKey();

    const mIncome = incomes.filter((i) => i.date.startsWith(month));
    const mExpense = expenses.filter((i) => i.date.startsWith(month));

    const totalIn = mIncome.reduce((s, i) => s + Number(i.amount), 0);
    const totalOut = mExpense.reduce((s, i) => s + Number(i.amount), 0);
    const saldo = totalIn - totalOut;

    const elMonth = document.getElementById("dash-month-label");
    const elSaldo = document.getElementById("dash-saldo");
    const elIncome = document.getElementById("dash-income");
    const elExpense = document.getElementById("dash-expense");

    if (elMonth) elMonth.textContent = monthLabel(month);
    if (elSaldo) {
      elSaldo.textContent = formatRupiah(Math.abs(saldo));
      if (saldo < 0) elSaldo.textContent = "−" + formatRupiah(Math.abs(saldo));
    }
    if (elIncome) elIncome.textContent = formatRupiah(totalIn);
    if (elExpense) elExpense.textContent = formatRupiah(totalOut);

    // Fix: Biar nggak fallback ke bulan lalu
    const activeBudget = budgets.find((b) => b.month === month);

    const elBudgetAmount = document.getElementById("dash-budget-amount");
    const elBudgetFill = document.getElementById("dash-budget-fill");
    const elBudgetPct = document.getElementById("dash-budget-pct");
    const elBudgetUsed = document.getElementById("dash-budget-used");
    const elBudgetSisa = document.getElementById("dash-budget-sisa");
    const elWarning = document.getElementById("dash-warning");
    const elWarningText = document.getElementById("dash-warning-text");

    if (activeBudget) {
      const bv = Number(activeBudget.amount);
      const used = totalOut;
      const sisa = Math.max(bv - used, 0);
      const pct = bv > 0 ? Math.min(Math.round((used / bv) * 100), 100) : 0;

      if (elBudgetAmount) elBudgetAmount.textContent = formatRupiah(bv);
      if (elBudgetUsed) elBudgetUsed.textContent = formatRupiah(used);
      if (elBudgetSisa) elBudgetSisa.textContent = formatRupiah(sisa);
      if (elBudgetPct) elBudgetPct.textContent = `${pct}%`;
      if (elBudgetFill) {
        elBudgetFill.style.width = `${pct}%`;
        elBudgetFill.className =
          "dash-budget-fill" +
          (pct >= 100 ? " danger" : pct >= 80 ? " warning" : "");
      }

      if (elWarning) {
        if (pct >= 100) {
          elWarning.style.display = "flex";
          if (elWarningText)
            elWarningText.textContent = "Budget bulan ini sudah habis!";
        } else if (pct >= 80) {
          elWarning.style.display = "flex";
          if (elWarningText)
            elWarningText.textContent = `Pengeluaran sudah ${pct}% dari budget. Hati-hati!`;
        } else {
          elWarning.style.display = "none";
        }
      }
    } else {
      if (elBudgetAmount) elBudgetAmount.textContent = "Belum diatur";
      if (elBudgetFill) {
        elBudgetFill.style.width = "0%";
        elBudgetFill.className = "dash-budget-fill";
      }
      if (elBudgetPct) elBudgetPct.textContent = "0%";
      if (elBudgetUsed) elBudgetUsed.textContent = formatRupiah(totalOut);
      if (elBudgetSisa) elBudgetSisa.textContent = "—";
      if (elWarning) elWarning.style.display = "none";
    }

    const recentEl = document.getElementById("dash-recent");
    if (recentEl) {
      const allTx = [
        ...incomes.map((i) => ({ ...i, type: "income" })),
        ...expenses.map((i) => ({ ...i, type: "expense" })),
      ]
        // Fix: tiebreaker sort
        .sort(
          (a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id),
        )
        .slice(0, 3);

      const emptyState = document.getElementById("dash-empty-state");
      if (allTx.length === 0) {
        recentEl.innerHTML = "";
        if (emptyState) emptyState.style.display = "block";
      } else {
        if (emptyState) emptyState.style.display = "none";
        recentEl.innerHTML = allTx
          .map((item) => {
            if (item.type === "income") {
              return `
                <div class="tx-item">
                    <div class="tx-icon income"><i class="ti ti-arrow-down-left"></i></div>
                    <div class="tx-body">
                        <div class="tx-source">${item.source || "Pemasukan"}</div>
                        <div class="tx-date">${formatDate(item.date)}</div>
                    </div>
                    <div class="tx-amount income">+${formatRupiah(item.amount)}</div>
                </div>`;
            } else {
              const c = catCfg[item.category] || catCfg.lainnya;
              return `
                <div class="tx-item">
                    <span class="cat-icon ${c.cls}" style="width:40px;height:40px;border-radius:12px;font-size:1.05rem;flex-shrink:0">
                        <i class="ti ${c.icon}"></i>
                    </span>
                    <div class="tx-body">
                        <div class="tx-source">${c.label}${item.note ? ` · ${item.note}` : ""}</div>
                        <div class="tx-date">${formatDate(item.date)}</div>
                    </div>
                    <div class="tx-amount expense">−${formatRupiah(item.amount)}</div>
                </div>`;
            }
          })
          .join("");
      }
    }

    // ===== RENDER SHORTCUT TARGET MENABUNG =====
    const dashTargetShortcut = document.getElementById("dash-target-shortcut");
    if (dashTargetShortcut) {
      // Ambil maksimal 2 target yang belum diarsip (lagi berjalan)
      const activeTargets = targets.filter(t => !t.isArchived).slice(0, 2);

      if (activeTargets.length === 0) {
        dashTargetShortcut.innerHTML = `
          <div class="empty-state" style="padding: 16px; background: transparent; border: none;">
            <i class="ti ti-target" style="font-size: 1.8rem; margin-bottom: 8px;"></i>
            <div style="font-size: 0.85rem;">Belum ada target berjalan</div>
          </div>`;
      } else {
        dashTargetShortcut.innerHTML = activeTargets.map(t => {
          const pct = Math.floor(Math.min((t.currentAmount / t.targetAmount) * 100, 100));
          return `
            <div class="tx-item" style="padding: 12px; margin-bottom: 8px; border: 1px solid var(--border); box-shadow: none; align-items: stretch;">
              <div class="tx-icon" style="background: ${t.color}; width: 44px; height: 44px;">
                <i class="ti ${t.icon || 'ti-target'}"></i>
              </div>
              <div class="tx-body" style="display: flex; flex-direction: column; justify-content: center;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span class="tx-source" style="font-size: 0.9rem;">${t.name}</span>
                  <span style="font-size: 0.8rem; font-weight: 700; color: ${t.color};">${pct}%</span>
                </div>
                <div class="dash-budget-bar-bg" style="height: 6px; margin: 0; background: var(--bg);">
                  <div class="dash-budget-fill" style="width: ${pct}%; background: ${t.color}; height: 100%; border-radius: 4px;"></div>
                </div>
                <div style="font-size: 0.72rem; color: var(--text-3); margin-top: 6px; display: flex; justify-content: space-between;">
                  <span>Terkumpul: <strong>${formatRupiah(t.currentAmount)}</strong></span>
                </div>
              </div>
            </div>
          `;
        }).join("");
      }
    }

  }

  function renderIncomeList() {
    const el = document.getElementById("list-pemasukan");
    if (!el) return;
    if (incomes.length === 0) {
      el.innerHTML = `<div class="empty-state"><i class="ti ti-inbox"></i>Belum ada pemasukan.</div>`;
      return;
    }
    el.innerHTML = incomes
      .slice()
      .reverse()
      .map(
        (item) => `
      <div class="tx-item">
          <div class="tx-icon income"><i class="ti ti-arrow-down-left"></i></div>
          <div class="tx-body">
              <div class="tx-source">${item.source || "Pemasukan"}</div>
              <div class="tx-date">${formatDate(item.date)}</div>
              ${item.note ? `<div class="tx-note">${item.note}</div>` : ""}
          </div>
          <div class="tx-amount income">+${formatRupiah(item.amount)}</div>
      </div>
    `,
      )
      .join("");
  }

  function renderExpenseList() {
    const el = document.getElementById("list-pengeluaran");
    if (!el) return;
    if (expenses.length === 0) {
      el.innerHTML = `<div class="empty-state"><i class="ti ti-inbox"></i>Belum ada pengeluaran.</div>`;
      return;
    }
    // Fix: Hapus .slice(0, 20) biar nggak nge-cap sepihak
    el.innerHTML = expenses
      .slice()
      .reverse()
      .map((item) => {
        const c = catCfg[item.category] || catCfg.lainnya;
        return `
          <div class="tx-item">
              <span class="cat-icon ${c.cls}" style="width:40px;height:40px;border-radius:12px;font-size:1.1rem;flex-shrink:0">
                  <i class="ti ${c.icon}"></i>
              </span>
              <div class="tx-body">
                  <div class="tx-source">${c.label}</div>
                  <div class="tx-date">${formatDate(item.date)}</div>
                  ${item.note ? `<div class="tx-note">${item.note}</div>` : ""}
              </div>
              <div class="tx-amount expense">−${formatRupiah(item.amount)}</div>
          </div>
        `;
      })
      .join("");
  }

  function renderRiwayat(filter = {}) {
    let data = [...expenses];
    if (filter.category)
      data = data.filter((i) => i.category === filter.category);
    if (filter.startDate) data = data.filter((i) => i.date >= filter.startDate);
    if (filter.endDate) data = data.filter((i) => i.date <= filter.endDate);

    const tbody = document.getElementById("tbody-riwayat");
    const totalEl = document.getElementById("total-riwayat");
    const jmlEl = document.getElementById("jumlah-riwayat");
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="td-empty">Tidak ada data.</td></tr>';
      if (totalEl) totalEl.textContent = "Rp 0";
      if (jmlEl) jmlEl.textContent = "0";
      return;
    }

    const total = data.reduce((s, i) => s + Number(i.amount), 0);
    if (totalEl) totalEl.textContent = formatRupiah(total);
    if (jmlEl) jmlEl.textContent = data.length;

    tbody.innerHTML = data
      .slice()
      .reverse()
      .map(
        (item) => `
      <tr>
          <td style="white-space:nowrap">${formatDate(item.date)}</td>
          <td><div class="cat-cell">${catIcon(item.category)}<span>${catLabel(item.category)}</span></div></td>
          <td style="font-weight:600;color:var(--expense)">${formatRupiah(item.amount)}</td>
          <td style="color:var(--text-2)">${item.note || "—"}</td>
          <td><button class="btn-delete" data-id="${item.id}">Hapus</button></td>
      </tr>
    `,
      )
      .join("");
  }

  function renderBudgetHistory() {
    const tbody = document.getElementById("tbody-budget-history");

    // Fix: Update stat budget-hero di tab riwayat biar gak statis
    const currentMonth = currentMonthKey();
    const currentB = budgets.find((b) => b.month === currentMonth);
    const usedB = expenses
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((s, e) => s + Number(e.amount), 0);

    const elHeroTotal = document.getElementById("budget-hero-total");
    const elHeroUsed = document.getElementById("budget-hero-used");
    const elHeroAmount = document.getElementById("budget-hero-amount");

    if (currentB) {
      const sisa = Math.max(Number(currentB.amount) - usedB, 0);
      if (elHeroTotal) elHeroTotal.textContent = formatRupiah(currentB.amount);
      if (elHeroUsed) elHeroUsed.textContent = formatRupiah(usedB);
      if (elHeroAmount) elHeroAmount.textContent = formatRupiah(sisa);
    } else {
      if (elHeroTotal) elHeroTotal.textContent = "Rp 0";
      if (elHeroUsed) elHeroUsed.textContent = formatRupiah(usedB);
      if (elHeroAmount) elHeroAmount.textContent = "Belum diatur";
    }

    if (!tbody) return;
    if (budgets.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="td-empty">Belum ada budget.</td></tr>';
      return;
    }

    tbody.innerHTML = budgets
      .slice()
      .reverse()
      .map((item) => {
        const used = expenses
          .filter((e) => e.date.startsWith(item.month))
          .reduce((s, e) => s + Number(e.amount), 0);
        const sisa = Math.max(Number(item.amount) - used, 0);
        return `
          <tr>
              <td>${monthLabel(item.month)}</td>
              <td>${formatRupiah(item.amount)}</td>
              <td>${formatRupiah(used)}</td>
              <td style="font-weight:600;color:${sisa > 0 ? "var(--income)" : "var(--expense)"}">
                  ${formatRupiah(sisa)}
              </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderRekap(month) {
    const bulanEl = document.getElementById("bulan-rekap");
    const activeMonth =
      month || (bulanEl && bulanEl.value) || currentMonthKey();

    const fIncome = incomes.filter((i) => i.date.startsWith(activeMonth));
    const fExpense = expenses.filter((i) => i.date.startsWith(activeMonth));

    const totalIn = fIncome.reduce((s, i) => s + Number(i.amount), 0);
    const totalOut = fExpense.reduce((s, i) => s + Number(i.amount), 0);
    const balance = totalIn - totalOut;

    const setPIn = document.getElementById("rekap-total-pemasukan");
    const setPOut = document.getElementById("rekap-total-pengeluaran");
    const setSal = document.getElementById("rekap-saldo-akhir");

    if (setPIn) setPIn.textContent = formatRupiah(totalIn);
    if (setPOut) setPOut.textContent = formatRupiah(totalOut);
    if (setSal) {
      setSal.textContent =
        balance < 0
          ? "−" + formatRupiah(Math.abs(balance))
          : formatRupiah(balance);
      setSal.style.color = balance >= 0 ? "var(--income)" : "var(--expense)";
    }
  }

  // ===== CUSTOM MONTH DROPDOWN LOGIC =====
  let selectedExpenseMonth = currentMonthKey();

  const dropdownBtn = document.getElementById("month-dropdown-btn");
  const dropdownMenu = document.getElementById("month-dropdown-menu");
  const dropdownLabel = document.getElementById("month-dropdown-label");

  function populateMonthDropdown() {
    if (!dropdownMenu) return;

    const options = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      options.push(`${y}-${m}`);
      d.setMonth(d.getMonth() - 1);
    }

    dropdownMenu.innerHTML = options
      .map(
        (monthValue) => `
      <button type="button" class="month-dropdown-item ${monthValue === selectedExpenseMonth ? "selected" : ""}" data-value="${monthValue}">
        ${monthLabel(monthValue)}
      </button>
    `,
      )
      .join("");

    dropdownMenu.querySelectorAll(".month-dropdown-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        selectedExpenseMonth = e.target.dataset.value;
        dropdownLabel.textContent = monthLabel(selectedExpenseMonth);

        dropdownMenu.classList.remove("show");
        dropdownBtn.classList.remove("active");
        renderCharts(selectedExpenseMonth); // Render ulang pie chart

        dropdownMenu
          .querySelectorAll(".month-dropdown-item")
          .forEach((btn) => btn.classList.remove("selected"));
        e.target.classList.add("selected");
      });
    });
  }

  if (dropdownBtn) {
    dropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("show");
      dropdownBtn.classList.toggle("active");
    });
  }

  document.addEventListener("click", (e) => {
    if (
      dropdownMenu &&
      dropdownMenu.classList.contains("show") &&
      !e.target.closest("#expense-month-dropdown")
    ) {
      dropdownMenu.classList.remove("show");
      dropdownBtn.classList.remove("active");
    }
  });

  populateMonthDropdown();
  if (dropdownLabel)
    dropdownLabel.textContent = monthLabel(selectedExpenseMonth);

  // ===== RENDER CHARTS =====
  let barChart = null;
  let pieChart = null;

  function renderCharts(selectedMonth) {
    const activeMonth = selectedMonth || currentMonthKey();
    const currentMonth = currentMonthKey();

    const months = {};
    const cats = {};

    const catLabelsMap = {
      makanan: "Makanan",
      transport: "Transport",
      jajan: "Jajan",
      hiburan: "Hiburan",
      kesehatan: "Kesehatan",
      pendidikan: "Pendidikan",
      kebutuhan: "Kebutuhan",
      lainnya: "Lainnya",
    };

    const catColorsMap = {
      makanan: "#FF7043",
      transport: "#1E88E5",
      jajan: "#FB8C00",
      hiburan: "#8B5CF6",
      kesehatan: "#10B981",
      pendidikan: "#EC4899",
      kebutuhan: "#0891B2",
      lainnya: "#6B7280",
    };

   let totalAllMonths = 0; // Diganti buat ngitung semua bulan
    let totalSelectedMonth = 0; // Buat pie chart card bawah

    expenses.forEach((e) => {
      const m = e.date.slice(0, 7);
      months[m] = (months[m] || 0) + Number(e.amount);

      // Hitung semua pengeluaran tanpa peduli bulan apa
      totalAllMonths += Number(e.amount);
      
      if (m === activeMonth) {
        cats[e.category] = (cats[e.category] || 0) + Number(e.amount);
        totalSelectedMonth += Number(e.amount);
      }
    });

    // 1. Update Header Card Atas (Total Semua Bulan)
    const totalAmountEl = document.getElementById("expense-total-amount");
    if (totalAmountEl)
      totalAmountEl.textContent = totalAllMonths.toLocaleString("id-ID");
    // 2. Update Tengah Pie Chart (Dinamis Ngikut Dropdown)
    const pieTotalEl = document.getElementById("pie-total-val");
    if (pieTotalEl)
      pieTotalEl.textContent = totalSelectedMonth.toLocaleString("id-ID");

    // 3. Bar Chart
    const sortedMonths = Object.keys(months).sort();
    const barLabels = sortedMonths.map((m) => {
      const [y, mo] = m.split("-");
      const namesShort = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agt",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];
      return `${namesShort[parseInt(mo) - 1]} '${y.slice(2)}`;
    });

    const ctxBar = document.getElementById("chart-bar-pengeluaran");
    if (ctxBar) {
      if (barChart) barChart.destroy();
      barChart = new Chart(ctxBar, {
        type: "bar",
        data: {
          labels: barLabels,
          datasets: [
            {
              data: sortedMonths.map((m) => months[m]),
              backgroundColor: "#1d4ed8",
              borderRadius: 6,
              barThickness: 24,
            },
          ],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "#e5e7eb", borderDash: [4, 4], drawBorder: false },
              ticks: {
                callback: (v) => (v >= 1000 ? v / 1000 + "k" : v),
                color: "#9ca3af",
                font: { size: 10 },
              },
            },
            x: {
              grid: { display: false, drawBorder: false },
              ticks: { color: "#9ca3af", font: { size: 11 } },
            },
          },
          maintainAspectRatio: false,
        },
      });
    }

    // 4. Pie Chart (Udah di-inject tooltip persenan)
    const pieKeys = Object.keys(cats);
    const dataVals = pieKeys.map((k) => cats[k]);
    const currentColors = pieKeys.map((k) => catColorsMap[k] || "#6B7280");

    const ctxPie = document.getElementById("chart-pie-pengeluaran");
    if (ctxPie) {
      if (pieChart) pieChart.destroy();
      pieChart = new Chart(ctxPie, {
        type: "doughnut",
        data: {
          labels: pieKeys.map((k) => catLabelsMap[k] || k),
          datasets: [
            {
              data: dataVals.length ? dataVals : [1],
              backgroundColor: dataVals.length ? currentColors : ["#f3f4f6"],
              borderWidth: dataVals.length ? 3 : 0,
              borderColor: "#ffffff",
            },
          ],
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  let label = context.label || "";
                  if (label) label += ": ";
                  if (context.raw !== null && totalSelectedMonth > 0) {
                    const pct = Math.round(
                      (context.raw / totalSelectedMonth) * 100,
                    );
                    label +=
                      "Rp " +
                      context.raw.toLocaleString("id-ID") +
                      ` (${pct}%)`;
                  }
                  return label;
                },
              },
            },
          },
          cutout: "78%",
          maintainAspectRatio: false,
        },
      });
    }

    // 5. Legend (Udah di-inject teks persenan)
    const legendEl = document.getElementById("expense-pie-legend");
    if (legendEl) {
      legendEl.innerHTML =
        pieKeys.length === 0
          ? ""
          : pieKeys
              .map((k) => {
                const label = catLabelsMap[k] || k;
                const color = catColorsMap[k] || "#6B7280";
                const pct =
                  totalSelectedMonth > 0
                    ? Math.round((cats[k] / totalSelectedMonth) * 100)
                    : 0;

                return `<div class="legend-bubble">
                  <span class="legend-dot" style="background: ${color}"></span>
                  <span>${label} <strong style="color: var(--text-1); margin-left: 2px;">${pct}%</strong></span>
                </div>`;
              })
              .join("");
    }
  }

  function renderAll() {
    renderDashboard();
    renderIncomeList();
    renderExpenseList();
    renderRiwayat();
    renderBudgetHistory();
    renderRekap();
    renderCharts();
  }

  const formPemasukan = document.getElementById("form-pemasukan");
  if (formPemasukan) {
    formPemasukan.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(formPemasukan);
      incomes.push({
        id: Date.now().toString(),
        date: fd.get("tgl-pemasukan"),
        amount: Number(fd.get("nominal-pemasukan")),
        source: fd.get("sumber-pemasukan"),
        note: fd.get("catatan-pemasukan"),
      });
      saveData();
      renderAll();
      formPemasukan.reset();
      showToast("Pemasukan berhasil disimpan!", "success");
    });
  }

  const formBudget = document.getElementById("form-budget");
  if (formBudget) {
    formBudget.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(formBudget);
      const month = fd.get("bulan-budget");
      const amount = Number(fd.get("nominal-budget"));

      // Fix: Cegah duplikat budget per bulan
      const existingIndex = budgets.findIndex((b) => b.month === month);
      if (existingIndex >= 0) {
        budgets[existingIndex].amount = amount;
      } else {
        budgets.push({ id: Date.now().toString(), month, amount });
      }

      saveData();
      renderAll();
      formBudget.reset();
      showToast("Budget berhasil disimpan!", "success");
    });
  }

  const tbodyRiwayat = document.getElementById("tbody-riwayat");
  if (tbodyRiwayat) {
    tbodyRiwayat.addEventListener("click", (e) => {
      if (!e.target.matches(".btn-delete")) return;
      if (!confirm("Hapus transaksi ini?")) return;
      expenses = expenses.filter((i) => i.id !== e.target.dataset.id);
      saveData();
      renderAll();
      showToast("Transaksi dihapus.", "success");
    });
  }

  function showToast(msg, type = "success") {
    const existing = document.getElementById("toast");
    if (existing) existing.remove();
    const t = document.createElement("div");
    t.id = "toast";
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed",
      bottom: "80px",
      left: "50%",
      transform: "translateX(-50%)",
      background: type === "success" ? "var(--primary)" : "var(--danger)",
      color: "white",
      padding: "10px 20px",
      borderRadius: "20px",
      fontSize: "0.85rem",
      fontWeight: "600",
      zIndex: "9999",
      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      pointerEvents: "none",
      whiteSpace: "nowrap",
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  const btnExport = document.getElementById("btn-export");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      const data = {
        incomes,
        expenses,
        budgets,
        targets, // Fix: Tambah targets ke export
        exported: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dompetku-export.json";
      a.click();
      // Fix: Pakai setTimeout biar gak gagal download di beberapa browser
      setTimeout(() => URL.revokeObjectURL(url), 100);
    });
  }

  const txModal = document.getElementById("tx-modal");
  const btnOpenTx = document.getElementById("btn-open-tx-modal");
  const btnCloseTx = document.getElementById("btn-close-tx-modal");
  const btnSaveTx = document.getElementById("btn-save-tx");
  const txTypeExpense = document.getElementById("tx-type-expense");
  const txTypeIncome = document.getElementById("tx-type-income");
  const txFieldSumber = document.getElementById("tx-field-sumber");
  const txFieldKategori = document.getElementById("tx-field-kategori");
  const txNominal = document.getElementById("tx-nominal");
  const txTanggal = document.getElementById("tx-tanggal");
  const txSumber = document.getElementById("tx-sumber");
  const txCatatan = document.getElementById("tx-catatan");
  const txKategori = document.getElementById("tx-kategori");
  const txCatSelected = document.getElementById("tx-cat-selected");
  const txCatLabel = document.getElementById("tx-cat-label");
  const txCatOptions = document.getElementById("tx-cat-options");
  const txCatChevron = document.getElementById("tx-cat-chevron");

  function openCatDropdown() {
    txCatOptions.classList.add("open");
    txCatChevron.classList.add("open");
  }
  function closeCatDropdown() {
    txCatOptions.classList.remove("open");
    txCatChevron.classList.remove("open");
  }

  if (txNominal) {
    txNominal.addEventListener("input", function () {
      let rawValue = this.value.replace(/[^0-9]/g, "");
      this.value = rawValue
        ? parseInt(rawValue, 10).toLocaleString("id-ID")
        : "";
    });
  }

  if (txCatSelected) {
    txCatSelected.addEventListener("click", (e) => {
      e.stopPropagation();
      txCatOptions.classList.contains("open")
        ? closeCatDropdown()
        : openCatDropdown();
    });
  }

  if (txCatOptions) {
    txCatOptions.querySelectorAll(".tx-cat-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        txKategori.value = opt.dataset.value;
        txCatLabel.textContent = opt.textContent.trim();
        txCatSelected.classList.add("selected-active");
        txCatOptions
          .querySelectorAll(".tx-cat-option")
          .forEach((o) => o.classList.remove("active"));
        opt.classList.add("active");
        closeCatDropdown();
      });
    });
  }

  document.addEventListener("click", (e) => {
    if (
      txCatOptions &&
      !txCatOptions.closest(".tx-cat-dropdown").contains(e.target)
    )
      closeCatDropdown();
  });

  let txType = "pengeluaran";

  function openTxModal(type) {
    txType = type || "pengeluaran";
    txTypeExpense.classList.toggle("active", txType === "pengeluaran");
    txTypeIncome.classList.toggle("active", txType === "pemasukan");
    txFieldSumber.style.display = txType === "pemasukan" ? "flex" : "none";
    txFieldKategori.style.display = txType === "pengeluaran" ? "flex" : "none";
    txTanggal.value = new Date().toISOString().split("T")[0];
    txNominal.value = "";
    txSumber.value = "";
    txCatatan.value = "";
    txKategori.value = "";
    txCatLabel.textContent = "Pilih Kategori";
    txCatSelected.classList.remove("selected-active");
    if (txCatOptions)
      txCatOptions
        .querySelectorAll(".tx-cat-option")
        .forEach((o) => o.classList.remove("active"));
    closeCatDropdown();
    txModal.style.display = "flex";
    setTimeout(() => txNominal.focus(), 300);
  }

  function closeTxModal() {
    const sheet = txModal.querySelector(".tx-modal-sheet");
    sheet.classList.add("closing");
    setTimeout(() => {
      txModal.style.display = "none";
      sheet.classList.remove("closing");
    }, 240);
  }

  if (btnOpenTx)
    btnOpenTx.addEventListener("click", () => openTxModal("pengeluaran"));
  if (btnCloseTx) btnCloseTx.addEventListener("click", closeTxModal);
  txModal.addEventListener("click", (e) => {
    if (e.target === txModal) closeTxModal();
  });

  txTypeExpense.addEventListener("click", () => {
    txType = "pengeluaran";
    txTypeExpense.classList.add("active");
    txTypeIncome.classList.remove("active");
    txFieldSumber.style.display = "none";
    txFieldKategori.style.display = "flex";
  });

  txTypeIncome.addEventListener("click", () => {
    txType = "pemasukan";
    txTypeIncome.classList.add("active");
    txTypeExpense.classList.remove("active");
    txFieldSumber.style.display = "flex";
    txFieldKategori.style.display = "none";
  });

  if (btnSaveTx) {
    btnSaveTx.addEventListener("click", () => {
      const nominal = Number(txNominal.value.replace(/\./g, ""));
      const tgl = txTanggal.value;
      if (!nominal || nominal <= 0)
        return alert("Masukkan nominal terlebih dahulu.");
      if (!tgl) return alert("Pilih tanggal.");

      if (txType === "pemasukan") {
        incomes.push({
          id: Date.now().toString(),
          date: tgl,
          amount: nominal,
          source: txSumber.value || "Lainnya",
          note: txCatatan.value,
        });
      } else {
        if (!txKategori.value) return alert("Pilih kategori pengeluaran.");
        expenses.push({
          id: Date.now().toString(),
          date: tgl,
          amount: nominal,
          category: txKategori.value,
          note: txCatatan.value,
        });
      }

      saveData();
      renderAll();
      closeTxModal();
      showTab("dashboard");
      showToast(
        `${txType === "pemasukan" ? "Pemasukan" : "Pengeluaran"} berhasil disimpan!`,
      );
    });
  }

  let saldoHidden = false;
  const btnToggleSaldo = document.getElementById("btn-toggle-saldo");
  const iconToggleSaldo = document.getElementById("icon-toggle-saldo");

  if (btnToggleSaldo) {
    btnToggleSaldo.addEventListener("click", () => {
      saldoHidden = !saldoHidden;
      const elSaldo = document.getElementById("dash-saldo");
      if (elSaldo) elSaldo.classList.toggle("hidden", saldoHidden);
      if (iconToggleSaldo)
        iconToggleSaldo.className = saldoHidden ? "ti ti-eye-off" : "ti ti-eye";
    });
  }

  loadData();
  renderAll();

  // ===== LOGIKA TARGET MENABUNG =====
  let currentTargetId = null;

  const targetColors = [
    "var(--t-color-1)",
    "var(--t-color-2)",
    "var(--t-color-3)",
    "var(--t-color-4)",
    "var(--t-color-5)",
    "var(--t-color-6)",
    "var(--t-color-7)",
    "var(--t-color-8)",
  ];

  // Fix: Tambahin icon array
  const targetIcons = [
    "ti-target",
    "ti-car",
    "ti-plane",
    "ti-device-laptop",
    "ti-shopping-cart",
    "ti-home",
    "ti-device-gamepad-2",
  ];

  function renderTargets() {
    const activeEl = document.getElementById("target-list-active");
    const archiveEl = document.getElementById("target-list-archive");
    const heroAmountEl = document.getElementById("target-hero-amount");
    if (!activeEl || !archiveEl) return;

    if (heroAmountEl) {
      const totalTerkumpul = targets.reduce(
        (sum, t) => sum + t.currentAmount,
        0,
      );
      heroAmountEl.textContent = formatRupiah(totalTerkumpul);
    }

    const generateCard = (t, index) => {
      const pct = Math.floor(
        Math.min((t.currentAmount / t.targetAmount) * 100, 100),
      );
      const delay = index * 0.08;

      // Fix: Pakai data-action bukan inline window function
      return `
        <div class="target-card ${t.isArchived ? "archived" : ""}" style="background: ${t.color}; animation-delay: ${delay}s;">
          <div class="target-header">
            <div class="target-icon"><i class="ti ${t.icon || "ti-target"}"></i></div>
            <div class="target-info">
              <div class="target-name">${t.name}</div>
              <div class="target-amounts">${formatRupiah(t.currentAmount)} / ${formatRupiah(t.targetAmount)}</div>
            </div>
          </div>
          <div class="target-bar-wrap">
            <div class="target-bar-bg">
              <div class="target-bar-fill" style="width: ${pct}%"></div>
            </div>
            <span class="target-pct">${pct}%</span>
          </div>
          <div class="target-actions">
            ${!t.isArchived ? `<button class="btn-action" data-action="setor" data-id="${t.id}"><i class="ti ti-plus"></i> Setor</button>` : ""}
            <button class="btn-action" data-action="riwayat" data-id="${t.id}"><i class="ti ti-list"></i> Riwayat</button>
            <button class="btn-target-delete btn-action" data-action="delete" data-id="${t.id}"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      `;
    };

    const actives = targets.filter((t) => !t.isArchived);
    const archives = targets.filter((t) => t.isArchived);

    activeEl.innerHTML = actives.length
      ? actives.map((t, i) => generateCard(t, i)).join("")
      : '<div class="empty-state"><i class="ti ti-target"></i>Belum ada target berjalan.</div>';
    archiveEl.innerHTML = archives.length
      ? archives.map((t, i) => generateCard(t, i)).join("")
      : '<div class="empty-state"><i class="ti ti-archive"></i>Belum ada target di arsip.</div>';
  }

  const modalAddTarget = document.getElementById("modal-add-target");
  document
    .getElementById("btn-open-add-target")
    ?.addEventListener("click", () => {
      document.getElementById("form-add-target").reset();
      modalAddTarget.style.display = "flex";
    });
  document
    .getElementById("btn-close-add-target")
    ?.addEventListener("click", () => {
      modalAddTarget.style.display = "none";
    });

  document
    .getElementById("form-add-target")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      let safeColors = targetColors;
      if (targets.length > 0) {
        const lastColor = targets[targets.length - 1].color;
        safeColors = targetColors.filter((c) => c !== lastColor);
      }
      const randomColor =
        safeColors[Math.floor(Math.random() * safeColors.length)];
      const randomIcon =
        targetIcons[Math.floor(Math.random() * targetIcons.length)];

      targets.push({
        id: Date.now().toString(),
        name: document.getElementById("target-nama").value,
        targetAmount: Number(document.getElementById("target-nominal").value),
        currentAmount: 0,
        color: randomColor,
        icon: randomIcon,
        isArchived: false,
        history: [],
      });
      saveData();
      renderTargets();
      modalAddTarget.style.display = "none";
      showToast("Target menabung berhasil dibuat!");
    });

  // Fix: Logika action yang asalnya global window function dipindah ke event delegation
  function openSetorModal(id) {
    currentTargetId = id;
    document.getElementById("setor-nominal").value = "";
    document.getElementById("modal-setor-target").style.display = "flex";
  }

  function openHistoryModal(id) {
    const t = targets.find((x) => x.id === id);
    const tbody = document.getElementById("tbody-history-target");
    tbody.innerHTML =
      t.history.length === 0
        ? '<tr><td colspan="2" class="td-empty">Belum ada setoran</td></tr>'
        : t.history
            .slice()
            .reverse()
            .map(
              (h) => `
          <tr>
            <td>${formatDate(h.date.split("T")[0])}</td>
            <td style="font-weight:600; text-align:right; color: var(--income)">+${formatRupiah(h.amount)}</td>
          </tr>
        `,
            )
            .join("");
    document.getElementById("modal-history-target").style.display = "flex";
  }

  function deleteTarget(id) {
    if (!confirm("Yakin mau hapus target ini?")) return;
    targets = targets.filter((t) => t.id !== id);
    saveData();
    renderTargets();
    showToast("Target berhasil dihapus.");
  }

  const tabTargetContainer = document.getElementById("tab-target");
  if (tabTargetContainer) {
    tabTargetContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-action");
      if (!btn) return;

      const id = btn.dataset.id;
      if (btn.dataset.action === "setor") openSetorModal(id);
      if (btn.dataset.action === "riwayat") openHistoryModal(id);
      if (btn.dataset.action === "delete") deleteTarget(id);
    });
  }

  document
    .getElementById("form-setor-target")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nominal = Number(document.getElementById("setor-nominal").value);
      const t = targets.find((x) => x.id === currentTargetId);

      if (t && nominal > 0) {
        t.currentAmount += nominal;
        t.history.push({ date: new Date().toISOString(), amount: nominal });
        if (t.currentAmount >= t.targetAmount && !t.isArchived) {
          t.isArchived = true;
          showToast(
            "Yeay! Target tercapai, otomatis pindah ke arsip.",
            "success",
          );
          const arsipTabBtn = document.querySelector(
            '[data-tab-detail="target-arsip"]',
          );
          if (arsipTabBtn) arsipTabBtn.click();
        } else {
          showToast("Setoran berhasil ditambahkan!");
        }
        saveData();
        renderTargets();
      }
      document.getElementById("modal-setor-target").style.display = "none";
    });

  renderTargets();
};


const EXPENSE_KEY = "smartGenZExpenses";
const SETTINGS_KEY = "smartGenZSettings";

const $ = (id) => document.getElementById(id);

// ================================
// DATA SAVE AND LOAD
// ================================

function getExpenses() {
  return JSON.parse(localStorage.getItem(EXPENSE_KEY) || "[]");
}

function saveExpenses(data) {
  localStorage.setItem(EXPENSE_KEY, JSON.stringify(data));
}

function getSettings() {
  return JSON.parse(
    localStorage.getItem(SETTINGS_KEY) ||
    '{"budget":0,"stayType":"Hostel","studentName":"","threshold":75}'
  );
}

function saveSettings(data) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

function money(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}

function today() {
  const date = new Date();

  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
}

function currentMonth() {
  return today().slice(0, 7);
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char];
  });
}

// ================================
// HINDI VOICE ALERT
// ================================

function speakHindi(message) {
  if (!("speechSynthesis" in window)) {
    alert(message);
    return;
  }

  // Purani voice ko rokna
  window.speechSynthesis.cancel();

  const voiceMessage = new SpeechSynthesisUtterance(message);

  // Hindi language
  voiceMessage.lang = "hi-IN";
  voiceMessage.rate = 0.85;
  voiceMessage.pitch = 1;
  voiceMessage.volume = 1;

  const voices = window.speechSynthesis.getVoices();

  // Hindi voice available ho to use select karo
  const hindiVoice = voices.find(function (voice) {
    return voice.lang.toLowerCase().startsWith("hi");
  });

  if (hindiVoice) {
    voiceMessage.voice = hindiVoice;
  }

  window.speechSynthesis.speak(voiceMessage);
}

// ================================
// EXPENSE ROW
// ================================

function expenseRow(expense, allowDelete = false) {
  return `
    <div class="expense-row">
      <div>
        <h3>${safe(expense.name)}</h3>
        <p>${safe(expense.date)} · ${safe(expense.category)}</p>
        ${expense.note ? `<p>${safe(expense.note)}</p>` : ""}
      </div>

      <div>
        <span class="amount">${money(expense.amount)}</span>

        ${allowDelete
          ? `<button class="delete"
              data-delete="${safe(expense.id)}"
              type="button">Delete</button>`
          : ""}
      </div>
    </div>
  `;
}

// ================================
// HOME DASHBOARD
// ================================

function renderDashboard() {
  if (!$("budgetTotal")) return;

  const settings = getSettings();

  const expenses = getExpenses().filter(function (item) {
    return item.date.startsWith(currentMonth());
  });

  const spent = expenses.reduce(function (total, item) {
    return total + Number(item.amount);
  }, 0);

  const budget = Number(settings.budget);
  const remaining = budget - spent;

  const percent = budget > 0
    ? (spent / budget) * 100
    : 0;

  $("budgetTotal").textContent = money(budget);
  $("spentTotal").textContent = money(spent);
  $("remainingTotal").textContent = money(remaining);

  $("progressText").textContent = Math.round(percent) + "%";
  $("progressBar").style.width = Math.min(100, percent) + "%";

  if (budget <= 0) {
    $("budgetMessage").textContent =
      "Shuru karne ke liye Settings mein monthly budget set karein.";
  } else if (remaining < 0) {
    $("budgetMessage").textContent =
      "Aapka budget " + money(Math.abs(remaining)) +
      " se zyada ho gaya hai.";
  } else if (percent >= Number(settings.threshold)) {
    $("budgetMessage").textContent =
      "Budget alert! Aapka " + Math.round(percent) +
      "% budget kharch ho chuka hai.";
  } else {
    $("budgetMessage").textContent =
      money(remaining) + " aapke paas bacha hai.";
  }

  const recent = getExpenses()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  $("recentList").innerHTML = recent.length
    ? recent.map(item => expenseRow(item)).join("")
    : "<p>Abhi koi kharcha add nahi hua hai.</p>";
}

// ================================
// ADD EXPENSE
// ================================

function setupExpenseForm() {
  const form = $("expenseForm");

  if (!form) return;

  $("expenseDate").value = today();

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = $("expenseName").value.trim();
    const amount = Number($("expenseAmount").value);
    const date = $("expenseDate").value;

    if (!name || amount <= 0 || !date) {
      alert("Kripya kharche ki sahi details bharein.");
      return;
    }

    const allExpenses = getExpenses();

    // Is mahine ka kharcha save karne se pehle
    const oldSpent = allExpenses
      .filter(item => item.date.startsWith(currentMonth()))
      .reduce((total, item) => total + Number(item.amount), 0);

    allExpenses.push({
      id: String(Date.now()),
      name: name,
      amount: amount,
      date: date,
      category: $("expenseCategory").value,
      note: $("expenseNote").value.trim()
    });

    saveExpenses(allExpenses);

    const settings = getSettings();

    const newSpent = allExpenses
      .filter(item => item.date.startsWith(currentMonth()))
      .reduce((total, item) => total + Number(item.amount), 0);

    const budget = Number(settings.budget);
    const threshold = Number(settings.threshold);

    // Budget limit pehli baar cross hone par Hindi voice
    if (
      date.startsWith(currentMonth()) &&
      budget > 0 &&
      oldSpent < budget * threshold / 100 &&
      newSpent >= budget * threshold / 100
    ) {
      speakHindi(
        "Dhyan dijiye! Aapka monthly budget " +
        threshold +
        " pratishat istemal ho chuka hai. " +
        "Kripya apne kharchon par dhyan dein."
      );
    }

    // Budget poora cross hone par extra warning
    if (
      date.startsWith(currentMonth()) &&
      budget > 0 &&
      oldSpent <= budget &&
      newSpent > budget
    ) {
      speakHindi(
        "Savdhan! Aapka monthly budget poora kharch ho chuka hai. " +
        "Aap budget se zyada paise kharch kar rahe hain."
      );
    }

    $("formMessage").textContent =
      "Aapka kharcha safalta se save ho gaya!";

    form.reset();
    $("expenseDate").value = today();
  });
}

// ================================
// SETTINGS
// ================================

function setupSettings() {
  const form = $("settingsForm");

  if (!form) return;

  const settings = getSettings();

  $("stayType").value = settings.stayType || "Hostel";
  $("monthlyBudget").value = settings.budget || "";
  $("studentName").value = settings.studentName || "";
  $("alertThreshold").value = settings.threshold || 75;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const budget = Number($("monthlyBudget").value);

    if (budget < 0) {
      alert("Budget zero ya usse zyada hona chahiye.");
      return;
    }

    saveSettings({
      stayType: $("stayType").value,
      budget: budget,
      studentName: $("studentName").value.trim(),
      threshold: Number($("alertThreshold").value)
    });

    $("settingsMessage").textContent =
      "Aapki settings safalta se save ho gayi!";

    renderDashboard();
  });
}

// ================================
// EXPENSE HISTORY
// ================================

function renderHistory() {
  if (!$("historyList")) return;

  const month = $("historyMonth").value;

  let list = getExpenses().sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });

  if (month) {
    list = list.filter(function (item) {
      return item.date.startsWith(month);
    });
  }

  $("historyList").innerHTML = list.length
    ? list.map(item => expenseRow(item, true)).join("")
    : "<p>Koi kharcha nahi mila.</p>";
}

function setupHistory() {
  if (!$("historyList")) return;

  $("historyMonth").value = currentMonth();

  $("historyMonth").addEventListener("change", renderHistory);

  $("clearFilter").addEventListener("click", function () {
    $("historyMonth").value = "";
    renderHistory();
  });

  $("historyList").addEventListener("click", function (event) {
    const button = event.target.closest("[data-delete]");

    if (!button) return;

    if (confirm("Kya aap is kharche ko delete karna chahte hain?")) {
      const updated = getExpenses().filter(function (item) {
        return item.id !== button.dataset.delete;
      });

      saveExpenses(updated);
      renderHistory();
    }
  });

  renderHistory();
}

// ================================
// MONTHLY REPORT
// ================================

function renderReport() {
  if (!$("reportContent")) return;

  const month = $("reportMonth").value || currentMonth();

  const list = getExpenses()
    .filter(item => item.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));

  const settings = getSettings();

  const spent = list.reduce(function (total, item) {
    return total + Number(item.amount);
  }, 0);

  const budget = Number(settings.budget);
  const remaining = budget - spent;

  const categories = {};

  list.forEach(function (item) {
    categories[item.category] =
      (categories[item.category] || 0) + Number(item.amount);
  });

  $("reportContent").innerHTML = `
    <h2>Smart GenZ — ${safe(month)} Report</h2>

    <p>Stay type: ${safe(settings.stayType)}</p>
    <p>Student: ${safe(settings.studentName || "Not entered")}</p>

    <div class="report-summary">
      <div>
        <p>Monthly Budget</p>
        <strong>${money(budget)}</strong>
      </div>
      <div>
        <p>Total Spent</p>
        <strong>${money(spent)}</strong>
      </div>
      <div>
        <p>Remaining Balance</p>
        <strong>${money(remaining)}</strong>
      </div>
    </div>

    <h2>Category Summary</h2>

    ${Object.keys(categories).length
      ? Object.entries(categories).map(function ([name, value]) {
          return `
            <div class="expense-row">
              <span>${safe(name)}</span>
              <strong>${money(value)}</strong>
            </div>
          `;
        }).join("")
      : "<p>Is mahine koi kharcha record nahi hua.</p>"}

    <h2>Expense Details</h2>

    ${list.length
      ? list.map(item => expenseRow(item)).join("")
      : "<p>Abhi koi expense details nahi hain.</p>"}
  `;

  window.smartGenZReportText =
    "Smart GenZ Monthly Report: " + month + "\n" +
    "Stay: " + settings.stayType + "\n" +
    "Budget: " + money(budget) + "\n" +
    "Spent: " + money(spent) + "\n" +
    "Remaining: " + money(remaining) + "\n" +
    "Total expenses: " + list.length;
}

function setupReport() {
  if (!$("reportMonth")) return;

  $("reportMonth").value = currentMonth();

  $("reportMonth").addEventListener("change", renderReport);

  $("printReport").addEventListener("click", function () {
    window.print();
  });

  $("shareReport").addEventListener("click", function () {
    renderReport();

    const url = "https://wa.me/?text=" +
      encodeURIComponent(window.smartGenZReportText);

    window.open(url, "_blank");
  });

  renderReport();
}

// ================================
// START APP
// ================================

document.addEventListener("DOMContentLoaded", function () {
  setupExpenseForm();
  setupSettings();
  setupHistory();
  setupReport();
  renderDashboard();
});

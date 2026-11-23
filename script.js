/**
 * ============================================================================
 * CampaignPilot - Client Application Script
 * Built with pure Vanilla JS following KMIT JavaScript & Event Handling modules
 * ============================================================================
 * Concepts implemented from guides:
 *  - DOM querying & updates (querySelector, createElement, textContent, classList)
 *  - Event handling (submit + preventDefault, input, change, click, mouseover/out)
 *  - Event delegation with closest()
 *  - Higher-order functions (onKey helper, callbacks)
 *  - Array methods with callbacks (forEach, map, filter)
 *  - Async/Await with Fetch API & status checks (res.ok)
 *  - Promise combinators (Promise.allSettled for multi-endpoint loading)
 *  - Disabling submit buttons in try/finally to prevent double submissions
 *  - Persistence with localStorage (JSON.stringify / parse)
 *  - Live updating clock with setInterval
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. DOM Elements Selection
// ----------------------------------------------------------------------------
const form = document.querySelector("#predictionForm");
const predictBtn = document.querySelector("#predictBtn");
const clearBtn = document.querySelector("#clearBtn");
const statusP = document.querySelector("#statusP");
const clockP = document.querySelector("#clockP");
const networkStatus = document.querySelector("#networkStatus");

const apiUrlSelect = document.querySelector("#apiUrlSelect");
const customApiInput = document.querySelector("#customApiInput");
const loadMetricsBtn = document.querySelector("#loadMetricsBtn");
const quickTestBtn = document.querySelector("#quickTestBtn");
const metricsPanel = document.querySelector("#metricsPanel");

const outcomeBox = document.querySelector("#outcomeBox");
const predictionBadge = document.querySelector("#predictionBadge");
const probabilityText = document.querySelector("#probabilityText");
const probabilityBar = document.querySelector("#probabilityBar");
const recommendationText = document.querySelector("#recommendationText");

const historyList = document.querySelector("#historyList");
const emptyHistoryMsg = document.querySelector("#emptyHistoryMsg");
const clearHistoryBtn = document.querySelector("#clearHistoryBtn");
const presetButtonsContainer = document.querySelector("#presetButtonsContainer");

// ----------------------------------------------------------------------------
// 2. Preset Data Profiles (Quick Form Autofill)
// ----------------------------------------------------------------------------
const PRESETS = {
    "sample-standard": {
        age: 35,
        job: "technician",
        marital: "married",
        education: "university.degree",
        default: "no",
        housing: "yes",
        loan: "no",
        contact: "cellular",
        month: "may",
        day_of_week: "mon",
        campaign: 2,
        pdays: 999,
        previous: 0,
        poutcome: "nonexistent",
        "emp.var.rate": 1.1,
        "cons.price.idx": 93.994,
        "cons.conf.idx": -36.4,
        euribor3m: 4.857,
        nr_employed: 5191.0
    },
    "sample-high": {
        age: 28,
        job: "student",
        marital: "single",
        education: "university.degree",
        default: "no",
        housing: "no",
        loan: "no",
        contact: "cellular",
        month: "aug",
        day_of_week: "thu",
        campaign: 1,
        pdays: 6,
        previous: 2,
        poutcome: "success",
        "emp.var.rate": -1.8,
        "cons.price.idx": 92.893,
        "cons.conf.idx": -46.2,
        euribor3m: 1.327,
        nr_employed: 5099.1
    },
    "sample-low": {
        age: 48,
        job: "blue-collar",
        marital: "married",
        education: "basic.4y",
        default: "unknown",
        housing: "yes",
        loan: "yes",
        contact: "telephone",
        month: "may",
        day_of_week: "fri",
        campaign: 7,
        pdays: 999,
        previous: 0,
        poutcome: "nonexistent",
        "emp.var.rate": 1.4,
        "cons.price.idx": 93.918,
        "cons.conf.idx": -42.7,
        euribor3m: 4.962,
        nr_employed: 5228.1
    }
};

// ----------------------------------------------------------------------------
// 3. State Management & localStorage Handling
// ----------------------------------------------------------------------------
const STORAGE_KEY = "campaignpilot_prediction_history";

/**
 * Loads saved prediction history from localStorage
 */
function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error("Could not parse history from localStorage", e);
        return [];
    }
}

/**
 * Saves prediction history array into localStorage
 */
function saveHistory(historyArray) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(historyArray));
}

let historyItems = loadHistory();

/**
 * Renders the prediction history list in the DOM using createElement
 */
function renderHistory() {
    // Clear list cleanly
    historyList.replaceChildren();

    if (historyItems.length === 0) {
        emptyHistoryMsg.hidden = false;
        return;
    }

    emptyHistoryMsg.hidden = true;

    // Use forEach with arrow function to build list items
    historyItems.forEach((entry, index) => {
        const li = document.createElement("li");
        li.className = "history-item";
        li.dataset.index = index;

        // Details container
        const details = document.createElement("div");
        details.className = "history-item-details";

        const title = document.createElement("span");
        title.className = "history-item-title";
        // Safe textContent (prevents XSS)
        title.textContent = `${entry.job} (${entry.age}y), ${entry.marital}`;

        const sub = document.createElement("span");
        sub.className = "history-item-sub";
        sub.textContent = `${entry.timestamp} | Contact: ${entry.contact}`;

        details.append(title, sub);

        // Right side badge and delete button
        const rightGroup = document.createElement("div");
        rightGroup.className = "history-item-right";

        const badge = document.createElement("span");
        const isYes = entry.prediction === "Yes";
        badge.className = `history-badge ${isYes ? "yes" : "no"}`;
        badge.textContent = `${entry.prediction} (${entry.probability}%)`;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "history-remove-btn";
        removeBtn.title = "Delete record";
        removeBtn.textContent = "×";

        rightGroup.append(badge, removeBtn);
        li.append(details, rightGroup);

        historyList.append(li);
    });
}

// ----------------------------------------------------------------------------
// 4. API URL Helper
// ----------------------------------------------------------------------------
function getActiveApiUrl() {
    if (apiUrlSelect.value === "custom") {
        return customApiInput.value.trim().replace(/\/+$/, "") || "http://127.0.0.1:8000";
    }
    return apiUrlSelect.value;
}

// ----------------------------------------------------------------------------
// 5. Form Data Extraction & Autofill
// ----------------------------------------------------------------------------
function getFormData() {
    return {
        age: parseInt(document.querySelector("#age").value, 10),
        job: document.querySelector("#job").value,
        marital: document.querySelector("#marital").value,
        education: document.querySelector("#education").value,
        default: document.querySelector("#default").value,
        housing: document.querySelector("#housing").value,
        loan: document.querySelector("#loan").value,
        contact: document.querySelector("#contact").value,
        month: document.querySelector("#month").value,
        day_of_week: document.querySelector("#day_of_week").value,
        campaign: parseInt(document.querySelector("#campaign").value, 10),
        pdays: parseInt(document.querySelector("#pdays").value, 10),
        previous: parseInt(document.querySelector("#previous").value, 10),
        poutcome: document.querySelector("#poutcome").value,
        "emp.var.rate": parseFloat(document.querySelector("#emp_var_rate").value),
        "cons.price.idx": parseFloat(document.querySelector("#cons_price_idx").value),
        "cons.conf.idx": parseFloat(document.querySelector("#cons_conf_idx").value),
        euribor3m: parseFloat(document.querySelector("#euribor3m").value),
        nr_employed: parseFloat(document.querySelector("#nr_employed").value)
    };
}

function setFormData(data) {
    if (!data) return;
    document.querySelector("#age").value = data.age ?? 35;
    document.querySelector("#job").value = data.job ?? "technician";
    document.querySelector("#marital").value = data.marital ?? "married";
    document.querySelector("#education").value = data.education ?? "university.degree";
    document.querySelector("#default").value = data.default ?? "no";
    document.querySelector("#housing").value = data.housing ?? "yes";
    document.querySelector("#loan").value = data.loan ?? "no";
    document.querySelector("#contact").value = data.contact ?? "cellular";
    document.querySelector("#month").value = data.month ?? "may";
    document.querySelector("#day_of_week").value = data.day_of_week ?? "mon";
    document.querySelector("#campaign").value = data.campaign ?? 1;
    document.querySelector("#pdays").value = data.pdays ?? 999;
    document.querySelector("#previous").value = data.previous ?? 0;
    document.querySelector("#poutcome").value = data.poutcome ?? "nonexistent";
    document.querySelector("#emp_var_rate").value = data["emp.var.rate"] ?? 1.1;
    document.querySelector("#cons_price_idx").value = data["cons.price.idx"] ?? 93.994;
    document.querySelector("#cons_conf_idx").value = data["cons.conf.idx"] ?? -36.4;
    document.querySelector("#euribor3m").value = data.euribor3m ?? 4.857;
    document.querySelector("#nr_employed").value = data.nr_employed ?? 5191.0;
}

// ----------------------------------------------------------------------------
// 6. Asynchronous Prediction (Async/Await, Fetch, try/catch/finally)
// ----------------------------------------------------------------------------
async function predictCustomer() {
    const apiUrl = getActiveApiUrl();
    const payload = getFormData();

    // UI Feedback: disable button to prevent double-submissions, update status
    predictBtn.disabled = true;
    statusP.className = "status-message loading";
    statusP.textContent = "Connecting to model & computing prediction...";

    try {
        const response = await fetch(`${apiUrl}/predict`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        // Check res.ok (fetch does not reject 400/500 automatically!)
        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Update UI with result
        statusP.className = "status-message ready";
        statusP.textContent = `Prediction ready at ${new Date().toLocaleTimeString()}!`;

        displayPrediction(result);

        // Store into history
        const newRecord = {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            job: payload.job,
            age: payload.age,
            marital: payload.marital,
            contact: payload.contact,
            prediction: result.prediction,
            probability: result.subscription_probability,
            formData: payload
        };

        // Keep last 15 predictions
        historyItems.unshift(newRecord);
        if (historyItems.length > 15) historyItems.pop();
        saveHistory(historyItems);
        renderHistory();

    } catch (err) {
        statusP.className = "status-message error";
        statusP.textContent = `Prediction failed: ${err.message}. Ensure backend is running at ${apiUrl}`;
        console.error("Prediction Error:", err);
    } finally {
        // ALWAYS re-enable button inside finally block
        predictBtn.disabled = false;
    }
}

function displayPrediction(result) {
    outcomeBox.classList.remove("hidden");
    const isYes = result.prediction === "Yes";

    // Prediction badge
    predictionBadge.textContent = isYes ? "WILL SUBSCRIBE (YES)" : "UNLIKELY TO SUBSCRIBE (NO)";
    predictionBadge.className = `outcome-badge ${isYes ? "outcome-yes" : "outcome-no"}`;

    // Probability & Progress bar
    const prob = result.subscription_probability;
    probabilityText.textContent = `${prob.toFixed(1)}%`;
    probabilityBar.style.width = `${Math.min(100, Math.max(0, prob))}%`;

    // Strategy recommendation
    if (prob >= 50) {
        recommendationText.textContent = "High priority candidate: Dispatch personalized cellular outreach. High expected conversion rate.";
    } else if (prob >= 20) {
        recommendationText.textContent = "Moderate propensity candidate: Consider targeting during secondary campaign follow-ups.";
    } else {
        recommendationText.textContent = "Low conversion probability: Avoid spending calling capacity unless required by coverage quota.";
    }
}

// ----------------------------------------------------------------------------
// 7. Promise Combinator: Fetching Model Info & Metrics (Promise.allSettled)
// ----------------------------------------------------------------------------
async function fetchModelOverview() {
    const apiUrl = getActiveApiUrl();
    loadMetricsBtn.disabled = true;
    loadMetricsBtn.textContent = "Fetching...";

    try {
        // Use Promise.allSettled to load multiple endpoints safely
        const results = await Promise.allSettled([
            fetch(`${apiUrl}/model-info`).then(r => {
                if (!r.ok) throw new Error(`Model info HTTP ${r.status}`);
                return r.json();
            }),
            fetch(`${apiUrl}/model-metrics`).then(r => {
                if (!r.ok) throw new Error(`Metrics HTTP ${r.status}`);
                return r.json();
            })
        ]);

        metricsPanel.classList.remove("hidden");
        metricsPanel.replaceChildren();

        const [infoRes, metricsRes] = results;

        if (metricsRes.status === "fulfilled") {
            const m = metricsRes.value;
            createMetricStat("Accuracy", `${m.accuracy}%`);
            createMetricStat("Precision", `${m.precision}%`);
            createMetricStat("Recall", `${m.recall}%`);
            createMetricStat("F1-Score", `${m.f1_score}%`);
        }

        if (infoRes.status === "fulfilled") {
            const info = infoRes.value;
            createMetricStat("Model", info.model_name || "Random Forest");
            createMetricStat("Features", info.number_of_features || 61);
        }

        if (infoRes.status === "rejected" && metricsRes.status === "rejected") {
            const errP = document.createElement("p");
            errP.className = "empty-note";
            errP.textContent = `Could not reach ${apiUrl}. Make sure server is running.`;
            metricsPanel.append(errP);
        }

    } catch (e) {
        console.error("Metrics fetch error:", e);
    } finally {
        loadMetricsBtn.disabled = false;
        loadMetricsBtn.textContent = "Fetch Model Metrics";
    }
}

function createMetricStat(label, value) {
    const div = document.createElement("div");
    div.className = "metric-stat";

    const valSpan = document.createElement("span");
    valSpan.className = "metric-val";
    valSpan.textContent = value;

    const lblSpan = document.createElement("span");
    lblSpan.className = "metric-lbl";
    lblSpan.textContent = label;

    div.append(valSpan, lblSpan);
    metricsPanel.append(div);
}

// ----------------------------------------------------------------------------
// 8. Event Handling & Delegation
// ----------------------------------------------------------------------------

// Form Submit: prevent default browser refresh
form.addEventListener("submit", (event) => {
    event.preventDefault();
    predictCustomer();
});

// Clear / Reset Form
clearBtn.addEventListener("click", () => {
    form.reset();
    outcomeBox.classList.add("hidden");
    statusP.className = "status-message";
    statusP.textContent = "Form reset. Select a preset or fill the form.";
});

// API selector change event
apiUrlSelect.addEventListener("change", () => {
    if (apiUrlSelect.value === "custom") {
        customApiInput.classList.remove("hidden");
        customApiInput.focus();
    } else {
        customApiInput.classList.add("hidden");
    }
});

// Quick Health Check
quickTestBtn.addEventListener("click", async () => {
    const apiUrl = getActiveApiUrl();
    quickTestBtn.disabled = true;
    statusP.className = "status-message loading";
    statusP.textContent = `Testing connection to ${apiUrl}...`;

    try {
        const res = await fetch(`${apiUrl}/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        statusP.className = "status-message ready";
        statusP.textContent = `Backend online: "${data.message || 'Connected'}"`;
    } catch (err) {
        statusP.className = "status-message error";
        statusP.textContent = `Backend unreachable at ${apiUrl} (${err.message})`;
    } finally {
        quickTestBtn.disabled = false;
    }
});

// Model Metrics button click
loadMetricsBtn.addEventListener("click", fetchModelOverview);

// Preset Buttons (using dataset + event delegation on container)
presetButtonsContainer.addEventListener("click", (event) => {
    const btn = event.target.closest(".preset-btn");
    if (!btn) return;

    const presetKey = btn.dataset.preset;
    if (PRESETS[presetKey]) {
        setFormData(PRESETS[presetKey]);
        statusP.className = "status-message";
        statusP.textContent = `Loaded preset: "${btn.textContent.trim()}". Press Predict or [P].`;
    }
});

// Mouseover & Mouseout on preset buttons (Concept from Event Handling RSI Module)
document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("mouseover", () => btn.classList.add("hovered"));
    btn.addEventListener("mouseout", () => btn.classList.remove("hovered"));
});

// History List Event Delegation:
// 1) Clicking remove 'x' removes the single history item
// 2) Clicking the card item restores its form values
historyList.addEventListener("click", (event) => {
    const removeBtn = event.target.closest(".history-remove-btn");
    const itemCard = event.target.closest(".history-item");

    if (removeBtn && itemCard) {
        // Prevent clicking parent card
        event.stopPropagation();
        const index = parseInt(itemCard.dataset.index, 10);
        historyItems.splice(index, 1);
        saveHistory(historyItems);
        renderHistory();
        return;
    }

    if (itemCard) {
        const index = parseInt(itemCard.dataset.index, 10);
        const record = historyItems[index];
        if (record && record.formData) {
            setFormData(record.formData);
            statusP.className = "status-message";
            statusP.textContent = `Restored prediction from ${record.timestamp}.`;
        }
    }
});

// Clear All History
clearHistoryBtn.addEventListener("click", () => {
    historyItems = [];
    saveHistory(historyItems);
    renderHistory();
    statusP.textContent = "Prediction history cleared.";
});

// ----------------------------------------------------------------------------
// 9. Keyboard Shortcuts (Higher-Order Function onKey from RSI Guides)
// ----------------------------------------------------------------------------
function onKey(keyName, action) {
    document.addEventListener("keydown", (event) => {
        // Trap check from guide: ignore shortcut if user is currently typing in an input/select
        if (event.target.tagName === "INPUT" || event.target.tagName === "SELECT") {
            // Allow Escape to blur inputs
            if (event.key === "Escape") {
                event.target.blur();
            }
            return;
        }

        if (event.key === keyName || event.key.toLowerCase() === keyName.toLowerCase()) {
            action(event);
        }
    });
}

// Shortcuts registration
onKey("p", () => {
    if (!predictBtn.disabled) {
        predictCustomer();
    }
});

onKey("Escape", () => {
    clearBtn.click();
});

onKey("m", () => {
    if (!loadMetricsBtn.disabled) {
        fetchModelOverview();
    }
});

// ----------------------------------------------------------------------------
// 10. Live Clock & Network Detection (Everyday Browser Features)
// ----------------------------------------------------------------------------
setInterval(() => {
    clockP.textContent = new Date().toLocaleTimeString();
}, 1000);

// Initialize clock immediately
clockP.textContent = new Date().toLocaleTimeString();

// Network status listeners
function updateNetworkStatus() {
    if (navigator.onLine) {
        networkStatus.textContent = "Online";
        networkStatus.className = "network-badge online";
    } else {
        networkStatus.textContent = "Offline";
        networkStatus.className = "network-badge offline";
    }
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);
updateNetworkStatus();

// ----------------------------------------------------------------------------
// 11. Initial Run
// ----------------------------------------------------------------------------
renderHistory();

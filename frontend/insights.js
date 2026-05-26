const API_BASE = "https://finsmart-backend-4zge.onrender.com";
function getReceipts() {
    return JSON.parse(localStorage.getItem("receipts")) || [];
}

function parseInsight(insights) {
    if (!insights) return null;

    if (typeof insights === "object") return insights;

    try {
        return JSON.parse(insights);
    } catch {
        return {
            category: "General spending",
            needsPercent: 70,
            wantsPercent: 30,
            financeScore: 70,
            insight: String(insights),
            savingAmount: 0,
            savingAction: "Keep uploading receipts to improve your spending overview.",
            categories: [],
            items: []
        };
    }
}

function loadInsights() {
    const receipts = getReceipts();

    let total = 0;
    let weightedNeeds = 0;
    let weightedWants = 0;
    let biggest = 0;
    let scoreTotal = 0;
    let scoredReceipts = 0;

    receipts.forEach(receipt => {
        const amount = parseFloat(receipt.total) || 0;
        const insight = parseInsight(receipt.insights);

        const needsPercent = Number(insight?.needsPercent ?? 70);
        const wantsPercent = Number(insight?.wantsPercent ?? 30);

        total += amount;
        biggest = Math.max(biggest, amount);

        weightedNeeds += amount * (needsPercent / 100);
        weightedWants += amount * (wantsPercent / 100);

        if (insight?.financeScore) {
            scoreTotal += Number(insight.financeScore);
            scoredReceipts++;
        }
    });

    const score = scoredReceipts > 0
        ? Math.round(scoreTotal / scoredReceipts)
        : calculateScore(total, receipts.length);

    const savings = getTotalSavingTarget(receipts, total);

    document.getElementById("monthlySpend").textContent = "£" + total.toFixed(2);
    document.getElementById("receiptCount").textContent = receipts.length;
    document.getElementById("biggestReceipt").textContent = "£" + biggest.toFixed(2);
    document.getElementById("savingsPotential").textContent = "£" + savings.toFixed(2);
    document.getElementById("financeScore").textContent = score;

    document.getElementById("scoreRing").style.background =
        `conic-gradient(#F7F8E5 ${score * 3.6}deg, rgba(247,248,229,.12) ${score * 3.6}deg)`;

    document.getElementById("summaryText").textContent =
        receipts.length > 0
            ? `${receipts.length} receipt(s) analysed. Total detected spending: £${total.toFixed(2)}.`
            : "Upload receipts to build your monthly spending overview.";

    renderAICards(receipts, total, savings, score);
    drawPieChart(weightedNeeds, weightedWants);
    drawLineChart(receipts);
    showReceiptTimeline(receipts);
    showMonthlyBreakdown(receipts);
    showCategoryOverview(receipts);
}

function getTotalSavingTarget(receipts, total) {
    const aiSavings = receipts.reduce((sum, receipt) => {
        const insight = parseInsight(receipt.insights);
        return sum + (parseFloat(insight?.savingAmount) || 0);
    }, 0);

    return aiSavings > 0 ? aiSavings : total * 0.1;
}

function renderAICards(receipts, total, savings, score) {
    const aiAdvice = document.getElementById("aiAdvice");

    if (receipts.length === 0) {
        aiAdvice.innerHTML = `
            <span class="eyebrow">AI Insight</span>
            <h2>No receipt analysis yet</h2>
            <p>Upload receipts to receive clear financial insights and practical saving actions.</p>
        `;
        return;
    }

    const latestReceipt = receipts[receipts.length - 1];
    const latestInsight = parseInsight(latestReceipt.insights);

    aiAdvice.innerHTML = `
        <span class="eyebrow">Latest AI Insight</span>
        <h2>${escapeHTML(latestInsight?.category || "General spending")}</h2>

        <p>${escapeHTML(latestInsight?.insight || "Your latest receipt has been analysed.")}</p>

        <div class="insight-stats">
            <div>
                <span>Needs / Wants</span>
                <strong>${latestInsight?.needsPercent ?? 70}% / ${latestInsight?.wantsPercent ?? 30}%</strong>
            </div>

            <div>
                <span>Saving Target</span>
                <strong>£${parseFloat(latestInsight?.savingAmount || 0).toFixed(2)}</strong>
            </div>

            <div>
                <span>AI Score</span>
                <strong>${latestInsight?.financeScore ?? score}/100</strong>
            </div>
        </div>

        <div class="saving-box">
            <span>How to save</span>
            <p>${escapeHTML(latestInsight?.savingAction || "Try reducing one flexible item in your next similar shop.")}</p>
        </div>
    `;
}

function showCategoryOverview(receipts) {
    const container = document.getElementById("categoryOverview");
    if (!container) return;

    container.innerHTML = "";

    if (receipts.length === 0) {
        container.innerHTML = `
            <article class="info-card">
                <span>No data</span>
                <strong>£0.00</strong>
                <p>Upload receipts to see categories.</p>
            </article>
        `;
        return;
    }

    const totals = {};

    receipts.forEach(receipt => {
        const insight = parseInsight(receipt.insights);
        const cats = insight?.categories || [];

        if (cats.length === 0) {
            const name = insight?.category || "General";
            totals[name] = (totals[name] || 0) + (parseFloat(receipt.total) || 0);
            return;
        }

        cats.forEach(cat => {
            const name = cat.name || "Other";
            totals[name] = (totals[name] || 0) + (parseFloat(cat.amount) || 0);
        });
    });

    Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .forEach(([name, amount]) => {
            const card = document.createElement("article");
            card.className = "info-card";
            card.innerHTML = `
                <span>${escapeHTML(name)}</span>
                <strong>£${amount.toFixed(2)}</strong>
                <p>${Math.round((amount / getTotalSpend(receipts)) * 100)}% of spending</p>
            `;
            container.appendChild(card);
        });
}

function getTotalSpend(receipts) {
    return receipts.reduce((sum, receipt) => sum + (parseFloat(receipt.total) || 0), 0) || 1;
}

function calculateScore(total, count) {
    if (count === 0) return 0;

    let score = 92;

    if (total > 300) score -= 18;
    else if (total > 180) score -= 10;
    else if (total > 100) score -= 5;

    if (count >= 5) score += 3;

    return Math.max(45, Math.min(100, score));
}

function showReceiptTimeline(receipts) {
    const receiptList = document.getElementById("receiptList");
    receiptList.innerHTML = "";

    if (receipts.length === 0) {
        receiptList.innerHTML = `
            <article class="empty-card">
                <h3>No receipts yet</h3>
                <p>Upload receipts to start building your timeline.</p>
            </article>
        `;
        return;
    }

    receipts.slice().reverse().forEach((receipt, index) => {
        const insight = parseInsight(receipt.insights);

        const card = document.createElement("details");
        card.className = "timeline-item";

        card.innerHTML = `
            <summary>
                <div>
                    <strong>${escapeHTML(receipt.store || "Unknown Store")}</strong>
                    <span>${formatDate(receipt.date)} · ${escapeHTML(insight?.category || "General")}</span>
                </div>
                <b>£${parseFloat(receipt.total || 0).toFixed(2)}</b>
            </summary>

            <div class="timeline-detail">
                <p>${escapeHTML(insight?.insight || "Receipt analysed.")}</p>
                <p><strong>Saving action:</strong> ${escapeHTML(insight?.savingAction || "No action available.")}</p>
            </div>
        `;

        receiptList.appendChild(card);
    });
}

function showMonthlyBreakdown(receipts) {
    const monthlyBreakdown = document.getElementById("monthlyBreakdown");
    monthlyBreakdown.innerHTML = "";

    if (receipts.length === 0) {
        monthlyBreakdown.innerHTML = `
            <article class="info-card">
                <span>No months</span>
                <strong>£0.00</strong>
                <p>Monthly totals appear here.</p>
            </article>
        `;
        return;
    }

    const monthlyTotals = {};

    receipts.forEach(receipt => {
        const date = new Date(receipt.date);
        if (isNaN(date.getTime())) return;

        const monthKey = date.toLocaleString("en-GB", {
            month: "long",
            year: "numeric"
        });

        monthlyTotals[monthKey] =
            (monthlyTotals[monthKey] || 0) + (parseFloat(receipt.total) || 0);
    });

    Object.keys(monthlyTotals).forEach(month => {
        const card = document.createElement("article");
        card.className = "info-card";

        card.innerHTML = `
            <span>${month}</span>
            <strong>£${monthlyTotals[month].toFixed(2)}</strong>
            <p>Total detected spending</p>
        `;

        monthlyBreakdown.appendChild(card);
    });
}

async function loadMonthlyAIReview() {
    const receipts = getReceipts();
    const panel = document.getElementById("monthlyAIReview");

    if (!panel) return;

    if (receipts.length === 0) {
        panel.innerHTML = `
            <h3>No monthly review yet</h3>
            <p>Upload receipts first to generate your monthly AI review.</p>
        `;
        return;
    }

    const cacheKey = "monthlyInsightsCache";
    const cachedRaw = localStorage.getItem(cacheKey);

    if (cachedRaw) {
        try {
            const cached = JSON.parse(cachedRaw);
            if (cached.receiptCount === receipts.length) {
                renderMonthlyAIReview(cached.review);
                return;
            }
        } catch {}
    }

    panel.innerHTML = `
        <h3>Analysing monthly spending...</h3>
        <p>FinSmart is reviewing ${receipts.length} receipt(s) and generating your saving plan.</p>
    `;

    try {
        const response = await fetch(`${API_BASE}/monthly-insights`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receipts })
        });

        const data = await response.json();

        if (!data.monthlyInsights) throw new Error("No monthly insights returned");

        localStorage.setItem(cacheKey, JSON.stringify({
            receiptCount: receipts.length,
            review: data.monthlyInsights
        }));

        renderMonthlyAIReview(data.monthlyInsights);

    } catch (error) {
        console.log(error);
        panel.innerHTML = `
            <h3>Monthly Review</h3>
            <p>Monthly AI review could not be generated right now. Individual receipt insights are still saved.</p>
        `;
    }
}

function renderMonthlyAIReview(review) {
    const panel = document.getElementById("monthlyAIReview");

    const planHTML = (review.savingPlan || []).map(step => `
        <li>${escapeHTML(step)}</li>
    `).join("");

    panel.innerHTML = `
        <div class="monthly-review-top">
            <div>
                <h3>Monthly Smart Review</h3>
                <p>${escapeHTML(review.monthlySummary || "Your receipts have been reviewed.")}</p>
            </div>

            <div class="monthly-score-card">
                <strong>${review.monthlyScore || 75}</strong>
                <span>/100</span>
            </div>
        </div>

        <div class="monthly-stats">
            <div>
                <span>Biggest Category</span>
                <strong>${escapeHTML(review.biggestCategory || "General")}</strong>
            </div>

            <div>
                <span>Needs / Wants</span>
                <strong>${review.needsPercent || 70}% / ${review.wantsPercent || 30}%</strong>
            </div>

            <div>
                <span>Saving Target</span>
                <strong>£${parseFloat(review.savingTarget || 0).toFixed(2)}</strong>
            </div>
        </div>

        <div class="saving-plan">
            <h4>Saving Plan</h4>
            <ul>${planHTML || "<li>Upload more receipts to create a stronger saving plan.</li>"}</ul>
        </div>
    `;
}

function formatDate(dateValue) {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue || "Unknown date";
    return date.toLocaleDateString("en-GB");
}

function drawPieChart(needs, wants) {
    const canvas = document.getElementById("pie");
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const total = needs + wants;
    const needsRatio = total > 0 ? needs / total : 0.7;
    const wantsRatio = 1 - needsRatio;

    const centerX = canvas.width / 2;
    const centerY = 132;
    const radius = 78;
    const start = -Math.PI / 2;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, start, start + Math.PI * 2 * needsRatio);
    ctx.fillStyle = "#F7F8E5";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, start + Math.PI * 2 * needsRatio, start + Math.PI * 2);
    ctx.fillStyle = "#6D6A61";
    ctx.fill();

    ctx.fillStyle = "#F7F8E5";
    ctx.font = "600 14px Inter";
    ctx.fillText(`Needs ${Math.round(needsRatio * 100)}%`, 80, 265);
    ctx.fillText(`Wants ${Math.round(wantsRatio * 100)}%`, 330, 265);
}

function drawLineChart(receipts) {
    const canvas = document.getElementById("line");
    const ctx = canvas.getContext("2d");
    const monthlyTotals = {};

    receipts.forEach(receipt => {
        const date = new Date(receipt.date);
        if (isNaN(date.getTime())) return;

        const key = date.toLocaleString("default", { month: "short" });
        monthlyTotals[key] = (monthlyTotals[key] || 0) + (parseFloat(receipt.total) || 0);
    });

    const labels = Object.keys(monthlyTotals);
    const values = Object.values(monthlyTotals);

    const data = values.length ? values : [0, 0, 0, 0, 0, 0];
    const monthLabels = labels.length ? labels : ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

    drawLineCanvas(canvas, ctx, data, monthLabels);
}

function drawLineCanvas(canvas, ctx, data, labels) {
    const padding = 54;
    const width = canvas.width;
    const height = canvas.height;
    const maxValue = Math.max(...data, 100);

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(247,248,229,0.12)";
    ctx.lineWidth = 1;

    for (let i = 0; i < 4; i++) {
        const y = padding + i * ((height - padding * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

    ctx.strokeStyle = "#F7F8E5";
    ctx.lineWidth = 3;
    ctx.beginPath();

    data.forEach((value, index) => {
        const x = data.length > 1 ? padding + index * stepX : width / 2;
        const y = height - padding - (value / maxValue) * (height - padding * 2);

        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();

    data.forEach((value, index) => {
        const x = data.length > 1 ? padding + index * stepX : width / 2;
        const y = height - padding - (value / maxValue) * (height - padding * 2);

        ctx.fillStyle = "#F7F8E5";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(247,248,229,0.72)";
        ctx.font = "600 12px Inter";
        ctx.fillText(labels[index], x - 10, height - 18);
    });
}

function confirmClearReceipts() {
    const confirmed = confirm("Clear all saved receipt data?");
    if (confirmed) {
        localStorage.removeItem("receipts");
        localStorage.removeItem("monthlyInsightsCache");
        loadInsights();
        loadMonthlyAIReview();
    }
}

function escapeHTML(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

loadInsights();
loadMonthlyAIReview();

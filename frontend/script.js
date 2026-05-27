const fileInput = document.getElementById("receiptUpload");
const loadingModal = document.getElementById("loadingModal");
const loadingText = document.getElementById("loadingText");
const confirmModal = document.getElementById("confirmModal");
const successModal = document.getElementById("successModal");
const savedReceiptInfo = document.getElementById("savedReceiptInfo");
const uploadSummaryText = document.getElementById("uploadSummaryText");
const viewInsightsBtn = document.getElementById("viewInsightsBtn");
const addMoreBtn = document.getElementById("addMoreBtn");

const API_BASE = "https://finsmart-backend-4zge.onrender.com";

let pendingReceipts = [];

fileInput.addEventListener("change", uploadReceipts);

viewInsightsBtn.addEventListener("click", () => {
    window.location.href = "insights.html";
});

addMoreBtn.addEventListener("click", () => {
    successModal.style.display = "none";
    fileInput.value = "";

    setTimeout(() => {
        fileInput.click();
    }, 200);
});

async function uploadReceipts(event) {
    const files = Array.from(event.target.files);

    if (!files.length) {
        return;
    }

    pendingReceipts = [];
    loadingModal.style.display = "flex";

    for (let i = 0; i < files.length; i++) {
        loadingText.textContent =
            `Processing receipt ${i + 1} of ${files.length}...`;

        await uploadSingleReceipt(files[i]);
    }

    loadingModal.style.display = "none";

    if (pendingReceipts.length > 0) {
        showConfirmModal();
    } else {
        alert("No receipts were processed. Please try a smaller image.");
    }
}

async function uploadSingleReceipt(file) {
    const formData = new FormData();

    try {
        loadingText.textContent =
            "Preparing receipt image for upload...";

        const uploadFile = await resizeImageForUpload(file);

        formData.append("receipt", uploadFile, "receipt.jpg");

        loadingText.textContent =
            "Uploading and reading receipt. This may take a moment on Render...";

        const response = await fetch(`${API_BASE}/upload`, {
            method: "POST",
            body: formData
        });

        const responseText = await response.text();

        let data;

        try {
            data = JSON.parse(responseText);
        } catch {
            throw new Error(responseText || "Server returned an invalid response");
        }

        if (!response.ok) {
            throw new Error(data.error || "Server response failed");
        }

        if (!data.receipt) {
            throw new Error("No receipt returned from backend");
        }

        pendingReceipts.push({
            receipt: data.receipt,
            insights: data.insights || null
        });

    } catch (error) {
        console.log("UPLOAD ERROR:", error);

        alert(
            "One receipt failed to process. Please check Render logs or try a clearer image."
        );
    }
}

function showConfirmModal() {
    confirmModal.innerHTML = `
        <div class="modal-box">
            <span class="eyebrow dark">Review before saving</span>

            <h2>
                Confirm ${pendingReceipts.length}
                receipt${pendingReceipts.length > 1 ? "s" : ""}
            </h2>

            <p class="small-muted">
                OCR is powerful but not perfect. Please check every receipt before saving.
            </p>

            <div class="confirm-list" id="confirmReceiptList"></div>

            <div class="modal-actions">
                <button class="btn" id="saveAllReceiptsBtn">
                    Save All Receipts
                </button>

                <button class="btn btn-dark" id="cancelAllReceiptsBtn">
                    Cancel
                </button>
            </div>
        </div>
    `;

    const list = document.getElementById("confirmReceiptList");

    pendingReceipts.forEach((item, index) => {
        const receipt = item.receipt;
        const row = document.createElement("div");

        row.className = "confirm-receipt-row";

        row.innerHTML = `
            <h4>Receipt ${index + 1}</h4>

            <div class="confirm-grid">
                <label>
                    Store
                    <input
                        class="confirm-store"
                        type="text"
                        value="${escapeHTML(receipt.store || "Unknown Store")}"
                    />
                </label>

                <label>
                    Date
                    <input
                        class="confirm-date"
                        type="date"
                        value="${toInputDate(receipt.date)}"
                    />
                </label>

                <label>
                    Total
                    <input
                        class="confirm-total"
                        type="number"
                        step="0.01"
                        value="${parseFloat(receipt.total || 0).toFixed(2)}"
                    />
                </label>
            </div>

            <details>
                <summary>View OCR text</summary>
                <p class="ocr-preview">
                    ${escapeHTML((receipt.rawText || "No OCR text").slice(0, 1000))}
                </p>
            </details>
        `;

        list.appendChild(row);
    });

    document
        .getElementById("saveAllReceiptsBtn")
        .addEventListener("click", saveConfirmedReceipts);

    document
        .getElementById("cancelAllReceiptsBtn")
        .addEventListener("click", () => {
            pendingReceipts = [];
            confirmModal.style.display = "none";
        });

    confirmModal.style.display = "flex";
}

function saveConfirmedReceipts() {
    const rows = document.querySelectorAll(".confirm-receipt-row");

    let savedCount = 0;
    let duplicateCount = 0;

    rows.forEach((row, index) => {
        const item = pendingReceipts[index];

        const confirmedReceipt = {
            ...item.receipt,
            store:
                row.querySelector(".confirm-store").value.trim() ||
                "Unknown Store",
            date:
                row.querySelector(".confirm-date").value ||
                new Date().toISOString(),
            total:
                parseFloat(row.querySelector(".confirm-total").value) ||
                0
        };

        const saved = saveReceipt(
            confirmedReceipt,
            item.insights
        );

        if (saved) {
            savedCount++;
        } else {
            duplicateCount++;
        }
    });

    pendingReceipts = [];
    confirmModal.style.display = "none";

    showSuccessModal(savedCount, duplicateCount);
}

function saveReceipt(receipt, insights) {
    const receipts =
        JSON.parse(localStorage.getItem("receipts")) || [];

    const cleanReceipt = {
        id:
            crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now() + Math.random()),
        store: receipt.store || "Unknown Store",
        date: receipt.date || new Date().toISOString(),
        total: parseFloat(receipt.total) || 0,
        rawText: receipt.rawText || "",
        items: receipt.items || [],
        insights: insights || {},
        uploadedAt: new Date().toISOString()
    };

    const duplicate = receipts.find(existingReceipt =>
        String(existingReceipt.store).toLowerCase() ===
            String(cleanReceipt.store).toLowerCase() &&
        existingReceipt.date === cleanReceipt.date &&
        Number(existingReceipt.total).toFixed(2) ===
            Number(cleanReceipt.total).toFixed(2)
    );

    if (duplicate) {
        return false;
    }

    receipts.push(cleanReceipt);

    localStorage.setItem(
        "receipts",
        JSON.stringify(receipts)
    );

    localStorage.removeItem("monthlyInsightsCache");

    return true;
}

function showSuccessModal(savedCount, duplicateCount) {
    successModal.style.display = "flex";

    savedReceiptInfo.textContent =
        `${savedCount} receipt(s) saved successfully` +
        `${duplicateCount ? `, ${duplicateCount} duplicate(s) skipped` : ""}.`;

    updateUploadSummary();
}

function updateUploadSummary() {
    const receipts =
        JSON.parse(localStorage.getItem("receipts")) || [];

    const total = receipts.reduce(
        (sum, receipt) => sum + (parseFloat(receipt.total) || 0),
        0
    );

    uploadSummaryText.textContent =
        `${receipts.length} receipt(s) saved so far. ` +
        `Total detected spending: £${total.toFixed(2)}.`;
}

function toInputDate(value) {
    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return new Date().toISOString().split("T")[0];
    }

    return date.toISOString().split("T")[0];
}

function escapeHTML(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function resizeImageForUpload(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
            resolve(file);
            return;
        }

        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);

            const maxSide = 1400;
            const scale = Math.min(
                1,
                maxSide / Math.max(image.width, image.height)
            );

            const canvas = document.createElement("canvas");

            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);

            const ctx = canvas.getContext("2d");

            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                blob => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }

                    resolve(blob);
                },
                "image/jpeg",
                0.82
            );
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Could not prepare image for upload"));
        };

        image.src = objectUrl;
    });
}

function drawPreviewCharts() {
    const pieCanvas = document.getElementById("previewPie");

    if (!pieCanvas) {
        return;
    }

    const pie = pieCanvas.getContext("2d");

    const centerX = pieCanvas.width / 2;
    const centerY = 135;
    const radius = 78;

    pie.clearRect(0, 0, pieCanvas.width, pieCanvas.height);

    pie.beginPath();
    pie.moveTo(centerX, centerY);
    pie.arc(
        centerX,
        centerY,
        radius,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * 0.68
    );
    pie.fillStyle = "#F7F8E5";
    pie.fill();

    pie.beginPath();
    pie.moveTo(centerX, centerY);
    pie.arc(
        centerX,
        centerY,
        radius,
        -Math.PI / 2 + Math.PI * 2 * 0.68,
        -Math.PI / 2 + Math.PI * 2
    );
    pie.fillStyle = "#6D6A61";
    pie.fill();

    pie.font = "600 15px Inter";
    pie.fillStyle = "#F7F8E5";
    pie.fillText("Needs 68%", 80, 265);
    pie.fillText("Wants 32%", 330, 265);

    const lineCanvas = document.getElementById("previewLine");

    if (!lineCanvas) {
        return;
    }

    drawLineCanvas(
        lineCanvas,
        lineCanvas.getContext("2d"),
        [45, 90, 72, 130, 98, 160],
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    );
}

function drawLineCanvas(canvas, ctx, data, labels) {
    const padding = 52;
    const width = canvas.width;
    const height = canvas.height;
    const max = Math.max(...data, 100);

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(247,248,229,.14)";
    ctx.lineWidth = 1;

    for (let i = 0; i < 4; i++) {
        const y = padding + i * ((height - padding * 2) / 3);

        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    const step =
        data.length > 1
            ? (width - padding * 2) / (data.length - 1)
            : 0;

    ctx.strokeStyle = "#F7F8E5";
    ctx.lineWidth = 4;
    ctx.beginPath();

    data.forEach((value, index) => {
        const x =
            data.length > 1
                ? padding + index * step
                : width / 2;

        const y =
            height -
            padding -
            (value / max) * (height - padding * 2);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    data.forEach((value, index) => {
        const x =
            data.length > 1
                ? padding + index * step
                : width / 2;

        const y =
            height -
            padding -
            (value / max) * (height - padding * 2);

        ctx.fillStyle = "#F7F8E5";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(247,248,229,.72)";
        ctx.font = "600 13px Inter";
        ctx.fillText(labels[index], x - 12, height - 18);
    });
}

drawPreviewCharts();
updateUploadSummary();
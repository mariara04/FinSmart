const fileInput =
    document.getElementById("receiptUpload");

const loadingModal =
    document.getElementById("loadingModal");

const loadingText =
    document.getElementById("loadingText");

const confirmModal =
    document.getElementById("confirmModal");

const successModal =
    document.getElementById("successModal");

const savedReceiptInfo =
    document.getElementById("savedReceiptInfo");

const uploadSummaryText =
    document.getElementById("uploadSummaryText");

const viewInsightsBtn =
    document.getElementById("viewInsightsBtn");

const addMoreBtn =
    document.getElementById("addMoreBtn");

/* =========================================
   RENDER BACKEND URL
========================================= */

const API_BASE =
    "https://finsmart-backend-4zge.onrender.com";

let pendingReceipts = [];

/* =========================================
   EVENTS
========================================= */

fileInput.addEventListener(
    "change",
    uploadReceipts
);

viewInsightsBtn.addEventListener(
    "click",
    () => {
        window.location.href =
            "insights.html";
    }
);

addMoreBtn.addEventListener(
    "click",
    () => {
        successModal.style.display =
            "none";

        fileInput.value = "";

        setTimeout(() => {
            fileInput.click();
        }, 200);
    }
);

/* =========================================
   UPLOAD RECEIPTS
========================================= */

async function uploadReceipts(event) {

    const files = Array.from(
        event.target.files
    );

    if (!files.length) {
        return;
    }

    pendingReceipts = [];

    loadingModal.style.display =
        "flex";

    for (let i = 0; i < files.length; i++) {

        loadingText.textContent =
            `Processing receipt ${i + 1} of ${files.length}...`;

        await uploadSingleReceipt(files[i]);
    }

    loadingModal.style.display =
        "none";

    if (pendingReceipts.length) {
        showConfirmModal();
    }
}

async function uploadSingleReceipt(file) {

    const formData = new FormData();

    formData.append("receipt", file);

    try {

        const response = await fetch(
            `${API_BASE}/upload`,
            {
                method: "POST",
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error(
                "Server response failed"
            );
        }

        const data = await response.json();

        if (!data.receipt) {
            throw new Error(
                "No receipt returned"
            );
        }

        pendingReceipts.push({
            receipt: data.receipt,
            insights: data.insights || null
        });

    } catch (error) {

        console.log(
            "UPLOAD ERROR:",
            error
        );

        alert(
            "One receipt failed to process. Check your backend logs."
        );
    }
}

/* =========================================
   CONFIRM MODAL
========================================= */

function showConfirmModal() {

    confirmModal.innerHTML = `
        <div class="modal-box">

            <span class="eyebrow dark">
                Review before saving
            </span>

            <h2>
                Confirm ${pendingReceipts.length}
                receipt${pendingReceipts.length > 1 ? "s" : ""}
            </h2>

            <p class="small-muted">
                OCR is powerful but not perfect.
                Please check every receipt before saving.
            </p>

            <div
                class="confirm-list"
                id="confirmReceiptList"
            ></div>

            <div class="modal-actions">

                <button
                    class="btn"
                    id="saveAllReceiptsBtn"
                >
                    Save All Receipts
                </button>

                <button
                    class="btn btn-dark"
                    id="cancelAllReceiptsBtn"
                >
                    Cancel
                </button>

            </div>

        </div>
    `;

    const list =
        document.getElementById(
            "confirmReceiptList"
        );

    pendingReceipts.forEach(
        (item, index) => {

            const receipt =
                item.receipt;

            const row =
                document.createElement("div");

            row.className =
                "confirm-receipt-row";

            row.innerHTML = `
                <h4>
                    Receipt ${index + 1}
                </h4>

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

                    <summary>
                        View OCR text
                    </summary>

                    <p class="ocr-preview">
                        ${escapeHTML(
                            (receipt.rawText || "No OCR text")
                                .slice(0, 1000)
                        )}
                    </p>

                </details>
            `;

            list.appendChild(row);
        }
    );

    document
        .getElementById(
            "saveAllReceiptsBtn"
        )
        .addEventListener(
            "click",
            saveConfirmedReceipts
        );

    document
        .getElementById(
            "cancelAllReceiptsBtn"
        )
        .addEventListener(
            "click",
            () => {
                pendingReceipts = [];

                confirmModal.style.display =
                    "none";
            }
        );

    confirmModal.style.display =
        "flex";
}

/* =========================================
   SAVE RECEIPTS
========================================= */

function saveConfirmedReceipts() {

    const rows =
        document.querySelectorAll(
            ".confirm-receipt-row"
        );

    let savedCount = 0;
    let duplicateCount = 0;

    rows.forEach((row, index) => {

        const item =
            pendingReceipts[index];

        const confirmedReceipt = {

            ...item.receipt,

            store:
                row.querySelector(
                    ".confirm-store"
                ).value.trim() ||
                "Unknown Store",

            date:
                row.querySelector(
                    ".confirm-date"
                ).value ||
                new Date().toISOString(),

            total:
                parseFloat(
                    row.querySelector(
                        ".confirm-total"
                    ).value
                ) || 0
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

    confirmModal.style.display =
        "none";

    showSuccessModal(
        savedCount,
        duplicateCount
    );
}
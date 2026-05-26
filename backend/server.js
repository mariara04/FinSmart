require("dotenv").config();

const fs = require("fs");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const { extractReceipt } = require("./receiptParser");
const {
    generateInsights,
    generateMonthlyInsights
} = require("./aiService");

const app = express();
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use(
    cors({
        origin: "*"
    })
);

app.use(express.json({ limit: "8mb" }));

app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

const upload = multer({
    dest: uploadDir
});

app.get("/", (req, res) => {
    res.json({
        name: "FinSmart API",
        status: "running"
    });
});

app.post("/upload", upload.single("receipt"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "No file uploaded"
            });
        }

        console.log("FILE RECEIVED:", req.file.path);

        const receipt = await extractReceipt(req.file.path);

        console.log("PARSED RECEIPT:", receipt);

        const insights = await generateInsights(receipt);

        console.log("AI INSIGHTS:", insights);

        return res.json({
            success: true,
            receipt,
            insights
        });

    } catch (error) {
        console.log("SERVER ERROR:", error);

        return res.status(500).json({
            error: "Processing failed"
        });
    }
});

app.post("/monthly-insights", async (req, res) => {
    try {
        const receipts = req.body.receipts || [];

        if (!Array.isArray(receipts) || receipts.length === 0) {
            return res.status(400).json({
                error: "No receipts provided"
            });
        }

        const monthlyInsights = await generateMonthlyInsights(receipts);

        return res.json({
            success: true,
            monthlyInsights
        });

    } catch (error) {
        console.log("MONTHLY INSIGHTS ERROR:", error);

        return res.status(500).json({
            error: "Monthly insight generation failed"
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`FinSmart backend running on port ${PORT}`);
});
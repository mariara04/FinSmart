const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const path = require("path");

async function extractReceipt(filePath) {
    const processedPath = await preprocessImage(filePath);

    const result = await Tesseract.recognize(processedPath, "eng");

    const text = result.data.text || "";

    console.log("OCR TEXT:");
    console.log(text);

    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return {
        store: extractStore(lines, text),
        date: extractDate(text),
        total: extractTotal(text),
        items: extractItems(lines),
        rawText: text
    };
}

async function preprocessImage(filePath) {
    const outputPath = path.join(
        __dirname,
        "uploads",
        "processed-" + Date.now() + ".png"
    );

    await sharp(filePath)
        .rotate()
        .grayscale()
        .normalize()
        .modulate({
            brightness: 1.08,
            contrast: 1.25
        })
        .sharpen()
        .resize({
            width: 2200,
            withoutEnlargement: true
        })
        .png()
        .toFile(outputPath);

    return outputPath;
}

function extractStore(lines, text) {
    const lowerText = text.toLowerCase();

    const storePatterns = [
        {
            name: "Morrisons",
            patterns: [
                "morrisons",
                "morrison",
                "wm morrison",
                "morrison supermarkets",
                "wm morrison supermarkets"
            ]
        },
        {
            name: "Primark",
            patterns: [
                "primark",
                "primark stores"
            ]
        },
        {
            name: "Tesco",
            patterns: ["tesco"]
        },
        {
            name: "Asda",
            patterns: ["asda"]
        },
        {
            name: "Sainsbury's",
            patterns: ["sainsbury", "sainsburys"]
        },
        {
            name: "Aldi",
            patterns: ["aldi"]
        },
        {
            name: "Lidl",
            patterns: ["lidl"]
        },
        {
            name: "Boots",
            patterns: ["boots"]
        },
        {
            name: "Superdrug",
            patterns: ["superdrug"]
        }
    ];

    for (const store of storePatterns) {
        for (const pattern of store.patterns) {
            if (lowerText.includes(pattern)) {
                return store.name;
            }
        }
    }

    const badWords = [
        "receipt",
        "invoice",
        "vat",
        "tax",
        "total",
        "card",
        "visa",
        "payment",
        "customer",
        "manager",
        "store",
        "number",
        "telephone",
        "merchant",
        "balance",
        "sale",
        "date",
        "time",
        "till",
        "auth",
        "contactless"
    ];

    for (const line of lines.slice(0, 15)) {
        const cleaned = cleanStoreName(line);
        const lower = cleaned.toLowerCase();

        if (
            cleaned.length > 2 &&
            cleaned.length < 40 &&
            !badWords.some(word => lower.includes(word)) &&
            !/\d{2}[\/\-]\d{2}/.test(cleaned) &&
            !/£|\$|\d+[.,]\d{2}/.test(cleaned)
        ) {
            return cleaned;
        }
    }

    return "Unknown Store";
}

function cleanStoreName(name) {
    return name
        .replace(/[^a-zA-Z0-9&.'\-\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function extractDate(text) {
    const patterns = [
        /\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/,
        /\b\d{2}[\/\-]\d{2}[\/\-]\d{2}\b/,
        /\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match) {
            return normalizeDate(match[0]);
        }
    }

    return new Date().toISOString();
}

function normalizeDate(dateText) {
    if (/^\d{4}/.test(dateText)) {
        return dateText;
    }

    const parts = dateText.split(/[\/\-]/);

    if (parts.length === 3) {
        let day = parts[0].padStart(2, "0");
        let month = parts[1].padStart(2, "0");
        let year = parts[2];

        if (year.length === 2) {
            const yearNumber = parseInt(year, 10);
            year = yearNumber > 50 ? "19" + year : "20" + year;
        }

        return `${year}-${month}-${day}`;
    }

    return dateText;
}

function extractTotal(text) {
    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const priorityCandidates = [];

    lines.forEach((line, index) => {
        const lower = line.toLowerCase();

        if (
            lower.includes("balance before deductions") ||
            lower.includes("balance") ||
            lower.includes("total") ||
            lower.includes("visa") ||
            lower.includes("card")
        ) {
            const amounts = line.match(/£?\s*\d{1,5}[.,]\d{2}/g);

            if (amounts) {
                amounts.forEach(amount => {
                    priorityCandidates.push(cleanMoney(amount));
                });
            }

            const nextLine = lines[index + 1] || "";
            const nextAmounts = nextLine.match(/£?\s*\d{1,5}[.,]\d{2}/g);

            if (nextAmounts && lower.includes("total")) {
                nextAmounts.forEach(amount => {
                    priorityCandidates.push(cleanMoney(amount));
                });
            }
        }
    });

    if (priorityCandidates.length > 0) {
        return Math.max(...priorityCandidates);
    }

    const allAmounts = text.match(/£?\s*\d{1,5}[.,]\d{2}/g);

    if (!allAmounts) {
        return 0;
    }

    const numbers = allAmounts
        .map(amount => cleanMoney(amount))
        .filter(num => num > 0 && num < 10000);

    return numbers.length ? Math.max(...numbers) : 0;
}

function cleanMoney(value) {
    return parseFloat(
        String(value)
            .replace("£", "")
            .replace("$", "")
            .replace(",", ".")
            .replace(/\s/g, "")
            .trim()
    ) || 0;
}

function extractItems(lines) {
    const items = [];

    lines.forEach(line => {
        const lower = line.toLowerCase();

        const hasAmount =
            /£?\s*\d{1,5}[.,]\d{2}/.test(line);

        const isNotSummary =
            !lower.includes("total") &&
            !lower.includes("balance") &&
            !lower.includes("card") &&
            !lower.includes("payment") &&
            !lower.includes("change") &&
            !lower.includes("visa") &&
            !lower.includes("vat") &&
            !lower.includes("auth") &&
            !lower.includes("merchant") &&
            !lower.includes("telephone") &&
            !lower.includes("thank you");

        if (hasAmount && isNotSummary) {
            items.push(line);
        }
    });

    return items;
}

module.exports = {
    extractReceipt
};
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function generateInsights(receipt) {
    if (process.env.DEMO_MODE === "true") {
        return fallbackReceiptInsight(receipt);
    }

    if (!process.env.GEMINI_API_KEY) {
        return fallbackReceiptInsight(receipt);
    }

    try {

        const prompt = `
You are FinSmart, a friendly and professional student finance assistant.

Analyse ONE receipt.

Receipt:
Store: ${receipt.store || "Unknown Store"}
Date: ${receipt.date || "Unknown Date"}
Total: £${receipt.total || 0}

Detected item lines:
${Array.isArray(receipt.items) && receipt.items.length > 0
    ? receipt.items.join("\n")
    : "No clear item lines detected"}

Raw OCR:
${receipt.rawText || "No OCR text"}

Return ONLY valid JSON:

{
  "category": "Food / Clothing / Entertainment / Household / Transport / Health / Subscriptions / Other",
  "needsPercent": number,
  "wantsPercent": number,
  "financeScore": number,
  "insight": "professional summary of this receipt",
  "savingAmount": number,
  "savingAction": "specific action to save this amount next time",
  "categories": [
    {
      "name": "Food",
      "amount": number,
      "type": "need or want",
      "reason": "why"
    }
  ],
  "items": [
    {
      "name": "item name",
      "estimatedCategory": "Food / Clothing / Entertainment / Household / Transport / Health / Subscriptions / Other",
      "type": "need or want"
    }
  ]
}

Rules:
- needsPercent + wantsPercent must equal 100
- financeScore must be 0-100
- Category amounts must add approximately to the receipt total
- If item prices are visible, use them
- If unclear, estimate
- Groceries basics are needs; treats are wants
- Clothing essentials may be need; extra/fashion is usually want
- savingAction must explain HOW to save
- Mention if OCR appears unclear
- No professional financial advice
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
        });

        return JSON.parse(cleanAIJson(response.text));

    } catch (error) {

        console.log("GEMINI RECEIPT ERROR:", error);

        return fallbackReceiptInsight(receipt);
    }
}

async function generateMonthlyInsights(receipts) {

    if (!process.env.GEMINI_API_KEY) {
        return fallbackMonthlyInsight(receipts);
    }

    try {

        const prompt = `
You are FinSmart, a student budgeting assistant.

Analyse this month's receipts together and create a professional monthly spending review.

Receipts JSON:
${JSON.stringify(receipts, null, 2)}

Return ONLY valid JSON:

{
  "monthlySummary": "short clear monthly summary",
  "biggestCategory": "category name",
  "spendingPattern": "what pattern you notice",
  "needsPercent": number,
  "wantsPercent": number,
  "monthlyScore": number,
  "savingTarget": number,
  "savingPlan": [
    "specific action 1",
    "specific action 2",
    "specific action 3"
  ],
  "categoryTotals": [
    {
      "name": "Food",
      "amount": number,
      "type": "mostly need or mostly want"
    }
  ]
}

Rules:
- needsPercent + wantsPercent must equal 100
- monthlyScore 0-100
- categoryTotals must use all receipts
- savingTarget realistic
- Saving plan must explain HOW to save
- Useful for a student
- No professional financial advice
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
        });

        return JSON.parse(cleanAIJson(response.text));

    } catch (error) {

        console.log("GEMINI MONTHLY ERROR:", error);

        return fallbackMonthlyInsight(receipts);
    }
}

function cleanAIJson(text) {

    return String(text)
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
}

function fallbackReceiptInsight(receipt) {

    const total = parseFloat(receipt.total) || 0;

    const raw = String(receipt.rawText || "").toLowerCase();

    let category = "General shopping";
    let needsPercent = 70;
    let wantsPercent = 30;
    let categoryName = "General";

    if (
        raw.includes("morrisons") ||
        raw.includes("milk") ||
        raw.includes("chicken") ||
        raw.includes("rice")
    ) {
        category = "Food";
        categoryName = "Food";
        needsPercent = 76;
        wantsPercent = 24;
    }

    if (
        raw.includes("primark") ||
        raw.includes("cargo") ||
        raw.includes("clothing")
    ) {
        category = "Clothing";
        categoryName = "Clothing";
        needsPercent = 35;
        wantsPercent = 65;
    }

    const savingAmount = Number(
        Math.max(1, total * 0.08).toFixed(2)
    );

    const financeScore = Math.max(
        50,
        100 - Math.round(total / 4)
    );

    return {
        category,
        needsPercent,
        wantsPercent,
        financeScore,

        insight:
            `This receipt appears to be mainly ${category.toLowerCase()} spending.`,

        savingAmount,

        savingAction:
            `You could save around £${savingAmount.toFixed(2)} next time by choosing one cheaper alternative or skipping one flexible item.`,

        categories: [
            {
                name: categoryName,
                amount: Number(total.toFixed(2)),
                type:
                    needsPercent >= wantsPercent
                        ? "need"
                        : "want",

                reason:
                    "Fallback estimate based on receipt text and total."
            }
        ],

        items: []
    };
}

function fallbackMonthlyInsight(receipts) {

    const total = receipts.reduce(
        (s, r) => s + (parseFloat(r.total) || 0),
        0
    );

    const savingTarget = Number(
        (total * 0.1).toFixed(2)
    );

    return {

        monthlySummary:
            `You uploaded ${receipts.length} receipt(s) with total spending of £${total.toFixed(2)}.`,

        biggestCategory: "General",

        spendingPattern:
            "More receipt data will make spending patterns clearer.",

        needsPercent: 70,
        wantsPercent: 30,

        monthlyScore: 75,

        savingTarget,

        savingPlan: [
            `Set a weekly shopping limit and aim to reduce flexible spending by about £${savingTarget.toFixed(2)}.`,
            `Choose own-brand alternatives for repeat grocery items where possible.`,
            `Review clothing and treat purchases before checkout and remove one non-essential item.`
        ],

        categoryTotals: [
            {
                name: "General",
                amount: Number(total.toFixed(2)),
                type: "mixed"
            }
        ]
    };
}

module.exports = {
    generateInsights,
    generateMonthlyInsights
};
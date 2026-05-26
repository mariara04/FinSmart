# FinSmart Luxury

Premium OCR + AI receipt analysis web app.

## Features
- Premium landing page
- Multi-receipt upload
- OCR extraction with Tesseract.js
- Image preprocessing with Sharp
- Editable confirmation modal for every receipt
- Individual AI analysis per receipt
- Item category analysis
- Needs vs wants dashboard
- Monthly AI spending review
- LocalStorage data storage
- Fallback insights if Gemini API is unavailable

## Run backend
```bash
cd backend
npm install
npm run dev
```

## Run frontend
Open `frontend/index.html` with VS Code Live Server.

## Gemini API
Create `backend/.env` and add:
```env
PORT=5000
GEMINI_API_KEY=your_key_here
```
Never upload your real `.env` to GitHub.

## Clear old data
If you used an older version, open `frontend/insights.html` and click **Clear Data**, then upload fresh receipts.

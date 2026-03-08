# 🦇 BATS AI Interview Evaluator

**Full-stack AI-powered candidate evaluation system.**
Uses multiple FREE AI providers: Groq, Cerebras, Together AI, Google Gemini.

## Quick Start

### Step 1: Get a FREE AI API Key (at least one)

| Provider | Free Tier | Get Key |
|----------|-----------|---------|
| **Groq** (recommended) | 30 req/min, unlimited | https://console.groq.com |
| **Cerebras** | Ultra-fast inference | https://cloud.cerebras.ai |
| **Together AI** | Free trial credits | https://api.together.xyz |
| **Google Gemini** | 15 req/min free | https://aistudio.google.com/apikey |

### Step 2: Setup Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and paste your API key(s)
```

### Step 3: Run Backend

**IMPORTANT: You MUST be inside the `backend/` folder:**

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

⚠️ If you get `Could not import module "main"` → you are NOT inside `backend/`. Run `cd backend` first!

✅ Test: Open http://localhost:8000 → should show `{"message": "BATS AI Backend v2.0 is running"}`

### Step 4: Run Frontend

```bash
npm install
npm run dev
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Could not import module "main"` | `cd backend` then run uvicorn |
| "Failed to fetch" in frontend | Backend not running — start it first |
| No AI responses | Check API keys in `backend/.env` |

# 🤖 AutoAR: Autonomous Accounts Receivable & AI Negotiation OS
Built for the **Razorpay Buildathon 2026**

AutoAR is an intelligent, multi-agent financial middleware platform that replaces manual debt collection pipelines with autonomous AI negotiation and real-time Razorpay ledger tracking.

## 🚀 Key Innovation Pillars
1. **Dynamic Risk-Aware Reminders:** Orchestrates Groq (Llama 3 70B) to generate contextual email alerts embedding secure Razorpay links across escalations (Polite, Firm, Urgent).
2. **Autonomous Contract Restructuring:** Uses Llama 3 8B in structured JSON mode to parse defensive customer text streams. If financial stress is verified, the agent automatically restructures the agreement parameters, hits Razorpay APIs to authorize partial links (50% min threshold), and locks the record state in Postgres.
3. **Cryptographically Guarded Reconciliation:** Implements full HMAC SHA256 verification on incoming Razorpay Webhooks (`payment_link.paid`, `payment_link.partially_paid`) to protect financial state integrity against timing or injection attacks.

## ⚙️ Core Architecture Blueprint
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** FastAPI (Python), Uvicorn, Razorpay SDK, Groq SDK
- **Database:** Supabase PostgreSQL

## 🛠️ Step-by-Step Installation & Local Execution
1. Clone the repository and configure environment variables in `.env` and `frontend/.env.local`.
2. Spin up the Python engine:
   ```bash
   cd backend && pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```
3. Boot up the user interface:
   ```bash
   cd frontend && npm install
   npm run dev
   ```

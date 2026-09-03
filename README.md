# 🤖 AutoAR — Autonomous Accounts Receivable & AI Negotiation OS

> **Built for the Razorpay Buildathon 2026**
> An intelligent, multi-agent financial middleware platform that eliminates manual debt collection pipelines through autonomous AI negotiation, real-time ledger tracking, and cryptographically guarded payment reconciliation.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Local Setup](#-installation--local-setup)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [API Reference](#-api-reference)
- [Demo Guide](#-demo-guide)
- [Security](#-security)

---

## 🌐 Overview

AutoAR replaces traditional, human-driven accounts receivable (AR) workflows with a fully autonomous AI agent pipeline. From the moment an invoice is created, the system handles reminder escalation, real-time payment link generation, autonomous contract restructuring, and ledger reconciliation — all without human intervention.

---

## ✨ Key Features

### 1. 📊 Autonomous Invoice & Payment Link Generation
Create customer invoices directly from the dashboard. AutoAR immediately generates a live **Razorpay Payment Link** in sandbox mode, stores the record in Supabase PostgreSQL, and enables partial payments out of the box.

### 2. 🧠 Multilingual AI Reminder Dispatch Agent
Powered by **Groq (Llama 3 70B)**, the AI Reminder Agent generates contextual collection content in two formats simultaneously:
- **Email Body** — A formal, professional payment demand letter
- **WhatsApp Message** — A short, punchy, conversational message with emojis and a payment link, written natively in the customer's language

Supports: `English`, `Hinglish`, `Hindi`, `Tamil`, `Telugu`, `Kannada`

Escalation tones:
| Tone | Use Case |
|---|---|
| 🟢 Polite | Standard onboarding — first reminder |
| 🟡 Firm | Overdue & un-notified customers |
| 🔴 Urgent | Final payout breach — maximum pressure |

### 3. 💬 One-Click WhatsApp Redirect
After generating an AI message, click **"💬 WhatsApp"** on the Email card to instantly open WhatsApp Web or the WhatsApp app with the customer's number pre-dialled and the full message pre-filled. Zero copy-paste friction.

- Automatically normalises Indian phone numbers (adds `+91` country code if missing)
- Works on both mobile (opens native app) and desktop (opens WhatsApp Web)

### 4. 📧 Direct Email Dispatch
Send the AI-generated payment reminder directly to the customer's inbox with one click via SMTP (Gmail App Passwords supported). Falls back to a simulated delivery log if SMTP is not configured.

### 5. 🤝 Autonomous AI Negotiation Engine
Paste a customer's reply message into the **AI Negotiator** tab. The system uses **Groq (Llama 3 8B)** in structured JSON mode to evaluate financial stress signals. If distress is verified:

- Automatically restructures the agreement to a **50% split-payment plan**
- Generates a **new Razorpay Payment Link** with the partial amount threshold locked
- Updates the invoice status in Supabase to `PARTIAL_ALLOWED`
- Returns the new payment URL to the merchant dashboard instantly

### 6. 🔐 Cryptographically Guarded Webhook Reconciliation
Listens for live Razorpay webhook events (`payment_link.paid`, `payment_link.partially_paid`, `payment_link.cancelled`, `payment_link.expired`) and auto-updates invoice status in the ledger. All incoming webhooks are verified using **HMAC SHA-256** to guard against timing and injection attacks.

### 7. ⏳ Time-Travel Aging Simulator *(Developer/Demo Tool)*
A one-click tool on every invoice row that backdates its `created_at` timestamp by 10 days in Supabase. Purpose-built for demo scenarios where you need to show AI tone escalation from *Polite → Urgent* without waiting real calendar time.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Next.js 16)                   │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ Invoice Form │  │ Ledger Matrix  │  │  AI Agent Hub   │  │
│  │  (Razorpay)  │  │  (Supabase RT) │  │ Reminder | Nego │  │
│  └──────┬───────┘  └───────┬────────┘  └────────┬────────┘  │
└─────────┼──────────────────┼───────────────────┼────────────┘
          │ REST API          │ REST API           │ REST API
          ▼                  ▼                    ▼
┌──────────────────────────────────────────────────────────────┐
│               FastAPI Backend (Python / Uvicorn)             │
│                                                              │
│  /api/create-invoice      → Razorpay SDK + Supabase Insert  │
│  /api/ai-generate-reminder → Groq (Llama 3 70B) Inference   │
│  /api/send-email           → SMTP (Gmail) Dispatch          │
│  /api/ai-negotiate-terms   → Groq (Llama 3 8B) + Razorpay  │
│  /api/dev-simulate-aging   → Supabase timestamp backdate    │
│  /api/webhook/razorpay     → HMAC SHA-256 + Ledger Update  │
└──────┬───────────────┬──────────────────┬───────────────────┘
       │               │                  │
       ▼               ▼                  ▼
  ┌─────────┐   ┌────────────┐   ┌──────────────┐
  │Razorpay │   │  Supabase  │   │  Groq Cloud  │
  │  APIs   │   │ PostgreSQL │   │  Inference   │
  └─────────┘   └────────────┘   └──────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| **Backend** | FastAPI, Python 3.11+, Uvicorn |
| **AI / LLM** | Groq Cloud — `groq/compound` (Llama 3 70B), `groq/compound-mini` (Llama 3 8B) |
| **Payments** | Razorpay SDK (Payment Links, Partial Payments, Webhooks) |
| **Database** | Supabase (PostgreSQL) with in-memory fallback |
| **Email** | SMTP via Gmail (App Password auth) |
| **Security** | HMAC SHA-256 Webhook Signature Verification |

---

## 📁 Project Structure

```
automation/
├── backend/
│   ├── main.py              # FastAPI app — all API routes & business logic
│   ├── schema.sql           # Supabase PostgreSQL table + RLS policies
│   ├── requirements.txt     # Python dependencies
│   └── .gitignore
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Main dashboard — all UI components
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Global styles
│   ├── .env.local           # Frontend environment variables
│   ├── next.config.ts
│   └── postcss.config.mjs
├── .env                     # Backend environment variables
├── .gitignore
└── README.md
```

---

## ✅ Prerequisites

- **Python** 3.11 or higher
- **Node.js** 18 or higher + npm
- A **Razorpay** account (sandbox mode is sufficient)
- A **Supabase** project
- A **Groq** API key (free tier works)
- A **Gmail** account with an App Password (for email dispatch)

---

## 🚀 Installation & Local Setup

### Step 1 — Clone the Repository

```bash
git clone <your-repo-url>
cd automation
```

### Step 2 — Configure Environment Variables

Copy and fill in both environment files (see [Environment Variables](#-environment-variables) section below):

```bash
# Backend secrets
cp .env.example .env

# Frontend public config
cp frontend/.env.local.example frontend/.env.local
```

### Step 3 — Set Up the Database

1. Open your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
2. Paste and execute the contents of [`backend/schema.sql`](./backend/schema.sql)

This creates the `invoices` table with Row Level Security policies pre-configured.

### Step 4 — Start the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The FastAPI server will be available at `http://127.0.0.1:8000`.
Interactive API docs: `http://127.0.0.1:8000/docs`

### Step 5 — Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

---

## 🔑 Environment Variables

### Backend — `.env`

| Variable | Description |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay API Key ID (from Dashboard → API Keys) |
| `RAZORPAY_KEY_SECRET` | Razorpay API Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret set in Razorpay Dashboard |
| `GROQ_API_KEY` | Groq Cloud API Key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase `anon` (public) key |
| `SMTP_SERVER` | SMTP server hostname (default: `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (default: `587`) |
| `SMTP_USER` | Gmail address used for sending emails |
| `SMTP_PASSWORD` | Gmail App Password (not your login password) |

### Frontend — `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same Supabase `anon` key |
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL (default: `http://127.0.0.1:8000`) |

> **Note:** `SMTP_USER` and `SMTP_PASSWORD` are optional. If omitted, the system enters simulated email delivery mode and logs the event without actually sending.

---

## 🗄 Database Setup

Run the following in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS public.invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    customer_name     TEXT NOT NULL,
    customer_email    TEXT NOT NULL,
    customer_phone    TEXT NOT NULL,
    amount_paise      BIGINT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'PENDING',
    payment_link_id   TEXT,
    payment_link_url  TEXT
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"   ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.invoices FOR UPDATE USING (true);
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/invoices` | Fetch all invoices (Supabase + in-memory fallback) |
| `POST` | `/api/create-invoice` | Create invoice & generate Razorpay payment link |
| `POST` | `/api/ai-generate-reminder` | Generate multilingual AI reminder (email + WhatsApp) |
| `POST` | `/api/send-email` | Dispatch email reminder via SMTP |
| `POST` | `/api/ai-negotiate-terms` | Run AI negotiation engine on customer reply |
| `POST` | `/api/dev-simulate-aging` | *(Demo)* Backdate invoice `created_at` by 10 days |
| `POST` | `/api/webhook/razorpay` | Razorpay webhook receiver (HMAC-verified) |

Full interactive docs available at `http://127.0.0.1:8000/docs` when the backend is running.

---

## 🎬 Demo Guide

### Standard Flow
1. **Create Invoice** → Fill in customer name, email, phone, and amount → Click "Generate Payment Link"
2. **View Ledger** → Invoice appears as `PENDING` with a live Razorpay pay link
3. **AI Reminder** → Click "Agent Actions" → Select tone & language → Click "⚡ Run Multilingual Dispatch Agent"
4. **Dispatch** → Click "📧 Send Email" to dispatch via SMTP, or "💬 WhatsApp" to open WhatsApp with the message pre-filled
5. **Negotiation** → Switch to "🤝 AI Negotiator" tab → Paste a customer hardship reply → Run the engine → Watch the system auto-approve a split plan and generate a new Razorpay link

### Time-Travel Aging Demo (Judges' Highlight)
> *"Let me show you what happens when this client ignores us for 10 days."*

1. On any invoice row, click **⏳ Age +10d**
2. The invoice is backdated 10 days in the database
3. Re-open Agent Actions and run the AI Reminder with **Urgent** tone
4. Show judges the AI automatically escalates language, pressure, and urgency — no code changes required

---

## 🔐 Security

- **Webhook Signature Verification:** All incoming Razorpay webhook payloads are validated using `HMAC-SHA256` with a shared secret before any database mutation occurs. Requests with invalid signatures return `HTTP 400`.
- **In-Memory Fallback:** The backend maintains a local in-memory ledger that mirrors Supabase state. This ensures the application remains functional even if the database connection is temporarily unavailable.
- **No Secrets in Frontend:** All sensitive keys (Razorpay secret, Groq API key, SMTP credentials) are server-side only. The frontend only uses Supabase's public `anon` key.

---

<div align="center">

Built with ❤️ for the **Razorpay Buildathon 2026**

</div>

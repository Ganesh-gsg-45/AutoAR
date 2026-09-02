import os
import json
import hmac
import hashlib
import uuid
import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import razorpay
from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Enable CORS so your Next.js frontend can communicate with FastAPI freely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Clients
razorpay_client = razorpay.Client(auth=(os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET")))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# In-Memory fallback store for when Supabase table is not yet created
in_memory_ledger: dict[str, dict] = {}

def db_insert_invoice(data: dict) -> dict:
    rec_id = str(uuid.uuid4())
    record = {
        "id": rec_id,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        **data
    }
    try:
        res = supabase.table("invoices").insert(data).execute()
        if res.data and len(res.data) > 0:
            record = res.data[0]
            rec_id = record["id"]
    except Exception as err:
        print(f"[Supabase Notice] Could not insert to Supabase ({err}). Storing in local memory.")
    
    in_memory_ledger[rec_id] = record
    return record

def db_get_invoices() -> list[dict]:
    try:
        res = supabase.table("invoices").select("*").order("created_at", desc=True).execute()
        if res.data is not None and len(res.data) > 0:
            supa_ids = {r["id"] for r in res.data if "id" in r}
            extra = [v for k, v in in_memory_ledger.items() if k not in supa_ids]
            return extra + res.data
    except Exception as err:
        print(f"[Supabase Notice] Could not select from Supabase ({err}). Returning local memory.")
    return list(in_memory_ledger.values())

def db_get_invoice(invoice_id: str) -> dict | None:
    try:
        res = supabase.table("invoices").select("*").eq("id", invoice_id).single().execute()
        if res.data:
            return res.data
    except Exception as err:
        print(f"[Supabase Notice] Could not get invoice from Supabase ({err}).")
    return in_memory_ledger.get(invoice_id)

def db_update_invoice(invoice_id: str, update_data: dict):
    try:
        supabase.table("invoices").update(update_data).eq("id", invoice_id).execute()
    except Exception as err:
        print(f"[Supabase Notice] Could not update Supabase ({err}).")
    if invoice_id in in_memory_ledger:
        in_memory_ledger[invoice_id].update(update_data)


class InvoiceRequest(BaseModel):
    customer_name: str
    customer_email: str
    customer_phone: str
    amount_rupees: float

@app.get("/api/invoices")
async def get_all_invoices():
    return db_get_invoices()

@app.post("/api/create-invoice")
async def create_invoice_and_link(req: InvoiceRequest):
    try:
        amount_in_paise = int(req.amount_rupees * 100)
        
        # 1. Create Razorpay Payment Link in Sandbox Mode with Email Notifications Enabled
        payment_data = {
            "amount": amount_in_paise,
            "currency": "INR",
            "accept_partial": True, # Crucial for AI negotiation feature
            "first_min_partial_amount": int(amount_in_paise / 2),
            "description": f"Invoice for services rendered to {req.customer_name}",
            "customer": {
                "name": req.customer_name,
                "email": req.customer_email,
                "contact": req.customer_phone
            },
            "notify": {"sms": False, "email": True}, # Razorpay sends email to customer!
            "reminder_enable": True
        }
        
        razorpay_link = razorpay_client.payment_link.create(data=payment_data)
        
        # 2. Store records in Database (Supabase + In-Memory Fallback)
        db_data = {
            "customer_name": req.customer_name,
            "customer_email": req.customer_email,
            "customer_phone": req.customer_phone,
            "amount_paise": amount_in_paise,
            "status": "PENDING",
            "payment_link_id": razorpay_link["id"],
            "payment_link_url": razorpay_link["short_url"]
        }
        
        created_record = db_insert_invoice(db_data)
        
        return {
            "status": "success",
            "payment_url": razorpay_link["short_url"],
            "payment_link_id": razorpay_link["id"],
            "invoice": created_record
        }
        
    except Exception as e:
        print("Error creating invoice:", e)
        raise HTTPException(status_code=500, detail=str(e))

class AIQuery(BaseModel):
    customer_name: str
    amount_rupees: float
    payment_url: str
    tone: str # 'polite', 'firm', or 'urgent'
    language: str = "Hinglish" # 'English', 'Hinglish', 'Hindi', 'Tamil', 'Telugu', etc.

@app.post("/api/ai-generate-reminder")
async def generate_reminder(req: AIQuery):
    try:
        system_prompt = f"""
        You are an AI financial collection agent operating in the Indian market.
        The client {req.customer_name} owes ₹{req.amount_rupees}.
        The escalation priority tone is {req.tone}.
        The customer's preferred communication language is {req.language}.
        
        Generate a response in strict JSON format with two keys:
        1. "email_body": A professional collection letter in English.
        2. "whatsapp_body": A short, punchy message optimized for WhatsApp in the requested language ({req.language}). It MUST include the payment link explicitly: {req.payment_url}. Keep it friendly but clear. Use conversational phrasing (e.g., if Hinglish, write like a standard chat message with emojis).
        """
        
        completion = groq_client.chat.completions.create(
            model="groq/compound",
            messages=[{"role": "user", "content": system_prompt}],
            temperature=0.5,
        )
        
        content = completion.choices[0].message.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        parsed = json.loads(content)
        return parsed
        
    except Exception as e:
        print("Error generating AI reminder:", e)
        return {
            "email_body": f"Dear {req.customer_name},\n\nThis is a {req.tone} reminder regarding your outstanding invoice balance of ₹{req.amount_rupees}.\n\nPlease complete your payment securely here: {req.payment_url}\n\nThank you,\nFinance Team",
            "whatsapp_body": f"Hi {req.customer_name}! Friendly reminder regarding your invoice of ₹{req.amount_rupees}. Pay here securely: {req.payment_url}"
        }


class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str

@app.post("/api/send-email")
async def send_email(req: SendEmailRequest):
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")

    if not smtp_user or not smtp_password:
        return {
            "status": "simulated",
            "message": f"Simulated delivery to {req.to_email}. (To send actual emails to real inboxes, add SMTP_USER and SMTP_PASSWORD to your .env file)"
        }
    
    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = req.to_email
        msg['Subject'] = req.subject
        msg.attach(MIMEText(req.body, 'plain'))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, req.to_email, msg.as_string())
        server.quit()
        return {"status": "success", "message": f"Email successfully delivered to {req.to_email}"}
    except Exception as e:
        print("SMTP Dispatch Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


class NegotiationRequest(BaseModel):
    invoice_id: str
    customer_reply: str  # e.g., "I can't pay ₹5,000 all at once, can I split it?"

@app.post("/api/ai-negotiate-terms")
async def negotiate_invoice(req: NegotiationRequest):
    # 1. Pull current invoice details
    invoice = db_get_invoice(req.invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice record not found")

    original_amount = invoice["amount_paise"] / 100

    # 2. Use Groq to evaluate the customer's text stream dynamically
    system_prompt = f"""
    You are an AI FinTech Accounts Receivable Assistant. A customer owes ₹{original_amount}.
    They sent this message: "{req.customer_reply}".

    Evaluate their message. If they mention difficulty paying or ask for a payment plan,
    you are authorized to offer splitting the balance into two equal installments.

    Respond in strict JSON format with exactly two keys:
    1. "reply": A short, empathetic but professional message confirming the micro-payment terms.
    2. "action": Either "STAY_FIRM" or "SPLIT_PAYMENT".
    """

    completion = groq_client.chat.completions.create(
        model="groq/compound-mini",
        messages=[{"role": "user", "content": system_prompt}],
    )

    content = completion.choices[0].message.content
    # Clean potential markdown formatting from JSON response
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()

    ai_decision = json.loads(content)

    # 3. If the AI Agent triggers a split, update Razorpay settings automatically
    if ai_decision.get("action") == "SPLIT_PAYMENT":
        split_amount_paise = int(invoice["amount_paise"] / 2)

        updated_link_data = razorpay_client.payment_link.create(data={
            "amount": invoice["amount_paise"],
            "currency": "INR",
            "accept_partial": True,
            "first_min_partial_amount": split_amount_paise,
            "description": f"AI Approved Partial Plan for {invoice['customer_name']}",
            "customer": {
                "name": invoice["customer_name"],
                "email": invoice["customer_email"],
                "contact": invoice["customer_phone"]
            },
            "notify": {"sms": False, "email": True}
        })

        # Save the new split arrangement parameters
        db_update_invoice(req.invoice_id, {
            "payment_link_id": updated_link_data["id"],
            "payment_link_url": updated_link_data["short_url"],
            "status": "PARTIAL_ALLOWED"
        })

        return {
            "ai_message": ai_decision.get("reply", "Payment split plan authorized."),
            "new_link": updated_link_data["short_url"]
        }

    return {"ai_message": ai_decision.get("reply", "Full amount required."), "new_link": invoice["payment_link_url"]}


@app.post("/api/webhook/razorpay")
async def razorpay_webhook(request: Request):
    """Listens for Razorpay payment events and auto-updates invoice status."""
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    
    # 1. Verify webhook signature
    razorpay_signature = request.headers.get("X-Razorpay-Signature", "")
    body_bytes = await request.body()
    
    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        body_bytes,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected_signature, razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    
    # 2. Parse event payload
    payload = json.loads(body_bytes)
    event = payload.get("event", "")
    payment_link = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
    payment_link_id = payment_link.get("id")
    
    if not payment_link_id:
        return {"status": "ignored", "reason": "no payment_link id"}
    
    # 3. Map Razorpay event → our status
    status_map = {
        "payment_link.paid": "PAID",
        "payment_link.partially_paid": "PARTIAL",
        "payment_link.cancelled": "CANCELLED",
        "payment_link.expired": "EXPIRED",
    }
    
    new_status = status_map.get(event)
    if not new_status:
        return {"status": "ignored", "event": event}
    
    # 4. Update matching invoice row
    for inv in db_get_invoices():
        if inv.get("payment_link_id") == payment_link_id:
            db_update_invoice(inv["id"], {"status": new_status})
    
    return {"status": "ok", "event": event, "updated_to": new_status}
